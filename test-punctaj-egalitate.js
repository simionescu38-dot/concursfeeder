/**
 * Test pentru corectarea punctelor la egalitate în sector:
 * media locurilor (convenția FIPS/CIPS) în loc de "toți iau locul cel mai bun".
 *
 * Funcțiile ajutătoare (mOf, cantOfM, extraOfM, cmmcOfM, totalOfM, cmmcAward,
 * standKey, nameKey) sunt extrase VERBATIM din index.html, ca testul să verifice
 * codul real, nu o copie care poate diverge.
 */
const fs = require("fs");
const vm = require("vm");
const H2 = require("./test-helpers.js"); // extractor care sare peste comentarii/șiruri/regex

const HTML = require("path").join(H2.RADACINA, "index.html");
const src = fs.readFileSync(HTML, "utf8");

/** extrage `function nume(...){...}` cu echilibrare de acolade */
function grab(name) {
  const i = src.indexOf("function " + name + "(");
  if (i < 0) throw new Error("nu găsesc funcția " + name);
  let d = 0, started = false;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === "{") { d++; started = true; }
    else if (c === "}") { d--; if (started && d === 0) return src.slice(i, j + 1); }
  }
  throw new Error("acolade neechilibrate la " + name);
}

const helpers = ["mOf", "cantOfM", "extraOfM", "cmmcOfM", "totalOfM", "cmmcAward", "standKey", "nameKey"]
  .map(grab).join("\n");

const sandbox = { state: { participants: [] }, console };
vm.createContext(sandbox);
vm.runInContext(`
  function ensureManche(p){
    if(!p.m) p.m={};
    [1,2].forEach(function(i){ if(!p.m[i]) p.m[i]={catches:[],extras:[]}; });
  }
  ${helpers}

  /* ---------- VECHI: toți cei la egalitate iau locul cel mai bun ---------- */
  function pointsVechi(mi){
    var secs={};
    state.participants.forEach(function(p){ var k=p.sector||"Fără sector"; (secs[k]=secs[k]||[]).push(p); });
    var map={};
    Object.keys(secs).forEach(function(k){
      var arr=secs[k];
      arr.forEach(function(p){
        var better=arr.filter(function(o){ return totalOfM(o,mi) > totalOfM(p,mi)+1e-9; }).length;
        map[p.id]=better+1;
      });
    });
    return map;
  }

  /* ---------- NOU: media locurilor ocupate de grupul la egalitate ---------- */
  function pointsNou(mi){
    var secs={};
    state.participants.forEach(function(p){ var k=p.sector||"Fără sector"; (secs[k]=secs[k]||[]).push(p); });
    var map={};
    Object.keys(secs).forEach(function(k){
      var arr=secs[k];
      arr.forEach(function(p){
        var w=totalOfM(p,mi);
        var better=arr.filter(function(o){ return totalOfM(o,mi) > w+1e-9; }).length;
        var tied=arr.filter(function(o){ return Math.abs(totalOfM(o,mi)-w) <= 1e-9; }).length;
        // ocupă locurile (better+1) ... (better+tied); media = better + (tied+1)/2
        map[p.id]=better+(tied+1)/2;
      });
    });
    return map;
  }

  function comboNou(){
    var a=pointsNou(1), b=pointsNou(2), map={};
    state.participants.forEach(function(p){ map[p.id]=(a[p.id]||0)+(b[p.id]||0); });
    return map;
  }

  function bestManche(p){ return Math.max(totalOfM(p,1), totalOfM(p,2)); }

  /* cascadă nouă: puncte -> kg -> cea mai mare manșă (doar la general) -> cel mai mare pește -> stand -> nume */
  function sortNou(arr, pmap, mi){
    return arr.slice().sort(function(a,b){
      var d=pmap[a.id]-pmap[b.id]; if(Math.abs(d)>1e-9) return d;
      var t=totalOfM(b,mi)-totalOfM(a,mi); if(Math.abs(t)>1e-9) return t;
      if(mi==='total'){
        var m=bestManche(b)-bestManche(a); if(Math.abs(m)>1e-9) return m;
      }
      var f=cmmcAward(b,mi)-cmmcAward(a,mi); if(Math.abs(f)>1e-9) return f;
      var s=standKey(a)-standKey(b); if(s) return s;
      return nameKey(a).localeCompare(nameKey(b),"ro");
    });
  }
`, sandbox);

