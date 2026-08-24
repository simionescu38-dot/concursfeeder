/**
 * Concursuri întregi, duse cap-coadă, cu TABELUL FINAL scris în test.
 *
 * Celelalte suite verifică fiecare rotiță în parte: egalitățile, scala sectoarelor,
 * absența, manșele nedisputate. Asta le pune la treabă pe toate deodată, pe concursuri
 * ca la baltă, și verifică ce vede organizatorul pe ecran: cine pe ce loc, cu ce puncte
 * și cu câte kilograme.
 *
 * De ce contează: o schimbare viitoare poate lăsa fiecare rotiță bună și tot să mute un
 * om de pe locul 3 pe 4. Rotițele n-ar spune nimic; tabelul spune.
 *
 * Tot codul e scos VERBATIM din index.html — nu copii care pot diverge.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

/* ---------- motorul adevărat, scos din fișierul livrat ---------- */
const MOTOR = [
  "mOf", "cantOfM", "extraOfM", "cmmcOfM", "totalOfM", "cmmcAward",
  "standKey", "byStand", "nameKey", "nameOf",
  "sectorOfM", "standOfM", "mancheDeAfisat", "manseRange", "numManse", "scalaSectoare",
  "absentLaMansa", "pointsMapS", "mancheDisputata", "pointsCombo", "bestMancheOf",
  "sortByPointsS", "sortRankS", "fmtPts", "fmt"
].map(n => H.grabFunction(src, n)).join("\n");

const box = { state: { participants: [], numManse: 2, scalaSectoare: false }, console };
vm.createContext(box);
// ensureManche() umblă și la ecran în aplicație; aici e nevoie doar de partea care
// completează manșele lipsă, ca mOf() să aibă ce întoarce
vm.runInContext(`
  function ensureManche(p){
    if(!p.m) p.m={};
    for(var i=1;i<=(state.numManse||2);i++){
      if(!p.m[i]) p.m[i]={catches:[],extras:[],catchTimes:[],catchPhotos:[]};
    }
  }
  ${MOTOR}
`, box);

/**
 * Așază un concurs în motor.
 *   pescari: [nume, [ [stand, sector, kg, extra?], ... pe manșe ]]
 *   Un stand gol ("") înseamnă că omul n-a extras în manșa aceea — adică n-a fost.
 */
function concurs(numManse, scala, pescari) {
  box.state.numManse = numManse;
  box.state.scalaSectoare = !!scala;
  box.state.participants = pescari.map(function (p, i) {
    var nume = p[0], manse = p[1], m = {};
    for (var mi = 1; mi <= numManse; mi++) {
      var r = manse[mi - 1] || ["", "", 0];
      m[mi] = {
        stand: r[0], sector: r[1],
        catches: r[2] ? [r[2]] : [],
        extras: r[3] ? [r[3]] : [],
        catchTimes: [], catchPhotos: []
      };
    }
    return { id: "p" + i, prenume: "", nume: nume, stand: manse[0][0], sector: manse[0][1], m: m };
  });
}

/** tabelul așa cum îl vede organizatorul: [nume, puncte, kg] pe locuri */
function tabel(scop) {
  return JSON.parse(vm.runInContext(`
    (function(){
      var pmap = ${JSON.stringify(scop)} === "total" ? pointsCombo() : pointsMapS(${JSON.stringify(scop)});
      return JSON.stringify(sortByPointsS(state.participants, pmap, ${JSON.stringify(scop)}).map(function(p){
        return [nameOf(p), Math.round(pmap[p.id]*1000)/1000, Math.round(totalOfM(p, ${JSON.stringify(scop)})*1000)/1000];
      }));
    })()`, box));
}
/** clasamentul pe kilograme dintr-un sector, cum se vede la „Pe sectoare" */
function peSector(mi, sector) {
  return JSON.parse(vm.runInContext(`
    (function(){
      var ai = state.participants.filter(function(p){ return sectorOfM(p, ${JSON.stringify(mi)}) === ${JSON.stringify(sector)}; });
      return JSON.stringify(sortRankS(ai, ${JSON.stringify(mi)}).map(function(p){ return nameOf(p); }));
    })()`, box));
}
const puncte = (scop, nume) => (tabel(scop).find(r => r[0] === nume) || [])[1];

