/**
 * Detaliile din Statistici.
 *
 * „la statistici vreau mai multe detalii" — s-au adăugat patru bucăți: despre capturi,
 * despre pescari, pe manșe, despre timp.
 *
 * Ce se păzește aici sunt lucrurile care se pot spune GREȘIT fără să se vadă:
 *   · „cea mai mare captură" NU e „cel mai mare pește" — una e o cântărire de juvelnic,
 *     care poate avea mai mulți pești în ea, alta e un pește extra, cântărit singur;
 *   · cine n-a prins nimic nu intră la „cel mai egal pe manșe" — n-are ce compara;
 *   · la o singură manșă nu se arată nimic despre manșe, ar fi o comparație cu nimic.
 *
 * Codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = [
  "mOf", "cantOfM", "extraOfM", "cmmcOfM", "totalOfM", "sectorOfM", "standOfM",
  "emptyManche", "ensureManche", "numManse", "manseRange", "mancheDisputata",
  "nameOf", "fmt", "esc", "ceas", "cateOreSiMinute",
  "statDesprePesti", "statDespreOameni", "statPeManse", "statDespreTimp"
];

/** un concurs, așa cum stă el pe telefon */
function concurs(participanti, manse) {
  const ctx = { console, JSON, Math, Date, Array, Object, String, Number,
                state: { participants: participanti, numManse: manse || 1, sectors: ["A", "B"] } };
  vm.createContext(ctx);
  vm.runInContext(FUNCTII.map(n => H.grabFunction(src, n)).join("\n"), ctx);
  return ctx;
}

/** un pescar cu capturi pe manșe: {1:[kg,…], 2:[…]} și sectorul lui pe fiecare manșă */
function pescar(id, prenume, nume, peManse, sectoare, ore) {
  const p = { id, prenume, nume, m: {} };
  Object.keys(peManse).forEach(mi => {
    p.m[mi] = { catches: peManse[mi].slice(), catchTimes: (ore && ore[mi]) || [],
                catchPhotos: [], extras: [], extraTimes: [], extraPhotos: [], cmmc: "",
                stand: String(id).replace(/\D/g, "") || "1", sector: (sectoare && sectoare[mi]) || "A" };
  });
  return p;
}

const html = (c, apel) => vm.runInContext(apel, c);
/* Scoaterea etichetelor lasă spații acolo unde erau ele: „<b>2</b>," ajunge „2 ,".
   Se strâng înapoi, altfel probele ar pica din pricina cititorului, nu a codului. */
const text = h => h.replace(/<[^>]*>/g, " ")
                   .replace(/\s+/g, " ")
                   .replace(/\s+([,.:;])/g, "$1")
                   .trim();

/* ================================================================
   1. Despre capturi
   ================================================================ */
console.log("\n=== 1. Despre capturi ===");
{
  const oameni = [
    pescar("p1", "Mihai", "Ionescu", { 1: [12.75, 3.2] }),
    pescar("p2", "Vasile", "Popescu", { 1: [20.11] }),
    pescar("p3", "Ion", "Țăranu", { 1: [] })           // n-a prins nimic
  ];
  const c = concurs(oameni, 1);
  const all = [];
  oameni.forEach(p => (p.m[1].catches || []).forEach(v => all.push({ v: +v, t: null, p })));
  c.all = all; c.allEx = [];
  const h = html(c, "statDesprePesti(all, allEx)");
  const tx = text(h);

  t("numără cântăririle, nu pescarii", /3 Cântăriri/.test(tx), true);
  t("cea mai mare cântărire e a lui Vasile", /Cea mai mare 20,110 kg — Vasile Popescu/.test(tx), true);
  t("cea mai mică e cea de 3,2", /Cea mai mică 3,200 kg — Mihai Ionescu/.test(tx), true);
  t("media pe cântărire, nu pe pescar",
    /12,020/.test(tx), true);                          // (12,75+3,2+20,11)/3
  t("spune câți au prins și câți nu", /Au prins 2 din 3 · 1 fără captură/.test(tx), true);
  /* Paza care contează: „cea mai mare captură" nu trebuie confundată cu „cel mai mare pește". */
  t("scrie limpede că e o cântărire de juvelnic, nu un pește",
    /cea mai grea cântărire de juvelnic/.test(tx), true);
  t("…și trimite la peștele extra pentru celălalt", /peștii extra/.test(tx), true);
}
{
  /* fără nicio captură nu se arată nimic — nu o casetă goală */
  const c = concurs([pescar("p1", "Ion", "Ionescu", { 1: [] })], 1);
  c.all = []; c.allEx = [];
  t("fără capturi, bucata nu apare deloc", html(c, "statDesprePesti(all, allEx)"), "");
}