/* ---------------- utilitare de test ---------------- */
let ok = 0, fail = 0;
function t(nume, real, asteptat) {
  const a = JSON.stringify(real), b = JSON.stringify(asteptat);
  if (a === b) { ok++; console.log("  ✅ " + nume); }
  else { fail++; console.log("  ❌ " + nume + "\n       primit:   " + a + "\n       așteptat: " + b); }
}
/** construiește participanți: [id, sector, stand, kg_m1, kg_m2] */
function setup(rows) {
  sandbox.state.participants = rows.map(r => ({
    id: r[0], sector: r[1], stand: r[2], nume: r[0], prenume: "",
    m: { 1: { catches: [r[3]], extras: r[4] !== undefined ? [r[4]] : [] },
         2: { catches: [r[5] !== undefined ? r[5] : 0], extras: [] } }
  }));
}
const P = (fn, mi) => vm.runInContext(`JSON.stringify(${fn}(${JSON.stringify(mi)}))`, sandbox);
const pts = (fn, mi) => JSON.parse(P(fn, mi));

console.log("\n=== 1. Fără egalități: nimic nu se schimbă (fără regresie) ===");
setup([["a","A","A1",5.0],["b","A","A2",3.0],["c","A","A3",1.0]]);
t("vechi", pts("pointsVechi",1), {a:1,b:2,c:3});
t("nou",   pts("pointsNou",1),   {a:1,b:2,c:3});

console.log("\n=== 2. Doi la egalitate pe locurile 2-3 ===");
setup([["a","A","A1",5.0],["b","A","A2",3.2],["c","A","A3",3.2],["d","A","A4",1.0]]);
t("vechi dă amândurora locul bun", pts("pointsVechi",1), {a:1,b:2,c:2,d:4});
t("nou dă media (2+3)/2 = 2,5",    pts("pointsNou",1),   {a:1,b:2.5,c:2.5,d:4});

console.log("\n=== 3. Invariantul: suma punctelor pe sector = N(N+1)/2 ===");
const sum = o => Object.values(o).reduce((x,y)=>x+y,0);
t("nou respectă invariantul pentru N=4",   sum(pts("pointsNou",1)) === 10, true);
t("vechi ÎL ÎNCALCĂ (9 în loc de 10)",     sum(pts("pointsVechi",1)) === 10, false);

console.log("\n=== 4. Cazul real: 10 pescari, 4 fără captură ===");
setup([["a","A","A1",9.0],["b","A","A2",8.0],["c","A","A3",7.0],
       ["d","A","A4",6.0],["e","A","A5",5.0],["f","A","A6",4.0],
       ["g","A","A7",0],["h","A","A8",0],["i","A","A9",0],["j","A","A10",0]]);
const v4 = pts("pointsVechi",1), n4 = pts("pointsNou",1);
t("vechi: cei fără captură iau 7 puncte", [v4.g,v4.h,v4.i,v4.j], [7,7,7,7]);
t("nou: iau media locurilor 7-10 = 8,5",  [n4.g,n4.h,n4.i,n4.j], [8.5,8.5,8.5,8.5]);
t("cei care au prins nu sunt afectați",   [n4.a,n4.b,n4.c,n4.d,n4.e,n4.f], [1,2,3,4,5,6]);
t("suma pe sector = 55",                  sum(n4) === 55, true);

console.log("\n=== 5. Toți la egalitate (sector întreg cu 0 kg) ===");
setup([["a","A","A1",0],["b","A","A2",0],["c","A","A3",0],["d","A","A4",0],["e","A","A5",0]]);
t("fiecare ia (5+1)/2 = 3", Object.values(pts("pointsNou",1)), [3,3,3,3,3]);

console.log("\n=== 6. Sectoare separate, punctajul nu se amestecă ===");
setup([["a","A","A1",5.0],["b","A","A2",5.0],["c","B","B1",9.0],["d","B","B2",1.0]]);
t("A: doi la egalitate pe 1-2 => 1,5 fiecare", [pts("pointsNou",1).a, pts("pointsNou",1).b], [1.5,1.5]);
t("B: neatins",                                 [pts("pointsNou",1).c, pts("pointsNou",1).d], [1,2]);

console.log("\n=== 7. Puncte fracționare însumate pe 2 manșe ===");
// a: 1,5 în M1 (egal cu b) + 1 în M2 = 2,5 | b: 1,5 + 2 = 3,5
sandbox.state.participants = [
  {id:"a",sector:"A",stand:"A1",nume:"a",prenume:"",m:{1:{catches:[5],extras:[]},2:{catches:[8],extras:[]}}},
  {id:"b",sector:"A",stand:"A2",nume:"b",prenume:"",m:{1:{catches:[5],extras:[]},2:{catches:[2],extras:[]}}}
];
t("combinat: a=2,5  b=3,5", pts("comboNou"), {a:2.5,b:3.5});