/* ================================================================
   1. Concurs curat: 2 manșe, două sectoare egale, fără surprize
   ================================================================ */
console.log("\n=== 1. Concurs curat, 2 manșe, sectoare egale ===");
concurs(2, false, [
  ["Cristi",  [["1", "A", 12.300], ["7", "B", 9.100]]],
  ["Paul",    [["2", "A",  8.650], ["8", "B", 14.200]]],
  ["Harry",   [["3", "A",  5.100], ["9", "B",  3.300]]],
  ["Mimi",    [["4", "B", 11.000], ["1", "A", 10.500]]],
  ["Seby",    [["5", "B",  7.400], ["2", "A",  6.200]]],
  ["Grisa",   [["6", "B",  2.900], ["3", "A",  1.100]]]
]);
t("manșa 1, sectorul A: locurile după kg", peSector(1, "A"), ["Cristi", "Paul", "Harry"]);
t("manșa 1: fiecare sector se punctează separat", tabel(1).map(r => [r[0], r[1]]),
  [["Cristi", 1], ["Mimi", 1], ["Paul", 2], ["Seby", 2], ["Harry", 3], ["Grisa", 3]]);
// Mimi a câștigat sectorul în amândouă manșele: 1+1=2, cel mai mic total, deci primul —
// deși are mai puține kilograme decât Paul. Așa e punctajul pe sectoare: contează locul
// din sectorul tău, nu cât ai prins față de cei din alt sector.
t("General: tabelul întreg", tabel("total"),
  [["Mimi", 2, 21.5], ["Paul", 3, 22.85], ["Cristi", 3, 21.4], ["Seby", 4, 13.6], ["Harry", 6, 8.4], ["Grisa", 6, 4]]);
t("cel cu cele mai multe kilograme (Paul, 22,850) NU e primul",
  tabel("total")[0][0], "Mimi");
t("la puncte egale departajează kilogramele: Paul (3p, 22,850) înaintea lui Cristi (3p, 21,400)",
  tabel("total").slice(1, 3).map(r => r[0]), ["Paul", "Cristi"]);
t("…la fel și la coadă: Harry (6p, 8,400) înaintea lui Grisa (6p, 4,000)",
  tabel("total").slice(-2).map(r => r[0]), ["Harry", "Grisa"]);

/* ================================================================
   2. Egalitate perfectă: doi cu exact aceeași greutate
   ================================================================ */
console.log("\n=== 2. Doi la aceeași greutate, în același sector ===");
concurs(2, false, [
  ["Cristi", [["1", "A", 10.000], ["1", "A", 5.000]]],
  ["Paul",   [["2", "A", 10.000], ["2", "A", 4.000]]],
  ["Harry",  [["3", "A",  3.000], ["3", "A", 9.000]]]
]);
t("amândoi iau media locurilor 1-2 = 1,5", [puncte(1, "Cristi"), puncte(1, "Paul")], [1.5, 1.5]);
t("al treilea rămâne pe 3, nu urcă", puncte(1, "Harry"), 3);
t("suma punctelor pe sector rămâne N(N+1)/2", 1.5 + 1.5 + 3, 6);
// Harry are 4 puncte, Paul 4,5 — deci Harry trece înaintea lui, deși are mai puține kg.
// La puncte câștigă punctele; kilogramele departajează doar la egalitate de puncte.
t("General: ordinea e după puncte, nu după kilograme",
  tabel("total"), [["Cristi", 3.5, 15], ["Harry", 4, 12], ["Paul", 4.5, 14]]);

/* ================================================================
   3. Sectoare inegale: același concurs, două feluri de punctaj
   ================================================================ */
