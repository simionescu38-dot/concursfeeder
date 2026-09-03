/**
 * Cartea personală a pescarului.
 *
 * Sezonul își face socoteala lui, pe kilograme. Dar PODIUMUL și VICTORIA DE SECTOR sunt
 * ale concursului, iar acolo se numără punctele pe sectoare. De-aia socoteala de la
 * cântar se face și în sezon.html, pe fiecare concurs în parte.
 *
 * Lucrul de care atârnă tot: cifrele din carte trebuie să fie CELE DE PE DIPLOMĂ. De
 * aceea proba nu se mulțumește să verifice că socoteala e plauzibilă — pune clasamentul
 * din sezon.html și pe cel din rezultat.html (pagina oficială a concursului, cea din QR)
 * pe ACELEAȘI date și cere să iasă la fel. Dacă vreodată una din ele o ia razna, cartea
 * i-ar spune omului că are trei podiumuri, iar diploma i-ar spune două.
 *
 * Tot codul e scos VERBATIM din fișierele livrate.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("sezon.html");
const pub = H.citeste("rezultat.html");
const t = H.creeazaVerificator();

const FUNCTII = ["normKey", "nameOf", "mOf", "catchesSum", "extrasSum", "extrasMax",
  "totalKg", "bestFish", "manseleDin", "totalLaMansa", "sectorLaMansa", "standLaMansa",
  "lipsaLaMansa", "mansaDisputata", "puncteleMansei", "ceaMaiBunaMansa", "totalLaScop",
  "cmmcLaScop", "standNr", "sorteazaOficial", "clasamentOficial", "cartea"];

function lume() {
  const ctx = { console, JSON, Array, Object, Math, parseInt, parseFloat, isNaN, String, Date };
  vm.createContext(ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  return ctx;
}

/** aceleași date, dar în pagina publică a concursului */
function paginaPublica(parts, numManse, scala) {
  const script = pub.match(/<script>([^]*?)<\/script>/)[1].replace(/load\(\)\.catch\([^]*$/m, "");
  const ctx = { console, location: { search: "", href: "" }, document: {}, navigator: {} };
  vm.createContext(ctx);
  vm.runInContext(script, ctx);
  ctx.state.participants = parts;
  ctx.state.numManse = numManse;
  ctx.state.scalaSectoare = scala === true;
  return ctx;
}

/** un om: sectorul și kilogramele pe fiecare manșă */
const om = (id, manse, extra) => ({
  id: id, prenume: id, nume: "Om",
  m: manse.reduce((acc, x, i) => {
    acc[i + 1] = { stand: String(x.stand || (i + 1)), sector: x.sector,
                   catches: x.kg === undefined ? [] : [x.kg],
                   extras: x.extra ? [x.extra] : [] };
    if (x.absent) acc[i + 1].stare = "absent";
    return acc;
  }, {}),
  ...(extra || {})
});
const sursa = (parts, scala) => ({ compName: "Etapa", parts: parts, scala: scala === true });

/** ordinea oficială, după cele două socoteli */
const ordineaSezon = (c, s) => {
  const of = vm.runInContext("clasamentOficial(" + JSON.stringify(s) + ")", c);
  return s.parts.slice().sort((a, b) => of[a.id].loc - of[b.id].loc).map(p => p.id);
};
const ordineaPublica = (parts, nm, scala) => {
  const p = paginaPublica(parts, nm, scala);
  return p.sortByPoints(parts, p.pointsCombo(), "total").map(x => x.id);
};

/* ================================================================
   1. Aceleași cifre ca pe diplomă
   ================================================================ */
console.log("\n=== 1. Sezonul și pagina concursului spun la fel ===");
{
  const c = lume();
  const cazuri = [
    ["două manșe, două sectoare", [
      om("A", [{ sector: "A", kg: 10 }, { sector: "B", kg: 4 }]),
      om("B", [{ sector: "A", kg: 8, extra: 2 }, { sector: "B", kg: 7 }]),
      om("C", [{ sector: "B", kg: 6 }, { sector: "A", kg: 9 }]),
      om("D", [{ sector: "B", kg: 5 }, { sector: "A", kg: 3 }])
    ], 2, false],
    ["cu unul absent la manșa a doua", [
      om("A", [{ sector: "A", kg: 10 }, { sector: "A", kg: 4 }]),
      om("B", [{ sector: "A", kg: 8 }, { sector: "A", absent: true }]),
      om("C", [{ sector: "B", kg: 6 }, { sector: "B", kg: 9 }]),
      om("D", [{ sector: "B", kg: 5 }, { sector: "B", kg: 3 }])
    ], 2, false],
    ["la greutăți egale", [
      om("A", [{ sector: "A", kg: 7 }]),
      om("B", [{ sector: "A", kg: 7 }]),
      om("C", [{ sector: "A", kg: 3 }])
    ], 1, false],
    ["cu sectoare de mărimi diferite, pe scală", [
      om("A", [{ sector: "A", kg: 10 }]),
      om("B", [{ sector: "A", kg: 8 }]),
      om("C", [{ sector: "A", kg: 6 }]),
      om("D", [{ sector: "B", kg: 9 }]),
      om("E", [{ sector: "B", kg: 2 }])
    ], 1, true],
    ["aceleași sectoare, fără scală", [
      om("A", [{ sector: "A", kg: 10 }]),
      om("B", [{ sector: "A", kg: 8 }]),
      om("C", [{ sector: "A", kg: 6 }]),
      om("D", [{ sector: "B", kg: 9 }]),
      om("E", [{ sector: "B", kg: 2 }])
    ], 1, false],
    ["o manșă în care nu s-a prins nimic", [
      om("A", [{ sector: "A", kg: 5 }, { sector: "A", kg: 0 }]),
      om("B", [{ sector: "A", kg: 3 }, { sector: "A", kg: 0 }])
    ], 2, false]
  ];
  cazuri.forEach(function (x) {
    const [nume, parts, nm, scala] = x;
    t(nume, ordineaSezon(c, sursa(parts, scala)), ordineaPublica(parts, nm, scala));
  });
}

console.log("\n=== 1b. Și câștigătorii de sector sunt aceiași ===");
{
  const c = lume();
  const parts = [
    om("A", [{ sector: "A", kg: 10 }, { sector: "B", kg: 4 }]),
    om("B", [{ sector: "A", kg: 8 }, { sector: "B", kg: 7 }]),
    om("C", [{ sector: "B", kg: 6 }, { sector: "A", kg: 9 }]),
    om("D", [{ sector: "B", kg: 5 }, { sector: "A", kg: 3 }])
  ];
  const of = vm.runInContext("clasamentOficial(" + JSON.stringify(sursa(parts)) + ")", c);
  const alMeu = {};
  Object.keys(of).forEach(k => { if (of[k].sectoare) alMeu[k] = of[k].sectoare; });
  const p = paginaPublica(parts, 2, false);
  const alPaginii = {};
  p.dateCampioni().sectoare.forEach(w => { alPaginii[w.p.id] = (alPaginii[w.p.id] || 0) + 1; });
  /* ordinea cheilor dintr-un obiect nu spune nimic: se compară pe perechi, sortate */
  const perechi = o => Object.keys(o).sort().map(k => k + ":" + o[k]);
  t("aceiași oameni, tot atâtea sectoare", perechi(alMeu), perechi(alPaginii));
  t("patru sectoare câștigate în două manșe",
    Object.keys(alMeu).reduce((s, k) => s + alMeu[k], 0), 4);
}

/* ================================================================
   2. Ce scoate socoteala pentru un om
   ================================================================ */
console.log("\n=== 2. Un concurs, om cu om ===");
{
  const c = lume();
  const parts = [
    om("A", [{ sector: "A", kg: 10, extra: 3 }, { sector: "A", kg: 4 }]),
    om("B", [{ sector: "A", kg: 8 }, { sector: "A", kg: 9 }]),
    om("C", [{ sector: "B", kg: 6 }, { sector: "B", kg: 2 }]),
    om("D", [{ sector: "B", kg: 1 }, { sector: "B", kg: 12, extra: 5 }])
  ];
  const of = vm.runInContext("clasamentOficial(" + JSON.stringify(sursa(parts)) + ")", c);
  t("fiecare are un loc, o dată", Object.keys(of).map(k => of[k].loc).sort(), [1, 2, 3, 4]);
  t("A a câștigat sectorul lui la prima manșă", of.A.sectoare, 1);
  t("B, la a doua", of.B.sectoare, 1);
  t("cel mai mare pește al zilei e al lui D", of.D.cmmc, true);
  t("…și nu al lui A", of.A.cmmc, false);
  t("cea mai bună manșă a lui D e a doua", [of.D.mansaNr, of.D.mansaKg], [2, 17]);
  t("…iar a lui A, prima", [of.A.mansaNr, of.A.mansaKg], [1, 13]);
}

console.log("\n=== 2b. La egalitate de pește, îl au amândoi ===");
{
  const c = lume();
  const parts = [
    om("A", [{ sector: "A", kg: 5, extra: 3 }]),
    om("B", [{ sector: "A", kg: 4, extra: 3 }]),
    om("C", [{ sector: "A", kg: 9 }])
  ];
  const of = vm.runInContext("clasamentOficial(" + JSON.stringify(sursa(parts)) + ")", c);
  t("amândoi au CMMC-ul", [of.A.cmmc, of.B.cmmc], [true, true]);
  t("cel fără pește extra, nu", of.C.cmmc, false);
}

console.log("\n=== 2c. Un concurs în care nu s-a prins nimic ===");
{
  const c = lume();
  const parts = [om("A", [{ sector: "A", kg: 0 }]), om("B", [{ sector: "A", kg: 0 }])];
  const of = vm.runInContext("clasamentOficial(" + JSON.stringify(sursa(parts)) + ")", c);
  t("tot au locuri, fără să crape nimic", Object.keys(of).length, 2);
  t("nimeni n-are CMMC", [of.A.cmmc, of.B.cmmc], [false, false]);
  t("nici sectoare câștigate", of.A.sectoare + of.B.sectoare, 0);
}

/* ================================================================
   3. Cartea, strânsă din rândurile lui
   ================================================================ */
console.log("\n=== 3. Cifrele cărții ===");
{
  const c = lume();
  const rec = { rows: [
    { comp: "Etapa 1", date: 1, loc: 1, sectoare: 2, cmmc: true, kg: 14, fish: 3.2, mansaKg: 9, mansaNr: 1 },
    { comp: "Etapa 2", date: 2, loc: 5, sectoare: 0, cmmc: false, kg: 20, fish: 1.1, mansaKg: 12, mansaNr: 2 },
    { comp: "Etapa 3", date: 3, loc: 3, sectoare: 1, cmmc: false, kg: 8, fish: 0, mansaKg: 5, mansaNr: 1 },
    { comp: "Etapa 4", date: 4, loc: 1, sectoare: 1, cmmc: true, kg: 11, fish: 4.9, mansaKg: 7, mansaNr: 2 }
  ] };
  const C = vm.runInContext("cartea(" + JSON.stringify(rec) + ")", c);
  t("patru concursuri", C.concursuri, 4);
  t("două de aur, unul de bronz", C.podium, [2, 0, 1]);
  t("trei podiumuri cu totul", C.podiumuri, 3);
  t("patru sectoare câștigate", C.sectoare, 4);
  t("două CMMC-uri", C.cmmcuri, 2);
  t("recordul e cel mai bun concurs, cu numele lui", [C.record.kg, C.record.comp], [20, "Etapa 2"]);
  t("cea mai bună manșă, cu care manșă a fost",
    [C.mansa.kg, C.mansa.nr, C.mansa.comp], [12, 2, "Etapa 2"]);
  t("cel mai mare pește al lui", C.pesteRecord, 4.9);
}

console.log("\n=== 3b. Un om abia venit ===");
{
  const c = lume();
  const C = vm.runInContext("cartea({rows:[{comp:'Etapa 1',loc:7,sectoare:0,cmmc:false,kg:3,fish:0,mansaKg:3,mansaNr:1}]})", c);
  t("un concurs", C.concursuri, 1);
  t("niciun podium", C.podium, [0, 0, 0]);
  t("niciun sector", C.sectoare, 0);
  t("niciun CMMC", C.cmmcuri, 0);
  t("recordul lui e tot ce are", C.record.kg, 3);
  t("fără pește extra, zero", C.pesteRecord, 0);
}

console.log("\n=== 3c. Cine n-a prins nimic n-are record ===");
{
  const c = lume();
  const C = vm.runInContext("cartea({rows:[{comp:'Etapa 1',loc:9,sectoare:0,cmmc:false,kg:0,fish:0,mansaKg:0,mansaNr:0}]})", c);
  t("concursul se numără", C.concursuri, 1);
  t("dar recordul nu se inventează", C.record, null);
  t("nici cea mai bună manșă", C.mansa, null);
}

console.log("\n=== 3d. Cartea unui om fără niciun rând ===");
{
  const c = lume();
  const C = vm.runInContext("cartea({})", c);
  t("nu crapă", C.concursuri, 0);
  t("toate pe zero", [C.podiumuri, C.sectoare, C.cmmcuri, C.pesteRecord], [0, 0, 0, 0]);
}

/* ================================================================
   4. Ecranul
   ================================================================ */
console.log("\n=== 4. Ecranul e legat cum trebuie ===");
{
  t("cartea se deschide atingând rândul", /onclick="toggleHist\(/.test(src), true);
  t("…și rândul spune asta", /atinge pentru cartea lui/.test(src), true);
  t("codul omului e scris pe rând", /rec\.cod \? 'cod '\+rec\.cod\+' · ' : ''/.test(src), true);
  t("nu s-a adăugat niciun ecran nou", (src.match(/<section/g) || []).length,
    (H.citeste("sezon.html").match(/<section/g) || []).length);

  const render = H.grabFunction(src, "renderTable");
  t("coloana «Loc» ține locul oficial", /place-badge '\+med\+'">'\+r\.loc/.test(render), true);
  t("punctul de sezon a trecut sub numele concursului", /fmtPts\(r\.place\)\+' pct'/.test(render), true);
  t("cartea se socotește din rândurile lui", /var C = cartea\(rec\);/.test(render), true);
  ["Concursuri", "Podiumuri", "Sectoare câștigate", "CMMC-uri", "Cel mai mare pește",
   "Media locurilor", "Record", "Cea mai bună manșă"].forEach(function (e) {
    t("scrie «"+e+"»", render.indexOf(e) > 0, true);
  });
  t("numele concursului nu se scrie ca HTML", /esc\(u\|\|''\)/.test(render), true);
}

console.log("\n=== 4b. Scala sectoarelor vine cu fiecare concurs ===");
{
  /* Fără ea, un concurs pescuit pe scala comună ar fi socotit aici pe locuri simple —
     adică alt podium decât cel de la premiere. */
  t("de la camerele live", (src.match(/scala: data\.scalaSectoare === true,/g) || []).length, 3);
  t("citită acolo unde se socotește", /var scala = src\.scala === true;/.test(H.grabFunction(src, "clasamentOficial")), true);
}

t.raport();