console.log("\n=== 8. Departajarea nouă (puncte și kg egale) ===");
// ambii: 5 kg în total (M1+M2), dar a are manșa cea mai mare mai bună
sandbox.state.participants = [
  {id:"a",sector:"A",stand:"A9",nume:"a",prenume:"",m:{1:{catches:[4],extras:[]},2:{catches:[1],extras:[]}}},
  {id:"b",sector:"A",stand:"A1",nume:"b",prenume:"",m:{1:{catches:[2.5],extras:[]},2:{catches:[2.5],extras:[]}}}
];
let ord = JSON.parse(vm.runInContext(
  "JSON.stringify(sortNou(state.participants, comboNou(), 'total').map(function(p){return p.id;}))", sandbox));
t("câștigă cea mai mare manșă (a), nu standul mai mic (b)", ord, ["a","b"]);

// puncte, kg ȘI cea mai mare manșă egale => decide cel mai mare pește
sandbox.state.participants = [
  {id:"a",sector:"A",stand:"A9",nume:"a",prenume:"",m:{1:{catches:[2],extras:[1.2]},2:{catches:[0],extras:[]}}},
  {id:"b",sector:"A",stand:"A1",nume:"b",prenume:"",m:{1:{catches:[2],extras:[1.2]},2:{catches:[0],extras:[]}}}
];
// identici => decide standul (A1 înaintea A9)
ord = JSON.parse(vm.runInContext(
  "JSON.stringify(sortNou(state.participants, comboNou(), 'total').map(function(p){return p.id;}))", sandbox));
t("complet identici => decide standul", ord, ["b","a"]);

sandbox.state.participants = [
  {id:"a",sector:"A",stand:"A9",nume:"a",prenume:"",m:{1:{catches:[1],extras:[2.5]},2:{catches:[0],extras:[]}}},
  {id:"b",sector:"A",stand:"A1",nume:"b",prenume:"",m:{1:{catches:[2],extras:[1.5]},2:{catches:[0],extras:[]}}}
];
ord = JSON.parse(vm.runInContext(
  "JSON.stringify(sortNou(state.participants, comboNou(), 'total').map(function(p){return p.id;}))", sandbox));
t("la egalitate perfectă de kg, câștigă peștele mai mare (a: 2,5)", ord, ["a","b"]);

/* ================================================================
   9. CODUL REAL din index.html — nu copiile de mai sus.
   Secțiunile 1-8 verifică algoritmul; asta verifică fișierul livrat.
   ================================================================ */
console.log("\n=== 9. Codul REAL din index.html ===");
const realSrc = ["mOf","cantOfM","extraOfM","cmmcOfM","totalOfM","cmmcAward","standKey","nameKey",
                 // sectorul e al manșei, deci pointsMapS trece prin sectorOfM
                 "sectorOfM","standOfM","mancheDeAfisat","manseRange","numManse","scalaSectoare",
                 "byStand","absentLaMansa","pointsMapS","mancheDisputata","pointsCombo","bestMancheOf","sortByPointsS","fmtPts",
                 "regPunctajHtml"]
  .map(grab).join("\n");
const real = { state: { participants: [], numManse: 2 }, console };
vm.createContext(real);
vm.runInContext(`
  function ensureManche(p){
    if(!p.m) p.m={};
    for(var i=1;i<=(state.numManse||2);i++){ if(!p.m[i]) p.m[i]={catches:[],extras:[]}; }
  }
  ${realSrc}
`, real);

function setupReal(rows){
  real.state.participants = rows.map(r => ({
    id: r[0], sector: r[1], stand: r[2], nume: r[0], prenume: "",
    m: { 1: { catches: [r[3]], extras: [] }, 2: { catches: [0], extras: [] } }
  }));
}
const ptsReal = mi => JSON.parse(vm.runInContext(`JSON.stringify(pointsMapS(${JSON.stringify(mi)}))`, real));

setupReal([["a","A","A1",5.0],["b","A","A2",3.2],["c","A","A3",3.2],["d","A","A4",1.0]]);
t("pointsMapS real: media (2+3)/2 = 2,5", ptsReal(1), {a:1,b:2.5,c:2.5,d:4});

setupReal([["a","A","A1",9.0],["b","A","A2",8.0],["c","A","A3",7.0],
           ["d","A","A4",6.0],["e","A","A5",5.0],["f","A","A6",4.0],
           ["g","A","A7",0],["h","A","A8",0],["i","A","A9",0],["j","A","A10",0]]);
t("pointsMapS real: invariantul N(N+1)/2 = 55", sum(ptsReal(1)) === 55, true);

