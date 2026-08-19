/**
 * Standul și sectorul aparțin MANȘEI, nu pescarului.
 *
 * Între manșe se trage din nou la sorți, tocmai ca să se anuleze norocul standului.
 * Cât timp sectorul era un singur câmp pe participant, tragerea pentru manșa 2
 * rescria retroactiv clasamentul manșei 1: cine pica într-un sector slab devenea,
 * pe hârtie, câștigătorul unei manșe încheiate. Nicio greutate nu se schimba —
 * doar punctele, în tăcere.
 *
 * Testul rulează codul REAL din index.html.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));

function aplicatie(numManse) {
  const ctx = { state: { participants: [], manche: 1, numManse: numManse || 3 }, console };
  vm.createContext(ctx);
  vm.runInContext(
    ["emptyManche", "numManse", "scalaSectoare", "manseRange", "ensureManche", "mOf",
     "sectorOfM", "standOfM", "mancheDeAfisat", "setStandSector",
     "cantOfM", "extraOfM", "cmmcOfM", "totalOfM", "cmmcAward",
     "pointsMapS", "mancheDisputata", "pointsCombo", "nameOf"]
      .map(n => grabFunction(src, n)).join("\n"), ctx);
  return ctx;
}

/** pescari: [id, sector, stand, kgM1, kgM2] */
function pune(ctx, rows) {
  ctx.state.participants = rows.map(r => ({
    id: r[0], sector: r[1], stand: r[2], nume: r[0], prenume: "",
    m: {
      1: { catches: [r[3] || 0], extras: [], sector: r[1], stand: r[2] },
      2: { catches: [r[4] || 0], extras: [], sector: r[1], stand: r[2] },
      3: { catches: [0], extras: [], sector: r[1], stand: r[2] }
    }
  }));
}
const P = (ctx, mi) => JSON.parse(vm.runInContext(`JSON.stringify(pointsMapS(${JSON.stringify(mi)}))`, ctx));

/* ================================================================
   1. Cazul care a pornit totul: tragere nouă înainte de manșa 2
   ================================================================ */
console.log("\n=== 1. O tragere nouă nu mai atinge manșa încheiată ===");
{
  const ctx = aplicatie(3);
  // manșa 1: Ion+Vlad în A, Radu+Mihai în B. Ion 9 kg, Vlad 1, Radu 8, Mihai 2.
  pune(ctx, [["Ion","A","1",9], ["Vlad","A","2",1], ["Radu","B","3",8], ["Mihai","B","4",2]]);
  const inainte = P(ctx, 1);
  t("manșa 1, înainte: câștigătorii de sector iau 1 punct",
    [inainte.Ion, inainte.Radu], [1, 1]);
  t("…iar cei bătuți în sector iau 2", [inainte.Vlad, inainte.Mihai], [2, 2]);

  // tragere nouă pentru manșa 2: Vlad trece în B, Radu în A
  ctx.state.manche = 2;
  vm.runInContext(`
    setStandSector(state.participants[1], 2, "3", "B");
    setStandSector(state.participants[2], 2, "2", "A");
  `, ctx);

  const dupa = P(ctx, 1);
  t("manșa 1, după tragerea pentru manșa 2: NESCHIMBATĂ", dupa, inainte);
  t("Radu rămâne câștigătorul manșei 1 cu 8 kg", dupa.Radu, 1);
  t("Mihai rămâne al doilea cu 2 kg", dupa.Mihai, 2);

  // iar manșa 2 chiar folosește sectoarele noi
  t("manșa 2 vede sectorul nou al lui Vlad", vm.runInContext('sectorOfM(state.participants[1],2)', ctx), "B");
  t("manșa 1 vede sectorul vechi al lui Vlad", vm.runInContext('sectorOfM(state.participants[1],1)', ctx), "A");
  t("și standul e tot pe manșă", vm.runInContext('standOfM(state.participants[1],1)+"/"+standOfM(state.participants[1],2)', ctx), "2/3");
}

/* ================================================================
   2. Punctele fiecărei manșe se fac pe sectorul manșei ei
   ================================================================ */
