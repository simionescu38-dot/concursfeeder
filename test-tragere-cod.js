/**
 * Tragerea la sorți cu COD și NUME pe aceeași foaie.
 *
 * De ce: până acum omul se căuta după nume. „Ciufi Man" și „Ciufy Man" erau doi oameni
 * pentru aplicație. Cu un cod pe foaie, omul E codul — iar numele scris alături e
 * martorul: dacă cele două nu-s ale aceluiași om, undeva s-a greșit, și rândul se
 * oprește. Un stand pus pe cine nu trebuie nu se mai vede până la premiere.
 *
 * Ce se probează aici:
 *   1. foaia cu două numere pe rând se citește, iar numele rămâne întreg;
 *   2. care număr e standul și care e codul se prinde singur, pe toată foaia;
 *   3. codul și numele de la oameni diferiți OPRESC rândul;
 *   4. un cod care nu e în bază nu oprește nimic — rândul merge după nume;
 *   5. codul se lipește de om la mutare, iar de-atunci numele nu mai contează;
 *   6. foile fără coduri merg exact ca înainte.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = ["uid", "esc", "numManse", "manseRange", "emptyManche", "ensureManche", "mOf",
  "sectorOfM", "standOfM", "setStandSector", "nameOf", "faraSemne",
  "cantOfM", "extraOfM", "totalOfM", "scrieInJurnal", "sectorRanges", "sectorForStand",
  "citesteTragerea", "pescarulTragerii", "randuriTragerii", "sectorulTragerii",
  "ordineaTragerii", "numeleSePotriveste", "pescarDupaCod", "participantDupaCod",
  "cheiePescar", "numePescar",
  "intervaleleTragerii", "verificaTragerea", "treceTragerea", "adaugaDinTragere",
  "splitName", "curataNumarul"];

/** un concurs adevărat, plus baza de pescari a sezonului */
function pornire(lot, optiuni) {
  const o = optiuni || {};
  const camp = { value: o.text || "" };
  const preview = { innerHTML: "" };
  const ctx = {
    console, JSON, Date, Math, parseInt, parseFloat, isNaN,
    blocat: !!o.blocat, intrebat: [], raspunsLaConfirm: o.confirma !== false,
    toasturi: [], salvat: 0, desenat: 0, copii: [],
    document: { getElementById: id => id === "trg-text" ? camp : (id === "trg-preview" ? preview : null) },
    guard() { return ctx.blocat; },
    confirm(q) { ctx.intrebat.push(q); return ctx.raspunsLaConfirm; },
    toast(m) { ctx.toasturi.push(m); },
    queueSave() { ctx.salvat++; },
    renderList() { ctx.desenat++; },
    isLocked() { return ctx.blocat; },
    puneDeoParte(motiv) { ctx.copii.push(motiv); },
    pescari: (o.baza || []).slice()
  };
  ctx.camp = camp; ctx.preview = preview;
  ctx.state = {
    name: "Probă", manche: o.mansa || 1, numManse: 2,
    sectors: o.sectors || ["A", "B", "C", "D"],
    numStanduri: o.numStanduri === undefined ? "44" : o.numStanduri,
    jurnal: [],
    participants: lot.map((x, i) => {
      const p = { id: "p" + i, prenume: x.prenume, nume: x.nume,
                  stand: x.stand || "", sector: x.sector || "",
                  m: { 1: { catches: [], catchTimes: [], catchPhotos: [], extras: [], extraTimes: [], extraPhotos: [], stand: x.stand || "", sector: x.sector || "" },
                       2: { catches: [], catchTimes: [], catchPhotos: [], extras: [], extraTimes: [], extraPhotos: [], stand: "", sector: "" } } };
      if (x.cod) p.cod = x.cod;
      return p;
    })
  };
  vm.createContext(ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  return ctx;
}

/** lotul de probă: aceiași oameni, în concurs */
const LOT = [
  { stand: "1", prenume: "Mihai", nume: "Ionescu", sector: "A" },
  { stand: "2", prenume: "Vasile", nume: "Popescu", sector: "A" },
  { stand: "3", prenume: "Ștefan", nume: "Bălan", sector: "A" },
  { stand: "4", prenume: "Ion", nume: "Țăranu", sector: "A" }
];
/** baza sezonului: aceiași oameni, cu codurile lor */
const BAZA = [
  { id: "b1", cod: 7, prenume: "Mihai", nume: "Ionescu" },
  { id: "b2", cod: 3, prenume: "Vasile", nume: "Popescu" },
  { id: "b3", cod: 12, prenume: "Ștefan", nume: "Bălan" },
  { id: "b4", cod: 5, prenume: "Ion", nume: "Țăranu" }
];

const citit = (ctx, text) => vm.runInContext("citesteTragerea(" + JSON.stringify(text) + ")", ctx);
const randuri = (ctx, text) => vm.runInContext(
  "randuriTragerii(" + JSON.stringify(text) + ").map(function(x){" +
  "return {stand:x.stand, cod:x.cod, nume:x.nume, cine:x.p?nameOf(x.p):null, cum:x.cum," +
  " nepotrivit:x.nepotrivit, codStrain:x.codStrain, standDublu:x.standDublu};})", ctx);
const ordine = (ctx, text) => vm.runInContext("randuriTragerii(" + JSON.stringify(text) + ").ordine", ctx);
const standuri = ctx => vm.runInContext(
  "state.participants.map(function(p){ return nameOf(p)+':'+standOfM(p,state.manche)+(p.cod?'#'+p.cod:''); })", ctx);
function verifica(ctx, text) {
  ctx.camp.value = text;
  vm.runInContext("verificaTragerea();", ctx);
  return ctx.preview.innerHTML.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/\s+([,.:;])/g, "$1").trim();
}
function trece(ctx, text) {
  ctx.camp.value = text;
  vm.runInContext("treceTragerea();", ctx);
}

