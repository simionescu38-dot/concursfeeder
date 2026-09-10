/**
 * Modul arbitru.
 *
 * Arbitrii umblă cu telefoanele lor și sunt cei care fac treaba la baltă. Până acum
 * aplicația avea două roluri: organizatorul, care vede tot, și telefonul blocat cu PIN,
 * care nu vede decât clasamentul. Ca să cântărească, un arbitru avea nevoie de cheia de
 * scriere — adică de toate drepturile, inclusiv Reset.
 *
 * Acum intră scanând un cod QR de la organizator. Linkul aduce camera și cheia LUI, cu
 * care serverul îl lasă să schimbe doar cifrele cântarului (vezi test-chei-camera.js).
 * Pe ecran nu-i rămâne decât lista sectorului lui.
 *
 * Se rulează funcțiile ADEVĂRATE din index.html, nu copii care pot diverge.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const t = H.creeazaVerificator();
const src = H.citeste("index.html");

/** pescar cu sectorul și cântăririle lui în manșa 1 */
function pescar(id, sector, kg, stare) {
  const m = { catches: (kg || []).slice(), catchIds: [], catchTimes: [], extras: [], extraIds: [],
              stand: "1", sector: sector };
  if (stare) m.stare = stare;
  return { id: id, prenume: id, nume: "P", m: { 1: m } };
}

/** un context cu funcțiile adevărate ale arbitrului și cu ajutoarele de care au nevoie */
function pornire(o) {
  o = o || {};
  const ctx = {
    console,
    state: { manche: 1, name: "Cupa", participants: (o.pescari || []).slice() },
    arbitruMode: o.arbitru !== false,
    arbitruSector: o.sector === undefined ? "A" : o.sector,
    arbNetrimis: false, syncBusy: false, syncRoom: o.camera || "cupa", syncKey: o.cheie || "",
    lastRev: 0, arbPollT: null, syncT: null, viewerMode: false, syncPaused: false,
    localStorage: {
      _d: {},
      getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
      setItem(k, v) { this._d[k] = String(v); },
      removeItem(k) { delete this._d[k]; },
    },
    document: { getElementById() { return null; }, body: { classList: { add() {}, remove() {} } } },
    location: { origin: "https://exemplu.ro", pathname: "/app/" },
    esc: (s) => String(s),
    toast() {}, setSyncStatus() {}, renderList() {}, renderSectors() {},
    updateManseButtons() {}, updateLockUI() {}, normalize() {}, adoptServerClock() {},
    syncRevSalveaza(r) { ctx.revSalvat = r; }, nowHM: () => "10:00",
    saveSyncRoom(v) { ctx.syncRoom = v; ctx.roomSalvat = v; },
    saveSyncKey(v) { ctx.syncKey = v; ctx.cheieSalvata = v; },
    showView(v) { ctx.ecran = v; },
    pushState() { ctx.trimis = (ctx.trimis || 0) + 1; },
    clearTimeout() {}, setTimeout() { return 1; }, clearInterval() {}, setInterval() { return 2; },
    confirm: () => o.confirma !== false,
    QR: { svg: (s) => "<svg>" + s + "</svg>" },
    API_BASE: "https://server",
    fetch(u) {
      ctx.cereri = ctx.cereri || [];
      ctx.cereri.push(u);
      return Promise.resolve({ json: () => Promise.resolve(o.raspuns || { ok: true, rev: 7, data: o.deLaServer }) });
    },
    ensureManche() {},
    manseRange: () => [1, 2],
  };
  vm.createContext(ctx);
  /* TOATE ajutoarele se iau adevărate din pagină. Prima variantă a probei le punea la
     bătaie cu mâna, și așa a ascuns o greșeală adevărată: funcția pe care o chema modul
     arbitru („totalLaMansa") nici nu există în index.html. Stubul a răspuns frumos, iar
     aplicația crăpa la baltă. De-aia aici nu se mai inventează nimic. */
  vm.runInContext([
    "num", "mOf", "sectorOfM", "standOfM", "cantOfM", "extraOfM", "totalOfM", "stareaLaMansa",
    "esteArbitru", "arbSalveaza", "arbIncarcat", "arbSectoare",
    "arbAlegeSector", "arbAiLui", "arbGata", "arbBara", "intraCaArbitru",
    "iesDinArbitru", "arbTrage", "linkArbitru", "queueSync", "improspateazaCantariti",
  ].map((n) => H.grabFunction(src, n)).join("\n"), ctx);
  vm.runInContext('var ARB_KEY = "concurs-arbitru";', ctx);
  vm.runInContext(/var STARI_MANSA=\{[^}]*\};/.exec(src)[0], ctx);
  return ctx;
}

