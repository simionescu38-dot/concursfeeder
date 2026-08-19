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
     "cmmcAward", "pointsMapS", "mancheDisputata", "pointsCombo", "normalize",
     "nameOf", "updateWarnStand"]
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
   4. Nimic nu mai rescrie o manșă întreagă dintr-o apăsare
      Tragerea din aplicație și lista de standuri au fost scoase: la
      baltă se trage la bilă. Amândouă puteau rescrie dintr-un gest
      ordinea, standul și sectorul tuturor — inclusiv ale unei manșe
      deja cântărite. A rămas formularul fiecărui participant, care
      atinge un singur om.
   ================================================================ */
console.log("\n=== 4. Nicio rescriere în masă ===");
{
  t("nu mai există tragere automată", /function\s+drawLots\s*\(/.test(src), false);
  t("nici tragere de ordine", /function\s+drawOrder\s*\(/.test(src), false);
  t("nici lista de standuri", /function\s+renderStandEntry\s*\(/.test(src), false);
  t("și niciun buton nu le mai cheamă",
    /drawLots\(\)|drawOrder\(\)|renderStandEntry\(\)|setStandManual\(/.test(src), false);

  // singurul drum rămas scrie un singur participant, în manșa activă
  const ed = grabFunction(src, "saveEdit");
  t("formularul caută un singur participant, după id",
    /state\.participants\.find\(/.test(ed), true);
  t("…și nu trece prin toți", /state\.participants\.forEach/.test(ed), false);
  t("iar standul scris merge în manșa activă",
    /mOf\(p, state\.manche\|\|1\)\.stand\s*=/.test(ed), true);
}

/* ================================================================
   5. Două bilete cu același număr
      Se văd altfel abia la baltă, când doi oameni ajung pe același stand —
      sau, mai rău, abia la cântar, unde captura se poate trece pe cine nu
      trebuie. Avertismentul stătea în lista de standuri; lista a plecat,
      greșeala nu.
   ================================================================ */
console.log("\n=== 5. Standuri duble ===");
{
  const ctx = aplicatie(2);
  let cutie = { style: {}, textContent: "" };
  ctx.document = { getElementById: function(id){ return id === "warn-stand" ? cutie : null; } };
  const arata = () => { vm.runInContext("updateWarnStand()", ctx); return cutie; };
  const pune = rows => {
    ctx.state.participants = rows.map((r,i) => ({
      id:"p"+i, nume:r[0], prenume:"",
      m:{ 1:{catches:[],extras:[],stand:r[1],sector:"A"},
          2:{catches:[],extras:[],stand:r[2]||"",sector:"A"} }
    }));
  };

  pune([["Ion","5"], ["Vlad","7"], ["Radu","9"]]);
  t("cu standuri diferite, nu apare nimic", arata().style.display, "none");

  pune([["Ion","5"], ["Vlad","5"], ["Radu","9"]]);
  const w = arata();
  t("cu două bilete la fel, avertismentul apare", w.style.display, "block");
  t("spune care stand", /standul 5 e dat de 2 ori/.test(w.textContent), true);
  t("spune pe cine", /\(Ion, Vlad\)/.test(w.textContent), true);
  t("spune în ce manșă", /manșa 1/.test(w.textContent), true);
  t("spune și de ce contează", /captura se poate trece pe cine nu trebuie/.test(w.textContent), true);
  t("nu pomenește standul curat", /standul 9/.test(w.textContent), false);

  // avertismentul e al manșei active: manșa 2 are altă repartizare
  pune([["Ion","5","1"], ["Vlad","5","2"], ["Radu","9","3"]]);
  ctx.state.manche = 2;
  t("pe manșa 2, curată, nu mai apare", arata().style.display, "none");
  ctx.state.manche = 1;
  t("iar pe manșa 1 e tot acolo", arata().style.display, "block");

  // cine n-a primit încă standul nu e „dublură" cu ceilalți care n-au primit
  pune([["Ion",""], ["Vlad",""], ["Radu","9"]]);
  t("doi fără stand nu sunt un stand dublu", arata().style.display, "none");

  // trei pe același stand, și un al doilea stand dublu
  pune([["Ion","5"], ["Vlad","5"], ["Radu","5"], ["Dan","12"], ["Emil","12"]]);
  const w2 = arata();
  t("numără corect când sunt trei pe același stand",
    /standul 5 e dat de 3 ori/.test(w2.textContent), true);
  t("le arată pe amândouă", /standul 12 e dat de 2 ori/.test(w2.textContent), true);
  t("iar standurile ies în ordine numerică",
    w2.textContent.indexOf("standul 5") < w2.textContent.indexOf("standul 12"), true);
}

t.raport();