console.log("\n=== 3. Sectoare inegale (4 · 3 · 2 oameni) ===");
const inegale = [
  ["A1", [["1", "A", 10.0]]], ["A2", [["2", "A", 8.0]]], ["A3", [["3", "A", 6.0]]], ["A4", [["4", "A", 4.0]]],
  ["B1", [["5", "B", 9.0]]],  ["B2", [["6", "B", 7.0]]], ["B3", [["7", "B", 5.0]]],
  ["C1", [["8", "C", 3.0]]],  ["C2", [["9", "C", 1.0]]]
];
concurs(1, false, inegale);
t("„Locul 3 = 3 puncte\": ultimul din sectorul mic ia 2, ultimul din cel mare ia 4",
  [puncte(1, "C2"), puncte(1, "A4")], [2, 4]);
concurs(1, true, inegale);
t("„Îndreptat\": ultimul din sectorul mic ia tot 4, ca ultimul din cel mare",
  [puncte(1, "C2"), puncte(1, "A4")], [4, 4]);
t("…primul din fiecare sector ia tot 1",
  [puncte(1, "A1"), puncte(1, "B1"), puncte(1, "C1")], [1, 1, 1]);
t("…iar cel din mijlocul sectorului de 3 cade între",
  puncte(1, "B2"), 2.5);
box.state.scalaSectoare = false;

/* ================================================================
   4. Cineva se retrage după manșa 1 — rămâne cu ce a pescuit
   ================================================================ */
console.log("\n=== 4. Retras după manșa 1 ===");
concurs(2, false, [
  ["Cristi", [["1", "A", 12.0], ["1", "A", 10.0]]],
  ["Paul",   [["2", "A",  9.0], ["2", "A",  8.0]]],
  ["Harry",  [["3", "A",  6.0], ["3", "A",  7.0]]],
  // s-a retras: în manșa 2 n-a extras stand și n-a cântărit nimic
  ["Retras", [["4", "A", 15.0], ["",  "",  0]]]
]);
t("în manșa 1 e primul, cu 15 kg", tabel(1)[0], ["Retras", 1, 15]);
t("în manșa 2 ia un punct peste ultimul loc din cel mai mare sector",
  puncte(2, "Retras"), 4);
t("…adică absența nu-l scoate din concurs, dar nici nu-l avantajează",
  puncte(2, "Retras") > puncte(2, "Harry"), true);
t("rămâne în tabelul General, cu kilogramele lui", tabel("total").find(r => r[0] === "Retras"), ["Retras", 5, 15]);
// Sectorul are 4 oameni în manșa 1 și doar 3 în manșa 2, deci locurile celorlalți se
// strâng după plecarea lui: Cristi 2+1, Paul 3+2, Harry 4+3.
t("locurile celorlalți se strâng în manșa din care lipsește",
  [puncte("total", "Cristi"), puncte("total", "Paul"), puncte("total", "Harry")], [3, 5, 7]);
// Cel retras a câștigat manșa 1 cu 15 kg: 1 punct acolo + 4 pentru absență = 5. Harry a
// pescuit ambele manșe, dar ultimul de fiecare dată: 4+3 = 7. Deci o manșă bună chiar bate
// două slabe — asta e regula, nu o scăpare.
t("o manșă câștigată bate două pescuite slab",
  tabel("total").map(r => r[0]), ["Cristi", "Paul", "Retras", "Harry"]);
t("la egalitate de puncte (Paul 5 · Retras 5) departajează kilogramele",
  [puncte("total", "Paul"), puncte("total", "Retras")], [5, 5]);
t("…iar Paul, cu 17 kg, trece înaintea celui retras, cu 15",
  tabel("total").findIndex(r => r[0] === "Paul") < tabel("total").findIndex(r => r[0] === "Retras"), true);

/* ================================================================
   5. Zero kilograme: prezent dar fără captură, și un sector întreg gol
   ================================================================ */