// departajare reală: puncte + kg egale, dar a are manșa cea mai mare mai bună
real.state.participants = [
  {id:"a",sector:"A",stand:"A9",nume:"a",prenume:"",m:{1:{catches:[4],extras:[]},2:{catches:[1],extras:[]}}},
  {id:"b",sector:"A",stand:"A1",nume:"b",prenume:"",m:{1:{catches:[2.5],extras:[]},2:{catches:[2.5],extras:[]}}}
];
t("sortByPointsS real: decide manșa cea mai mare, nu standul",
  JSON.parse(vm.runInContext(
    "JSON.stringify(sortByPointsS(state.participants, pointsCombo(), 'total').map(function(p){return p.id;}))", real)),
  ["a","b"]);

const F = v => vm.runInContext(`fmtPts(${JSON.stringify(v)})`, real);
t("fmtPts real: 2 → \"2\"",     F(2),   "2");
t("fmtPts real: 2.5 → \"2,5\"", F(2.5), "2,5");
t("fmtPts real: 8.5 → \"8,5\"", F(8.5), "8,5");

/* ================================================================
   9b. Manșele nedisputate nu intră la General.
   O manșă în care nu s-a cântărit nimic ar pune toată lumea la egalitate pe
   zero, deci fiecare ar încasa media locurilor din sectorul lui — adică
   (oameni în sector + 1) / 2. Sectoarele n-au mereu același număr de oameni,
   așa că punctele fantomă ar fi mai mici în sectoarele mici și cei de acolo ar
   urca nemeritat la General. Regula rămâne „cele mai puține puncte = locul 1",
   dar se aplica pe numere greșite.
   ================================================================ */
// Secțiunile 9b și 9c descriu modul „aceeași scală", care e acum o alegere, nu
// implicitul. Îl pornim explicit, ca așteptările scrise atunci să rămână valabile.
real.state.scalaSectoare = true;
console.log("\n=== 9b. Manșe nedisputate (General) ===");
const comboReal = () => JSON.parse(vm.runInContext("JSON.stringify(pointsCombo())", real));
/** concurent cu o captură per manșă, în ordinea dată */
function pesc(id, sector, kgPerManse) {
  const m = {};
  kgPerManse.forEach((kg, i) => { m[i + 1] = { catches: kg ? [kg] : [], extras: [] }; });
  return { id, sector, stand: id, nume: id, prenume: "", m };
}

// 3 manșe configurate, doar prima pescuită; sector A are 4 oameni, sector B doar 2
real.state.numManse = 3;
real.state.participants = [pesc("a1","A",[10,0,0]), pesc("a2","A",[8,0,0]),
                           pesc("a3","A",[6,0,0]), pesc("a4","A",[4,0,0]),
                           pesc("b1","B",[10,0,0]), pesc("b2","B",[8,0,0])];
t("manșa nepescuită nu e disputată", vm.runInContext("mancheDisputata(2)", real), false);
t("manșa pescuită e disputată",      vm.runInContext("mancheDisputata(1)", real), true);
// b2 iese 4, nu 2: e ultimul din sectorul lui, iar locurile sectorului de 2 se întind pe
// scala sectorului de 4 (vezi 9c). Ce verifică testul aici e că manșele nepescuite nu intră
// în sumă — punctele de la General sunt exact cele din manșa 1, nimic în plus.
t("General = punctele manșei pescuite, fără puncte fantomă",
  comboReal(), {a1:1, a2:2, a3:3, a4:4, b1:1, b2:4});
t("General e identic cu punctele manșei disputate",
  comboReal(), JSON.parse(vm.runInContext("JSON.stringify(pointsMapS(1))", real)));
t("câștigătorii celor două sectoare rămân la egalitate, nu îi separă mărimea sectorului",
  comboReal().a1 === comboReal().b1, true);

// două manșe pescuite din trei: General e suma lor exactă
real.state.participants = [pesc("a1","A",[10,4,0]), pesc("a2","A",[8,6,0]), pesc("a3","A",[6,8,0])];
t("2 din 3 manșe: General e suma celor două disputate",
  comboReal(), {a1:4, a2:4, a3:4});

// într-o manșă disputată, cine n-a prins nimic ia locurile de la urmă — asta e corect
real.state.participants = [pesc("x1","A",[10,0,0]), pesc("x2","A",[0,0,0]), pesc("x3","A",[0,0,0])];
t("în manșa disputată, cei fără captură iau media locurilor rămase",
  comboReal(), {x1:1, x2:2.5, x3:2.5});

// niciun cântar deschis încă: nimeni nu pornește cu puncte
real.state.participants = [pesc("y1","A",[0,0,0]), pesc("y2","B",[0,0,0])];
t("înainte de primul cântar, toți au 0 puncte", comboReal(), {y1:0, y2:0});

