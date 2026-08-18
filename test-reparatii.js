/**
 * Capcanele găsite la o verificare a drumului real de concurs, după ce standul a
 * devenit al manșei. Niciuna nu dădea eroare — toate schimbau tăcut repartizarea.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));

function aplicatie(numManse, manche) {
  const ctx = {
    state: { participants: [], manche: manche || 1, numManse: numManse || 2,
             sectors: ["A", "B"], sponsors: [], rules: "" },
    console, num: x => parseFloat(x) || 0
  };
  vm.createContext(ctx);
  vm.runInContext(
    ["emptyManche", "numManse", "manseRange", "ensureManche", "mOf", "sectorOfM", "standOfM",
     "mancheDeAfisat", "setStandSector", "cantOfM", "extraOfM", "cmmcOfM", "totalOfM",
     "cmmcAward", "pointsMapS", "mancheDisputata", "pointsCombo", "normalize"]
      .map(n => grabFunction(src, n)).join("\n"), ctx);
  return ctx;
}

/** doi pescari cu manșa 1 și manșa 2 trase deja, pe standuri diferite */
function douaManseTrase(ctx) {
  ctx.state.participants = [
    { id: "a", stand: "1", sector: "A", nume: "a", prenume: "", msv: 1,
      m: { 1: { catches: [5], extras: [], stand: "1", sector: "A" },
           2: { catches: [], extras: [], stand: "4", sector: "B" } } },
    { id: "b", stand: "2", sector: "A", nume: "b", prenume: "", msv: 1,
      m: { 1: { catches: [3], extras: [], stand: "2", sector: "A" },
           2: { catches: [], extras: [], stand: "3", sector: "B" } } }
  ];
}

/* ================================================================
   1. Trecerea de la 2 la 3 manșe
   ================================================================ */
console.log("\n=== 1. Manșa deschisă acum începe goală ===");
{
  const ctx = aplicatie(2);
  douaManseTrase(ctx);
  ctx.state.numManse = 3;
  vm.runInContext("state.participants.forEach(ensureManche);", ctx);
  t("imediat după comutare, manșa 3 n-are stand",
    vm.runInContext("standOfM(state.participants[0],3)", ctx), "");
  t("…nici sector", vm.runInContext("sectorOfM(state.participants[0],3)", ctx), "");

  // capcana: normalize (adică o redeschidere a aplicației) îngheța standul curent
  // în manșa 3, care părea astfel deja trasă
  vm.runInContext("normalize();", ctx);
  t("nici după o redeschidere a aplicației",
    vm.runInContext("standOfM(state.participants[0],3)", ctx), "");
  t("…și tot fără sector", vm.runInContext("sectorOfM(state.participants[0],3)", ctx), "");
  t("dar manșele trase își păstrează standurile",
    vm.runInContext("standOfM(state.participants[0],1)+'/'+standOfM(state.participants[0],2)", ctx), "1/4");
}

/* ================================================================
   2. Redeschiderea aplicației pe altă manșă decât prima
   ================================================================ */
console.log("\n=== 2. „Unde stă acum\" după o redeschidere ===");
{
  const ctx = aplicatie(2, 2); // aplicația pornește cu manșa 2 activă
  douaManseTrase(ctx);
  vm.runInContext("normalize();", ctx);
  t("p.stand e al manșei active, nu al manșei 1",
    ctx.state.participants[0].stand, "4");
  t("la fel și sectorul", ctx.state.participants[0].sector, "B");
  t("celălalt pescar la fel", ctx.state.participants[1].stand, "3");
  // formularul de editare se preumple din p.stand: dacă rămânea al manșei 1,
  // prima salvare scria peste tragerea manșei 2
  t("deci formularul de editare nu mai poate strica tragerea manșei active",
    ctx.state.participants[0].stand, vm.runInContext("standOfM(state.participants[0],2)", ctx));
}

/* ================================================================
   3. Migrarea datelor vechi se face o singură dată
   ================================================================ */
console.log("\n=== 3. Migrarea datelor vechi ===");
{
  const ctx = aplicatie(2);
  // participant scris înainte de schimbare: stand doar pe pescar
  ctx.state.participants = [
    { id: "x", stand: "7", sector: "B", nume: "x", prenume: "",
      m: { 1: { catches: [5], extras: [] }, 2: { catches: [], extras: [] } } }
  ];
  vm.runInContext("normalize();", ctx);
  t("manșele existente preiau standul de atunci",
    vm.runInContext("standOfM(state.participants[0],1)+'/'+standOfM(state.participants[0],2)", ctx), "7/7");
  t("și sunt marcate ca migrate", ctx.state.participants[0].msv, 1);

  // acum se deschide manșa 3: nu mai are voie să moștenească nimic
  ctx.state.numManse = 3;
  vm.runInContext("normalize();", ctx);
  t("manșa deschisă după migrare rămâne goală",
    vm.runInContext("standOfM(state.participants[0],3)", ctx), "");
}

/* ================================================================
   4. O tragere automată nouă nu lasă în urmă alegeri de mână
   ================================================================ */
console.log("\n=== 4. Alegerile de mână, după o tragere nouă ===");
{
  const ctx = aplicatie(2);
  douaManseTrase(ctx);
  ctx.state.participants[0].m[1].secManual = 1; // sector ales de mână la manșa 1
  const draw = grabFunction(src, "drawLots");
  t("tragerea automată șterge marcajul de sector manual",
    /delete mOf\(p,mi\)\.secManual/.test(draw), true);
}

t.raport();