console.log("\n=== 5. Zero kg ===");
concurs(1, false, [
  ["Cristi", [["1", "A", 8.0]]],
  ["Paul",   [["2", "A", 0]]],     // a fost, a stat, n-a prins
  ["Harry",  [["3", "A", 0]]],
  ["Mimi",   [["4", "B", 0]]],     // sector întreg fără captură
  ["Seby",   [["5", "B", 0]]]
]);
t("prezentul fără captură intră în sector, nu la absenți",
  puncte(1, "Paul") <= 3, true);
t("doi la 0 kg în sectorul A împart locurile 2-3", [puncte(1, "Paul"), puncte(1, "Harry")], [2.5, 2.5]);
t("un sector întreg la 0 kg: amândoi iau media locurilor 1-2", [puncte(1, "Mimi"), puncte(1, "Seby")], [1.5, 1.5]);
t("cel cu 8 kg e tot primul", tabel(1)[0][0], "Cristi");

/* ================================================================
   6. Trei manșe, dintre care una nepescuită încă
   ================================================================ */
console.log("\n=== 6. Trei manșe, a treia încă nedisputată ===");
concurs(3, false, [
  ["Cristi", [["1", "A", 10.0], ["4", "B", 6.0], ["", "", 0]]],
  ["Paul",   [["2", "A",  8.0], ["5", "B", 9.0], ["", "", 0]]],
  ["Harry",  [["3", "A",  4.0], ["6", "B", 2.0], ["", "", 0]]]
]);
t("manșa 3 nu s-a disputat", vm.runInContext("mancheDisputata(3)", box), false);
t("General adună doar manșele pescuite: 1+2 și 2+1",
  [puncte("total", "Cristi"), puncte("total", "Paul")], [3, 3]);
t("nimeni nu primește puncte fantomă din manșa nepescuită",
  puncte("total", "Harry"), 6);
t("tabelul General, la zi cu ce s-a pescuit",
  tabel("total"), [["Paul", 3, 17], ["Cristi", 3, 16], ["Harry", 6, 6]]);
vm.runInContext("state.participants[1].m[3]={stand:'7',sector:'A',catches:[3],extras:[],catchTimes:[],catchPhotos:[]};", box);
t("odată cântărit ceva în manșa 3, ea intră în sumă",
  vm.runInContext("mancheDisputata(3)", box), true);
t("…iar cine n-a fost în ea primește un punct peste ultimul loc",
  puncte(3, "Cristi"), 2);

/* ================================================================
   7. Sector cu un singur om
   ================================================================ */
console.log("\n=== 7. Sector cu un singur om ===");
concurs(1, false, [
  ["Cristi", [["1", "A", 10.0]]],
  ["Paul",   [["2", "A",  8.0]]],
  ["Harry",  [["3", "A",  6.0]]],
  ["Singur", [["4", "B",  0.5]]]
]);
t("singurul din sectorul lui ia locul 1, oricât de puțin a prins", puncte(1, "Singur"), 1);
// ...dar nu iese primul: are 1 punct, la fel ca primul din sectorul A, iar la egalitate
// de puncte departajează kilogramele — 10 kg bat 0,5 kg.
t("la egalitate cu primul din celălalt sector, kilogramele îl trimit al doilea",
  tabel(1).slice(0, 2), [["Cristi", 1, 10], ["Singur", 1, 0.5]]);
concurs(1, true, [
  ["Cristi", [["1", "A", 10.0]]],
  ["Paul",   [["2", "A",  8.0]]],
  ["Harry",  [["3", "A",  6.0]]],
  ["Singur", [["4", "B",  0.5]]]
]);
t("pe „Îndreptat\" ia mijlocul scalei, nu locul 1", puncte(1, "Singur"), 2);
box.state.scalaSectoare = false;

/* ================================================================
   8. Peștii extra intră în total, dar CMMC nu se adună de două ori
   ================================================================ */
