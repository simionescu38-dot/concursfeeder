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

const HTML = "D:/concursfeeder-repo/index.html";
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
                 "byStand","pointsMapS","pointsCombo","bestMancheOf","sortByPointsS","fmtPts",
                 "regPunctajHtml"]
  .map(grab).join("\n");
const real = { state: { participants: [] }, console };
vm.createContext(real);
vm.runInContext(`
  function ensureManche(p){
    if(!p.m) p.m={};
    [1,2].forEach(function(i){ if(!p.m[i]) p.m[i]={catches:[],extras:[]}; });
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
   10. CODUL REAL din sezon.html — locurile la egalitate.
   ================================================================ */
console.log("\n=== 10. Codul REAL din sezon.html ===");
const sezSrc = fs.readFileSync("D:/concursfeeder-repo/sezon.html", "utf8");
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

console.log("\n──────────────────────────────");
console.log(ok + " trecute, " + fail + " picate");
process.exit(fail ? 1 : 0);
