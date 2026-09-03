/**
 * Două paze mici, amândouă la răscruci.
 *
 * 1. Un concurs care pleacă în arhivă FĂRĂ coduri se leagă înapoi de sezon după nume —
 *    adică tocmai greșeala pe care baza a venit s-o repare. Iar arhivele nu se modifică:
 *    ce a plecat fără coduri rămâne așa. Deci se întreabă o dată, la ultima răscruce.
 *
 * 2. Worker-ul din Cloudflare nu vine din depozit, se lipește de mână. Dacă se
 *    desincronizează, nimic nu bagă de seamă până nu se strică ceva la baltă. Un buton
 *    încearcă fiecare drum și spune ce răspunde — fără să scrie nimic.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

/* ================================================================
   1. Semnul când n-ai pus codurile
   ================================================================ */
function lumeCoduri(optiuni) {
  const o = optiuni || {};
  const ctx = {
    console, JSON, Array, String, parseInt, isNaN,
    intrebat: [], raspuns: o.confirma !== false,
    confirm(q) { ctx.intrebat.push(q); return ctx.raspuns; },
    state: { participants: o.concurs || [] }
  };
  vm.createContext(ctx);
  vm.runInContext("var pescari=" + JSON.stringify(
    Array.from({ length: o.inBaza || 0 }, (_, i) => ({ id: "b" + i, cod: i + 1 }))) + ";", ctx);
  ["codParticipant", "ceriCoduri"].forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  return ctx;
}
const om = cod => ({ id: "p" + Math.random(), prenume: "Om", nume: "x", cod: cod === undefined ? "" : cod });
const cere = c => vm.runInContext("ceriCoduri()", c);

console.log("\n=== 1. Când întreabă și când nu ===");
{
  /* cazul care doare: baza plină, concursul fără niciun cod */
  const c = lumeCoduri({ inBaza: 101, concurs: [om(), om(), om()] });
  t("întreabă", cere(c), true);
  t("…o singură dată", c.intrebat.length, 1);
  t("spune câți sunt fără cod", /Niciunul dintre cei 3 pescari n-are cod/.test(c.intrebat[0]), true);
  t("…și câți are în bază", /în bază ai 101/.test(c.intrebat[0]), true);
  t("spune ce se pierde", /se leagă de sezon după nume/.test(c.intrebat[0]), true);
  t("…și că nu se mai poate drege", /Odată arhivată, nu se mai poate drege/.test(c.intrebat[0]), true);
  t("spune ce face fiecare buton",
    /Anulează = ies, ca să apăs «Pune codurile»[\s\S]*OK = arhivez și așa/.test(c.intrebat[0]), true);
}

console.log("\n=== 1b. Când NU are ce spune ===");
{
  const totiCuCod = lumeCoduri({ inBaza: 101, concurs: [om(1), om(2), om(3)] });
  t("toți au cod — tace", cere(totiCuCod), true);
  t("…fără nicio întrebare", totiCuCod.intrebat.length, 0);

  /* Măcar unul cu cod înseamnă că butonul a fost apăsat; restul sunt oameni din afara
     bazei, și n-au de unde lua cod. A insista ar fi o alarmă falsă la fiecare etapă. */
  const unul = lumeCoduri({ inBaza: 101, concurs: [om(7), om(), om()] });
  t("unul singur cu cod e destul — tace", cere(unul), true);
  t("…tot fără întrebare", unul.intrebat.length, 0);

  const bazaGoala = lumeCoduri({ inBaza: 0, concurs: [om(), om()] });
  t("cu baza goală n-are de unde lua coduri — tace", cere(bazaGoala), true);
  t("…fără întrebare", bazaGoala.intrebat.length, 0);

  const fara = lumeCoduri({ inBaza: 101, concurs: [] });
  t("concurs gol — tace", cere(fara), true);
}

console.log("\n=== 1c. Coduri stricate nu trec drept coduri ===");
{
  const stricate = lumeCoduri({ inBaza: 10, concurs: [om("abc"), om(0), om("  ")] });
  t("«abc», zero și golul nu sunt coduri — se întreabă", cere(stricate), true);
  t("…o dată", stricate.intrebat.length, 1);
}

console.log("\n=== 1d. Răspunsul omului se respectă ===");
{
  const nu = lumeCoduri({ inBaza: 101, concurs: [om(), om()], confirma: false });
  t("dacă zice Anulează, arhivarea se oprește", cere(nu), false);
  const da = lumeCoduri({ inBaza: 101, concurs: [om(), om()] });
  t("dacă zice OK, merge înainte", cere(da), true);
}

console.log("\n=== 1e. Stă la amândouă răscrucile ===");
{
  const sfarsit = H.grabFunction(src, "amTerminatConcursul");
  t("la butonul de sfârșit de concurs", /if\(!ceriCoduri\(\)\) return;/.test(sfarsit), true);
  t("…înainte de a cere balta",
    sfarsit.indexOf("ceriCoduri()") < sfarsit.indexOf("ceriBalta()"), true);

  const wipe = H.grabFunction(src, "wipe");
  t("și la Reset, care arhivează înainte de a șterge", /if\(!ceriCoduri\(\)\) return;/.test(wipe), true);
  t("…doar când chiar se arhivează",
    /if\(willArchive\)\{[\s\S]*ceriCoduri\(\)[\s\S]*\}/.test(wipe), true);
  /* La Reset, confirmarea lui proprie vine DUPĂ: altfel ar ieși două ferestre una peste
     alta, greșeala pe care au dres-o deja o dată cu balta. */
  t("…înaintea confirmării de ștergere",
    wipe.indexOf("ceriCoduri()") < wipe.indexOf("if(!confirm(msg)) return;"), true);
}