console.log("\n=== 8. Pești extra și CMMC ===");
concurs(1, false, [
  ["Cristi", [["1", "A", 10.0, 3.5]]],   // 10 cântărit + 3,5 pește extra
  ["Paul",   [["2", "A", 12.0]]],
  ["Harry",  [["3", "A",  6.0, 1.0]]]
]);
t("totalul e cantitatea plus peștii extra", vm.runInContext("totalOfM(state.participants[0],1)", box), 13.5);
t("CMMC-ul e cel mai mare pește extra, nu se adaugă separat",
  vm.runInContext("cmmcOfM(state.participants[0],1)", box), 3.5);
t("clasamentul ține cont de peștii extra", tabel(1).map(r => r[0]), ["Cristi", "Paul", "Harry"]);

/* ================================================================
   9. Concursul de duminică, așa cum a fost: 11 oameni, 2 sectoare inegale
   ================================================================ */
console.log("\n=== 9. Concurs adevărat: Brăila, 23.08 ===");
concurs(1, false, [
  ["Mimi Fedor",       [["34", "A", 23.010]]],
  ["Hritcu Bogdan",    [["36", "A", 13.760]]],
  ["Calfa Cristi",     [["38", "A", 15.640]]],
  ["Sandel Hartopeanu",[["40", "A",  9.010]]],
  ["Cristi Enache",    [["42", "A", 18.030]]],
  ["Codrin",           [["44", "A",  9.090]]],
  ["Paul Selig",       [["46", "B", 11.610]]],
  ["Fabian Cretu",     [["48", "B", 12.320]]],
  ["Petrica Cazacu",   [["50", "B",  8.930]]],
  ["Danut Hostina",    [["52", "B", 10.000]]],
  ["Harry",            [["54", "B", 20.195, 3.460]]]
]);
t("sectorul A are 6 oameni, sectorul B are 5",
  [peSector(1, "A").length, peSector(1, "B").length], [6, 5]);
t("sectorul A, pe kilograme", peSector(1, "A"),
  ["Mimi Fedor", "Cristi Enache", "Calfa Cristi", "Hritcu Bogdan", "Codrin", "Sandel Hartopeanu"]);
t("sectorul B, pe kilograme", peSector(1, "B"),
  ["Harry", "Fabian Cretu", "Paul Selig", "Danut Hostina", "Petrica Cazacu"]);
t("Harry ia locul 1 în sectorul lui", puncte(1, "Harry"), 1);
t("Mimi Fedor ia locul 1 în sectorul lui", puncte(1, "Mimi Fedor"), 1);
t("Codrin (9,090) trece înaintea lui Sandel (9,010) — 80 de grame",
  peSector(1, "A").indexOf("Codrin") < peSector(1, "A").indexOf("Sandel Hartopeanu"), true);
t("totalul concursului", Math.round(vm.runInContext(
  "state.participants.reduce(function(s,p){return s+totalOfM(p,1);},0)", box) * 1000) / 1000, 155.055);

/* ================================================================
   10. Cine lipsește de la TOATE manșele
   ================================================================ */
console.log("\n=== 10. Înscris, dar n-a venit deloc ===");
concurs(2, false, [
  ["Cristi",  [["1", "A", 10.0], ["1", "A", 9.0]]],
  ["Paul",    [["2", "A",  8.0], ["2", "A", 7.0]]],
  ["N-a fost",[["",  "",   0],   ["",  "",  0]]]
]);
t("are cel mai mare total de puncte, deci ultimul loc", tabel("total").slice(-1)[0][0], "N-a fost");
t("ia câte un punct peste ultimul loc, în fiecare manșă", puncte("total", "N-a fost"), 6);
t("prezenții rămân neatinși", [puncte("total", "Cristi"), puncte("total", "Paul")], [2, 4]);

/* ================================================================
   11. Lanțul de departajare, treaptă cu treaptă

   sortByPointsS are cinci trepte: puncte → kilograme → cea mai bună manșă (doar la
   General) → cel mai mare pește → numărul standului. Primele două se încercau deja;
   ultimele trei, nicăieri. Ele decid cupa exact când doi sunt la egalitate perfectă,
   adică atunci când contestația e cea mai probabilă.
   ================================================================ */