console.log("\n=== 2. Fiecare manșă se punctează pe sectoarele ei ===");
{
  const ctx = aplicatie(2);
  pune(ctx, [["a","A","1",9,1], ["b","A","2",1,9], ["c","B","3",8,2], ["d","B","4",2,8]]);
  // în manșa 2 se inversează sectoarele
  vm.runInContext(`
    setStandSector(state.participants[0], 2, "1", "B");
    setStandSector(state.participants[1], 2, "2", "B");
    setStandSector(state.participants[2], 2, "3", "A");
    setStandSector(state.participants[3], 2, "4", "A");
  `, ctx);
  const m2 = P(ctx, 2);
  // manșa 2: sector A = c(2) și d(8) -> d câștigă; sector B = a(1) și b(9) -> b câștigă
  t("în manșa 2 câștigătorii sunt cei din sectoarele noi", [m2.d, m2.c, m2.b, m2.a], [1, 2, 1, 2]);
}

/* ================================================================
   3. Datele vechi, fără sector pe manșă, nu se strică
   ================================================================ */
console.log("\n=== 3. Concursurile vechi merg mai departe ===");
{
  const ctx = aplicatie(2);
  // participant ca înainte de schimbare: sector doar pe pescar, manșe fără el
  ctx.state.participants = [
    { id:"x", sector:"A", stand:"1", nume:"x", prenume:"", m:{ 1:{catches:[5],extras:[]}, 2:{catches:[3],extras:[]} } },
    { id:"y", sector:"A", stand:"2", nume:"y", prenume:"", m:{ 1:{catches:[2],extras:[]}, 2:{catches:[7],extras:[]} } }
  ];
  t("sectorul manșei cade înapoi pe cel al pescarului",
    vm.runInContext('sectorOfM(state.participants[0],1)', ctx), "A");
  t("standul la fel", vm.runInContext('standOfM(state.participants[1],2)', ctx), "2");
  t("punctajul iese normal", P(ctx, 1), { x: 1, y: 2 });
}

/* ================================================================
   4. La General se arată ultima manșă cântărită
   ================================================================ */
console.log("\n=== 4. Ce sector se arată la General ===");
{
  const ctx = aplicatie(3);
  pune(ctx, [["a","A","1",5], ["b","B","2",3]]);
  t("cu doar manșa 1 cântărită, General arată manșa 1",
    vm.runInContext("mancheDeAfisat()", ctx), 1);

  vm.runInContext(`
    setStandSector(state.participants[0], 2, "9", "C");
    state.participants[0].m[2].catches=[4];
  `, ctx);
  t("după ce se cântărește în manșa 2, General arată manșa 2",
    vm.runInContext("mancheDeAfisat()", ctx), 2);
  t("deci sectorul de la General e cel de acum, nu cel de ieri",
    vm.runInContext("sectorOfM(state.participants[0],'total')", ctx), "C");
}

/* ================================================================
   5. Avertismentul pentru cei fără sector
   ================================================================ */
console.log("\n=== 5. Avertismentul pentru cei fara sector ===");
{
  const bara = { style: {}, textContent: "" };
  const ctx = aplicatie(2);
  ctx.document = { getElementById: id => (id === "warn-sector" ? bara : null) };
  vm.runInContext(grabFunction(src, "updateWarnSector"), ctx);

  pune(ctx, [["Ion","A","1",5], ["Vlad","A","2",3]]);
  vm.runInContext("updateWarnSector();", ctx);
  t("cu toți în sector, nu apare nimic", bara.style.display, "none");

  pune(ctx, [["Ion","A","1",5], ["Vlad","","2",3]]);
  vm.runInContext("updateWarnSector();", ctx);
  t("cu unul fără sector, avertismentul apare", bara.style.display, "block");
  t("spune pe cine", /Vlad/.test(bara.textContent), true);
  t("spune și de ce contează", /1 punct pe nedrept/.test(bara.textContent), true);
  t("spune în ce manșă", /manșa 1/.test(bara.textContent), true);
}

/* ================================================================
   6. Mai multe sectoare (unele bălți au și 6)
   ================================================================ */