// o manșă cu doar pești extra (fără captură la cantar) tot s-a disputat
real.state.participants = [
  {id:"z1",sector:"A",stand:"z1",nume:"z1",prenume:"",m:{1:{catches:[],extras:[]},2:{catches:[],extras:[3]},3:{catches:[],extras:[]}}},
  {id:"z2",sector:"A",stand:"z2",nume:"z2",prenume:"",m:{1:{catches:[],extras:[]},2:{catches:[],extras:[]},3:{catches:[],extras:[]}}}
];
t("manșa cu doar pești extra contează ca disputată", vm.runInContext("mancheDisputata(2)", real), true);
t("…și punctele ei intră la General", comboReal(), {z1:1, z2:2});

real.state.numManse = 2; // starea implicită, pentru orice verificare care urmează

/* ================================================================
   9c. Sectoare de mărimi diferite, aduse pe aceeași scală.
   Locurile brute nu se pot compara între sectoare inegale: ultimul dintr-un
   sector de 10 lua 10 puncte, ultimul dintr-unul de 5 doar 5, deși amândoi
   și-au închis sectorul — cine nimerea sectorul mic era avantajat de tragerea
   la sorți. Locurile fiecărui sector se întind pe scala sectorului celui mai
   numeros, iar invariantul care ține totul în frâu e că suma punctelor unui
   sector = n × (nMax+1) / 2, adică fiecare sector contribuie la fel de mult.
   ================================================================ */
console.log("\n=== 9c. Normalizarea sectoarelor inegale ===");
real.state.numManse = 1;
/** pune concurenții pe sectoare: grupe(["A",[10,8]],["B",[9]]) */
function grupe(...gr) {
  const out = []; let i = 0;
  gr.forEach(([sec, kgs]) => kgs.forEach(kg => {
    i++; out.push({ id: sec + i, sector: sec, stand: sec + i, nume: sec + i, prenume: "",
                    m: { 1: { catches: [kg], extras: [] } } });
  }));
  real.state.participants = out;
}
const pts1 = () => JSON.parse(vm.runInContext("JSON.stringify(pointsMapS(1))", real));
/** suma punctelor unui sector, din harta de puncte */
const sumaSec = (m, sec) => real.state.participants
  .filter(p => p.sector === sec).reduce((s, p) => s + m[p.id], 0);
const nSec = sec => real.state.participants.filter(p => p.sector === sec).length;
const nMaxSec = () => Math.max(...[...new Set(real.state.participants.map(p => p.sector))].map(nSec));
/** invariantul, pentru fiecare sector în joc */
function invariant(eticheta) {
  const m = pts1(), nMax = nMaxSec();
  const sectoare = [...new Set(real.state.participants.map(p => p.sector))];
  const toate = sectoare.every(sec => Math.abs(sumaSec(m, sec) - nSec(sec) * (nMax + 1) / 2) <= 1e-9);
  t(eticheta + ": suma fiecărui sector = n × (nMax+1)/2", toate, true);
}

// sectoare egale: normalizarea trebuie să fie complet neutră
grupe(["A", [10, 8, 6, 4]], ["B", [10, 8, 6, 4]]);
t("sectoare egale: punctele rămân exact locurile",
  pts1(), {A1:1, A2:2, A3:3, A4:4, B5:1, B6:2, B7:3, B8:4});
invariant("sectoare egale");

// 4 vs 2: primul fiecărui sector ia 1, ultimul ia 4 în ambele
grupe(["A", [10, 8, 6, 4]], ["B", [10, 8]]);
t("4 vs 2: locurile sectorului mic se întind pe scala celui mare",
  pts1(), {A1:1, A2:2, A3:3, A4:4, B5:1, B6:4});
t("câștigătorii ambelor sectoare iau 1 punct", pts1().A1 === pts1().B5, true);
t("ultimii ambelor sectoare iau la fel", pts1().A4 === pts1().B6, true);
invariant("4 vs 2");

// sector cu un singur om: n-are cu cine se compara, deci ia media, nu locul 1 pe gratis
grupe(["A", [10, 8, 6, 4, 2]], ["B", [9]]);
t("sectorul de un om ia media scalei, nu 1 punct", pts1().B6, 3);
t("…adică nu bate câștigătorul sectorului mare", pts1().B6 > pts1().A1, true);
invariant("5 vs 1");

// egalitățile supraviețuiesc normalizării
grupe(["A", [10, 5, 5, 1]], ["B", [7, 7]]);
t("egalitate în sectorul mare: media locurilor 2-3", [pts1().A2, pts1().A3], [2.5, 2.5]);
t("egalitate în sectorul mic: amândoi la mijlocul scalei", [pts1().B5, pts1().B6], [2.5, 2.5]);
invariant("egalități");