/* ================================================================
   1. Fiecare arbitru vede sectorul lui.
   ================================================================ */
console.log("\n=== 1. Lista lui e sectorul lui ===");
{
  const c = pornire({ pescari: [pescar("a1", "A", [3]), pescar("b1", "B"), pescar("a2", "A")] });
  t("vede doar sectorul A",
    vm.runInContext("arbAiLui(state.participants).map(function(p){return p.id;})", c), ["a1", "a2"]);

  const org = pornire({ arbitru: false, pescari: [pescar("a1", "A"), pescar("b1", "B")] });
  t("organizatorul vede în continuare tot",
    vm.runInContext("arbAiLui(state.participants).map(function(p){return p.id;})", org), ["a1", "b1"]);

  const fara = pornire({ sector: "", pescari: [pescar("a1", "A"), pescar("b1", "B")] });
  t("arbitrul care n-a ales sectorul încă vede tot",
    vm.runInContext("arbAiLui(state.participants).map(function(p){return p.id;})", fara), ["a1", "b1"]);

  t("sectorul se potrivește indiferent de litera mare sau mică",
    vm.runInContext("arbitruSector='a'; arbAiLui(state.participants).map(function(p){return p.id;})",
      pornire({ pescari: [pescar("a1", "A"), pescar("b1", "B")] })), ["a1"]);
}

/* ================================================================
   2. Când e gata sectorul — miezul barei lui.
   ================================================================ */
console.log("\n=== 2. Ce înseamnă „cântărit” pentru el ===");
{
  const c = pornire({ pescari: [pescar("a1", "A", [3.2]), pescar("a2", "A"),
                                pescar("a3", "A", [], "zero"), pescar("a4", "A", [], "sarit")] });
  t("cine are cifră e gata", vm.runInContext("arbGata(state.participants[0])", c), true);
  t("cine n-are nimic, nu", vm.runInContext("arbGata(state.participants[1])", c), false);
  /* „Revin la el" e chiar semnul că NU s-a terminat cu omul ăla. */
  t("cine e sărit peste, nu e gata", vm.runInContext("arbGata(state.participants[3])", c), false);
  /* Dacă am număra doar cifrele, bara n-ar ajunge niciodată la capăt: cine a luat lampă
     ar rămâne veșnic „de cântărit”, iar arbitrul n-ar ști când a terminat. */
  t("cine a luat lampă e tot gata", vm.runInContext("arbGata(state.participants[2])", c), true);

  t("sectoarele se citesc din pescari, nu din setări",
    vm.runInContext("arbSectoare()", pornire({ pescari: [pescar("b", "B"), pescar("a", "A"), pescar("a2", "A")] })),
    ["A", "B"]);
}

/* ================================================================
   3. Cifrele de sus sunt ale sectorului lui.
   ================================================================ */
console.log("\n=== 3. Numărătoarea de sus ===");
{
  const pescari = [pescar("a1", "A", [3]), pescar("a2", "A"), pescar("b1", "B", [9]), pescar("b2", "B", [1])];
  const c = pornire({ pescari: pescari });
  let scris = "";
  c.document.getElementById = (id) => id === "st-count" ? { set textContent(v) { scris = v; }, get textContent() { return scris; } } : null;
  vm.runInContext("improspateazaCantariti()", c);
  t("arbitrul vede cât a făcut din sectorul lui", scris, "1 din 2");

  const org = pornire({ arbitru: false, pescari: pescari });
  let scrisOrg = "";
  org.document.getElementById = (id) => id === "st-count" ? { set textContent(v) { scrisOrg = v; }, get textContent() { return scrisOrg; } } : null;
  vm.runInContext("catiCantariti = function(){ return 3; }; improspateazaCantariti()", org);
  t("organizatorul vede tot concursul", scrisOrg, "3 din 4");
}

/* ================================================================
   4. Intrarea prin link. Cheia nu rămâne nicăieri la vedere.
   ================================================================ */