/* ================================================================
   2. Butonul care spune dacă serverul e întreg
   ================================================================ */
function lumeServer(optiuni) {
  const o = optiuni || {};
  const elemente = {};
  const ctx = {
    console, JSON, Date, Array, Promise, Object, String,
    encodeURIComponent,
    API_BASE: "https://api.test",
    syncRoom: o.camera === undefined ? "feedermoldova" : o.camera,
    cerute: [], metode: [],
    esc: s2 => String(s2 == null ? "" : s2).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])),
    document: { getElementById: id => (elemente[id] = elemente[id] || { innerHTML: "" }) },
    __el: elemente,
    fetch(url, opt) {
      ctx.cerute.push(url);
      ctx.metode.push((opt && opt.method) || "GET");
      const r = (o.raspunsuri || {});
      const cheie = Object.keys(r).find(k => url.indexOf(k) >= 0);
      const v = cheie ? r[cheie] : { ok: true, rooms: [], archives: [], events: [], versions: [], acelasi: [] };
      if (v === "cade") return Promise.reject(new Error("fără net"));
      if (v === "404") return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(v) });
    }
  };
  vm.createContext(ctx);
  ["probaServer", "verificaServerul"].forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  return ctx;
}
const verifica = c => new Promise(res => {
  vm.runInContext("verificaServerul();", c);
  setTimeout(res, 20);
});
const html = c => c.__el["server-proba"].innerHTML;

(async () => {

console.log("\n=== 2. Ce încearcă ===");
{
  const c = lumeServer({});
  await verifica(c);
  const drumuri = c.cerute.map(u => u.replace("https://api.test", "").split("?")[0]);
  t("încearcă toate drumurile de care are nevoie aplicația", drumuri.sort(),
    ["/api/archive", "/api/events", "/api/history", "/api/rooms", "/api/state", "arhiva/acelasi-om.json"]);
  /* O probă care lasă urme pe server ar putea strica tocmai ce verifică. */
  t("nu scrie nicăieri", c.metode.filter(m => m !== "GET"), []);
  t("toate răspund", (html(c).match(/✅/g) || []).length, 6);
  t("…și se spune limpede", /Serverul răspunde la tot ce-i trebuie aplicației\./.test(html(c)), true);
  t("se arată și adresa serverului", /https:\/\/api\.test/.test(html(c)), true);
}

console.log("\n=== 2b. Când unul nu răspunde ===");
{
  const c = lumeServer({ raspunsuri: { "/api/history": "cade" } });
  await verifica(c);
  t("celelalte tot merg", (html(c).match(/✅/g) || []).length, 5);
  t("cel picat e arătat", (html(c).match(/❌/g) || []).length, 1);
  t("…pe numele lui", /Versiunile camerei[\s\S]*nu răspunde/.test(html(c)), true);
  t("se spune câte-s", /<b>1<\/b> drum nu răspunde/.test(html(c)), true);
  t("…și unde să se uite", /worker-ul de pe Cloudflare are nevoie de lipirea cea nouă/.test(html(c)), true);
}

console.log("\n=== 2c. Feluri de a nu merge ===");
{
  const patruSuteZero = lumeServer({ raspunsuri: { "/api/events": "404" } });
  await verifica(patruSuteZero);
  t("un drum care nu există spune ce a răspuns", /răspunde 404/.test(html(patruSuteZero)), true);

  const altceva = lumeServer({ raspunsuri: { "/api/rooms": { ok: false, error: "boom" } } });
  await verifica(altceva);
  t("un răspuns care nu e ce trebuie se vede",
    /Lista camerelor[\s\S]*răspunde, dar nu ce trebuie/.test(html(altceva)), true);

  const totul = lumeServer({ raspunsuri: {
    "/api": "cade", "arhiva/": "cade" } });
  await verifica(totul);
  t("când pică tot, se spune că poate fi semnalul",
    /Dacă sunt toate, e semnalul sau serverul e oprit/.test(html(totul)), true);
}

console.log("\n=== 2d. Fără cod de cameră ===");
{
  const c = lumeServer({ camera: "" });
  await verifica(c);
  const drumuri = c.cerute.map(u => u.replace("https://api.test", "").split("?")[0]);
  t("camera și versiunile ei nu se încearcă", drumuri.indexOf("/api/state"), -1);
  t("…dar restul, da", drumuri.length, 4);
  t("și i se spune de ce", /N-ai cod de cameră pe telefonul ăsta/.test(html(c)), true);
}

console.log("\n=== 2e. Ecranul ===");
{
  const ecran = src.slice(src.indexOf("plianteaza('pliant-necaz')"), src.indexOf('id="view-strat"'));
  t("butonul stă strâns în pliantul «Când ceva nu merge»",
    /onclick="verificaServerul\(\)"/.test(ecran), true);
  t("butonul spune ce face", /Verifică serverul<\/button>/.test(ecran), true);
  t("e ghost, nu scos în față", /btn btn-ghost" onclick="verificaServerul/.test(ecran), true);
  t("are unde să scrie ce a găsit", /id="server-proba"/.test(ecran), true);
  /* Se poate apăsa și cu lacătul pus: nu umblă la nimic, doar întreabă serverul. */
  t("nu se ascunde la lacăt", /<div class="card">\s*\r?\n\s*<div class="sec-title">Serverul răspunde\?/.test(ecran), true);
  t("se spune că nu schimbă nimic", /Nu scrie și nu schimbă nimic — doar se uită\./.test(ecran), true);
}

t.raport();

})();