// scală mare, sector mic: apar fracții mai fine de jumătatea de punct
grupe(["A", [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]], ["B", [9, 3, 3]]);
t("10 vs 3: ultimii doi din sectorul mic, la egalitate, iau 7,75",
  [pts1().B12, pts1().B13], [7.75, 7.75]);
t("fmtPts arată sferturile, nu le rotunjește la jumătate",
  vm.runInContext("fmtPts(7.75)", real), "7,75");
invariant("10 vs 3");

// un singur sector: nMax = n, deci iar identitate
grupe(["A", [10, 8, 6]]);
t("un singur sector: punctele rămân locurile", pts1(), {A1:1, A2:2, A3:3});
invariant("un singur sector");

real.state.numManse = 2;

/* ================================================================
   10. CODUL REAL din sezon.html — locurile la egalitate.
   ================================================================ */
real.state.scalaSectoare = false; // înapoi la implicit pentru restul suitei
console.log("\n=== 10. Codul REAL din sezon.html ===");
const sezSrc = H2.citeste("sezon.html");
function grabParen(hay, marker){
  const i = hay.indexOf(marker);
  if (i < 0) throw new Error("nu găsesc în sezon.html: " + marker);
  let d = 0, started = false;
  for (let j = i; j < hay.length; j++) {
    const c = hay[j];
    if (c === "(") { d++; started = true; }
    else if (c === ")") { d--; if (started && d === 0) return hay.slice(i, j + 2); } // include ;
  }
  throw new Error("paranteze neechilibrate la " + marker);
}
const placesOf = new Function("ranked", grabParen(sezSrc, "var places = ranked.map(") + "\n return places;");

t("sezon real: fără egalități => 1,2,3",
  placesOf([{kg:9},{kg:5},{kg:1}]), [1,2,3]);
t("sezon real: doi egali pe 2-3 => 2,5",
  placesOf([{kg:9},{kg:5},{kg:5},{kg:1}]), [1,2.5,2.5,4]);
t("sezon real: toți la 0 kg => 2,5 fiecare (media 1-4)",
  placesOf([{kg:0},{kg:0},{kg:0},{kg:0}]), [2.5,2.5,2.5,2.5]);

/* ================================================================
   11. Pagina de Regulament trebuie să spună ADEVĂRUL despre punctaj.
   Textul e citit de pescari ca să înțeleagă clasamentul; dacă regula
   din cod se schimbă și textul rămâne, aplicația îi minte.
   ================================================================ */
console.log("\n=== 11. Regulamentul descrie ce face codul ===");
const regText = vm.runInContext("regPunctajHtml()", real).replace(/<[^>]+>/g, " ");

// afirmația: „doi la egalitate pe locurile 2 și 3 iau amândoi 2,5 puncte"
t("textul chiar face afirmația despre 2,5 puncte", /2,5 puncte/.test(regText), true);
setupReal([["a","A","A1",9.0],["b","A","A2",5.0],["c","A","A3",5.0],["d","A","A4",1.0]]);
{
  const p = ptsReal(1);
  t("…iar codul chiar dă 2,5 celor doi de pe 2-3", [p.b, p.c], [2.5, 2.5]);
  t("…și îl afișează cu virgulă, cum scrie în text", vm.runInContext("fmtPts(2.5)", real), "2,5");
}

// afirmația: „Totalul = cantitatea + peștii extra", fără CMMC
t("textul spune că totalul e cantitate + pești extra",
  /cantitatea cântărită \+ peștii extra/.test(regText), true);
real.state.participants = [
  {id:"x",sector:"A",stand:"1",nume:"x",prenume:"",m:{1:{catches:[3],extras:[2]},2:{catches:[0],extras:[]}}}
];
{
  const total = vm.runInContext("totalOfM(state.participants[0],1)", real);
  const cant  = vm.runInContext("cantOfM(state.participants[0],1)", real);
  const extra = vm.runInContext("extraOfM(state.participants[0],1)", real);
  const cmmc  = vm.runInContext("cmmcOfM(state.participants[0],1)", real);
  t("…iar codul chiar face total = cantitate + extra", total, cant + extra);
  t("…și NU adaugă CMMC-ul pe deasupra", total !== cant + extra + cmmc || cmmc === 0, true);
  t("(CMMC-ul există totuși, ca premiu separat)", cmmc, 2);
}

// afirmația: la General, CMMC e cel mai mare din concurs, nu suma zilelor
t("textul spune că la General CMMC e cel mai mare, nu suma",
  /cel mai mare din tot concursul, nu suma/.test(regText), true);