/* ================================================================
   1. Rândul cu două numere
   ================================================================ */
console.log("\n=== 1. Se citesc amândouă numerele, iar numele rămâne întreg ===");
{
  const c = pornire(LOT, { baza: BAZA });
  const unul = txt => { const r = citit(c, txt); return r.length ? { stand: r[0].stand, cod: r[0].cod, nume: r[0].nume } : null; };

  t("stand, cod, nume", unul("1 7 Mihai Ionescu"), { stand: "1", cod: "7", nume: "Mihai Ionescu" });
  t("cu virgule", unul("1, 7, Mihai Ionescu"), { stand: "1", cod: "7", nume: "Mihai Ionescu" });
  t("cu liniuțe", unul("1 - 7 - Mihai Ionescu"), { stand: "1", cod: "7", nume: "Mihai Ionescu" });
  t("cu bară", unul("1 | 7 | Mihai Ionescu"), { stand: "1", cod: "7", nume: "Mihai Ionescu" });
  t("cu sectorul scris în față", unul("A 1 7 Mihai Ionescu"), { stand: "1", cod: "7", nume: "Mihai Ionescu" });

  t("un singur număr rămâne stand, fără cod", unul("1 Mihai Ionescu"), { stand: "1", cod: "", nume: "Mihai Ionescu" });
  /* Al doilea număr se ia DOAR din poziția a doua. Altfel un nume cu cifră în el
     („Ion 2 Popescu", cum se mai scrie pe grup) și-ar pierde o bucată. */
  t("un număr din mijlocul numelui nu e cod", unul("1 Ion 2 Popescu"),
    { stand: "1", cod: "", nume: "Ion 2 Popescu" });
  t("nici al treilea număr nu se ia", unul("1 7 Mihai Ionescu 9"),
    { stand: "1", cod: "7", nume: "Mihai Ionescu 9" });
  /* Data e acoperită cu semne înainte de căutarea numerelor, deci nu dă niciun cod.
     (Punctele ei se fac spații în nume de mult, nu de acum.) */
  t("data nu se ia drept cod", unul("1 Tragerea 06.09.2026 Mihai Ionescu"),
    { stand: "1", cod: "", nume: "Tragerea 06 09 2026 Mihai Ionescu" });
}

/* ================================================================
   2. Care număr e standul și care e codul
   ------------------------------------------------------------------
   Nu se poate ști dintr-un rând: 7 și 12 sunt amândouă și standuri bune, și coduri
   bune. Se socotește pe TOATĂ foaia, în amândouă felurile.
   ================================================================ */
