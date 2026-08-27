/**
 * Poza și ora la peștele extra.
 *
 * „Eu fac poze la cântarele cu pești extra, în timpul concursului, apoi la final
 * cântărim juvelnicele."
 *
 * De aici a ieșit totul. Aplicația salva ora și poza la CANTITATE — adică la juvelnice,
 * cântărite toate la final, unde ora nu spune decât când a stat omul la cântar. Iar la
 * peștii extra — singurii cântăriți pe loc, ăia care dau CMMC-ul și pentru care el
 * scotea telefonul să fotografieze — nu salva nimic.
 *
 * Pe deasupra, aparatul de fotografiat era pe jumătate construit: `catchPhotos`, chipul
 * cu 📷, fereastra care arată poza mare — toate existau, dar `addCatch` trimitea mereu
 * `null`, deci nicio poză n-avea cum să intre. În datele concursului din 27 august: zero.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

/** aplicația, cu un pescar și un ceas oprit, ca orele să fie de verificat */
function app(cfg) {
  cfg = cfg || {};
  const toasturi = [];
  const jurnal = [];
  const camp = { value: cfg.scris === undefined ? "1,5" : cfg.scris, focus() {} };
  const ctx = {
    console, Math, JSON, Date,
    state: { manche: 1, numManse: 2, participants: [
      { id: "p1", prenume: "Mimi", nume: "Fedor", stand: "13",
        m: { 1: { catches: [], catchTimes: [], catchPhotos: [], extras: [], extraTimes: [], extraPhotos: [], stand: "13", sector: "C" },
             2: { catches: [], catchTimes: [], catchPhotos: [], extras: [], extraTimes: [], extraPhotos: [], stand: "", sector: "" } } }] },
    guard: () => !!cfg.blocat,
    confirm: () => true, // ștergerea întreabă; la probă răspundem „da"
    toast: m => toasturi.push(m),
    num: v => { v = ("" + v).trim().replace(",", "."); const n = parseFloat(v); return isNaN(n) ? 0 : n; },
    fmt: n => String(n),
    nameOf: p => ((p.prenume || "") + " " + (p.nume || "")).trim(),
    hhmm: () => "10:15",
    leaderId: () => null, showNewLeader: () => {}, speak: () => {}, kgSpeech: () => "",
    totalOfM: () => 0, standOfM: () => "13", sectorOfM: () => "C",
    scrieInJurnal: (p, mi, fel, act, kg) => jurnal.push({ fel, act, kg }),
    queueSave: () => {}, refreshCard: () => {}, uid: () => "x",
    isLocked: () => !!cfg.blocat,
    document: { getElementById: id => (id === "extra-p1" ? camp : { src: "", textContent: "", classList: { add() {} } }) }
  };
  ctx.mOf = (p, mi) => p.m[mi];
  ctx.extraOf = p => (p.m[1].extras || []).reduce((a, b) => a + b, 0);
  vm.createContext(ctx);
  vm.runInContext(
    ["addExtraCore", "addExtra", "removeExtra", "extrasChipsHtml"]
      .map(n => H.grabFunction(src, n)).join("\n"), ctx);
  const m = () => ctx.state.participants[0].m[1];
  return {
    adauga: photo => vm.runInContext("addExtraCore('p1'," + (photo ? JSON.stringify(photo) : "null") + ");", ctx),
    adaugaFaraPoza: () => vm.runInContext("addExtra('p1');", ctx),
    sterge: i => vm.runInContext("removeExtra('p1'," + i + ");", ctx),
    chips: () => vm.runInContext("extrasChipsHtml(state.participants[0]);", ctx),
    m, toasturi, jurnal, camp
  };
}

/* ================================================================
   1. Ora — la peștele extra, nu doar la juvelnice
   ================================================================ */
console.log("\n=== 1. Ora peștelui extra ===");
{
  const a = app();
  const inainte = Date.now();
  a.adauga(null);
  const m = a.m();
  t("greutatea a intrat", m.extras, [1.5]);
  t("…cu o oră salvată lângă ea", typeof m.extraTimes[0], "number");
  t("…ora de acum, nu una veche", m.extraTimes[0] >= inainte, true);
  t("…și cu loc gol pentru poză", m.extraPhotos, [null]);
}
{
  // singurul câmp care avea oră era Cantitate — juvelnicele, cântărite la final
  const cod = H.grabFunction(src, "addExtraCore");
  t("ora se pune chiar la adăugare", /extraTimes\.push\(Date\.now\(\)\)/.test(cod), true);
}

/* ================================================================
   2. Poza
   ================================================================ */
