/**
 * Punctele la sectoare inegale: locuri simple sau aduse pe aceeași scală.
 *
 * Regulamentul de aici spune „locul 3 ia 3 puncte", oricât de mare e sectorul.
 * Scala comună e mai dreaptă când sectoarele diferă mult, dar dă puncte
 * fracționare (2,25 · 3,5 · 4,75) pe care nu le poți explica la premiere.
 * De aceea e o alegere, cu locurile simple ca implicit.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));

function aplicatie(scala) {
  const ctx = {
    state: { participants: [], manche: 1, numManse: 2, sectors: ["A", "B", "C"], scalaSectoare: scala },
    console
  };
  vm.createContext(ctx);
  vm.runInContext(
    ["emptyManche", "numManse", "scalaSectoare", "manseRange", "ensureManche", "mOf",
     "sectorOfM", "standOfM", "mancheDeAfisat", "setStandSector", "cantOfM", "extraOfM",
     "cmmcOfM", "totalOfM", "cmmcAward", "pointsMapS", "mancheDisputata"]
      .map(n => grabFunction(src, n)).join("\n"), ctx);
  return ctx;
}

/** sectoare de mărimile date, fiecare cu capturi descrescătoare */
function puncte(scala, sizes) {
  const ctx = aplicatie(scala);
  const parts = []; let id = 0;
  sizes.forEach(function (n, si) {
    for (let i = 0; i < n; i++) {
      id++; const sec = ctx.state.sectors[si];
      parts.push({
        id: "p" + id, sector: sec, stand: String(id), nume: "p" + id, prenume: "",
        m: { 1: { catches: [100 - i], extras: [], sector: sec, stand: String(id) },
             2: { catches: [0], extras: [], sector: sec, stand: String(id) } }
      });
    }
  });
  ctx.state.participants = parts;
  const pm = JSON.parse(vm.runInContext("JSON.stringify(pointsMapS(1))", ctx));
  const g = {};
  parts.forEach(function (p) { (g[p.sector] = g[p.sector] || []).push(Math.round(pm[p.id] * 100) / 100); });
  return g;
}

/* ---------- 1. implicit: locurile din sector ---------- */
console.log("\n=== 1. Implicit sunt locurile din sector ===");
{
  const ctx = aplicatie(undefined);
  t("fără setare, scala e oprită", vm.runInContext("scalaSectoare()", ctx), false);
  vm.runInContext("state.scalaSectoare=false;", ctx);
  t("explicit oprită, tot oprită", vm.runInContext("scalaSectoare()", ctx), false);
}
{
  const g = puncte(false, [6, 5, 5]);
  t("sectorul de 6 dă locurile 1…6", g.A, [1, 2, 3, 4, 5, 6]);
  t("sectorul de 5 dă locurile 1…5, fără zecimale", g.B, [1, 2, 3, 4, 5]);
  t("locul 3 ia exact 3 puncte", g.B[2], 3);
}

/* ---------- 2. scala comună, când e cerută ---------- */
console.log("\n=== 2. Scala comună, când o alegi ===");
{
  const g = puncte(true, [6, 5, 5]);
  t("sectorul mare rămâne 1…6", g.A, [1, 2, 3, 4, 5, 6]);
  t("sectorul mic se întinde pe aceeași scală", g.B, [1, 2.25, 3.5, 4.75, 6]);
  t("ultimul dintr-un sector de 5 ia tot 6 puncte", g.B[4], 6);
}

/* ---------- 3. la sectoare egale, cele două variante coincid ---------- */
console.log("\n=== 3. Sectoare egale: aceleași puncte în ambele ===");
{
  const simplu = puncte(false, [5, 5, 5]);
  const scala  = puncte(true,  [5, 5, 5]);
  t("sector A identic", simplu.A, scala.A);
  t("sector B identic", simplu.B, scala.B);
  t("sector C identic", simplu.C, scala.C);
  t("și sunt chiar locurile", simplu.A, [1, 2, 3, 4, 5]);
}

/* ---------- 4. media locurilor la egalitate rămâne, în ambele ---------- */
console.log("\n=== 4. Egalitatea de kilograme se împarte, ca înainte ===");
{
  // doi la egalitate pe locurile 2 și 3 iau amândoi 2,5 — convenția FIPS, neatinsă
  const ctx = aplicatie(false);
  ctx.state.participants = [
    { id: "a", sector: "A", stand: "1", nume: "a", prenume: "", m: { 1: { catches: [9], extras: [], sector: "A", stand: "1" }, 2: { catches: [0], extras: [] } } },
    { id: "b", sector: "A", stand: "2", nume: "b", prenume: "", m: { 1: { catches: [5], extras: [], sector: "A", stand: "2" }, 2: { catches: [0], extras: [] } } },
    { id: "c", sector: "A", stand: "3", nume: "c", prenume: "", m: { 1: { catches: [5], extras: [], sector: "A", stand: "3" }, 2: { catches: [0], extras: [] } } },
    { id: "d", sector: "A", stand: "4", nume: "d", prenume: "", m: { 1: { catches: [1], extras: [], sector: "A", stand: "4" }, 2: { catches: [0], extras: [] } } }
  ];
  const pm = JSON.parse(vm.runInContext("JSON.stringify(pointsMapS(1))", ctx));
  t("cei doi la egalitate iau media locurilor 2 și 3", [pm.b, pm.c], [2.5, 2.5]);
  t("iar suma pe sector rămâne 1+2+3+4", pm.a + pm.b + pm.c + pm.d, 10);
}

/* ---------- 5. comutatorul din Contul meu ---------- */
console.log("\n=== 5. Comutatorul ===");
{
  t("există butonul de locuri simple", src.indexOf('id="sc-simplu"') >= 0, true);
  t("și cel de scală comună", src.indexOf('id="sc-scala"') >= 0, true);
  const set = grabFunction(src, "setScalaSectoare");
  t("alegerea se salvează", /save\(\)/.test(set), true);
  t("și clasamentul se reface pe loc", /renderRank\(\)/.test(set), true);

  const norm = grabFunction(src, "normalize");
  t("valoarea implicită e pusă la normalizare",
    /state\.scalaSectoare=false/.test(norm), true);
}

t.raport();
