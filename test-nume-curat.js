/**
 * Numerotarea de mână din fața numelui.
 *
 * Cât timp ordinea nu se vedea nicăieri în aplicație, organizatorul și-a numerotat
 * pescarii chiar în câmpul de nume: „6.Cristi Enache". Clasamentul își arată singur
 * locurile, iar standul scrie sub nume — deci numărul e dublură, și ajunge așa pe
 * ecranele tuturor, prin camera live.
 *
 * Se taie doar din capul numelui afișat. Un nume nu are voie să fie ciuntit din
 * mijloc, iar o cifră care chiar e numele omului nu are voie să dispară.
 *
 * Testul rulează codul REAL din index.html.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(["curataNumarul", "nameOf"].map(n => grabFunction(src, n)).join("\n"), ctx);

/** curăță un pescar și întoarce numele afișat plus dacă s-a schimbat ceva */
function curata(prenume, nume) {
  ctx.p = { prenume: prenume, nume: nume };
  const schimbat = vm.runInContext("curataNumarul(p)", ctx);
  return { nume: vm.runInContext("nameOf(p)", ctx), schimbat: schimbat };
}

/* ================================================================
   1. Numerotarea chiar se duce
   ================================================================ */
console.log("\n=== 1. Numărul din fața numelui pleacă ===");
{
  t("6.Cristi Enache rămâne Cristi Enache", curata("6.Cristi", "Enache").nume, "Cristi Enache");
  t("…și spune că a schimbat ceva", curata("6.Cristi", "Enache").schimbat, true);
  t("un singur cuvânt: 3.Nechita", curata("3.Nechita", "").nume, "Nechita");
  t("numărul scris pe câmpul de nume, fără prenume", curata("", "12.Seby").nume, "Seby");
  t("cu spațiu după punct", curata("5. Sandel", "Hartopeanu").nume, "Sandel Hartopeanu");
  t("cu paranteză în loc de punct", curata("8)Pasa", "Vlad").nume, "Pasa Vlad");
  t("cu spații în față", curata("  4.Costel", "Titiana").nume, "Costel Titiana");
  t("număr de două cifre", curata("12.Seby", "").nume, "Seby");
}

/* ================================================================
   2. Ce NU are voie să atingă
   ================================================================ */
console.log("\n=== 2. Numele întregi rămân întregi ===");
{
  const curat = curata("Cristi", "Enache");
  t("un nume fără număr rămâne cum e", curat.nume, "Cristi Enache");
  t("…și spune că n-a schimbat nimic", curat.schimbat, false);

  t("nu taie din mijlocul numelui", curata("Ion", "2.Popescu").nume, "Ion 2.Popescu");
  t("nu taie o cifră fără punct", curata("2Chei", "Popescu").nume, "2Chei Popescu");
  t("nu taie un nume care e doar cifre", curata("7", "").nume, "7");
  t("nu taie o poreclă cu punct în mijloc", curata("Gigi", "M.Popescu").nume, "Gigi M.Popescu");
  t("nu taie o inițială", curata("I.", "Popescu").nume, "I. Popescu");
  t("nu taie un număr prea lung ca să fie o numerotare", curata("2024.Cupa", "").nume, "2024.Cupa");
  t("pescarul fără nume rămâne cum era", curata("", "").nume, "—");
}

/* ================================================================
   3. Curățarea se face o dată, nu la fiecare trecere
   ================================================================ */
console.log("\n=== 3. A doua trecere nu mai are ce curăța ===");
{
  ctx.p = { prenume: "6.Cristi", nume: "Enache" };
  t("prima trecere curăță", vm.runInContext("curataNumarul(p)", ctx), true);
  t("a doua nu mai are ce", vm.runInContext("curataNumarul(p)", ctx), false);
  t("iar numele a rămas întreg", vm.runInContext("nameOf(p)", ctx), "Cristi Enache");
}

/* ================================================================
   4. Toate drumurile pe care intră un nume trec prin curățare
   ================================================================ */
console.log("\n=== 4. Nu rămâne nicio ușă deschisă ===");
{
  ["addParticipant", "saveEdit", "doImport", "normalize"].forEach(function (fn) {
    t(fn + " curăță numele", /curataNumarul\(/.test(grabFunction(src, fn)), true);
  });
  t("normalize salvează după ce a curățat",
    /if\(curatate\) save\(\);/.test(grabFunction(src, "normalize")), true);
}

t.raport();