console.log("\n=== 2. Ordinea se prinde singură, pe toată foaia ===");
{
  const c = pornire(LOT, { baza: BAZA });
  const FOAIE = "1 7 Mihai Ionescu\n2 3 Vasile Popescu\n3 12 Ștefan Bălan";
  t("foaia scrisă stand-cod", ordine(c, FOAIE), "stand-cod");
  t("standurile ies bune", randuri(c, FOAIE).map(x => x.stand), ["1", "2", "3"]);
  t("codurile ies bune", randuri(c, FOAIE).map(x => x.cod), ["7", "3", "12"]);

  const INVERS = "7 1 Mihai Ionescu\n3 2 Vasile Popescu\n12 3 Ștefan Bălan";
  t("foaia scrisă cod-stand", ordine(c, INVERS), "cod-stand");
  t("standurile ies tot bune", randuri(c, INVERS).map(x => x.stand), ["1", "2", "3"]);
  t("codurile ies tot bune", randuri(c, INVERS).map(x => x.cod), ["7", "3", "12"]);
  t("și oamenii sunt aceiași", randuri(c, INVERS).map(x => x.cine),
    ["Mihai Ionescu", "Vasile Popescu", "Ștefan Bălan"]);

  /* Fără bază n-are cu ce compara: rămâne cum se scria până acum, standul întâi. */
  const gol = pornire(LOT, { baza: [] });
  t("cu baza goală, standul e primul", ordine(gol, FOAIE), "stand-cod");
  t("…iar omul se caută tot după nume", randuri(gol, FOAIE)[0].cine, "Mihai Ionescu");
  t("…și se spune că-i cod străin", randuri(gol, FOAIE)[0].codStrain, true);
}

console.log("\n=== 2b. O foaie ambiguă nu se ghicește pe dos ===");
{
  /* Un singur rând, cu două numere care sunt amândouă coduri bune ale unor oameni
     diferiți. La egalitate rămâne felul obișnuit: standul întâi. */
  const c = pornire(LOT, { baza: BAZA });
  t("la egalitate, standul rămâne primul", ordine(c, "7 12 Cineva Necunoscut"), "stand-cod");
}

/* ================================================================
   3. Codul și numele de la oameni diferiți
   ================================================================ */
console.log("\n=== 3. Codul și numele de la oameni diferiți opresc rândul ===");
{
  const c = pornire(LOT, { baza: BAZA });
  const FOAIE = "1 7 Mihai Ionescu\n2 3 Ștefan Bălan";  // codul 3 e al lui Vasile Popescu
  const r = randuri(c, FOAIE);
  t("primul rând e bun", { cine: r[0].cine, nepotrivit: r[0].nepotrivit }, { cine: "Mihai Ionescu", nepotrivit: false });
  t("al doilea e oprit", r[1].nepotrivit, true);
  t("…și nu se alege niciun om", r[1].cine, null);

  const text = verifica(c, FOAIE);
  t("se spune ce cod e nepotrivit", /codul 3 e Vasile Popescu în bază, dar pe foaie scrie Ștefan Bălan/.test(text), true);
  t("se spune că nu se trece", /nu-l trec/.test(text), true);
  t("…și ce e de făcut", /Dreg foaia, sau dreg baza/.test(text), true);
  t("celălalt tot se mută", /1 pescar se mută/.test(text), true);

  /* butonul de adăugare nu apare: cel oprit E în concurs, doar foaia e greșită */
  t("nu se oferă adăugarea celui oprit", /Adaugă/.test(ctxPreviewBrut(c)), false);

  trece(c, FOAIE);
  t("s-a mutat doar unul", standuri(c)[0], "Mihai Ionescu:1#7");
  t("cel oprit a rămas unde era", standuri(c)[2], "Ștefan Bălan:3");
  t("întrebarea spune și de ce", /codul și numele de la oameni diferiți — nu le trec/.test(c.intrebat[0]), true);
}
function ctxPreviewBrut(c) { return c.preview.innerHTML; }

console.log("\n=== 3b. Numele scris altfel NU e nepotrivire ===");
{
  const c = pornire(LOT, { baza: BAZA });
  const r = randuri(c, "1 5 Ion Taranu");   // fără diacritice
  t("fără diacritice, tot el e", r[0].nepotrivit, false);
  t("…și e găsit", r[0].cine, "Ion Țăranu");
  t("codul l-a dus la om, prin bază", r[0].cum, "baza");

  const r2 = randuri(pornire(LOT, { baza: BAZA }), "1 5 TARANU ION");
  t("cu numele întors și cu majuscule, tot el", r2[0].nepotrivit, false);
  t("…și tot găsit", r2[0].cine, "Ion Țăranu");
}

/* ================================================================
   4. Un cod care nu e în bază
   ================================================================ */
console.log("\n=== 4. Un cod necunoscut nu oprește nimic ===");
{
  const c = pornire(LOT, { baza: BAZA });
  const r = randuri(c, "1 99 Mihai Ionescu");
  t("rândul nu e oprit", r[0].nepotrivit, false);
  t("omul e găsit după nume", r[0].cine, "Mihai Ionescu");
  t("…și se spune că e cod străin", r[0].codStrain, true);

  const text = verifica(c, "1 99 Mihai Ionescu");
  t("se spune limpede", /1 cod nu e în baza de pescari — rândul merge după nume/.test(text), true);
  t("…cu codul și numele lui", /cod 99 — Mihai Ionescu/.test(text), true);
}

