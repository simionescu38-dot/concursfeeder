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
  vm.runInContext([grabFunction(src, "sectorRanges"), grabFunction(src, "sectorForStand")].join("\n"), ctx);

  const imp = JSON.parse(vm.runInContext('JSON.stringify(sectorRanges(28, state.sectors))', ctx));
  t("28 de standuri se împart în 6 sectoare", imp.length, 6);
  t("…fără să se piardă vreun stand", imp.reduce(function(s,x){ return s+(x.to-x.from+1); },0), 28);
  t("…iar resturile merg la primele sectoare (5,5,5,5,4,4)",
    imp.map(function(x){ return x.to-x.from+1; }), [5,5,5,5,4,4]);

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
   7. Standul strigat la bilă se scrie de mână
      Aplicația nu mai trage nimic: la baltă se trage la bilă, iar
      organizatorul scrie standul strigat. Scrisul lui atinge un singur
      pescar, iar sectorul iese din intervale.
   ================================================================ */
console.log("\n=== 7. Standul scris de mână ===");
{
  const ctx = aplicatie(3);
  ctx.state.sectors = ["A","B","C"];
  ctx.toast = function(){}; ctx.guard = function(){ return false; };
  ctx.confirm = function(){ return true; };
  ctx.queueSave = function(){}; ctx.renderList = function(){}; ctx.renderStandEntry = function(){};
  ctx.document = { getElementById: function(){ return { value: "6" }; } };
  vm.runInContext(["sectorRanges","sectorForStand","currentRanges","updateStandDup","participantById","setStandManual"]
    .map(function(n){ return grabFunction(src, n); }).join("\n"), ctx);

  pune(ctx, [["a","A","",0], ["b","A","",0], ["c","B","",0],
             ["d","B","",0], ["e","C","",0], ["f","C","",0]]);
  ctx.state.participants.forEach(function(p){ p.m[1].stand=""; p.m[1].sector=""; });

  // organizatorul scrie standul extras la baltă
  vm.runInContext("setStandManual('a', '5');", ctx);
  t("ceilalți rămân fără stand — se scrie unul câte unul",
    ctx.state.participants.slice(1).every(function(p){ return !p.m[1].stand; }), true);
  t("standul scris manual intră în manșa activă",
    vm.runInContext("standOfM(state.participants[0],1)", ctx), "5");
  t("iar sectorul se completează singur din intervale",
    vm.runInContext("sectorOfM(state.participants[0],1)", ctx), "C");

  vm.runInContext("setStandManual('a', '');", ctx);
  t("ștergerea standului șterge și sectorul",
    vm.runInContext("standOfM(state.participants[0],1)+'|'+sectorOfM(state.participants[0],1)", ctx), "|");
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

/* ================================================================
   9. Sectorul trecut de mână bate calculul automat
      La unele bălți sectoarele nu sunt blocuri consecutive de standuri,
      deci organizatorul le pune singur — și nu are voie să le piardă
      când corectează o cifră la stand.
   ================================================================ */
console.log("\n=== 9. Sectorul trecut de mana ===");
{
  const ctx = aplicatie(3);
  ctx.state.sectors = ["A","B","C"];
  ctx.guard = function(){ return false; };
  ctx.queueSave = function(){}; ctx.renderList = function(){}; ctx.updateStandDup = function(){};
  ctx.document = { getElementById: function(){ return null; } };
  vm.runInContext(["sectorRanges","sectorForStand","currentRanges","participantById",
    "setStandManual","setSectorManual"]
    .map(function(n){ return grabFunction(src, n); }).join("\n"), ctx);
  // 9 standuri, 3 sectoare: A 1-3, B 4-6, C 7-9
  vm.runInContext("currentRanges = function(){ return sectorRanges(9, state.sectors); };", ctx);

  pune(ctx, [["a","","",0], ["b","","",0]]);
  ctx.state.participants.forEach(function(p){ p.m[1].stand=""; p.m[1].sector=""; });

  vm.runInContext("setStandManual('a', '2');", ctx);
  t("standul 2 pică singur în sectorul A",
    vm.runInContext("sectorOfM(state.participants[0],1)", ctx), "A");

  vm.runInContext("setSectorManual('a', 'C');", ctx);
  t("ales de mână: trece în C",
    vm.runInContext("sectorOfM(state.participants[0],1)", ctx), "C");

  vm.runInContext("setStandManual('a', '3');", ctx);
  t("corectarea standului NU șterge sectorul ales de mână",
    vm.runInContext("sectorOfM(state.participants[0],1)", ctx), "C");
  t("…dar standul chiar se schimbă",
    vm.runInContext("standOfM(state.participants[0],1)", ctx), "3");

  // revenirea la sectorul pe care îl dau intervalele retrage alegerea
  vm.runInContext("setSectorManual('a', 'A');", ctx);
  vm.runInContext("setStandManual('a', '8');", ctx);
  t("revenit pe automat, standul redevine stăpân (8 -> C)",
    vm.runInContext("sectorOfM(state.participants[0],1)", ctx), "C");

  vm.runInContext("setStandManual('b', '5');", ctx);
  t("celălalt pescar rămâne pe automat (5 -> B)",
    vm.runInContext("sectorOfM(state.participants[1],1)", ctx), "B");
}

t.raport();