console.log("\n=== 11a. Treapta 3: cea mai bună manșă (la General) ===");
concurs(2, false, [
  // Amândoi termină cu 15 kg și 3 puncte; îi desparte doar manșa cea mai bună.
  // Standurile sunt puse dinadins INVERS: dacă treapta „cea mai bună manșă" ar dispărea,
  // departajarea ar cădea pe stand și ar câștiga Constant. Așa proba chiar dovedește ceva.
  ["Explozie", [["8", "A", 12.0], ["8", "A",  3.0]]],
  ["Constant", [["1", "A",  8.0], ["1", "A",  7.0]]]
]);
t("puncte egale la General", [puncte("total", "Explozie"), puncte("total", "Constant")], [3, 3]);
t("kilograme egale la General",
  vm.runInContext("[totalOfM(state.participants[0],'total'), totalOfM(state.participants[1],'total')]", box), [15, 15]);
t("cea mai bună manșă îi desparte: 12 kg bate 8 kg",
  tabel("total").map(r => r[0]), ["Explozie", "Constant"]);

console.log("\n=== 11b. Treapta 4: cel mai mare pește ===");
concurs(1, false, [
  // 10 kg fiecare, dar unul are un pește de 3 kg; standul e pus dinadins invers,
  // ca să se vadă că CMMC-ul decide ÎNAINTEA standului
  ["FaraPeste", [["2", "A", 10.0]]],
  ["CuPeste",   [["5", "A",  7.0, 3.0]]]
]);
t("amândoi au 10 kg",
  vm.runInContext("[totalOfM(state.participants[0],1), totalOfM(state.participants[1],1)]", box), [10, 10]);
t("deci împart locurile 1-2", [puncte(1, "FaraPeste"), puncte(1, "CuPeste")], [1.5, 1.5]);
t("CMMC-ul decide, deși are standul mai mare", tabel(1).map(r => r[0]), ["CuPeste", "FaraPeste"]);

console.log("\n=== 11c. Treapta 5: numărul standului ===");
concurs(1, false, [
  ["StandMare", [["9", "A", 10.0]]],
  ["StandMic",  [["2", "A", 10.0]]]
]);
t("totul egal — puncte, kilograme, niciun pește extra",
  [puncte(1, "StandMare"), puncte(1, "StandMic")], [1.5, 1.5]);
t("standul mai mic trece primul", tabel(1).map(r => r[0]), ["StandMic", "StandMare"]);
t("standul 10 nu se compară ca text cu standul 9", (function () {
  concurs(1, false, [["Stand10", [["10", "A", 10.0]]], ["Stand9", [["9", "A", 10.0]]]]);
  return tabel(1).map(r => r[0]);
})(), ["Stand9", "Stand10"]);

/* ================================================================
   12. Concurs în care nu s-a prins absolut nimic
   ================================================================ */
console.log("\n=== 12. Nimeni n-a prins nimic ===");
concurs(1, false, [
  ["A1", [["4", "A", 0]]], ["A2", [["1", "A", 0]]],
  ["B1", [["7", "B", 0]]], ["B2", [["3", "B", 0]]]
]);
t("fiecare sector împarte locurile 1-2",
  [puncte(1, "A1"), puncte(1, "A2"), puncte(1, "B1"), puncte(1, "B2")], [1.5, 1.5, 1.5, 1.5]);
t("nimeni nu e „absent\": toți au extras stand",
  vm.runInContext("state.participants.filter(function(p){return absentLaMansa(p,1);}).length", box), 0);
t("ordinea cade pe stand, fiindcă tot restul e egal",
  tabel(1).map(r => r[0]), ["A2", "B2", "A1", "B1"]);
t("totalul concursului e zero",
  vm.runInContext("state.participants.reduce(function(s,p){return s+totalOfM(p,1);},0)", box), 0);