console.log("\n=== 6. Concurs cu 6 sectoare ===");
{
  const ctx = aplicatie(3);
  ctx.state.sectors = ["A","B","C","D","E","F"];
  // proprietatea „fiecare sector cântărește la fel" e a modului cu scală comună
  ctx.state.scalaSectoare = true;

  // 28 de pescari, sectoare de 5 și de 4
  const parts=[]; let id=0;
  [5,5,5,5,4,4].forEach(function(n, si){
    for(let i=0;i<n;i++){
      id++;
      const sec=ctx.state.sectors[si];
      parts.push({ id:"p"+id, sector:sec, stand:String(id), nume:"p"+id, prenume:"",
        m:{ 1:{catches:[100-i],extras:[],sector:sec,stand:String(id)},
            2:{catches:[0],extras:[],sector:sec,stand:String(id)},
            3:{catches:[0],extras:[],sector:sec,stand:String(id)} } });
    }
  });
  ctx.state.participants = parts;
  const pm = P(ctx, 1);
  const medii = {};
  parts.forEach(function(p){ (medii[p.sector]=medii[p.sector]||[]).push(pm[p.id]); });
  const listaMedii = Object.keys(medii).map(function(k){
    const a=medii[k]; return Math.round(a.reduce(function(x,y){return x+y;},0)/a.length*1000)/1000;
  });
  t("toate cele 6 sectoare cântăresc la fel în clasament (media 3)",
    listaMedii, [3,3,3,3,3,3]);
  t("nimeni nu coboară sub 1 punct", Math.min.apply(null, Object.values(pm)), 1);
  t("iar ultimul dintr-un sector mic ia tot cât ultimul dintr-unul mare",
    Math.max.apply(null, Object.values(pm)), 5);
}

/* ================================================================
   7. Standul se scrie din formularul participantului
      Aplicația nu mai trage nimic și nu mai are o listă de standuri:
      la baltă se trage la bilă, iar organizatorul deschide pescarul și
      îi scrie standul strigat. Formularul e singurul drum rămas, deci
      el trebuie să scrie în manșa ACTIVĂ, nu peste manșele încheiate.
   ================================================================ */
console.log("\n=== 7. Standul scris din formular ===");
{
  const ctx = aplicatie(3);
  ctx.state.sectors = ["A","B","C"];
  ctx.guard = function(){ return false; };
  ctx.queueSave = function(){}; ctx.renderList = function(){};
  ctx.editingId = "a";
  // formularul de editare al pescarului „a"
  const camp = { "ed-stand-a":"5", "ed-prenume-a":"", "ed-nume-a":"a", "ed-sector-a":"C" };
  ctx.document = { getElementById: function(id){ return (id in camp) ? { value: camp[id] } : null; } };
  vm.runInContext(["saveEdit", "curataNumarul"].map(function(n){ return grabFunction(src, n); }).join("\n"), ctx);

  pune(ctx, [["a","A","1",0], ["b","A","2",0]]);
  ctx.state.participants.forEach(function(p){ p.m[2].stand=""; p.m[2].sector=""; });

  ctx.state.manche = 2;
  vm.runInContext("saveEdit('a');", ctx);
  t("standul scris intră în manșa activă",
    vm.runInContext("standOfM(state.participants[0],2)", ctx), "5");
  t("…împreună cu sectorul",
    vm.runInContext("sectorOfM(state.participants[0],2)", ctx), "C");
  t("manșa 1, deja cântărită, rămâne neatinsă",
    vm.runInContext("standOfM(state.participants[0],1)+sectorOfM(state.participants[0],1)", ctx), "1A");
  t("ceilalți nu se ating — se scrie unul câte unul",
    vm.runInContext("standOfM(state.participants[1],2)", ctx), "");

  // standul se poate și șterge, dacă s-a trecut greșit
  camp["ed-stand-a"] = "";
  vm.runInContext("saveEdit('a');", ctx);
  t("standul șters chiar se golește în manșa activă",
    vm.runInContext("standOfM(state.participants[0],2)", ctx), "");
}

/* ================================================================
   8. O manșă fără extragere nu împrumută standurile celei dinainte
   ================================================================ */
console.log("\n=== 8. Manșa următoare începe goală ===");
{
  const ctx = aplicatie(3);
  pune(ctx, [["a","A","7",5], ["b","B","3",3]]);
  ctx.state.participants.forEach(function(p){ p.m[2].stand=""; p.m[2].sector=""; });
  ctx.state.participants[0].stand="7"; ctx.state.participants[0].sector="A";
  t("manșa 2 nu arată standul din manșa 1",
    vm.runInContext("standOfM(state.participants[0],2)", ctx), "");
  t("…nici sectorul", vm.runInContext("sectorOfM(state.participants[0],2)", ctx), "");
  t("dar manșa 1 și-l păstrează",
    vm.runInContext("standOfM(state.participants[0],1)+sectorOfM(state.participants[0],1)", ctx), "7A");
}

t.raport();