/* ================================================================
   2. Despre pescari
   ================================================================ */
console.log("\n=== 2. Despre pescari ===");
{
  const oameni = [
    pescar("p1", "Mihai", "Ionescu", { 1: [10], 2: [10] }),      // 20, egal
    pescar("p2", "Vasile", "Popescu", { 1: [25], 2: [5] }),      // 30, dezechilibrat
    pescar("p3", "Ion", "Țăranu", { 1: [4], 2: [1] }),           // 5
    pescar("p4", "Radu", "Bălan", { 1: [], 2: [] })              // n-a prins
  ];
  const c = concurs(oameni, 2);
  const tx = text(html(c, "statDespreOameni()"));

  t("primul e cel cu cele mai multe kg", /1\. Vasile Popescu 30,000 kg/.test(tx), true);
  t("al doilea", /2\. Mihai Ionescu 20,000 kg/.test(tx), true);
  t("al treilea", /3\. Ion Țăranu 5,000 kg/.test(tx), true);
  t("cine n-a prins nimic nu intră în primii trei", /Radu Bălan/.test(tx), false);
  t("diferența e între primul și ULTIMUL CARE A PRINS, nu ultimul de pe listă",
    /Între primul și ultimul care a prins: 25,000 kg/.test(tx), true);
  t("cel mai egal pe manșe e cel cu 10 și 10",
    /Cel mai egal pe manșe: Mihai Ionescu — 10,000 și 10,000 kg, adică 0 kg diferență/.test(tx), true);
}
{
  /* la o singură manșă nu există „cel mai egal": n-are cu ce compara */
  const c = concurs([
    pescar("p1", "Mihai", "Ionescu", { 1: [10] }),
    pescar("p2", "Vasile", "Popescu", { 1: [5] })
  ], 1);
  const tx = text(html(c, "statDespreOameni()"));
  t("la o manșă, primii trei se arată", /1\. Mihai Ionescu/.test(tx), true);
  t("…dar «cel mai egal» nu", /Cel mai egal/.test(tx), false);
}
{
  /* cine a lipsit de la o manșă nu poate fi „cel mai egal", oricât de mic i-ar fi saltul */
  const c = concurs([
    pescar("p1", "Mihai", "Ionescu", { 1: [10], 2: [] }),        // a lipsit la a doua
    pescar("p2", "Vasile", "Popescu", { 1: [8], 2: [6] })
  ], 2);
  const tx = text(html(c, "statDespreOameni()"));
  t("cel care a lipsit la o manșă nu e «cel mai egal»",
    /Cel mai egal pe manșe: Vasile Popescu/.test(tx), true);
}
{
  const c = concurs([pescar("p1", "Mihai", "Ionescu", { 1: [10] })], 1);
  t("cu un singur pescar nu se arată nimic", html(c, "statDespreOameni()"), "");
}

/* ================================================================
   3. Pe manșe
   ================================================================ */
console.log("\n=== 3. Pe manșe ===");
{
  const oameni = [
    pescar("p1", "Mihai", "Ionescu", { 1: [12], 2: [3] }, { 1: "A", 2: "B" }),
    pescar("p2", "Vasile", "Popescu", { 1: [8], 2: [9] }, { 1: "A", 2: "B" }),
    pescar("p3", "Ion", "Țăranu", { 1: [5], 2: [1] }, { 1: "B", 2: "A" })
  ];
  const c = concurs(oameni, 2);
  const tx = text(html(c, "statPeManse()"));

  t("manșa 1 are totalul ei", /Manșa 1 25,000 kg/.test(tx), true);
  t("manșa 2 are totalul ei", /Manșa 2 13,000 kg/.test(tx), true);
  t("câți au cântărit în fiecare", /3 au cântărit/.test(tx), true);
  t("cel mai bun din manșa 1", /cel mai bun: Mihai Ionescu cu 12,000 kg/.test(tx), true);
  t("cel mai bun din manșa 2 e altul", /cel mai bun: Vasile Popescu cu 9,000 kg/.test(tx), true);
  t("sectorul care a strâns cel mai mult, în manșa 1",
    /sectorul A a strâns cel mai mult \(20,000 kg\)/.test(tx), true);
  t("diferența dintre manșe", /Între manșa cu cel mai mult și cea cu cel mai puțin: 12,000 kg/.test(tx), true);
}
{
  const c = concurs([pescar("p1", "Mihai", "Ionescu", { 1: [10] })], 1);
  t("la o singură manșă nu se arată nimic pe manșe", html(c, "statPeManse()"), "");
}
{
  /* două manșe declarate, dar la a doua n-a cântărit nimeni: nu e o manșă disputată */
  const c = concurs([pescar("p1", "Mihai", "Ionescu", { 1: [10], 2: [] })], 2);
  t("o manșă la care n-a cântărit nimeni nu se pune la socoteală",
    html(c, "statPeManse()"), "");
}

