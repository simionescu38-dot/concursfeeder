/**
 * Clasamentul de sezon leagă oamenii după COD, nu după nume.
 *
 * Un nume se scrie în trei feluri; un cod nu. Până acum sezonul strângea oamenii după
 * nume, iar unirea scrierilor se ținea într-un fișier scris de mână din depozit. De
 * când fiecare om are un cod dat o dată pe sezon, identitatea lui e codul.
 *
 * Două lucruri de care atârnă tot:
 *  - foile arhivate ÎNAINTE de coduri n-au niciunul, deci codul se caută în bază, după
 *    oricare dintre felurile în care i s-a scris numele. Baza le ține minte pe toate.
 *  - doi oameni de pe ACEEAȘI foaie care duc la același cod nu se topesc într-unul: ar
 *    face din doi pescari unul, tăcut. Acolo se rămâne după nume.
 *
 * Tot codul e scos VERBATIM din sezon.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("sezon.html");
const t = H.creeazaVerificator();

const FUNCTII = ["normKey", "nameOf", "incarcaAcelasiOm", "cheiaOmului", "numeleOmului",
  "aduCamerele", "incarcaBaza", "codulOmului", "numeleAfisat"];

/** o lume cu serverul prefăcut: camerele și baza sunt ce-i dăm noi */
function lume(optiuni) {
  const o = optiuni || {};
  const ctx = {
    console, JSON, Array, Promise, Date, parseInt, Object,
    encodeURIComponent,
    API_BASE: "https://api.test",
    cerute: [],
    faraCache(u) { return u + "?cb=1"; },
    fetch(u) {
      ctx.cerute.push(u);
      if (o.cade) return Promise.reject(new Error("fără net"));
      if (/\/api\/rooms/.test(u)) {
        return Promise.resolve({ json: () => Promise.resolve({ ok: true, rooms: o.camere || [] }) });
      }
      const m = /room=([^&]*)/.exec(u);
      const cam = m ? decodeURIComponent(m[1]) : "";
      const d = (o.baze || {})[cam];
      return Promise.resolve({ json: () => Promise.resolve(
        d ? { ok: true, data: d } : { ok: true, data: null }) });
    }
  };
  vm.createContext(ctx);
  vm.runInContext("var ACELASI = {};", ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  vm.runInContext("var _camere = null; var BAZA = {}; var BAZA_NUME = {};", ctx);
  return ctx;
}

/** forma pe care o scrie chiar aplicația în camera bazei */
const bazaCu = (oameni) => ({
  baza: true, name: "Baza de pescari · " + oameni.length,
  ultimulCod: oameni.length,
  pescari: oameni.map((x, i) => {
    const sp = x.nume.indexOf(" ");
    return { id: "b" + i, cod: x.cod, prenume: x.nume.slice(0, sp), nume: x.nume.slice(sp + 1),
             scrieri: x.scrieri || [] };
  })
});
const CAMERA = { code: "baza:feedermoldova", name: "Baza de pescari · 3" };
const LIVE = { code: "feedermoldova", name: "Cupa de septembrie" };

const incarca = c => new Promise(res => { c.gata = res;
  vm.runInContext("incarcaBaza().then(function(){ gata(); })", c); });
const cod = (c, nume, scris) => vm.runInContext(
  "codulOmului(" + JSON.stringify(scris === undefined ? {} : { cod: scris }) + "," + JSON.stringify(nume) + ")", c);
const afisat = (c, k, nm) => vm.runInContext("numeleAfisat(" + k + "," + JSON.stringify(nm) + ")", c);

(async () => {

/* ================================================================
   1. Codul scris pe foaie e cel dintâi
   ================================================================ */
console.log("\n=== 1. Codul de pe foaie ===");
{
  const c = lume({});
  t("codul scris la concurs se ia ca atare", cod(c, "Mihai Ionescu", 7), 7);
  t("fără cod și fără bază, zero", cod(c, "Mihai Ionescu"), 0);
  t("un cod stricat nu trece drept cod", cod(c, "Mihai Ionescu", "abc"), 0);
  t("nici zero, nici minus", cod(c, "Mihai Ionescu", 0), 0);
}

/* ================================================================
   2. Baza dă codul foilor vechi
   ================================================================ */
console.log("\n=== 2. Codul aflat din bază ===");
{
  const c = lume({
    camere: [LIVE, CAMERA],
    baze: { "baza:feedermoldova": bazaCu([
      { cod: 1, nume: "Dragoș Carâmb", scrieri: ["Ciufi Man", "Ciufy Man"] },
      { cod: 2, nume: "Mihai Ionescu" }
    ]) }
  });
  await incarca(c);
  t("după numele lui de acum", cod(c, "Dragoș Carâmb"), 1);
  t("după o scriere veche de pe foaie", cod(c, "Ciufi Man"), 1);
  t("…și după cealaltă", cod(c, "Ciufy Man"), 1);
  t("fără diacritice, tot el", cod(c, "DRAGOS CARAMB"), 1);
  t("cine nu-i în bază rămâne fără cod", cod(c, "Vasile Popescu"), 0);
  t("codul scris pe foaie bate baza", cod(c, "Ciufi Man", 9), 9);
  t("numele arătat e cel de acum, nu scrierea veche", afisat(c, 1, "Ciufi Man"), "Dragoș Carâmb");
  t("fără cod, se arată cum scrie pe foaie", afisat(c, 0, "Vasile Popescu"), "Vasile Popescu");
  t("s-a cerut o singură dată lista camerelor",
    c.cerute.filter(u => /\/api\/rooms/.test(u)).length, 1);
  t("…și s-a intrat doar în camera bazei",
    c.cerute.filter(u => /\/api\/state/.test(u)).map(u => decodeURIComponent(u.split("room=")[1])),
    ["baza:feedermoldova"]);
}

console.log("\n=== 2b. Când baza nu se poate citi ===");
{
  const fara = lume({ camere: [LIVE] });
  await incarca(fara);
  t("fără cameră de bază, nimic nu se strică", cod(fara, "Dragoș Carâmb"), 0);
  t("…și nu s-a cerut nicio stare", fara.cerute.filter(u => /\/api\/state/.test(u)).length, 0);

  const cade = lume({ cade: true });
  await incarca(cade);
  t("fără net, sezonul merge după nume", cod(cade, "Dragoș Carâmb"), 0);

  const goala = lume({ camere: [CAMERA], baze: {} });
  await incarca(goala);
  t("cameră fără bază scrisă în ea, la fel", cod(goala, "Dragoș Carâmb"), 0);
}

console.log("\n=== 2c. Ce nu intră în bază ===");
{
  const c = lume({
    camere: [CAMERA],
    baze: { "baza:feedermoldova": { baza: true, pescari: [
      { id: "x", cod: 0, prenume: "Fara", nume: "Cod" },
      { id: "y", cod: 3, prenume: "", nume: "" },
      { id: "z", cod: 4, prenume: "Ion", nume: "Popa", scrieri: ["", "  "] },
      { id: "w", cod: 5, prenume: "Alt", nume: "Om", scrieri: ["Ion Popa"] }
    ] } }
  });
  await incarca(c);
  t("un om fără cod nu intră", cod(c, "Fara Cod"), 0);
  t("un cod fără nume n-are ce lega", vm.runInContext("BAZA_NUME[3]||''", c), "");
  t("scrierile goale nu se pun", cod(c, "Ion Popa"), 4);
  t("prima scriere care aduce codul rămâne stăpână", cod(c, "Ion Popa"), 4);
  t("…iar celălalt își păstrează numele lui", cod(c, "Alt Om"), 5);
}

/* ================================================================
   3. Sezonul strâns pe cod, cu datele adevărate
   ------------------------------------------------------------------
   Aici se vede plata: același om, scris în două feluri pe două foi vechi, iese cu un
   singur rând și două concursuri — fără să se atingă nimeni de arhive.
   ================================================================ */
console.log("\n=== 3. Legarea în clasament ===");
const SEZON = ["normKey", "nameOf", "cheiaOmului", "numeleOmului", "codulOmului", "numeleAfisat",
  "mOf", "catchesSum", "extrasSum", "extrasMax", "totalKg", "bestFish", "placesOfComp",
  "pragSezon", "semnatura", "cheiaLocatiei", "faraDubluri", "numeConcurs", "loadSeason",
  "incarcaAcelasiOm", "aduCamerele", "incarcaBaza"];

/** loadSeason rulat pe surse date de noi: concursurile intră ca „arhive de fișier" */
function sezon(optiuni) {
  const o = optiuni || {};
  const ctx = {
    console, JSON, Array, Promise, Date, parseInt, parseFloat, isNaN, Math, Object, String,
    encodeURIComponent, Error,
    API_BASE: "https://api.test",
    faraCache(u) { return u; },
    fetch() { return Promise.reject(new Error("nefolosit")); }
  };
  vm.createContext(ctx);
  vm.runInContext("var ACELASI = {}; var _camere = null; var BAZA = {}; var BAZA_NUME = {};", ctx);
  SEZON.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  /* sursele și baza se pun de-a gata: proba e despre strângere, nu despre drumuri */
  ctx.SURSE = o.surse || [];
  vm.runInContext("incarcaAcelasiOm=function(){return Promise.resolve();};" +
    "incarcaBaza=function(){return Promise.resolve();};" +
    "fetchLiveSources=function(){return Promise.resolve([]);};" +
    "fetchArchiveSources=function(){return Promise.resolve(SURSE);};", ctx);
  (o.baza || []).forEach(x => {
    vm.runInContext("BAZA_NUME[" + x.cod + "]=" + JSON.stringify(x.nume) + ";", ctx);
    [x.nume].concat(x.scrieri || []).forEach(sc => {
      vm.runInContext("BAZA[normKey(" + JSON.stringify(sc) + ")]=" + x.cod + ";", ctx);
    });
  });
  return ctx;
}
/** un concurs: fiecare om e „Nume kg" sau {nume, kg, cod} */
const concurs = (nume, zi, oameni) => ({
  compName: nume, compDate: Date.parse(zi), startAt: zi, updatedAt: Date.parse(zi),
  balta: "Remus Lake", code: "arhiva:" + nume,
  parts: oameni.map((x, i) => ({
    id: nume + "-" + i, prenume: x.nume.split(" ")[0], nume: x.nume.split(" ").slice(1).join(" "),
    cod: x.cod === undefined ? "" : x.cod, stand: String(i + 1),
    m: { 1: { catches: [x.kg], extras: [], stand: String(i + 1), sector: "A" } }
  }))
});
const cere = c => new Promise(res => { c.gata = res;
  vm.runInContext("loadSeason().then(function(s){ gata(s); })", c); });

{
  /* Două foi vechi, fără coduri, cu numele scris altfel de fiecare dată. Baza le știe
     pe amândouă. */
  const c = sezon({
    baza: [{ cod: 1, nume: "Dragoș Carâmb", scrieri: ["Ciufi Man", "Ciufy Man"] }],
    surse: [
      concurs("Etapa 1", "2026-07-05T05:00:00.000Z", [{ nume: "Ciufi Man", kg: 8 }, { nume: "Mihai Ionescu", kg: 6 }]),
      concurs("Etapa 2", "2026-07-19T05:00:00.000Z", [{ nume: "Ciufy Man", kg: 7 }, { nume: "Mihai Ionescu", kg: 9 }])
    ]
  });
  const s = await cere(c);
  const dupaNume = {};
  s.list.forEach(r => { dupaNume[r.name] = r; });
  t("două rânduri, nu trei", s.list.length, 2);
  t("omul scris în două feluri e unul singur",
    (dupaNume["Dragoș Carâmb"] || {}).competitions, 2);
  t("…cu kilogramele adunate", (dupaNume["Dragoș Carâmb"] || {}).totalKg, 15);
  t("…și sub numele lui de acum", Object.keys(dupaNume).sort(), ["Dragoș Carâmb", "Mihai Ionescu"]);
  t("nu se face niciun rând «Ciufi Man»", dupaNume["Ciufi Man"], undefined);
  t("pragul de participări nu-l mai lasă neclasat", (dupaNume["Dragoș Carâmb"] || {}).clasat, true);
}

console.log("\n=== 3b. Codul de pe foaia nouă merge cu al bazei ===");
{
  /* La etapa a treia aplicația a pus codul pe rând. Trebuie să cadă peste același om. */
  const c = sezon({
    baza: [{ cod: 1, nume: "Dragoș Carâmb", scrieri: ["Ciufi Man"] }],
    surse: [
      concurs("Etapa 1", "2026-07-05T05:00:00.000Z", [{ nume: "Ciufi Man", kg: 8 }]),
      concurs("Etapa 3", "2026-08-02T05:00:00.000Z", [{ nume: "Dragos Caramb", kg: 4, cod: 1 }])
    ]
  });
  const s = await cere(c);
  t("un singur om", s.list.length, 1);
  t("cu amândouă etapele", s.list[0].competitions, 2);
  t("numele arătat e cel din bază", s.list[0].name, "Dragoș Carâmb");
}

console.log("\n=== 3c. Doi oameni pe aceeași foaie nu se topesc într-unul ===");
{
  /* „Dragoș Carâmb" și „Ciufi Man" pe aceeași listă: ori s-a scris greșit, ori scrierea
     s-a lipit de omul celălalt. Nu se poate ști. Doi rămân doi. */
  const c = sezon({
    baza: [{ cod: 1, nume: "Dragoș Carâmb", scrieri: ["Ciufi Man"] }],
    surse: [concurs("Etapa 1", "2026-07-05T05:00:00.000Z",
      [{ nume: "Dragoș Carâmb", kg: 8 }, { nume: "Ciufi Man", kg: 6 }])]
  });
  const s = await cere(c);
  t("rămân doi pescari", s.list.length, 2);
  t("fiecare cu concursul lui", s.list.map(r => r.competitions), [1, 1]);
  t("…și cu kilogramele lui", s.list.map(r => r.totalKg).sort((a, b) => a - b), [6, 8]);
}

console.log("\n=== 3d. Doi oameni cu același nume, coduri diferite ===");
{
  /* Greșeala cealaltă, pe care numele n-o putea prinde niciodată: doi „Ion Popa" adevărați.
     După nume erau un om cu patru concursuri; după cod sunt doi, cu câte două. */
  const c = sezon({
    baza: [{ cod: 4, nume: "Ion Popa" }, { cod: 5, nume: "Ion Popa" }],
    surse: [
      concurs("Etapa 1", "2026-07-05T05:00:00.000Z",
        [{ nume: "Ion Popa", kg: 8, cod: 4 }, { nume: "Ion Popa", kg: 3, cod: 5 }]),
      concurs("Etapa 2", "2026-07-19T05:00:00.000Z",
        [{ nume: "Ion Popa", kg: 6, cod: 4 }, { nume: "Ion Popa", kg: 2, cod: 5 }])
    ]
  });
  const s = await cere(c);
  t("sunt doi oameni, nu unul", s.list.length, 2);
  t("fiecare cu două concursuri", s.list.map(r => r.competitions), [2, 2]);
  t("kilogramele nu s-au amestecat",
    s.list.map(r => r.totalKg).sort((a, b) => a - b), [5, 14]);
}

console.log("\n=== 3e. Fără bază și fără coduri, sezonul e cel de până acum ===");
{
  const c = sezon({
    surse: [
      concurs("Etapa 1", "2026-07-05T05:00:00.000Z", [{ nume: "Mihai Ionescu", kg: 8 }]),
      concurs("Etapa 2", "2026-07-19T05:00:00.000Z", [{ nume: "Mihai Ionescu", kg: 6 }])
    ]
  });
  const s = await cere(c);
  t("numele leagă mai departe", s.list.length, 1);
  t("…cu amândouă etapele", s.list[0].competitions, 2);
  t("…și cu kilogramele adunate", s.list[0].totalKg, 14);
}

console.log("\n=== 3f. Cel mai mare pește al sezonului poartă numele bun ===");
{
  const c = sezon({
    baza: [{ cod: 1, nume: "Dragoș Carâmb", scrieri: ["Ciufi Man"] }],
    surse: [{
      compName: "Etapa 1", compDate: Date.parse("2026-07-05T05:00:00.000Z"),
      startAt: "2026-07-05T05:00:00.000Z", updatedAt: 1, balta: "Remus Lake", code: "arhiva:1",
      parts: [{ id: "a", prenume: "Ciufi", nume: "Man", stand: "1",
                m: { 1: { catches: [4], extras: [3.2], stand: "1", sector: "A" } } }]
    }]
  });
  const s = await cere(c);
  t("peștele e găsit", s.seasonFish.v, 3.2);
  t("…pe numele lui de acum", s.seasonFish.name, "Dragoș Carâmb");
  t("și în podiumul concursului la fel", s.comps[0].top3[0].name, "Dragoș Carâmb");
}

/* ================================================================
   4. Fișierul scris de mână rămâne a doua linie
   ================================================================ */
console.log("\n=== 4. Lista scrisă de mână n-a fost aruncată ===");
{
  /* Baza stă pe server; la baltă nu e mereu semnal. Când baza nu se poate citi,
     arhiva/acelasi-om.json ține sezonul întreg, ca până acum. */
  const c = sezon({
    surse: [
      concurs("Etapa 1", "2026-07-05T05:00:00.000Z", [{ nume: "Ciufi Man", kg: 8 }]),
      concurs("Etapa 2", "2026-07-19T05:00:00.000Z", [{ nume: "Ciufy Man", kg: 6 }])
    ]
  });
  vm.runInContext("ACELASI[normKey('Ciufi Man')]={cheie:normKey('Dragoș Carâmb'),nume:'Dragoș Carâmb'};" +
    "ACELASI[normKey('Ciufy Man')]={cheie:normKey('Dragoș Carâmb'),nume:'Dragoș Carâmb'};", c);
  const s = await cere(c);
  t("fără bază, lista de mână leagă tot", s.list.length, 1);
  t("…cu amândouă etapele", s.list[0].competitions, 2);
  t("fișierul e tot citit la pornire",
    /await incarcaAcelasiOm\(\);\s*\n\s*await incarcaBaza\(\);/.test(H.grabFunction(src, "loadSeason")), true);
  t("fișierul e tot în depozit", H.citeste("arhiva/acelasi-om.json").indexOf("acelasi") > 0, true);
}

t.raport();

})();
