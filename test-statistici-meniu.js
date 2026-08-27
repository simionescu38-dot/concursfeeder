/**
 * Butonul „Statistici" din meniu.
 *
 * Statisticile stăteau odată în rândul de butoane al clasamentului, ca un mod alături de
 * „Pe sectoare" și „Final". Când au fost mutate în pliantul lor, modul a dispărut din
 * `renderRank` — dar butonul din meniu a rămas să-l ceară. Urmarea: apeși „Statistici",
 * ajungi în Clasament, pe lista de sectoare, cu niciun buton aprins și nicio statistică.
 * Omul crede că s-au pierdut datele.
 *
 * Aici se verifică amândouă capetele: că butonul duce unde stau ele ACUM, și că `renderRank`
 * chiar n-are un mod „stat" — fiindcă ziua în care cineva l-ar pune la loc, testul ăsta
 * trebuie să cadă și să întrebe care dintre cele două drumuri rămâne.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

/* ================================================================
   1. Unde duce butonul din meniu
   ================================================================ */
console.log("\n=== 1. Butonul din meniu ===");
{
  const meniu = H.grabFunction(src, "renderMeniu");
  const randuri = meniu.split("\n").filter(l => /"Statistici"/.test(l));

  // două meniuri: unul de organizator, unul de pescar (telefon blocat)
  t("apare în amândouă meniurile", randuri.length, 2);
  t("niciunul nu mai cere modul care nu există",
    randuri.some(l => /setRankMode\(\s*['"]stat['"]\s*\)/.test(l)), false);
  t("amândouă duc în Clasament", randuri.every(l => /meniuGo\(\s*['"]rank['"]/.test(l)), true);
  t("…și sar la pliantul statisticilor",
    randuri.every(l => /['"]pliant-stat['"]/.test(l)), true);
  t("…chemând deschiderea, nu comutarea",
    randuri.every(l => /statisticiDinMeniu/.test(l) && !/deschideStatistici\b/.test(l)), true);
}

/* ================================================================
   2. „stat" chiar nu mai e un mod de clasament
   Dacă cineva îl pune la loc, testul ăsta cade și cere o hotărâre.
   ================================================================ */
console.log("\n=== 2. Modul „stat\" nu mai există în clasament ===");
{
  const rr = H.grabFunction(src, "renderRank");
  t("renderRank nu știe de niciun mod „stat\"", /rankMode\s*===\s*['"]stat['"]/.test(rr), false);
  const srm = H.grabFunction(src, "setRankMode");
  t("setRankMode nu aprinde niciun buton pentru „stat\"",
    /['"]stat['"]/.test(srm), false);
}

/* ================================================================
   3. Funcția adevărată, rulată pe un pliant fals
   ================================================================ */
console.log("\n=== 3. Ce face statisticiDinMeniu ===");

/** pliantul, cât îi trebuie lui plianteaza: capul, cuprinsul și clasa */
function pliantFals(inchis) {
  const cuprins = { hidden: inchis };
  const cap = { atribute: {}, setAttribute(k, v) { this.atribute[k] = v; } };
  const el = {
    clase: inchis ? [] : ["deschis"],
    classList: {
      toggle(c, on) { const i = el.clase.indexOf(c); if (on && i < 0) el.clase.push(c); if (!on && i >= 0) el.clase.splice(i, 1); }
    },
    querySelector(sel) { return /pliant-cap/.test(sel) ? cap : cuprins; }
  };
  return { el, cap, cuprins };
}

function ruleaza(inchis, deCateOri) {
  const p = pliantFals(inchis);
  const box = { innerHTML: "" };
  let statsChemat = 0;
  const ctx = {
    console,
    document: {
      getElementById: id => id === "pliant-stat" ? p.el : (id === "statBody" ? box : null),
      querySelector: sel => /#pliant-stat \.pliant-in/.test(sel) ? p.cuprins : null
    },
    statsHtml: () => { statsChemat++; return "<b>statistici</b>"; }
  };
  vm.createContext(ctx);
  vm.runInContext(
    ["plianteaza", "improspateazaStatistici", "statisticiDinMeniu"]
      .map(n => H.grabFunction(src, n)).join("\n"), ctx);
  for (let i = 0; i < (deCateOri || 1); i++) vm.runInContext("statisticiDinMeniu();", ctx);
  return { deschis: !p.cuprins.hidden, html: box.innerHTML, statsChemat,
           aria: p.cap.atribute["aria-expanded"], clase: p.el.clase.slice() };
}

{
  const r = ruleaza(true);
  t("pliant închis → se deschide", r.deschis, true);
  t("…și se umple cu statisticile", r.html, "<b>statistici</b>");
  t("…cu aria-expanded pus pe „true\"", r.aria, "true");
  t("…și cu clasa „deschis\"", r.clase.indexOf("deschis") >= 0, true);
}
{
  // apăsat de două ori din meniu, pliantul nu trebuie să se închidă în nas
  const r = ruleaza(true, 2);
  t("apăsat de două ori, rămâne deschis", r.deschis, true);
  t("…și statisticile s-au refăcut de fiecare dată", r.statsChemat, 2);
}
{
  const r = ruleaza(false);
  t("pliant deja deschis → rămâne deschis", r.deschis, true);
  t("…și tot se împrospătează", r.html, "<b>statistici</b>");
}

/* ================================================================
   4. Butonul de pe ecran a rămas cum era: el comută
   ================================================================ */
console.log("\n=== 4. Butonul de pe ecran comută mai departe ===");
{
  t("pliantul se deschide de pe cap cu deschideStatistici",
    /onclick="deschideStatistici\(\)"/.test(src), true);
  const d = H.grabFunction(src, "deschideStatistici");
  t("…iar acela chiar comută (plianteaza fără paza de „hidden\")",
    /plianteaza\("pliant-stat"\)/.test(d) && !/hidden/.test(d), true);
}

/* ================================================================
   5. Pliantul stă în ecranul spre care trimite butonul
   ================================================================ */
console.log("\n=== 5. Pliantul e chiar în Clasament ===");
{
  const start = src.indexOf('<section class="view" id="view-rank">');
  const stop = src.indexOf("</section>", start);
  const inauntru = src.slice(start, stop);
  t("view-rank există", start > 0, true);
  t("pliant-stat e înăuntrul lui", /id="pliant-stat"/.test(inauntru), true);
  // dacă s-ar muta în alt ecran, meniuGo('rank',…) ar sări la un element ascuns
  t("…și nu în ecranul de cântărire",
    /id="pliant-stat"/.test(src.slice(src.indexOf('id="view-cantar"'),
                                      src.indexOf("</section>", src.indexOf('id="view-cantar"')))), false);
}

t.raport();
