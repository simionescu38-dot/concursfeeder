/**
 * Poza trimisă pe WhatsApp tăia clasamentul la primii 10 și îl sorta întotdeauna după
 * kilograme, oricare ar fi fost ecranul. La un concurs pe puncte putea, așa, să anunțe
 * alt câștigător decât clasamentul oficial — iar poza e exact ce ajunge la pescari.
 * Aici se verifică hotărârea, nu pânza: planImagine() spune ce intră în poză.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));

const FUNCTII = [
  "emptyManche", "numManse", "scalaSectoare", "manseRange", "ensureManche", "mOf",
  "sectorOfM", "standOfM", "mancheDeAfisat", "setStandSector", "cantOfM", "extraOfM",
  "cmmcOfM", "totalOfM", "cmmcAward", "absentLaMansa", "pointsMapS", "mancheDisputata",
  "pointsCombo", "normalize", "nameOf", "byStand", "sortRankS", "sortByPointsS",
  "currentPmap", "fmt", "fmtPts", "planImagine"
];

/** aplicația, cu ecranul pus pe ce alege organizatorul din Clasamente */
function aplicatie(opt) {
  opt = opt || {};
  const ctx = {
    state: {
      name: opt.nume !== undefined ? opt.nume : "Caciula de sambata",
      participants: [], sectors: ["A", "B", "C"], sponsors: [], rules: "",
      numManse: opt.numManse || 3, manche: 1
    },
    rankMode: opt.rankMode || "fin",
    finMethod: opt.finMethod || "kg",
    rankScope: opt.rankScope !== undefined ? opt.rankScope : "total",
    console,
    num: x => parseFloat(x) || 0,
    save() {},
    roDate: () => "22 august 2026"
  };
  vm.createContext(ctx);
  vm.runInContext(FUNCTII.map(n => grabFunction(src, n)).join("\n"), ctx);
  return ctx;
}

/** n pescari, standuri 1..n, sectoare rotite, greutăți diferite pe fiecare manșă */
function pescari(ctx, n, manse) {
  ctx.state.participants = [];
  for (let i = 0; i < n; i++) {
    const m = {};
    for (let mi = 1; mi <= manse; mi++) {
      m[mi] = {
        catches: [3 + ((i * 7 + mi * 3) % 11) + (i % 5) / 10],
        catchTimes: [], catchPhotos: [], extras: [],
        stand: String(i + 1),
        sector: ["A", "B", "C"][i % 3]
      };
    }
    ctx.state.participants.push({
      id: "p" + i, prenume: "Pescar", nume: String(i + 1),
      stand: String(i + 1), sector: ["A", "B", "C"][i % 3], msv: 1, m: m
    });
  }
  return ctx.state.participants;
}

/** toate numele dintr-un plan, din toate secțiunile */
function numeleDin(plan) {
  const out = [];
  plan.sectiuni.forEach(s => s.randuri.forEach(r => out.push(r.nume)));
  return out;
}

/* ================================================================
   1. Nimeni nu mai cade pe dinafară
   ================================================================ */
console.log("\n=== 1. Toți participanții intră în poză ===");
{
  [
    { eticheta: "final pe kg", opt: { rankMode: "fin", finMethod: "kg" } },
    { eticheta: "final pe puncte, General", opt: { rankMode: "fin", finMethod: "pct", rankScope: "total" } },
    { eticheta: "final pe puncte, o manșă", opt: { rankMode: "fin", finMethod: "pct", rankScope: 2 } },
    { eticheta: "pe sectoare", opt: { rankMode: "sec" } }
  ].forEach(caz => {
    const ctx = aplicatie(caz.opt);
    pescari(ctx, 14, 3);
    const plan = vm.runInContext("planImagine()", ctx);
    t("14 pescari, " + caz.eticheta + ": toți 14 în poză", numeleDin(plan).length, 14);
    t("…fără nume repetat", new Set(numeleDin(plan)).size, 14);
  });

  // concursul mare din simulare: 50 de oameni, niciunul tăiat
  const mare = aplicatie({ rankMode: "fin", finMethod: "pct", rankScope: "total" });
  pescari(mare, 50, 3);
  const planMare = vm.runInContext("planImagine()", mare);
  t("50 de pescari: toți 50 în poză", numeleDin(planMare).length, 50);

  // capcana veche, exact: al 11-lea om exista, dar nu ajungea niciodată în poză
  const ctx11 = aplicatie({ rankMode: "fin", finMethod: "kg" });
  pescari(ctx11, 11, 2);
  const p11 = vm.runInContext("planImagine()", ctx11);
  t("al 11-lea pescar nu mai e tăiat", numeleDin(p11).length, 11);
}