real.state.participants = [
  {id:"y",sector:"A",stand:"1",nume:"y",prenume:"",m:{1:{catches:[0],extras:[4]},2:{catches:[0],extras:[3]}}}
];
t("…iar codul chiar ia maximul (4), nu suma (7)",
  vm.runInContext("cmmcAward(state.participants[0],'total')", real), 4);

// afirmația despre ordinea de departajare
t("textul enumeră departajarea în ordinea din cod",
  /puncte → kilograme → cea mai bună manșă .* → cel mai mare pește → numărul standului → nume/.test(regText), true);

/* ================================================================
   12. Sezonul nu are voie să numere același concurs de două ori.
   Camera live și arhiva făcută din ea sunt aceleași date; la fel
   două arhivări ale aceluiași concurs. Fără filtru, punctele și
   kilogramele acelorași oameni intrau de mai multe ori.
   ================================================================ */
console.log("\n=== 12. Filtrul de dubluri din sezon.html ===");
{
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(
    ["nameOf", "mOf", "catchesSum", "extrasSum", "totalKg", "semnatura", "faraDubluri"]
      .map(n => H2.grabFunction(sezSrc, n)).join("\n"),
    ctx);
  ctx.faraDubluri = vm.runInContext("faraDubluri", ctx);

  const pescar = (id, kg) => ({ id, prenume: "X", nume: id, m: { 1: { catches: [kg], extras: [] }, 2: { catches: [], extras: [] } } });
  const concurs = (nume, parts, startAt) => ({ compName: nume, compDate: 1, startAt: startAt===undefined?1000:startAt, code: nume, parts });

  const oameni = [pescar("a", 5), pescar("b", 3)];
  const camera  = concurs("remuslake2026", oameni);
  const arhiva  = concurs("Remus Lake 7.08", oameni.map(p => JSON.parse(JSON.stringify(p))));
  const altul   = concurs("Alt concurs", [pescar("c", 9)]);

  ctx.__in = [arhiva, camera, altul];
  const iesire = ctx.faraDubluri(ctx.__in);
  t("camera live și arhiva ei se contopesc într-unul singur", iesire.length, 2);
  t("rămâne arhiva (are nume și dată stabile), nu camera", iesire[0].compName, "Remus Lake 7.08");
  t("un concurs chiar diferit nu e înlăturat", iesire[1].compName, "Alt concurs");

  // două arhivări ale aceluiași concurs, la ore diferite
  ctx.__in2 = [concurs("Remus Lake 7.08.2026", oameni),
               concurs("Remus Lake 7.08.2026", oameni.map(p => JSON.parse(JSON.stringify(p))))];
  t("două arhivări ale aceluiași concurs contează o dată", ctx.faraDubluri(ctx.__in2).length, 1);

  // Cazul de la Brăila: o greutate corectată între două arhivări. E ACELAȘI concurs —
  // aceiași oameni, aceeași oră de start — deci nu are voie să intre de două ori.
  const dupaCorectie = concurs("remuslake2026", [pescar("a", 5), Object.assign(pescar("b", 3), { m: { 1: { catches: [10.4], extras: [] }, 2: { catches: [], extras: [] } } })]);
  t("o greutate corectată nu mai rupe concursul în două",
    ctx.faraDubluri([arhiva, dupaCorectie]).length, 1);
  t("…iar cea păstrată e prima din listă, adică arhiva",
    ctx.faraDubluri([arhiva, dupaCorectie])[0].compName, "Remus Lake 7.08");

  // dar un concurs cu aceiași oameni în ALTĂ zi rămâne al lui
  const altaZi = concurs("Remus Lake 14.08", oameni, 9999999);
  t("aceiași oameni, altă zi = alt concurs", ctx.faraDubluri([arhiva, altaZi]).length, 2);

  // fără oră de start, cade pe ziua salvării
  const faraOra1 = { compName: "X", compDate: Date.parse("2026-08-19T15:38:00Z"), startAt: null, code: "x1", parts: oameni };
  const faraOra2 = { compName: "X", compDate: Date.parse("2026-08-19T17:07:00Z"), startAt: null, code: "x2", parts: oameni };
  t("două salvări din aceeași zi, fără oră de start, se recunosc",
    ctx.faraDubluri([faraOra1, faraOra2]).length, 1);
  const altaZiFaraOra = { compName: "X", compDate: Date.parse("2026-08-26T15:38:00Z"), startAt: null, code: "x3", parts: oameni };
  t("…dar altă zi rămâne alt concurs", ctx.faraDubluri([faraOra1, altaZiFaraOra]).length, 2);

  t("lista goală nu crapă", ctx.faraDubluri([]).length, 0);

  // Numerotarea de mână a rămas în arhivele de dinainte de curățare. Dacă sezonul o ia
  // ca parte din nume, același om iese pe două rânduri: numerotat în concursurile vechi,
  // curat în cele noi — și niciunul nu arată câte concursuri a făcut de fapt.
  const numeOf = vm.runInContext("nameOf", ctx);
  t("numerotarea veche nu mai face parte din nume",
    numeOf({ prenume: "7.Fabian", nume: "Cretu" }), "Fabian Cretu");
  t("…iar numele curat rămâne cum e",
    numeOf({ prenume: "Fabian", nume: "Cretu" }), "Fabian Cretu");
  t("cele două variante ajung la același om",
    numeOf({ prenume: "7.Fabian", nume: "Cretu" }) === numeOf({ prenume: "Fabian", nume: "Cretu" }), true);
  t("o inițială nu e o numerotare",
    numeOf({ prenume: "I.", nume: "Popescu" }), "I. Popescu");
}