/* ================================================================
   4. Despre timp
   ================================================================ */
console.log("\n=== 4. Despre timp ===");
{
  const c = concurs([pescar("p1", "Mihai", "Ionescu", { 1: [1] })], 1);
  /* trei cântăriri: 08:30, 09:15, 11:30 — două ore în ora 8..11 */
  const zi = (h, m) => new Date(2026, 8, 6, h, m, 0).getTime();
  c.timed = [{ v: 1, t: zi(8, 30) }, { v: 2, t: zi(9, 15) }, { v: 3, t: zi(9, 45) }, { v: 4, t: zi(11, 30) }];
  const tx = text(html(c, "statDespreTimp(timed)"));

  t("durata de la prima la ultima", /3 h De la prima la ultima/.test(tx), true);
  t("ora primei cântăriri", /Prima la 08:30/.test(tx), true);
  t("ora ultimei", /ultima la 11:30/.test(tx), true);
  t("câte pe oră", /1,3 Cântăriri pe oră/.test(tx), true);
  t("ora cu cele mai multe", /Cele mai multe într-o oră: 2, între 9 și 10/.test(tx), true);
  t("spune că numără doar ce are oră salvată", /doar cântăririle cu oră salvată/.test(tx), true);
}
{
  const c = concurs([pescar("p1", "Mihai", "Ionescu", { 1: [1] })], 1);
  c.timed = [{ v: 1, t: Date.now() }];
  t("cu o singură oră salvată nu se arată nimic", html(c, "statDespreTimp(timed)"), "");
}
{
  /* toate cântăririle în aceeași clipă: n-are sens „pe oră" */
  const acum = Date.now();
  const c = concurs([pescar("p1", "Mihai", "Ionescu", { 1: [1] })], 1);
  c.timed = [{ v: 1, t: acum }, { v: 2, t: acum + 1000 }];
  t("dacă totul e într-un minut, nu se arată durata", html(c, "statDespreTimp(timed)"), "");
}

/* ================================================================
   5. Scrisul orelor și al duratei
   ================================================================ */
console.log("\n=== 5. Ore și durate ===");
{
  const c = concurs([], 1);
  t("ora se scrie cu două cifre",
    vm.runInContext("ceas(new Date(2026,8,6,7,5).getTime())", c), "07:05");
  t("o oră și un sfert", vm.runInContext("cateOreSiMinute(75*60000)", c), "1 h 15 min");
  t("două ore fix", vm.runInContext("cateOreSiMinute(120*60000)", c), "2 h");
  t("sub o oră, doar minute", vm.runInContext("cateOreSiMinute(40*60000)", c), "40 min");
}

/* ================================================================
   6. Legate în ecranul de Statistici
   ================================================================ */
console.log("\n=== 6. Chemate din Statistici ===");
{
  const sh = H.grabFunction(src, "statsHtml");
  t("despre capturi", /statDesprePesti\(all, allEx\)/.test(sh), true);
  t("despre pescari", /statDespreOameni\(\)/.test(sh), true);
  t("pe manșe", /html\+=statPeManse\(\)/.test(sh), true);
  t("despre timp", /html\+=statDespreTimp\(timed\)/.test(sh), true);
  /* «despre timp» are nevoie de cântăririle cu oră — trebuie chemată DUPĂ ce se face lista */
  t("despre timp vine după ce se strâng orele",
    sh.indexOf("var timed=") < sh.indexOf("statDespreTimp(timed)"), true);
}

t.raport();