/* ================================================================
   2. Poza urmează ecranul, nu o ordine a ei
   ================================================================
   Aici era greșeala tăcută: poza sorta după kilograme chiar și când concursul
   se judeca după puncte, deci putea anunța alt câștigător decât cel oficial. */
console.log("\n=== 2. Ordinea din poză e cea de pe ecran ===");
{
  const ctx = aplicatie({ rankMode: "fin", finMethod: "pct", rankScope: "total" });
  pescari(ctx, 14, 3);
  const plan = vm.runInContext("planImagine()", ctx);
  const dinPoza = numeleDin(plan);
  const pePuncte = vm.runInContext(
    "sortByPointsS(state.participants, currentPmap(), rankScope).map(nameOf)", ctx);
  const peKg = vm.runInContext("sortRankS(state.participants, rankScope).map(nameOf)", ctx);
  t("ordinea e cea pe puncte", dinPoza, pePuncte);
  t("…iar cele două chiar diferă (altfel testul n-ar dovedi nimic)", peKg.join("|") !== pePuncte.join("|"), true);
  t("câștigătorul din poză e cel de pe ecran", dinPoza[0], pePuncte[0]);

  const peKgCtx = aplicatie({ rankMode: "fin", finMethod: "kg" });
  pescari(peKgCtx, 14, 3);
  const planKg = vm.runInContext("planImagine()", peKgCtx);
  t("pe kg, ordinea e cea după kilograme",
    numeleDin(planKg), vm.runInContext("sortRankS(state.participants, rankScope).map(nameOf)", peKgCtx));
}

/* ================================================================
   3. Pe sectoare: câte o secțiune, cu aceiași oameni ca pe ecran
   ================================================================ */
console.log("\n=== 3. Modul pe sectoare ===");
{
  const ctx = aplicatie({ rankMode: "sec" });
  pescari(ctx, 14, 3);
  const plan = vm.runInContext("planImagine()", ctx);
  t("o secțiune pentru fiecare sector", plan.sectiuni.length, 3);
  t("secțiunile poartă numele sectorului", plan.sectiuni.map(s => s.titlu.split(" ·")[0]),
    ["Sector A", "Sector B", "Sector C"]);
  t("toți cei 14 sunt împărțiți pe sectoare",
    plan.sectiuni.reduce((n, s) => n + s.randuri.length, 0), 14);
  t("titlul spune câți sunt în sector", /5 participanți/.test(plan.sectiuni[0].titlu), true);
  t("pe sectoare se arată punctele", plan.arataPct, true);
  t("primul din sector are medalie de aur", plan.sectiuni[1].randuri[0].medal, "🥇");
}

/* ================================================================
   4. General pe puncte: coloane de manșă, ca pe ecran
   ================================================================ */
console.log("\n=== 4. Coloanele de manșă la General ===");
{
  const ctx = aplicatie({ rankMode: "fin", finMethod: "pct", rankScope: "total", numManse: 3 });
  pescari(ctx, 8, 3);
  const plan = vm.runInContext("planImagine()", ctx);
  t("poza are coloane pentru cele 3 manșe", plan.manse, [1, 2, 3]);
  t("fiecare rând are cele 3 celule de manșă", plan.sectiuni[0].randuri[0].manse.length, 3);
  t("celulele au și puncte, și kilograme",
    plan.sectiuni[0].randuri[0].manse.every(c => c.pct !== "" && c.kg !== ""), true);

  // manșa 3 nepescuită încă: iese cu liniuță, nu cu zero
  const partial = aplicatie({ rankMode: "fin", finMethod: "pct", rankScope: "total", numManse: 3 });
  pescari(partial, 8, 3);
  partial.state.participants.forEach(p => { p.m[3].catches = []; });
  const planPartial = vm.runInContext("planImagine()", partial);
  const celule3 = planPartial.sectiuni[0].randuri.map(r => r.manse[2]);
  t("manșa nedisputată iese cu liniuță", celule3.every(c => c.pct === "–"), true);
  t("…și fără kilograme", celule3.every(c => c.kg === ""), true);
  t("manșele disputate rămân cu puncte",
    planPartial.sectiuni[0].randuri[0].manse[0].pct !== "–", true);
}

