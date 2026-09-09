/**
 * Clasamentul standurilor: după media pe cântărire, nu după totalul kg.
 *
 * Tabelul „Cel mai productiv stand" există ca să arate ce standuri sunt constant bune.
 * Sortat pe totalul kg, arăta altceva: de câte ori s-a nimerit standul la tragere. Un stand
 * folosit de zece ori aduna mai mult decât unul folosit de trei ori, chiar dacă al doilea
 * era vizibil mai bun — exact pe dos față de ce cauți când alegi unde să te așezi.
 *
 * E aceeași capcană ca la sectoarele inegale și ca la suma din sezon: cantitatea totală
 * depinde de câte ori s-a întâmplat, nu de cât de bun e.
 *
 * Media singură are gaura obișnuită — un stand folosit o SINGURĂ dată, cu o captură
 * norocoasă, ar sări primul. De aceea cele cu o singură cântărire rămân în tabel, cu
 * cifrele lor, dar fără loc.
 *
 * Se rulează bucata ADEVĂRATĂ de sortare din sezon.html, nu o copie.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const t = H.creeazaVerificator();
const src = H.citeste("sezon.html");

/* Sortarea stă înăuntrul lui loadSeason, deci se taie între două repere stabile. */
const start = src.indexOf("    var PRAG_STAND = 2;");
const stop = src.indexOf("    comps.sort(", start);
if (start < 0 || stop < 0) throw new Error("nu găsesc bucata de clasare a standurilor din sezon.html");
const clasare = src.slice(start, stop);

const ctx = { console };
vm.createContext(ctx);

/** [stand, cântăriri, total kg] → standurile clasate, în ordine */
function claseaza(randuri) {
  ctx.byLoc = { "Remus Lake": {} };
  randuri.forEach(function (r) {
    ctx.byLoc["Remus Lake"][r[0]] = { stand: r[0], uses: r[1], totalKg: r[2] };
  });
  vm.runInContext(clasare, ctx);
  return ctx.locStands[0].standuri;
}
const ordine = r => r.map(x => x.stand);
const clasati = r => r.filter(x => x.uses >= 2).map(x => x.stand);

/* ================================================================
   1. Cazul care motivează schimbarea.
   ================================================================ */
console.log("\n=== 1. Cine e cu adevărat productiv ===");
{
  // standul 46: folosit des, mediocru. Standul 12: folosit rar, dar bun.
  const r = claseaza([["46", 10, 62], ["12", 3, 40]]);
  t("standul mai bun iese primul, deși are total mai mic", ordine(r), ["12", "46"]);
  t("mediile sunt socotite", [r[0].medie, r[1].medie], [40 / 3, 6.2]);
  t("(control) pe total, ordinea era invers",
    [["46", 10, 62], ["12", 3, 40]].sort((a, b) => b[2] - a[2]).map(x => x[0]), ["46", "12"]);
}

/* ================================================================
   2. Paza împotriva norocului de o dată.
   ================================================================ */
console.log("\n=== 2. O singură cântărire nu dă loc ===");
{
  const r = claseaza([["7", 1, 30], ["3", 6, 60], ["9", 4, 32]]);
  t("standul cu o singură cântărire nu ia locul întâi", ordine(r)[0], "3");
  t("…și stă la urmă, oricât de mare i-ar fi media", ordine(r)[ordine(r).length - 1], "7");
  t("media lui e totuși cea mai mare", r.find(x => x.stand === "7").medie, 30);
  t("clasate rămân doar cele cu cel puțin două cântăriri", clasati(r), ["3", "9"]);
}

/* ================================================================
   3. Departajări.
   ================================================================ */
console.log("\n=== 3. La medii egale ===");
{
  const r = claseaza([["1", 2, 20], ["2", 8, 80]]);
  t("câștigă cel probat de mai multe ori", ordine(r), ["2", "1"]);
}

/* ================================================================
   4. Ce NU trebuie să se schimbe.
   ================================================================ */
console.log("\n=== 4. Fără efecte nedorite ===");
{
  const r = claseaza([["5", 3, 30], ["6", 3, 15]]);
  t("la același număr de cântăriri, ordinea e cea de dinainte", ordine(r), ["5", "6"]);

  t("un singur stand nu crapă", ordine(claseaza([["1", 4, 40]])), ["1"]);
  t("stand fără cântăriri are media zero, nu împarte la zero",
    claseaza([["1", 0, 0], ["2", 2, 10]]).find(x => x.stand === "1").medie, 0);
  t("…și stă la urmă", ordine(claseaza([["1", 0, 0], ["2", 2, 10]]))[0], "2");
}

t.raport();