/* ================================================================
   13. Manșa la care pescarul n-a fost
       Fără sector și fără stand în manșa aia, cădea singur în
       sectorul-fantomă „Fără sector", era automat primul acolo și lua
       1 punct — punctajul MAXIM, pentru o manșă la care nu venise. La
       General trecea astfel peste oameni care au pescuit tot.
       Regula acum: un punct peste ultimul loc din cel mai mare sector.
   ================================================================ */
console.log("\n=== 13. Cine lipsește de la o manșă ===");
{
  // patru prezenți, doi pe sector, plus un întârziat care prinde doar manșa 2
  real.state.participants = [
    ["Ion","A","1",9,7], ["Vlad","A","2",4,3], ["Radu","B","3",8,6], ["Mihai","B","4",2,1]
  ].map(r => ({ id:r[0], nume:r[0], prenume:"", stand:r[2], sector:r[1],
    m:{ 1:{catches:[r[3]],extras:[],stand:r[2],sector:r[1]},
        2:{catches:[r[4]],extras:[],stand:r[2],sector:r[1]} } }));
  real.state.participants.push({ id:"Nou", nume:"Nou", prenume:"", stand:"5", sector:"A",
    m:{ 1:{catches:[],extras:[],stand:"",sector:""},
        2:{catches:[5],extras:[],stand:"5",sector:"A"} } });

  const m1 = ptsReal(1);
  t("absența nu mai ia 1 punct", m1.Nou !== 1, true);
  t("ia un punct peste ultimul loc din cel mai mare sector (2+1)", m1.Nou, 3);
  t("iar prezenții rămân exact cum erau",
    [m1.Ion, m1.Vlad, m1.Radu, m1.Mihai], [1, 2, 1, 2]);

  t("în manșa la care a fost, e punctat normal", ptsReal(2).Nou, 2);

  const gen = JSON.parse(vm.runInContext("JSON.stringify(pointsCombo())", real));
  t("la General nu mai trece peste cine a pescuit tot", gen.Nou > gen.Mihai, true);

  real.pmap = gen;
  const ordine = vm.runInContext(
    "sortByPointsS(state.participants, pmap, 'total').map(function(p){return p.id;})", real);
  t("clasamentul General îl pune la coadă",
    ordine[ordine.length-1], "Nou");

  // regulamentul din aplicație trebuie să spună regula, nu doar s-o aplice
  const reg = vm.runInContext("regPunctajHtml()", real);
  t("Regulamentul explică ce ia cine lipsește",
    /Cine lipsește de la o manșă/.test(reg), true);
  t("…și că absența nu iese mai bine decât prezența",
    /absența nu iese niciodată mai bine decât prezența/.test(reg), true);

  // cine a venit și n-a prins nimic NU e absent: are stand, deci intră în sectorul lui
  real.state.participants[4].m[1].stand = "5";
  real.state.participants[4].m[1].sector = "A";
  const cuStand = ptsReal(1);
  t("prezent cu 0 kg intră în sector, nu la absenți", cuStand.Nou, 3);
  t("…iar sectorul lui are acum trei oameni, deci ultimul ia 3",
    [cuStand.Ion, cuStand.Vlad], [1, 2]);

  // absent din amândouă manșele: nu e nici primul, nici scutit
  real.state.participants[4].m[1] = {catches:[],extras:[],stand:"",sector:""};
  real.state.participants[4].m[2] = {catches:[],extras:[],stand:"",sector:""};
  const genTot = JSON.parse(vm.runInContext("JSON.stringify(pointsCombo())", real));
  t("cine lipsește de la tot are cel mai mare total de puncte",
    Math.max.apply(null, Object.keys(genTot).map(k => genTot[k])), genTot.Nou);
}

console.log("\n──────────────────────────────");
console.log(ok + " trecute, " + fail + " picate");
process.exit(fail ? 1 : 0);