/* ================================================================
   5. Antetul, CMMC și coloana de puncte
   ================================================================ */
console.log("\n=== 5. Antetul poza-i spune ce e ===");
{
  const ctx = aplicatie({ rankMode: "fin", finMethod: "pct", rankScope: "total", nume: "Caciula de sambata" });
  pescari(ctx, 6, 3);
  const plan = vm.runInContext("planImagine()", ctx);
  t("titlul e numele concursului", plan.titlu, "Caciula de sambata");
  t("subtitlul spune că e pe puncte", /Final pe puncte/.test(plan.subtitlu), true);
  t("…și pentru care manșe", /General/.test(plan.subtitlu), true);

  const oManche = aplicatie({ rankMode: "fin", finMethod: "kg", rankScope: 2 });
  pescari(oManche, 6, 3);
  const planM = vm.runInContext("planImagine()", oManche);
  t("pe o manșă anume, subtitlul o numește", /Manșa 2/.test(planM.subtitlu), true);
  t("pe kg nu se arată coloana de puncte", planM.arataPct, false);
  t("…dar kilogramele sunt acolo", planM.sectiuni[0].randuri[0].kg.length > 0, true);

  // concurs fără nume: poza nu rămâne cu titlu gol
  const faraNume = aplicatie({ rankMode: "fin", finMethod: "kg", nume: "" });
  pescari(faraNume, 3, 2);
  t("fără nume de concurs, titlul cade pe unul general",
    vm.runInContext("planImagine()", faraNume).titlu, "Concurs pescuit");

  // CMMC: apare doar dacă s-a trecut un pește mare
  t("fără pește mare trecut, banda CMMC lipsește",
    vm.runInContext("planImagine()", ctx).cmmc, "");
  // CMMC = cel mai mare pește, adică cel mai mare dintre peștii trecuți separat (extras)
  ctx.state.participants[2].m[1].extras = [7.5];
  const cuCmmc = vm.runInContext("planImagine()", ctx);
  t("cu pește mare trecut, banda CMMC apare", /CMMC/.test(cuCmmc.cmmc), true);
  t("…cu numele celui care l-a prins", /Pescar 3/.test(cuCmmc.cmmc), true);
}

/* ================================================================
   6. Statisticile nu sunt un clasament
   ================================================================ */
console.log("\n=== 6. Ecranul de statistici ===");
{
  const ctx = aplicatie({ rankMode: "stat", finMethod: "pct", rankScope: "total" });
  pescari(ctx, 9, 3);
  const plan = vm.runInContext("planImagine()", ctx);
  t("se desenează clasamentul final, nu o poză goală", numeleDin(plan).length, 9);
  t("subtitlul spune ce s-a desenat", /Final pe puncte/.test(plan.subtitlu), true);
}

/* ================================================================
   7. Nicio tăietură rămasă în fișierele livrate
   ================================================================ */
console.log("\n=== 7. Tăietura la primii 10 a dispărut ===");
{
  const poza = grabFunction(src, "planImagine") + grabFunction(src, "drawShareImage");
  t("planul nu taie lista", /slice\(0\s*,\s*10\)/.test(poza), false);
  t("pânza nu mai are înălțime fixă", /var W=1080,\s*H=1440/.test(poza), false);
  t("înălțimea se socotește din listă", /inaltimea\(/.test(poza), true);

  const sezon = citeste(path.join(RADACINA, "sezon.html"));
  const pozaSezon = grabFunction(sezon, "drawSeasonImage");
  t("nici poza de sezon nu taie", /slice\(0\s*,\s*10\)/.test(pozaSezon), false);
  t("…și crește și ea după listă", /inaltimea\(/.test(pozaSezon), true);
  // punctele de sezon au devenit media pe etapă (ptsAfisat), nu suma
  t("…și arată punctele când e sortată pe puncte", /fmtPts\(ptsAfisat\(rec\)\)/.test(pozaSezon), true);
  t("…iar neclasații rămân în afara podiumului", /filter\(function\(p\)\{ return p\.clasat; \}\)/.test(pozaSezon), true);
}

t.raport();
