/**
 * Ultima cântărire nu se pierde când telefonul se stinge.
 *
 * Scrisul pe telefon e amânat cu 200ms (`queueSave`), ca să nu se scrie de zece ori
 * într-o secundă când intră o cântărire. Numai că la baltă telefonul se bagă în buzunar
 * IMEDIAT după ultimul pescar — iar un telefon care adoarme în răstimpul ăla nu mai apucă
 * să scrie: ceasul amânat nu mai bate niciodată, și cântărirea se pierde de tot.
 *
 * Prins la probă, pe concursul lui de două zile: cântăream 18 pescari sâmbătă, închideam
 * și redeschideam aplicația, și rămâneau 17. Al optsprezecelea — exact cel după care pui
 * telefonul în buzunar — nu mai era nicăieri.
 *
 * Codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

/* ================================================================
   1. Scrie pe loc, și taie ceasul amânat
   ================================================================ */
console.log("\n=== 1. Scrisul forțat ===");
{
  const ctx = { console, scrieri: 0, saveT: 7, taiate: [] };
  vm.createContext(ctx);
  vm.runInContext("function save(){ scrieri++; }", ctx);
  vm.runInContext("function clearTimeout(x){ taiate.push(x); }", ctx);
  vm.runInContext(H.grabFunction(src, "salveazaAcum"), ctx);

  vm.runInContext("salveazaAcum()", ctx);
  t("scrie pe loc", ctx.scrieri, 1);
  /* Ceasul amânat trebuie tăiat, altfel ar mai scrie o dată degeaba după ce ne-am întors. */
  t("…și taie ceasul care aștepta", ctx.taiate, [7]);
  t("…iar ceasul rămâne stins", ctx.saveT, null);

  /* Fără nimic în așteptare, tot scrie: e mai ieftin decât să pierzi o cântărire. */
  vm.runInContext("salveazaAcum()", ctx);
  t("fără nimic în așteptare, tot scrie", ctx.scrieri, 2);
  t("…și nu taie un ceas care nu există", ctx.taiate.length, 1);
}
{
  /* Dacă scrisul crapă — memoria plină, modul privat — aplicația nu se oprește:
     cântărirea de pe ecran e tot acolo, iar omul poate merge mai departe. */
  const ctx = { console, saveT: null };
  vm.createContext(ctx);
  vm.runInContext("function save(){ throw new Error('memorie plină'); }", ctx);
  vm.runInContext("function clearTimeout(){}", ctx);
  vm.runInContext(H.grabFunction(src, "salveazaAcum"), ctx);
  let crapat = false;
  try { vm.runInContext("salveazaAcum()", ctx); } catch (e) { crapat = true; }
  t("un scris care crapă nu oprește aplicația", crapat, false);
}

/* ================================================================
   2. Cine îl cheamă
   ================================================================ */
console.log("\n=== 2. Cine îl cheamă ===");
{
  /* Ecranul care se stinge: telefonul în buzunar, sau schimbat pe altă aplicație. */
  t("ecranul stins scrie pe loc",
    /visibilitychange[\s\S]{0,120}document\.hidden[\s\S]{0,60}salveazaAcum\(\)/.test(src), true);
  /* `pagehide` e singurul care se dă pe iPhone — `beforeunload` nu se dă deloc acolo. */
  t("…și pagina care pleacă, la fel",
    /addEventListener\("pagehide", salveazaAcum\)/.test(src), true);
  /* Se ascultă pe `window`, nu pe `document`: pe `document` nu se dă. */
  t("pagehide se ascultă pe fereastră",
    /window\.addEventListener\("pagehide"/.test(src), true);
}

/* ================================================================
   3. Amânarea rămâne acolo unde e bună
   ================================================================
   Nu s-a scos: fără ea, o cântărire cu cinci capturi ar scrie de cinci ori la rând. */
console.log("\n=== 3. Amânarea rămâne ===");
{
  const q = H.grabFunction(src, "queueSave");
  t("queueSave tot amână", /setTimeout\(save, 200\)/.test(q), true);
  t("…și tot trimite spre cameră", /queueSync\(\)/.test(q), true);
}

t.raport();
