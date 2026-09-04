/**
 * Baza de pescari, ținută și pe server.
 *
 * Baza stă în camera ei, numită „baza:<camera ta>". Pentru server e o cameră ca oricare
 * alta — deci capătă pe gratis tot ce are o cameră: numărătoare de versiuni și ultimele
 * 40 de variante păstrate. Worker-ul nu se atinge deloc.
 *
 * Iar fiindcă n-are participanți, nu apare nicăieri drept concurs live: peste tot unde se
 * caută concursuri se cere ca o cameră să aibă oameni în ea. Singura listă care nu cerea
 * asta e cea publică din concursuri.html — acolo se sare peste camerele bazei, după nume.
 *
 * Lucrul de care atârnă tot: când serverul s-a mișcat de când l-am văzut ultima oară, NU
 * se pune peste. Se adună întâi cine e acolo și lipsește aici — altfel omul adăugat pe
 * telefonul celuilalt organizator s-ar pierde.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = ["uid", "faraSemne", "cheiePescar", "cheieCuvinte", "scrierileLui", "tineMinteScrierea", "numePescar", "pescarCodNou", "pescarNou",
  "bazaDinFisier", "potrivesteBaza", "cameraBazei", "bazaPoateLaServer", "bazaIncarcaRev",
  "bazaSalveazaRev", "bazaStare", "improspateazaStareaBazei", "bazaScrieLocal",
  "bazaAdunaDe", "bazaSpreServer", "trimiteBaza", "aduBazaDeLaServer", "pescariSalveaza"];

/** o lume cu un server prefăcut: se vede fiecare cerere care pleacă */
function lume(optiuni) {
  const o = optiuni || {};
  const memorie = Object.assign({}, o.memorie || {});
  const elemente = {};
  const ctx = {
    console, JSON, Date, Math, parseInt, isNaN, Array, String, Object, Promise,
    encodeURIComponent,
    API_BASE: "https://api.test",
    syncRoom: o.camera === undefined ? "feedermoldova" : o.camera,
    syncKey: o.cheie === undefined ? "cheia-mea" : o.cheie,
    blocat: !!o.blocat, intrebat: [], raspuns: o.confirma !== false,
    toasturi: [], desenat: 0, cereri: [], amanate: [],
    guard() { return ctx.blocat; },
    confirm(q) { ctx.intrebat.push(q); return ctx.raspuns; },
    toast(m) { ctx.toasturi.push(m); },
    renderPescari() { ctx.desenat++; },
    /* amânarea nu se măsoară în timp aici: se ține deoparte și se dă drumul din test */
    setTimeout(fn) { ctx.amanate.push(fn); return ctx.amanate.length; },
    clearTimeout() { ctx.amanate.pop(); },
    localStorage: {
      getItem: k => (k in memorie ? memorie[k] : null),
      setItem: (k, v) => { memorie[k] = v; }
    },
    memorie,
    document: { getElementById: id => (elemente[id] = elemente[id] || { textContent: "", style: {} }) },
    __el: elemente,
    fetch(url, opt) {
      ctx.cereri.push({
        url, metoda: (opt && opt.method) || "GET",
        cheie: opt && opt.headers && opt.headers["x-write-key"],
        corp: opt && opt.body ? JSON.parse(opt.body) : null
      });
      const r = ctx.raspunsuri.shift();
      if (r === "cade") return Promise.reject(new Error("fără net"));
      return Promise.resolve({ json: () => Promise.resolve(r) });
    },
    raspunsuri: (o.raspunsuri || []).slice()
  };
  vm.createContext(ctx);
  vm.runInContext('var PESCARI_KEY="concurs-pescari-v1"; var pescari=[]; var pescariUltimCod=0;', ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  vm.runInContext('var BAZA_PREFIX="baza:"; var BAZA_REV_KEY="concurs-baza-rev";' +
                  " var bazaRevCunoscut=0; var bazaT=null;", ctx);
  vm.runInContext("bazaIncarcaRev();", ctx);
  (o.baza || []).forEach(nm => {
    const sp = nm.indexOf(" ");
    vm.runInContext("pescari.push(pescarNou(" + JSON.stringify(nm.slice(0, sp)) + "," +
                    JSON.stringify(nm.slice(sp + 1)) + "))", ctx);
  });
  if (o.revStiut !== undefined) vm.runInContext("bazaSalveazaRev(" + o.revStiut + ");", ctx);
  return ctx;
}

const baza = ctx => vm.runInContext("pescari.map(function(p){ return p.cod+':'+numePescar(p); })", ctx);
const rev = ctx => vm.runInContext("bazaRevCunoscut", ctx);
const stare = ctx => ctx.__el["baza-stare"].textContent;
/** forma pe care o scrie chiar aplicația pe server */
const peServer = (oameni, ultimulCod) => ({
  baza: true, name: "Baza de pescari · " + oameni.length,
  ultimulCod: ultimulCod === undefined ? oameni.length : ultimulCod,
  pescari: oameni.map(x => {
    const sp = x.nume.indexOf(" ");
    return { id: "s" + x.cod, cod: x.cod, prenume: x.nume.slice(0, sp), nume: x.nume.slice(sp + 1) };
  })
});
/** lasă promisiunile din cod să se scurgă */
const linisteste = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

(async () => {

/* ================================================================
   1. Camera bazei
   ================================================================ */
console.log("\n=== 1. Unde stă baza pe server ===");
{
  const c = lume({});
  t("camera bazei e a camerei tale, cu prefix", vm.runInContext("cameraBazei()", c), "baza:feedermoldova");
  t("se poate salva", vm.runInContext("bazaPoateLaServer()", c), true);
  t("fără cameră, nu se poate", vm.runInContext("bazaPoateLaServer()", lume({ camera: "" })), false);
  t("fără cheie de scriere, nu se poate", vm.runInContext("bazaPoateLaServer()", lume({ cheie: "" })), false);
  t("fără cameră, nici nume de cameră nu iese", vm.runInContext("cameraBazei()", lume({ camera: "" })), "");
}

console.log("\n=== 1b. Camera bazei nu poate fi luată drept concurs ===");
{
  /* Peste tot unde aplicația caută concursuri live cere ca o cameră să aibă oameni în
     ea. Baza n-are „participants", deci nu apare. */
  t("camerele live cer participanți",
    /st && st\.ok && st\.data && \(st\.data\.participants\|\|\[\]\)\.length>0/.test(src), true);
  t("Acasă cere și el participanți",
    /res\.data && \(res\.data\.participants\|\|\[\]\)\.length && !concursTerminat/.test(src), true);
  t("sezonul sare peste camerele fără oameni",
    /if\(!parts\.length\) return;/.test(H.citeste("sezon.html")), true);

  /* Lista publică nu citește starea camerelor, deci nu poate cere participanți: acolo
     se sare după nume, înainte de a desena ceva. */
  const conc = H.citeste("concursuri.html");
  t("lista publică sare peste camerele bazei", /r\.code\.indexOf\("baza:"\)!==0/.test(conc), true);
  t("…înainte de a le desena",
    conc.indexOf('indexOf("baza:")') < conc.indexOf("el.innerHTML = rooms.map"), true);
}

/* ================================================================
   2. Trimiterea
   ================================================================ */
console.log("\n=== 2. Ce pleacă spre server ===");
{
  const c = lume({ baza: ["Mihai Ionescu", "Vasile Popescu"],
                   raspunsuri: [{ ok: true, rev: 0, data: null }, { ok: true, rev: 1 }] });
  vm.runInContext("trimiteBaza();", c);
  await linisteste();

  t("întâi se citește ce e pe server", c.cereri[0].metoda, "GET");
  t("…din camera bazei", c.cereri[0].url, "https://api.test/api/state?room=baza%3Afeedermoldova");
  t("apoi se scrie", c.cereri[1].metoda, "PUT");
  t("…cu cheia de scriere", c.cereri[1].cheie, "cheia-mea");
  t("…în aceeași cameră", c.cereri[1].url, "https://api.test/api/state?room=baza%3Afeedermoldova");

  const d = c.cereri[1].corp.data;
  t("pleacă semnul că e o bază, nu un concurs", d.baza, true);
  t("pleacă oamenii", d.pescari.map(p => p.cod + ":" + (p.prenume + " " + p.nume).trim()),
    ["1:Mihai Ionescu", "2:Vasile Popescu"]);
  t("pleacă și numărătoarea codurilor", d.ultimulCod, 2);
  t("numele camerei spune câți sunt", d.name, "Baza de pescari · 2");
  /* Fără „participants", nicio listă de concursuri live n-o poate lua drept concurs. */
  t("NU pleacă niciun participant", d.participants, undefined);

  t("revizia se ține minte", rev(c), 1);
  t("…și pe telefon, pentru data viitoare", c.memorie["concurs-baza-rev"], "1");
  t("se spune unde a ajuns", stare(c),
    "Pe server, în camera baza:feedermoldova · versiunea 1. Pleacă singură la fiecare schimbare.");
}

console.log("\n=== 2b. Fără cameră sau fără cheie, nu se încearcă ===");
{
  const c = lume({ camera: "", baza: ["Mihai Ionescu"] });
  vm.runInContext("trimiteBaza();", c);
  await linisteste();
  t("nu pleacă nicio cerere", c.cereri.length, 0);
}

console.log("\n=== 2c. Trimiterea se amână, ca zece adăugări să facă o cerere ===");
{
  const c = lume({ baza: [], raspunsuri: [{ ok: true, rev: 0, data: null }, { ok: true, rev: 1 }] });
  vm.runInContext("bazaSpreServer(); bazaSpreServer(); bazaSpreServer();", c);
  t("nimic n-a plecat încă", c.cereri.length, 0);
  t("…și a rămas o singură amânare", c.amanate.length, 1);
  vm.runInContext("(" + "0" + ");", c);
  c.amanate[0]();
  await linisteste();
  t("după amânare pleacă o singură dată", c.cereri.filter(x => x.metoda === "PUT").length, 1);
}

console.log("\n=== 2d. Orice schimbare a bazei o trimite ===");
{
  /* pescariSalveaza e singurul loc prin care trece orice schimbare — acolo se agață. */
  const ps = H.grabFunction(src, "pescariSalveaza");
  t("salvarea locală cheamă trimiterea", /bazaSpreServer\(\);/.test(ps), true);
  t("…dar DUPĂ ce a scris pe telefon",
    ps.indexOf("localStorage.setItem") < ps.indexOf("bazaSpreServer"), true);
  t("…și o pică de rețea nu strică salvarea locală",
    /try\{ bazaSpreServer\(\); \}catch\(e\)\{\}/.test(ps), true);
}

/* ================================================================
   3. Când a scris altcineva între timp
   ------------------------------------------------------------------
   Asta e partea de care atârnă tot. Doi organizatori, aceeași cameră: cel care
   salvează al doilea nu are voie să-l șteargă pe omul adăugat de primul.
   ================================================================ */
console.log("\n=== 3. Serverul s-a mișcat de când l-am văzut ===");
{
  const c = lume({
    baza: ["Mihai Ionescu"], revStiut: 1,
    raspunsuri: [
      /* pe server e revizia 2: altcineva a adăugat pe Ion Țăranu, cu codul 7 */
      { ok: true, rev: 2, data: peServer([{ cod: 7, nume: "Ion Țăranu" }], 7) },
      { ok: true, rev: 3 }
    ]
  });
  vm.runInContext("trimiteBaza();", c);
  await linisteste();

  t("omul celuilalt telefon a intrat aici", baza(c), ["1:Mihai Ionescu", "7:Ion Țăranu"]);
  t("…cu codul lui de acolo", baza(c)[1].split(":")[0], "7");
  t("i se spune omului", c.toasturi[0], "1 pescar adus de pe server");
  t("s-a redesenat lista", c.desenat > 0, true);

  const d = c.cereri[1].corp.data;
  t("înapoi pleacă amândoi, nu doar ai mei",
    d.pescari.map(p => p.cod), [1, 7]);
  t("numărătoarea a urcat la cel mai mare cod", d.ultimulCod, 7);
  t("revizia nouă se ține minte", rev(c), 3);
}

console.log("\n=== 3b. Când reviziile se potrivesc, telefonul are ultimul cuvânt ===");
{
  /* Asta e ce face scoaterea cuiva din bază să chiar rămână scoasă: dacă serverul n-a
     fost atins de nimeni de când l-am văzut, ce e pe telefon se pune ca atare. */
  const c = lume({
    baza: ["Mihai Ionescu"], revStiut: 2,
    raspunsuri: [{ ok: true, rev: 2, data: peServer([{ cod: 1, nume: "Mihai Ionescu" },
                                                     { cod: 2, nume: "Scos Dinbaza" }], 2) },
                 { ok: true, rev: 3 }]
  });
  vm.runInContext("trimiteBaza();", c);
  await linisteste();
  t("cel scos nu se întoarce", baza(c), ["1:Mihai Ionescu"]);
  t("…și nici nu pleacă înapoi pe server", c.cereri[1].corp.data.pescari.length, 1);
}

console.log("\n=== 3c. Ce nu se poate aduna se spune, nu se pune peste ===");
{
  /* Pe server, codul 1 e la altcineva. Nu se pune peste (ar fi doi cu același cod) și
     nu i se dă altul (n-ar mai fi codul lui de la etapele trecute). */
  const c = lume({
    baza: ["Mihai Ionescu"], revStiut: 1,
    raspunsuri: [{ ok: true, rev: 2, data: peServer([{ cod: 1, nume: "Ion Țăranu" }], 1) },
                 { ok: true, rev: 3 }]
  });
  vm.runInContext("trimiteBaza();", c);
  await linisteste();
  t("nu intră peste codul luat", baza(c), ["1:Mihai Ionescu"]);
  t("…și nu se strigă degeaba un pescar adus", c.toasturi, []);
}

/* ================================================================
   4. Adusul de mână
   ================================================================ */
console.log("\n=== 4. Adusul de mână, cu butonul ===");
{
  const c = lume({
    baza: ["Mihai Ionescu"],
    raspunsuri: [{ ok: true, rev: 5, data: peServer([{ cod: 1, nume: "Mihai Ionescu" },
                                                     { cod: 4, nume: "Ion Țăranu" },
                                                     { cod: 9, nume: "Radu Georgescu" }], 12) }]
  });
  vm.runInContext("aduBazaDeLaServer();", c);
  await linisteste();
  t("s-a citit o singură dată", c.cereri.length, 1);
  t("…și nu s-a scris nimic", c.cereri.filter(x => x.metoda === "PUT").length, 0);
  t("au venit cei care lipseau", baza(c), ["1:Mihai Ionescu", "4:Ion Țăranu", "9:Radu Georgescu"]);
  t("numărătoarea vine de pe server", vm.runInContext("pescarCodNou()", c), 13);
  t("s-a întrebat întâi", /Aduci 2 pescari de pe server, cu codurile lor\?/.test(c.intrebat[0]), true);
  t("…și s-a spus cine era deja", /1 sunt deja în bază — nu-i ating\./.test(c.intrebat[0]), true);
  t("revizia se ține minte", rev(c), 5);
}

console.log("\n=== 4b. Cu «nu», nu se schimbă nimic ===");
{
  const c = lume({ baza: ["Mihai Ionescu"], confirma: false,
                   raspunsuri: [{ ok: true, rev: 5, data: peServer([{ cod: 4, nume: "Ion Țăranu" }], 4) }] });
  vm.runInContext("aduBazaDeLaServer();", c);
  await linisteste();
  t("baza a rămas cum era", baza(c), ["1:Mihai Ionescu"]);
}

console.log("\n=== 4c. Pe server încă nu e nimic ===");
{
  const c = lume({ baza: ["Mihai Ionescu"], raspunsuri: [{ ok: true, rev: 0, data: null }] });
  vm.runInContext("aduBazaDeLaServer();", c);
  await linisteste();
  t("se spune limpede", stare(c), "Pe server nu e nicio bază încă.");
  t("…și nu se întreabă nimic", c.intrebat, []);
}

console.log("\n=== 4d. Toți sunt deja aici ===");
{
  const c = lume({ baza: ["Mihai Ionescu"],
                   raspunsuri: [{ ok: true, rev: 5, data: peServer([{ cod: 1, nume: "Mihai Ionescu" }], 1) }] });
  vm.runInContext("aduBazaDeLaServer();", c);
  await linisteste();
  t("se spune", stare(c), "Toți cei 1 de pe server sunt deja în bază.");
  t("…dar revizia tot se ține minte", rev(c), 5);
}

console.log("\n=== 4e. Cu lacătul pus nu se aduce ===");
{
  const c = lume({ baza: [], blocat: true, raspunsuri: [{ ok: true, rev: 1, data: peServer([{ cod: 1, nume: "Ion Țăranu" }]) }] });
  vm.runInContext("aduBazaDeLaServer();", c);
  await linisteste();
  t("nu pleacă nicio cerere", c.cereri.length, 0);
  t("…și baza rămâne goală", baza(c), []);
}

/* ================================================================
   5. Când nu merge
   ================================================================ */
console.log("\n=== 5. Fără net, sau cu cheia greșită ===");
{
  const c = lume({ baza: ["Mihai Ionescu"], raspunsuri: ["cade"] });
  vm.runInContext("trimiteBaza();", c);
  await linisteste();
  t("se spune ce s-a întâmplat", stare(c),
    "Fără net — baza a rămas pe telefon. Pleacă singură când prinde semnal.");
  t("baza n-a pățit nimic", baza(c), ["1:Mihai Ionescu"]);

  const gresit = lume({ baza: ["Mihai Ionescu"],
                        raspunsuri: [{ ok: true, rev: 0, data: null }, { ok: false, error: "forbidden" }] });
  vm.runInContext("trimiteBaza();", gresit);
  await linisteste();
  t("cheia greșită se spune pe nume", stare(gresit), "Cheia de scriere nu e bună — baza n-a plecat pe server.");
  t("…și revizia nu se mișcă", rev(gresit), 0);
}

console.log("\n=== 5b. Fără cameră, se spune ce lipsește ===");
{
  const c = lume({ camera: "", baza: ["Mihai Ionescu"] });
  vm.runInContext("improspateazaStareaBazei();", c);
  t("se spune ce-i trebuie", /n-ai pus încă un cod de cameră și cheia de scriere/.test(stare(c)), true);
  t("…și se arată drumul cu fișierul", /Salveaz-o măcar într-un fișier/.test(stare(c)), true);
  t("bucata cu serverul se ascunde", c.__el["baza-server"].style.display, "none");
}

/* ================================================================
   6. Ecranul
   ================================================================ */
console.log("\n=== 6. Ecranul e legat cum trebuie ===");
{
  const ecran = src.slice(src.indexOf('id="view-pescari"'), src.indexOf('id="view-spons"'));
  t("rândul de stare e pe ecran", /id="baza-stare"/.test(ecran), true);
  t("butonul de adus e pe ecran", /onclick="aduBazaDeLaServer\(\)"/.test(ecran), true);
  t("butonul spune ce face", /Adu baza de pe server<\/button>/.test(ecran), true);
  t("bucata serverului se ascunde la lacăt", /class="lockhide" id="baza-server"/.test(ecran), true);
  t("fișierul a rămas și el", /Salvează baza într-un fișier<\/button>/.test(ecran), true);
  t("ecranul rămâne cu trei carduri", (ecran.match(/class="card/g) || []).length, 3);
  t("un singur buton scos în față", (ecran.match(/btn-primary/g) || []).length, 1);

  t("starea se scrie când se deschide ecranul",
    /try\{ improspateazaStareaBazei\(\); \}catch\(e\)\{\}/.test(H.grabFunction(src, "renderPescari")), true);
  t("revizia știută se citește la pornire", /pescariIncarca\(\); bazaIncarcaRev\(\);/.test(src), true);
}

t.raport();

})();