console.log("\n=== 2. Poza la cântar ===");
{
  const a = app();
  a.adauga("data:image/jpeg;base64,AAAA");
  t("poza se păstrează pe peștele lui", a.m().extraPhotos[0], "data:image/jpeg;base64,AAAA");
  t("…iar greutatea rămâne a ei", a.m().extras, [1.5]);
}
{
  const a = app();
  a.adaugaFaraPoza();
  t("adăugat de la «+», fără poză, merge ca înainte", a.m().extras, [1.5]);
  t("…și nu inventează o poză", a.m().extraPhotos, [null]);
}
{
  // fără greutate n-are ce intra: un pește fără număr ar arăta ca o cântărire uitată
  const cod = H.grabFunction(src, "onExtraPhoto");
  t("poza cere întâi greutatea", /num\(el\.value\)>0/.test(cod), true);
  t("…și spune asta pe față", /Scrie întâi greutatea/.test(cod), true);
  t("micșorează poza înainte s-o păstreze", /max=480/.test(cod), true);
  t("…mai mare decât pozele pescarilor, ca să se citească cifrele",
    480 > +(H.grabFunction(src, "onPhoto").match(/max=(\d+)/) || [])[1], true);
  t("nu lucrează pe telefonul blocat", /if\(guard\(\)\) return;/.test(cod), true);
}

/* ================================================================
   3. Chipul: ce se vede pe card
   ================================================================ */
console.log("\n=== 3. Ce se vede pe cardul pescarului ===");
{
  const a = app();
  a.adauga("data:image/jpeg;base64,AAAA");
  const h = a.chips();
  t("scrie ora", /10:15/.test(h), true);
  t("pune semnul de poză", /📷/.test(h), true);
  t("…și se poate apăsa ca s-o vezi mare", /showExtraPhoto\('p1',0\)/.test(h), true);
  // × e peste chip: fără oprirea propagării, ștergerea ar deschide și poza
  t("«×» nu deschide poza când ștergi", /event\.stopPropagation\(\);removeExtra/.test(h), true);
}
{
  const a = app();
  a.adauga(null);
  const h = a.chips();
  t("fără poză, niciun semn de poză", /📷/.test(h), false);
  t("…și nu se poate apăsa degeaba", /showExtraPhoto/.test(h), false);
  t("dar ora tot se vede", /10:15/.test(h), true);
}

/* ================================================================
   4. Ștergerea nu lasă ora și poza altui pește
   ================================================================ */
console.log("\n=== 4. Ștergerea ===");
{
  const a = app();
  a.adauga("poza-1");
  a.camp.value = "2,5"; a.adauga("poza-2");
  a.camp.value = "3,5"; a.adauga("poza-3");
  t("trei pești extra", a.m().extras, [1.5, 2.5, 3.5]);
  a.sterge(1);
  t("a rămas cel dintâi și cel de-al treilea", a.m().extras, [1.5, 3.5]);
  // dacă doar greutățile s-ar decala, poza lui 2 ar rămâne lipită de 3
  t("…iar pozele s-au decalat odată cu ele", a.m().extraPhotos, ["poza-1", "poza-3"]);
  t("…și orele la fel", a.m().extraTimes.length, 2);
}

/* ================================================================
   5. Concursurile vechi, fără ora și poza
   ================================================================ */
console.log("\n=== 5. Un concurs din iulie se deschide fără să crape ===");
{
  const norm = H.grabFunction(src, "normalize");
  t("se completează cu goluri pentru extras", /extraTimes\.push\(null\)/.test(norm), true);
  t("…și pentru poze", /extraPhotos\.push\(null\)/.test(norm), true);
  t("…iar dacă sunt prea multe, se taie",
    /extraTimes\.length=m\.extras\.length/.test(norm) && /extraPhotos\.length=m\.extras\.length/.test(norm), true);
  const gol = H.grabFunction(src, "emptyManche");
  t("manșa nouă le are din start", /extraTimes:\[\], extraPhotos:\[\]/.test(gol), true);
}

/* ================================================================
   6. Graficul cu orele spune acum adevărul
   ================================================================ */
console.log("\n=== 6. „Când a mușcat peștele\" ===");
{
  const st = H.grabFunction(src, "statsHtml");
  t("peștii extra intră în grafic cu ora lor", /allEx\.push\(\{v:\+v\|\|0, t:\(m\.extraTimes\|\|\[\]\)\[i\]/.test(st), true);
  t("graficul numără și capturi, și pești extra", /all\.concat\(allEx\)/.test(st), true);
  // scria „Peștii extra nu apar aici — la ei aplicația nu salvează ora": nu mai e adevărat
  t("nu mai scrie că la extra nu se salvează ora",
    /Peștii extra nu apar aici/.test(src), false);
  t("…ci spune de ce juvelnicele cad într-o oră",
    /Juvelnicele se cântăresc la final/.test(st), true);
}

t.raport();
