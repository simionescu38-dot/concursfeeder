/**
 * Cât cântărești, sub cântar nu mai vine nimic străin.
 *
 * „Tot mi se pare complicată." Măsurat pe 412px, cu concursul lui pe ecran — 35 de
 * pescari, patru sectoare, manșa pornită — ecranul de Acasă avea **21 de butoane**, din
 * care cinci ale cântăritului. Sub cântar, la 1357px, venea grila de dale („Statistici",
 * „Sezon", „Regulament", „Strategie", „Sponsori"), iar la 1658px „Sunt organizator":
 * încă 900px de drumuri către alte ecrane, tocmai când omul are un singur lucru de
 * făcut, cu cântarul într-o mână și telefonul în cealaltă.
 *
 * Nu se șterg — se strâng, ca tot ce se folosește rar. Închizi cântarul, revin toate.
 *
 * Două capcane, amândouă probate aici:
 *   · `.hero` e `display:flex`, iar flex bate `hidden`. Fără regula cu `!important`,
 *     dalele ar rămâne pe ecran deși li s-a pus `hidden` — aceeași capcană care a lăsat
 *     odată un ✓ sub butoanele cântarului.
 *   · treapta închisă înseamnă `nr = 0`, iar `MUTA[0]` nu există: dacă strânsul s-ar
 *     pune după ieșirea aceea, dalele n-ar mai învia niciodată.
 *
 * Codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

/* `MUTA` și `ORDINE_DEPOZIT` nu-s funcții, deci se scot echilibrând acolada, respectiv
   parantezele drepte — cu aceeași socoteală care sare peste comentarii și șiruri. */
function grabVar(src, marcaj, deschis, inchis) {
  const i = src.indexOf(marcaj);
  if (i < 0) throw new Error("nu găsesc " + marcaj);
  const j = src.indexOf(deschis, i);
  return src.slice(i, H.balance(src, j, deschis, inchis) + 1) + ";";
}
const SRC_MUTA = grabVar(src, "var MUTA = {", "{", "}");

/* ================================================================
   1. Capcana lui flex
   ================================================================ */
console.log("\n=== 1. Regula care face `hidden` să țină ===");
{
  t("`.hero` chiar e display:flex — deci `hidden` singur n-ar ajunge",
    /\.hero\{[^}]*display:flex/.test(src), true);
  t("…de aceea există regula cu !important",
    /#hero-acasa\[hidden\]\{display:none !important;\}/.test(src), true);
  t("…iar dalele au un nume după care pot fi prinse",
    /<div class="hero" id="hero-acasa">/.test(src), true);
}

/* ================================================================
   2. Codul adevărat, rulat
   ================================================================ */
console.log("\n=== 2. Ce se întâmplă la schimbarea treptei ===");
{
  /* Un DOM cât să încapă mutarea: noduri care țin minte cine le-a luat la ei. */
  function faceDom() {
    const noduri = {};
    const nod = (id) => (noduri[id] = noduri[id] || {
      id: id, hidden: false, copii: [], style: {},
      appendChild(c) { c.parinte = id; this.copii.push(c); },
      querySelector() { return null; },
    });
    ["depozit", "cantar-mana", "seg-manse", "card-adauga", "sumar-cantar", "sectorul",
     "warn-stand", "warn-sector", "warn-cod", "pliant-toti", "pliant-import",
     "pliant-tragere", "pliant-jurnal", "hero-acasa",
     "tr-in-2", "tr-in-3", "tr-in-4", "tr-btn-4"].forEach(nod);
    return {
      noduri,
      document: { getElementById: (id) => noduri[id] || null },
    };
  }

  const dom = faceDom();
  const ctx = {
    console, document: dom.document,
    scaraPozitia: 0,
    pliantPus: function () {},          /* probat în suita lui, nu aici */
  };
  vm.createContext(ctx);
  /* MUTA și ORDINE_DEPOZIT, luate din fișier, nu rescrise aici */
  vm.runInContext(SRC_MUTA, ctx);
  vm.runInContext(grabVar(src, "var ORDINE_DEPOZIT = [", "[", "]"), ctx);
  vm.runInContext(H.grabFunction(src, "heroPus"), ctx);
  vm.runInContext(H.grabFunction(src, "mutaInTreapta"), ctx);

  const dale = () => !dom.noduri["hero-acasa"].hidden;

  t("la început dalele se văd", dale(), true);

  vm.runInContext("mutaInTreapta(2)", ctx);
  t("treapta 2 (aduci pescarii) le lasă pe ecran", dale(), true);

  vm.runInContext("mutaInTreapta(4)", ctx);
  t("treapta 4 (cântarul) le strânge", dale(), false);

  vm.runInContext("mutaInTreapta(3)", ctx);
  t("…iar altă treaptă le aduce înapoi", dale(), true);

  vm.runInContext("mutaInTreapta(4)", ctx);
  t("strânse iar la cântar", dale(), false);
  /* Ăsta e miezul: treapta închisă e 0, iar MUTA[0] nu există. */
  vm.runInContext("mutaInTreapta(0)", ctx);
  t("închizi cântarul — dalele învie", dale(), true);
}

/* ================================================================
   3. Ordinea din cod: strânsul ÎNAINTEA ieșirii
   ================================================================ */
console.log("\n=== 3. Locul în care e pus ===");
{
  const f = H.grabFunction(src, "mutaInTreapta");
  const laHero = f.indexOf("heroPus(");
  const laIesire = f.indexOf("var ids = MUTA[nr]; if(!ids) return;");
  t("strânsul e scris înaintea ieșirii pentru treapta fără mutări",
    laHero >= 0 && laIesire >= 0 && laHero < laIesire, true);
  t("…și se uită la treapta cântarului, nu la alta", /heroPus\(nr !== 4\)/.test(f), true);
}

/* ================================================================
   4. Cântarul rămâne întreg
   ================================================================ */
console.log("\n=== 4. Ce NU s-a atins ===");
{
  const f = H.grabFunction(src, "mutaInTreapta");
  t("pliantul „toți pescarii” se strânge mai departe la cântar",
    /pliantPus\("pliant-toti", nr !== 4\)/.test(f), true);
  t("…iar panoul treptei trece tot dedesubt", /if\(nr === 4\)\{[\s\S]{0,120}tr-btn-/.test(f), true);
  ["cantar-mana", "seg-manse", "sumar-cantar", "sectorul", "pliant-jurnal"]
    .forEach((id) => t("„" + id + "” rămâne în treapta cântarului",
      SRC_MUTA.indexOf('"' + id + '"') >= 0, true));
}

/* ================================================================
   5. Varianta nouă ajunge pe telefon
   ================================================================ */
console.log("\n=== 5. Telefonul ia varianta nouă ===");
{
  const sw = H.citeste("sw.js");
  const m = sw.match(/concurs-pescuit-v(\d+)/);
  t("sw.js are o versiune de cache", !!m, true);
  t("…urcată cel puțin la 203", m && parseInt(m[1], 10) >= 203, true);
}

t.raport();
