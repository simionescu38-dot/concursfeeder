/**
 * Sectorul se completează singur din stand.
 *
 * Standurile se împart pe sectoare în ordine, iar când organizatorul scrie standul
 * unui pescar, sectorul îl urmează. Alegerea făcută de mână bate calculul: la unele
 * bălți sectoarele nu sunt blocuri consecutive de standuri, iar o cifră corectată la
 * stand nu are voie să șteargă ce a pus omul acolo.
 *
 * Cine rămâne fără sector nu e o scăpare fără urmări: intră într-un sector-fantomă,
 * iar cel mai bun dintre ei ia 1 punct, adică punctajul maxim, oricât de puțin ar fi
 * prins. De asta completarea automată există.
 *
 * Testul rulează codul REAL din index.html.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));

/** un câmp de formular, cât să treacă drept unul adevărat */
function camp(val) { return { value: val === undefined ? "" : val, dataset: {} }; }

function aplicatie(sectors, numStanduri, nrPescari) {
  const ctx = {
    state: { sectors: sectors, numStanduri: numStanduri === undefined ? "" : numStanduri,
             participants: new Array(nrPescari || 0).fill(0).map((_, i) => ({ id: "p" + i })) },
    console
  };
  vm.createContext(ctx);
  vm.runInContext(
    ["sectorRanges", "sectorForStand", "currentRanges", "sectorDinStand"]
      .map(n => grabFunction(src, n)).join("\n"), ctx);
  return ctx;
}
const scrie = (ctx, st, sec) => {
  ctx.st = st; ctx.sec = sec;
  vm.runInContext("sectorDinStand(st, sec)", ctx);
  return sec.value;
};

/* ================================================================
   1. Împărțirea standurilor pe sectoare
   ================================================================ */
console.log("\n=== 1. Cum se împart standurile ===");
{
  const ctx = aplicatie(["A","B","C","D"], "64");
  const r = JSON.parse(vm.runInContext("JSON.stringify(sectorRanges(64, state.sectors))", ctx));
  t("64 de standuri, 4 sectoare, blocuri egale",
    r.map(x => x.from + "–" + x.to), ["1–16","17–32","33–48","49–64"]);

  const imp = JSON.parse(vm.runInContext("JSON.stringify(sectorRanges(28, ['A','B','C','D','E','F']))", ctx));
  t("28 în 6 sectoare: resturile merg la primele (5,5,5,5,4,4)",
    imp.map(x => x.to - x.from + 1), [5,5,5,5,4,4]);
  t("…fără să se piardă vreun stand",
    imp.reduce((s,x) => s + (x.to - x.from + 1), 0), 28);

  t("fără sectoare, nu există intervale",
    JSON.parse(vm.runInContext("JSON.stringify(sectorRanges(64, []))", ctx)).length, 0);
  t("standul din afara bălții nu primește sector",
    vm.runInContext("sectorForStand(99, sectorRanges(64, state.sectors))", ctx), "");
}

/* ================================================================
   2. Numărul de standuri: scris o dată, sau presupus din câți pescari sunt
   ================================================================ */
console.log("\n=== 2. De unde știe câte standuri sunt ===");
{
  const scrisDeMana = aplicatie(["A","B"], "64", 10);
  t("numărul scris de mână bate numărul de pescari",
    JSON.parse(vm.runInContext("JSON.stringify(currentRanges())", scrisDeMana)).map(x => x.to), [32, 64]);

  const nescris = aplicatie(["A","B"], "", 10);
  t("nescris, se presupune un stand de fiecare pescar",
    JSON.parse(vm.runInContext("JSON.stringify(currentRanges())", nescris)).map(x => x.to), [5, 10]);

  const gunoi = aplicatie(["A","B"], "abc", 10);
  t("o valoare fără cifre nu strică împărțirea",
    JSON.parse(vm.runInContext("JSON.stringify(currentRanges())", gunoi)).map(x => x.to), [5, 10]);

  const gol = aplicatie(["A","B"], "", 0);
  t("fără pescari și fără număr, nu există intervale",
    JSON.parse(vm.runInContext("JSON.stringify(currentRanges())", gol)).length, 0);
}

/* ================================================================
   3. Sectorul urmează standul scris
   ================================================================ */
console.log("\n=== 3. Scrii standul, vine sectorul ===");
{
  // 64 de standuri, 4 sectoare: A 1–16, B 17–32, C 33–48, D 49–64
  const ctx = aplicatie(["A","B","C","D"], "64");
  t("standul 54 cade în D", scrie(ctx, camp("54"), camp("A")), "D");
  t("standul 34 cade în C", scrie(ctx, camp("34"), camp("A")), "C");
  t("standul 1 cade în A", scrie(ctx, camp("1"), camp("D")), "A");

  // pe măsură ce se tastează „54": întâi „5", apoi „54"
  const sec = camp("A"), st = camp("");
  st.value = "5"; scrie(ctx, st, sec);
  t("la prima cifră, sectorul e cel al standului 5", sec.value, "A");
  st.value = "54"; scrie(ctx, st, sec);
  t("la a doua, se mută unde trebuie", sec.value, "D");

  t("un stand golit nu schimbă sectorul", scrie(ctx, camp(""), camp("C")), "C");
  t("un stand fără cifre nu schimbă sectorul", scrie(ctx, camp("—"), camp("C")), "C");
  t("un stand din afara bălții nu golește sectorul", scrie(ctx, camp("99"), camp("C")), "C");
}

/* ================================================================
   4. Alegerea de mână rămâne cum a pus-o omul
   ================================================================ */
console.log("\n=== 4. Sectorul ales de mână ===");
{
  const ctx = aplicatie(["A","B","C","D"], "64");
  const st = camp("54"), sec = camp("A");
  t("întâi vine singur", scrie(ctx, st, sec), "D");

  // omul îl mută în B; formularul marchează alegerea
  sec.value = "B"; sec.dataset.man = "1";
  st.value = "55"; scrie(ctx, st, sec);
  t("corectarea standului NU șterge alegerea", sec.value, "B");
  st.value = "3"; scrie(ctx, st, sec);
  t("nici mutarea în alt capăt al bălții", sec.value, "B");

  // pescarul următor pleacă de la zero: formularul se golește, marcajul cade
  const secNou = camp("A");
  t("dar pescarul următor primește iar automat",
    scrie(ctx, camp("54"), secNou), "D");
}

/* ================================================================
   5. Fără sectoare definite, nu se inventează niciunul
   ================================================================ */
console.log("\n=== 5. Balta fără sectoare ===");
{
  const ctx = aplicatie([], "64");
  t("sectorul rămâne cum era", scrie(ctx, camp("54"), camp("")), "");
}

t.raport();