/* ================================================================
   5. Codul se lipește de om
   ------------------------------------------------------------------
   Ăsta e tot rostul. „Ciufi Man" și „Ciufy Man" erau doi oameni pentru aplicație;
   odată codul lipit, cum îi scrie numele pe foaia următoare nu mai schimbă nimic.
   ================================================================ */
console.log("\n=== 5. Odată codul lipit, numele nu mai contează ===");
{
  const c = pornire(LOT, { baza: BAZA });
  trece(c, "1 7 Mihai Ionescu\n2 3 Vasile Popescu");
  t("codurile s-au lipit de oameni", standuri(c).slice(0, 2), ["Mihai Ionescu:1#7", "Vasile Popescu:2#3"]);
  t("cine n-a fost pe foaie n-a primit cod", standuri(c)[2], "Ștefan Bălan:3");

  /* manșa a doua, altă tragere, cu numele scris întors — omul e găsit după codul lipit */
  vm.runInContext("state.manche=2;", c);
  const r = randuri(c, "9 7 Ionescu Mihai");
  t("codul lipit duce la om, oricum e scris numele", r[0].cine, "Mihai Ionescu");
  t("…și se vede că l-a dus codul, nu baza", r[0].cum, "cod");
  trece(c, "9 7 Ionescu Mihai");
  t("s-a mutat pe standul 9 în manșa 2",
    vm.runInContext("standOfM(state.participants[0],2)", c), "9");

  /* Iar porecla de pe grup NU trece pe sub cod: asta e tocmai plasa. Omul are un singur
     rând în bază; dacă foaia îi scrie altfel, aplicația o spune, nu-l face al doilea om. */
  const r2 = randuri(c, "9 7 Ciufi Man");
  t("porecla lângă cod e strigată, nu înghițită", r2[0].nepotrivit, true);
}

console.log("\n=== 5b. Cine intră nou din foaie vine cu codul lui ===");
{
  const c = pornire(LOT, { baza: BAZA });
  vm.runInContext("state.pescariNoi=0;", c);
  c.camp.value = "9 21 Gheorghe Marin";
  vm.runInContext("adaugaDinTragere();", c);
  t("s-a adăugat", vm.runInContext("state.participants.length", c), 5);
  t("…cu codul de pe foaie", vm.runInContext("state.participants[4].cod", c), 21);
  t("…pe standul lui", vm.runInContext("standOfM(state.participants[4],1)", c), "9");
}

/* ================================================================
   6. Ce nu s-a schimbat
   ================================================================ */
console.log("\n=== 6. Foile fără coduri merg exact ca înainte ===");
{
  const c = pornire(LOT, { baza: BAZA });
  trece(c, "5 Mihai Ionescu\n6 Vasile Popescu");
  t("se mută după nume, ca înainte", standuri(c).slice(0, 2), ["Mihai Ionescu:5", "Vasile Popescu:6"]);
  t("nu se inventează niciun cod", standuri(c).slice(0, 2).every(x => x.indexOf("#") < 0), true);
}

console.log("\n=== 6b. Standul dublu se vede și pe foaia cu coduri ===");
{
  const c = pornire(LOT, { baza: BAZA });
  const r = randuri(c, "1 7 Mihai Ionescu\n1 3 Vasile Popescu");
  t("al doilea rând are standul scris de două ori", r[1].standDublu, true);
  t("primul rând pe standul 1 trece, ca până acum", r[0].standDublu, false);
  trece(c, "1 7 Mihai Ionescu\n1 3 Vasile Popescu");
  t("se mută doar primul", standuri(c)[0], "Mihai Ionescu:1#7");
  t("al doilea rămâne unde era", standuri(c)[1], "Vasile Popescu:2");

  /* și pe foaia scrisă invers, dubla se vede tot pe STAND, nu pe cod */
  const c2 = pornire(LOT, { baza: BAZA });
  const r2 = randuri(c2, "7 1 Mihai Ionescu\n3 1 Vasile Popescu");
  t("scrisă invers, dubla e tot pe stand", r2[1].standDublu, true);
}

console.log("\n=== 6c. Lacătul ===");
{
  const c = pornire(LOT, { baza: BAZA, blocat: true });
  trece(c, "1 7 Mihai Ionescu");
  t("cu lacătul pus nu se mută nimeni", standuri(c)[0], "Mihai Ionescu:1");
  t("…și nu se lipește niciun cod", vm.runInContext("state.participants[0].cod", c), undefined);
}

t.raport();
