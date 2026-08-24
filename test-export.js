/**
 * Toate ieșirile spun același lucru.
 *
 * Un clasament pleacă din aplicație pe patru drumuri: ecranul, textul copiat, PDF-ul și
 * poza pentru WhatsApp. Dacă unul dintre ele sortează altfel, hârtia de la premiere anunță
 * altă ordine decât cea citită cu voce tare — și nimeni nu observă până la contestație.
 *
 * Asta s-a și întâmplat: printRank() sorta MEREU după kilograme, chiar și pe „Final ·
 * După puncte", dar tipărea coloana Pct și scria „Clasament oficial". Cine câștiga
 * sectorul mic cu 9 kg apărea al doilea pe ecran și al patrulea pe hârtie.
 *
 * Verificarea e pe sursa fișierului LIVRAT, nu pe o copie.
 */
const H = require("./test-helpers.js");
const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const IESIRI = ["renderRank", "copyRank", "printRank", "planImagine"];
const cod = {};
IESIRI.forEach(function (n) { cod[n] = H.grabFunction(src, n); });

/* ---------- 1. Fiecare drum știe de clasamentul pe puncte ---------- */
console.log("\n=== 1. Toate cele patru ieșiri cunosc „După puncte\" ===");
IESIRI.forEach(function (n) {
  t(n + " se uită la finMethod", /finMethod\s*===\s*"pct"/.test(cod[n]), true);
});

/* ---------- 2. Fiecare sortează cu sortByPointsS acolo ---------- */
console.log("\n=== 2. …și sortează cu aceeași funcție ===");
IESIRI.forEach(function (n) {
  t(n + " folosește sortByPointsS", /sortByPointsS\s*\(/.test(cod[n]), true);
});

/* ---------- 3. Condiția e scrisă la fel peste tot ----------
   renderRank și copyRank o scriu ca „rankMode===fin && finMethod===pct"; planImagine
   ajunge acolo după ce a tratat separat modul „sec", deci îi ajunge finMethod. */
console.log("\n=== 3. Aceeași condiție, nu una apropiată ===");
["renderRank", "copyRank", "printRank"].forEach(function (n) {
  t(n + ': condiția e rankMode==="fin" && finMethod==="pct"',
    /rankMode\s*===\s*"fin"\s*&&\s*finMethod\s*===\s*"pct"/.test(cod[n]), true);
});
t("planImagine tratează întâi „Pe sectoare\", apoi punctele",
  /mod\s*===\s*"sec"/.test(cod.planImagine) && /finMethod\s*===\s*"pct"/.test(cod.planImagine), true);

/* ---------- 4. Regresia veche, prinsă pe nume ---------- */
console.log("\n=== 4. Regresia care a fost odată ===");
// printRank sorta lista generală cu sortRankS, necondiționat. Dacă cineva o pune la loc,
// dispare fie alegerea, fie folosirea lui sortByPointsS — și una dintre verificări cade.
t("printRank nu mai sortează necondiționat pe kilograme",
  /var\s+lista\s*=\s*pePuncte\s*\?/.test(cod.printRank), true);
t("printRank păstrează sortRankS doar ca a doua variantă",
  /pePuncte\s*\?\s*sortByPointsS[\s\S]*?:\s*sortRankS/.test(cod.printRank), true);

/* ---------- 5. Hârtia spune ce clasament e ---------- */
console.log("\n=== 5. PDF-ul își scrie felul în cap ===");
t("subtitlul PDF-ului scrie „După puncte\" sau „După kg\"",
  /pePuncte\s*\?\s*"După puncte"\s*:\s*"După kg"/.test(cod.printRank), true);
t("…lângă „Clasament oficial\"", /Clasament oficial/.test(cod.printRank), true);

/* ---------- 6. Sectoarele rămân pe kilograme ---------- */
console.log("\n=== 6. Tabelele pe sectoare rămân pe kilograme ===");
// pe sectoare, clasamentul E pe kilograme — și pe ecran, și pe hârtie
t("printRank sortează sectoarele cu sortRankS",
  /sortRankS\s*\(\s*secs\[k\]/.test(cod.printRank), true);
t("renderRank la fel, pentru „Pe sectoare\"",
  /sortRankS\s*\(\s*secs\[k\]/.test(cod.renderRank), true);

/* ---------- 7. Sezonul: aceeași listă pentru toate trei ---------- */
console.log("\n=== 7. Sezonul: ecran, copiere și PDF pleacă din aceeași listă ===");
const sez = H.citeste("sezon.html");
["renderTable", "copySeasonText", "printSeason"].forEach(function (n) {
  const f = H.grabFunction(sez, n);
  t(n + " folosește pozitiiSezon(currentSeasonSorted())",
    /pozitiiSezon\s*\(/.test(f) && /currentSeasonSorted\s*\(\s*\)/.test(f), true);
});
t("printSeason scrie și el ce clasament e", /sortLabel\s*\(\s*\)/.test(H.grabFunction(sez, "printSeason")), true);

t.raport();