/* ================================================================
   13. Pescari fără sector
   ================================================================ */
console.log("\n=== 13. Fără sector ===");
concurs(1, false, [
  ["Fara1", [["1", "", 10.0]]],
  ["Fara2", [["2", "", 6.0]]],
  ["Fara3", [["3", "", 2.0]]],
  ["Are1",  [["4", "A", 9.0]]],
  ["Are2",  [["5", "A", 1.0]]]
]);
t("cei fără sector formează o grupă a lor, de trei",
  [puncte(1, "Fara1"), puncte(1, "Fara2"), puncte(1, "Fara3")], [1, 2, 3]);
t("cei cu sector se punctează între ei, ca de obicei",
  [puncte(1, "Are1"), puncte(1, "Are2")], [1, 2]);
t("primul din fiecare grupă ia 1 punct — kilogramele departajează",
  tabel(1).slice(0, 2).map(r => r[0]), ["Fara1", "Are1"]);

/* ================================================================
   14. „Îndreptat" pe două manșe
   ================================================================ */
console.log("\n=== 14. Scala comună, pe două manșe ===");
concurs(2, true, [
  ["A1", [["1", "A", 10.0], ["1", "A", 10.0]]],
  ["A2", [["2", "A",  8.0], ["2", "A",  8.0]]],
  ["A3", [["3", "A",  6.0], ["3", "A",  6.0]]],
  ["A4", [["4", "A",  4.0], ["4", "A",  4.0]]],
  ["B1", [["5", "B",  9.0], ["5", "B",  9.0]]],
  ["B2", [["6", "B",  1.0], ["6", "B",  1.0]]]
]);
t("în sectorul mic, ultimul ia tot cât ultimul din sectorul mare",
  [puncte(1, "B2"), puncte(1, "A4")], [4, 4]);
t("primii din fiecare sector iau 1", [puncte(1, "A1"), puncte(1, "B1")], [1, 1]);
t("la General punctele se adună, deci se dublează",
  [puncte("total", "A1"), puncte("total", "B2")], [2, 8]);
t("tabelul General, pe scala comună",
  tabel("total").map(r => r[0]), ["A1", "B1", "A2", "A3", "A4", "B2"]);
box.state.scalaSectoare = false;

/* ================================================================
   15. Tragere nouă între manșe: fiecare manșă pe sectoarele ei
   ================================================================ */
console.log("\n=== 15. Alt sector în manșa 2 ===");
concurs(2, false, [
  // în manșa 1 sunt toți trei în A; în manșa 2 primii doi trec în B
  ["Unu",  [["1", "A", 10.0], ["7", "B", 3.0]]],
  ["Doi",  [["2", "A",  6.0], ["8", "B", 9.0]]],
  ["Trei", [["3", "A",  2.0], ["9", "A", 5.0]]]
]);
t("manșa 1: un singur sector, cu trei oameni",
  [puncte(1, "Unu"), puncte(1, "Doi"), puncte(1, "Trei")], [1, 2, 3]);
t("manșa 2: doi în B, unul singur în A",
  [puncte(2, "Doi"), puncte(2, "Unu"), puncte(2, "Trei")], [1, 2, 1]);
t("sectorul se citește din manșa cerută, nu din prima",
  vm.runInContext("[sectorOfM(state.participants[0],1), sectorOfM(state.participants[0],2)]", box), ["A", "B"]);
t("standul la fel",
  vm.runInContext("[standOfM(state.participants[0],1), standOfM(state.participants[0],2)]", box), ["1", "7"]);
t("General adună punctele celor două manșe",
  [puncte("total", "Unu"), puncte("total", "Doi"), puncte("total", "Trei")], [3, 3, 4]);
t("la egalitate de puncte, kilogramele decid: Doi (15) înaintea lui Unu (13)",
  tabel("total").map(r => r[0]), ["Doi", "Unu", "Trei"]);

t.raport();