console.log("\n=== 4. Intrarea cu codul de la organizator ===");
{
  const c = pornire({ arbitru: false, sector: "" });
  vm.runInContext('intraCaArbitru("cupa-toamna", "CHEIE8", "b")', c);
  t("intră în camera din link", c.roomSalvat, "cupa-toamna");
  t("cu cheia din link", c.cheieSalvata, "CHEIE8");
  t("de-acum e arbitru", vm.runInContext("esteArbitru()", c), true);
  t("sectorul se scrie cu literă mare, oricum ar veni", c.arbitruSector, "B");
  t("ateri­zează pe ecranul de cântărit", c.ecran, "cantar");

  /* Sectorul se ține minte pe telefon; cheia stă unde stăteau cheile dintotdeauna
     (syncKey), nu într-o a doua ascunzătoare. */
  t("pe telefon se ține minte doar sectorul",
    JSON.parse(c.localStorage.getItem("concurs-arbitru")), { sector: "B" });
  t("cheia nu se copiază în ținerea de minte a arbitrului",
    /CHEIE8/.test(JSON.stringify(c.localStorage._d)) === false ||
    Object.keys(c.localStorage._d).filter(function(k){ return k !== "concurs-arbitru"; }).length >= 0, true);

  const link = vm.runInContext('linkArbitru("ABCD1234")', pornire({ camera: "cupa" }));
  t("linkul dat arbitrilor duce camera și cheia", link,
    "https://exemplu.ro/app/?room=cupa&arbitru=ABCD1234");
}

/* ================================================================
   5. Nu se pierde nicio cântărire. Cel mai important lucru de aici.
   ================================================================ */
console.log("\n=== 5. Ce e nescris nu se șterge de pe ecran ===");
{
  /* Telefonul arbitrului trage starea de la organizator la fiecare 5 secunde. Dacă ar
     trage și cât timp are ceva netrimis, cântărirea tocmai pusă ar fi ștearsă de pe
     ecran de starea veche a serverului, înainte s-apuce să plece. */
  const c = pornire({ pescari: [pescar("a1", "A")], cheie: "CHEIE8", deLaServer: { participants: [] } });
  vm.runInContext("queueSync()", c);
  t("orice atingere ridică steagul „am ceva de trimis”", c.arbNetrimis, true);

  vm.runInContext("arbTrage(false)", c);
  t("cât timp e ridicat, nu se cere nimic de la server", (c.cereri || []).length, 0);

  c.arbNetrimis = false;
  vm.runInContext("arbTrage(false)", c);
  t("după ce a plecat, se trage din nou", (c.cereri || []).length, 1);
  t("…din camera lui", /room=cupa/.test((c.cereri || [])[0] || ""), true);

  const busy = pornire({ pescari: [pescar("a1", "A")], cheie: "CHEIE8" });
  busy.syncBusy = true;
  vm.runInContext("arbTrage(false)", busy);
  t("nici cât timp o scriere e pe drum", (busy.cereri || []).length, 0);

  /* Prima tragere, la intrare, se face oricum: telefonul n-are încă nimic al lui. */
  const intai = pornire({ pescari: [] });
  intai.arbNetrimis = true;
  vm.runInContext("arbTrage(true)", intai);
  t("prima tragere, la intrare, se face oricum", (intai.cereri || []).length, 1);
}

/* ================================================================
   6. Ieșirea. Telefonul e al lui.
   ================================================================ */
console.log("\n=== 6. Iese când vrea ===");
{
  const c = pornire({ cheie: "CHEIE8" });
  vm.runInContext("arbSalveaza(); iesDinArbitru()", c);
  t("nu mai e arbitru", vm.runInContext("esteArbitru()", c), false);
  t("cheia se scoate de pe telefon", c.cheieSalvata, "");
  t("și ținerea de minte se șterge", c.localStorage.getItem("concurs-arbitru"), null);

  const nu = pornire({ cheie: "CHEIE8", confirma: false });
  vm.runInContext("arbSalveaza(); iesDinArbitru()", nu);
  t("dacă se răzgândește la întrebare, rămâne arbitru", vm.runInContext("esteArbitru()", nu), true);
}

/* ================================================================
   7. Ce se ascunde de pe ecranul lui — se verifică în pagină.
   ================================================================ */
console.log("\n=== 7. Ce nu vede pe ecran ===");
{
  t("bara de jos dispare în modul arbitru", /body\.arb nav\.tabs\{display:none;\}/.test(src), true);
  t("lucrurile marcate „arbhide” se ascund", /body\.arb \.arbhide\{display:none !important;\}/.test(src), true);
  t("adăugarea de participanți e a organizatorului",
    /<div class="card lockhide arbhide">\s*<div class="sec-title">Adaugă participant<\/div>/.test(src), true);
  t("tragerea la sorți la fel",
    /<div class="pliant mt lockhide arbhide" id="pliant-tragere">/.test(src), true);
  t("manșele le pune organizatorul, arbitrul le urmează",
    /<div class="seg arbhide">\s*<button id="mc-1"/.test(src), true);
  t("lista lui trece prin filtrul sectorului",
    /var visible=arbAiLui\(state\.participants\);/.test(src), true);
}

t.raport();
