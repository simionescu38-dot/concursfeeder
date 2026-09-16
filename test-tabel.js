/**
 * Clasamentul ca tabel pentru Excel.
 *
 * „Export PDF + Excel/CSV" — din lista lui. PDF-ul era de mult (prin tipărire), iar
 * „Copiază clasamentul" scotea text de pus pe grup:
 *
 *     1. Ion Temciuc (St.1, Sec A) — 3 pct, 8,940 kg
 *
 * Bun pe WhatsApp, dar în Excel intră tot pe o coloană: e o frază, nu un tabel. Pentru
 * socotelile clubului trebuia altceva.
 *
 * Trei lucruri hotărăsc dacă un fișier se deschide bine în Excel-ul românesc, și toate
 * trei se probează aici, fiindcă niciunul nu se vede cu ochiul până nu e prea târziu:
 *
 *   · despărțitorul e PUNCT-ȘI-VIRGULĂ. Zecimalele noastre sunt cu virgulă („8,940"),
 *     deci cu virgulă despărțitoare fiecare greutate s-ar rupe în două coloane.
 *   · la început se pune semnul de UTF-8, altfel „Gavrileț" se deschide „GavrileÈ›".
 *   · rândurile se despart cu CRLF, cum le așteaptă Excel.
 *
 * Codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

/* ================================================================
   1. Câmpurile care au nevoie de ghilimele
   ================================================================ */
console.log("\n=== 1. Câmpurile primejdioase ===");
{
  const ctx = { console, String };
  vm.createContext(ctx);
  vm.runInContext(H.grabFunction(src, "csvCamp"), ctx);
  const c = (v) => vm.runInContext("csvCamp(" + JSON.stringify(v) + ")", ctx);

  t("un nume obișnuit trece neatins", c("Ion Temciuc"), "Ion Temciuc");
  /* Zecimalele NU se îmbracă în ghilimele: despărțitorul e „;", deci virgula e slobodă. */
  t("o greutate rămâne cum e", c("8,940"), "8,940");
  /* Dar un „;" în nume ar rupe rândul în două. */
  t("un „;” în nume se îmbracă în ghilimele", c("Popescu; Ion"), '"Popescu; Ion"');
  t("…iar ghilimelele dinăuntru se dublează", c('Ion "Nea" Temciuc'), '"Ion ""Nea"" Temciuc"');
  t("un rând rupt se îmbracă și el", c("Ion\nTemciuc"), '"Ion\nTemciuc"');
  t("gol rămâne gol", c(""), "");
  t("nimicul nu scrie „undefined”", c(undefined), "");
  t("nici nulul", c(null), "");
}

/* ================================================================
   2. Cele trei lucruri care fac fișierul să se deschidă
   ================================================================ */
console.log("\n=== 2. Ce cere Excel-ul românesc ===");
{
  const f = H.grabFunction(src, "tabelClasament");
  t("despărțitorul e punct-și-virgulă", /\.join\(";"\)/.test(f), true);
  t("…iar rândurile se despart cu CRLF", /\.join\("\\r\\n"\)/.test(f), true);

  const d = H.grabFunction(src, "descarcaTabel");
  t("fișierul începe cu semnul de UTF-8", /\\uFEFF/.test(d), true);
  t("…și se dă drept CSV", /text\/csv;charset=utf-8/.test(d), true);
  t("numele fișierului are ziua în el", /getFullYear\(\)/.test(d), true);
  /* Numele concursului intră în numele fișierului, deci semnele pe care sistemele de
     fișiere nu le rabdă se scot. Se caută după înțeles — clasa de semne, urmată de „-” —
     fiindcă barele oblice scăpate fac un tipar imposibil de citit. */
  t("…și numele concursului se curăță de semne oprite",
    /\.replace\(\/\[[^\]]*<>\|[^\]]*\]\/g, "-"\)/.test(d), true);

  t("fără pescari nu scoate nimic", /!\(state\.participants \|\| \[\]\)\.length/.test(d), true);
}

/* ================================================================
   3. Ce scrie în tabel
   ================================================================ */
console.log("\n=== 3. Coloanele ===");
{
  const f = H.grabFunction(src, "tabelClasament");
  ["Loc", "Stand", "Sector", "Nume", "Total kg", "Total puncte", "Cel mai mare pește"]
    .forEach((c) => t("are coloana „" + c + "”", f.indexOf('"' + c + '"') >= 0, true));
  /* Fiecare manșă își aduce cele trei coloane ale ei. */
  t("fiecare manșă are kg, puncte și stare",
    /"Manșa " \+ mi \+ " kg", "Manșa " \+ mi \+ " puncte", "Manșa " \+ mi \+ " stare"/.test(f), true);

  /* Fișierul scoate TOT concursul, nu doar manșa de pe ecran: un tabel care răspunde la
     o singură întrebare te pune să-l scoți de cinci ori. */
  t("scoate toate manșele disputate, nu doar cea de pe ecran",
    /manseRange\(\)\.filter\(mancheDisputata\)/.test(f), true);
  t("…iar generalul e socotit pe tot concursul", /pointsCombo\(\)/.test(f), true);

  /* Ordinea din fișier urmează felul ales pe ecran, ca să nu fie două adevăruri despre
     același concurs. */
  t("ordinea urmează felul de la final",
    /finMethod === "pct"[\s\S]{0,120}sortByPointsS[\s\S]{0,80}sortRankS/.test(f), true);

  /* Starea se scrie cu vorba lui, nu cu numele din cod. */
  t("starea se scrie pe românește", /STARI_MANSA\[st\]/.test(f), true);
  t("…iar cine a cântărit scrie „Cântărit”", /"Cântărit"/.test(f), true);
}

/* ================================================================
   4. Butonul
   ================================================================ */
console.log("\n=== 4. Butonul ===");
{
  t("stă pe ecranul de clasament",
    /onclick="descarcaTabel\(\)"[\s\S]{0,140}Tabel pentru Excel/.test(src), true);
  /* Nu se ia la întrecere cu nimic: e frate cu „Copiază clasamentul" și cu imaginea. */
  t("…ca buton discret, nu scos în față",
    /class="btn btn-ghost mt" onclick="descarcaTabel\(\)"/.test(src), true);
  /* Cele trei ieșiri spun fiecare UNDE duce: pe grup, pe Facebook, în Excel. */
  t("cele trei ieșiri își spun fiecare drumul",
    ["Copiază clasamentul", "Imagine pentru WhatsApp / Facebook", "Tabel pentru Excel"]
      .every((x) => src.indexOf(x) >= 0), true);
}

t.raport();
