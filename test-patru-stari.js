/**
 * Cele patru stări ale unui pescar fără cântar trecut.
 *
 * Până acum erau două: „are kilograme" și „n-are". Iar „n-are" însemna deopotrivă
 * „a venit și n-a prins nimic" și „arbitrul n-a ajuns încă la el" — clasamentul le
 * socotea la fel, zero. Un stand uitat lua tăcut ultimul loc din sector, cu puncte cu
 * tot, iar asta nu se mai vedea până la premiere.
 *
 * Acum sunt patru, iar cea nespusă („necântărit") oprește sfârșitul de concurs:
 *   cântărit      — are kilograme trecute
 *   lampă         — a venit, a stat, n-a prins (zero adevărat, ca până acum)
 *   absent        — n-a venit la manșa aia
 *   revin la el   — sărit dinadins, se întoarce la final
 *
 * Lucrul de care atârnă TOT: formulele nu se ating. Un concurs în care nimeni n-are
 * stare pusă trebuie să dea exact aceleași puncte ca înainte — altfel s-ar rescrie
 * rezultate deja premiate.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = ["uid", "esc", "fmt", "fmtPts", "numManse", "manseRange", "emptyManche",
  "ensureManche", "mOf", "sectorOfM", "standOfM", "mancheDeAfisat", "nameOf", "nameKey",
  "standKey", "byStand", "cantOfM", "extraOfM", "cmmcOfM", "totalOfM", "cmmcAward",
  "scalaSectoare", "scrieInJurnal", "mancheDisputata",
  "stareaLaMansa", "nelamurit", "standuriNecantarite", "absentLaMansa", "pointsMapS",
  "stariHtml", "puneStarea", "stergeStarea", "improspateazaNecantarite",
  "sortByPointsS", "sortRankS", "rankRows"];

/** un concurs cu doi sectoare a câte trei oameni */
function pornire(optiuni) {
  const o = optiuni || {};
  const elemente = {};
  const ctx = {
    console, JSON, Date, Math, parseInt, parseFloat, isNaN,
    blocat: !!o.blocat, toasturi: [], salvat: 0, desenat: 0,
    document: { getElementById: id => (elemente[id] = elemente[id] || { innerHTML: "", style: {} }) },
    guard() { return ctx.blocat; },
    isLocked() { return ctx.blocat; },
    toast(m) { ctx.toasturi.push(m); },
    queueSave() { ctx.salvat++; },
    renderList() { ctx.desenat++; },
    renderRank() { ctx.desenat++; },
    leaderId() { return null; },
    __el: elemente
  };
  ctx.state = {
    name: "Cupa de probă", manche: o.mansa || 1, numManse: 2,
    sectors: ["A", "B"], numStanduri: "6", scalaSectoare: false, jurnal: [],
    participants: (o.lot || LOT).map((x, i) => ({
      id: "p" + i, prenume: x.pre, nume: x.num,
      stand: x.st || "", sector: x.sec || "",
      m: {
        1: { catches: (x.kg1 || []).slice(), catchTimes: [], catchPhotos: [], extras: [], extraTimes: [], extraPhotos: [],
             stand: x.st || "", sector: x.sec || "", stare: x.stare1 || "" },
        2: { catches: (x.kg2 || []).slice(), catchTimes: [], catchPhotos: [], extras: [], extraTimes: [], extraPhotos: [],
             stand: x.st2 === undefined ? (x.st || "") : x.st2, sector: x.sec || "", stare: x.stare2 || "" }
      }
    }))
  };
  vm.createContext(ctx);
  /* numele celor patru stări se iau din fișierul livrat, nu se scriu a doua oară aici */
  vm.runInContext(src.match(/var STARI_MANSA=\{[^}]*\};/)[0], ctx);
  vm.runInContext("var rankScope=1, rankMode='sec', finMethod='pct';", ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  return ctx;
}

const LOT = [
  { pre: "Mihai",  num: "Ionescu",   st: "1", sec: "A", kg1: [12.5] },
  { pre: "Vasile", num: "Popescu",   st: "2", sec: "A", kg1: [8.2] },
  { pre: "Ștefan", num: "Bălan",     st: "3", sec: "A", kg1: [] },
  { pre: "Ion",    num: "Țăranu",    st: "4", sec: "B", kg1: [15.1] },
  { pre: "Andrei", num: "Munteanu",  st: "5", sec: "B", kg1: [9.9] },
  { pre: "Radu",   num: "Georgescu", st: "6", sec: "B", kg1: [] }
];

const stare = (ctx, i, mi) => vm.runInContext(
  "stareaLaMansa(state.participants[" + i + "]," + JSON.stringify(mi || 1) + ")", ctx);
const puncte = (ctx, mi) => vm.runInContext(
  "(function(){var m=pointsMapS(" + (mi || 1) + "); return state.participants.map(function(p){" +
  "return Math.round((m[p.id]||0)*100)/100; });})()", ctx);
const nelamurite = ctx => vm.runInContext(
  "standuriNecantarite().map(function(x){ return 'M'+x.mi+':'+x.oameni.map(function(p){" +
  "return standOfM(p,x.mi)||'-'; }).join(','); })", ctx);
const text = h => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/* ================================================================
   1. Cele patru stări, citite
   ================================================================ */
console.log("\n=== 1. Ce stare are fiecare ===");
{
  const c = pornire();
  t("cine are kilograme e cântărit", stare(c, 0), "cantarit");
  t("cine n-are nimic, dar are stand, e necântărit", stare(c, 2), "necantarit");

  vm.runInContext("mOf(state.participants[2],1).stare='zero';", c);
  t("spus «lampă»", stare(c, 2), "zero");
  vm.runInContext("mOf(state.participants[2],1).stare='absent';", c);
  t("spus «absent»", stare(c, 2), "absent");
  vm.runInContext("mOf(state.participants[2],1).stare='sarit';", c);
  t("spus «revin la el»", stare(c, 2), "sarit");
  vm.runInContext("mOf(state.participants[2],1).stare='ceva-inventat';", c);
  t("o stare inventată nu ține — rămâne necântărit", stare(c, 2), "necantarit");

  /* Asta o știa aplicația de mult: fără stand extras, n-a fost la manșă. */
  const fara = pornire({ lot: [{ pre: "Cine", num: "Va", st: "", kg1: [] }] });
  t("fără stand, fără kilograme: n-a fost la manșă", stare(fara, 0), "absent");

  /* Kilogramele bat orice stare rămasă scrisă din greșeală. */
  const cu = pornire({ lot: [{ pre: "Are", num: "Kg", st: "1", sec: "A", kg1: [4], stare1: "absent" }] });
  t("cine are kilograme e cântărit, orice ar scrie starea", stare(cu, 0), "cantarit");

  t("la General nu există o stare — sunt câte una pe manșă", stare(pornire(), 2, "total"), "");
}

/* ================================================================
   2. Formulele nu se mișcă
   ------------------------------------------------------------------
   Lucrul de care atârnă totul. Un concurs fără nicio stare pusă trebuie să dea
   EXACT aceleași puncte ca înainte de schimbarea asta — altfel s-ar rescrie
   rezultate deja premiate.
   ================================================================ */
console.log("\n=== 2. Fără nicio stare pusă, punctele rămân cum erau ===");
{
  const c = pornire();
  /* sector A: 12,5 · 8,2 · 0 → locurile 1, 2, 3; sector B: 15,1 · 9,9 · 0 → 1, 2, 3 */
  t("punctele sunt cele de dintotdeauna", puncte(c, 1), [1, 2, 3, 1, 2, 3]);

  const zero = pornire();
  vm.runInContext("mOf(state.participants[2],1).stare='zero';", zero);
  t("«lampă» nu schimbă niciun punct", puncte(zero, 1), [1, 2, 3, 1, 2, 3]);
  t("…fiindcă exact asta se socotea și înainte", stare(zero, 2), "zero");

  const sarit = pornire();
  vm.runInContext("mOf(state.participants[2],1).stare='sarit';", sarit);
  t("«revin la el» nu schimbă niciun punct", puncte(sarit, 1), [1, 2, 3, 1, 2, 3]);
}

console.log("\n=== 2b. «Absent» îl scoate din sectorul lui, ca pe absentul de până acum ===");
{
  const c = pornire();
  vm.runInContext("mOf(state.participants[2],1).stare='absent';", c);
  t("e absent la manșă", vm.runInContext("absentLaMansa(state.participants[2],1)", c), true);
  /* Sectorul A rămâne cu doi. Absentul ia punctajul absenților: nMax+1, unde nMax e
     cel mai numeros sector — 3 — deci 4. Exact ca cel fără stand, dintotdeauna. */
  t("ceilalți din sector urcă, absentul ia punctajul absenților",
    puncte(c, 1), [1, 2, 4, 1, 2, 3]);

  /* și cel fără stand, netins de nimeni, ia același drum — n-am schimbat nimic acolo */
  const vechi = pornire({ lot: LOT.map((x, i) => i === 2 ? Object.assign({}, x, { st: "" }) : x) });
  t("cel fără stand ia același punctaj, ca înainte", puncte(vechi, 1), [1, 2, 4, 1, 2, 3]);
}

console.log("\n=== 2c. Concursurile arhivate n-au starea asta scrisă nicăieri ===");
{
  /* Un concurs vechi are `m` fără câmpul `stare`. Trebuie să se poarte identic. */
  const c = pornire();
  vm.runInContext("state.participants.forEach(function(p){ delete p.m[1].stare; delete p.m[2].stare; });", c);
  t("fără câmpul «stare», punctele sunt aceleași", puncte(c, 1), [1, 2, 3, 1, 2, 3]);
  t("…iar cel fără cântar e necântărit, nu zero", stare(c, 2), "necantarit");
}

/* ================================================================
   3. Butoanele de pe cardul pescarului
   ================================================================ */
console.log("\n=== 3. Ce se vede pe cardul celui fără cântar ===");
{
  const c = pornire();
  const h = i => vm.runInContext("stariHtml(state.participants[" + i + "])", c);

  t("cine e cântărit nu primește rândul de stări… (nu se cheamă pentru el)",
    /12,500|chip-c/.test(h(0)), false);
  const nec = h(2);
  t("cel fără cântar e numit necântărit", /Încă necântărit/.test(text(nec)), true);
  t("are toate trei butoanele",
    ["Lampă", "Absent", "Revin la el"].every(x => text(nec).indexOf(x) >= 0), true);
  /* Numele sunt ale lui, alese de el. Aici se probează doar că pe buton scrie ce a ales,
     nu vreo prescurtare a mea. */
  t("nu s-au strecurat alte nume", /Sărit|0,000 kg|Nu a venit|prins nimic/.test(text(nec)), false);

  vm.runInContext("mOf(state.participants[2],1).stare='zero';", c);
  t("cu starea pusă, butoanele dispar", /Absent/.test(text(h(2))), false);
  t("…și rămâne doar ce s-a spus", text(h(2)), "Lampă ×");
  t("…cu un × de șters", /stergeStarea/.test(h(2)), true);

  const fara = pornire({ lot: [{ pre: "Cine", num: "Va", st: "", kg1: [] }] });
  t("cine n-a extras stand nu primește butoane",
    text(vm.runInContext("stariHtml(state.participants[0])", fara)), "n-a extras stand în manșa 1");
}

console.log("\n=== 3b. Cu lacătul pus se vede, dar nu se apasă ===");
{
  const c = pornire({ blocat: true });
  const h = i => vm.runInContext("stariHtml(state.participants[" + i + "])", c);
  t("blocat: niciun buton", /<button/.test(h(2)), false);
  t("blocat: se spune totuși ce e", text(h(2)), "încă necântărit");

  vm.runInContext("mOf(state.participants[2],1).stare='absent';", c);
  t("blocat: starea pusă se citește", text(h(2)), "Absent");
  t("blocat: fără × de șters", /stergeStarea/.test(h(2)), false);

  vm.runInContext("puneStarea('p1','zero');", c);
  t("blocat: nu se poate pune nicio stare", stare(c, 1), "cantarit");
}

/* ================================================================
   4. Apăsatul propriu-zis
   ================================================================ */
console.log("\n=== 4. Ce se întâmplă când apeși ===");
{
  const c = pornire();
  vm.runInContext("puneStarea('p2','zero');", c);
  t("starea s-a pus", stare(c, 2), "zero");
  t("s-a salvat", c.salvat, 1);
  t("s-au redesenat și lista, și clasamentul", c.desenat, 2);
  t("i se spune omului ce a apăsat", c.toasturi[0], "Ștefan Bălan: lampă");

  /* Jurnalul: la o contestație, „cine l-a pus absent, și la ce oră" e tot atât
     de important ca o greutate. */
  const j = vm.runInContext("state.jurnal.map(function(x){ return [x.fel,x.act,x.inainte,x.dupa,x.stand].join('|'); })", c);
  t("s-a scris în jurnal", j, ["stare|pus|necântărit|Lampă|3"]);

  vm.runInContext("puneStarea('p2','absent');", c);
  t("schimbată, jurnalul ține minte de la ce",
    vm.runInContext("state.jurnal[1].inainte", c), "Lampă");

  vm.runInContext("stergeStarea('p2');", c);
  t("ștearsă, se întoarce la necântărit", stare(c, 2), "necantarit");
  t("…și scrie și asta în jurnal",
    vm.runInContext("state.jurnal[2].fel+'|'+state.jurnal[2].act", c), "stare|sters");

  vm.runInContext("puneStarea('p2','ceva-inventat');", c);
  t("o stare inventată nu se scrie", vm.runInContext("state.jurnal.length", c), 3);
}

console.log("\n=== 4b. Prima captură șterge starea ===");
{
  const c = pornire();
  vm.runInContext("mOf(state.participants[2],1).stare='absent';", c);
  /* addCatchCore cere prea mult DOM ca s-o chemăm aici întreagă. Se ia funcția
     ADEVĂRATĂ din fișierul livrat și se citește ordinea: starea se golește înainte de
     a intra captura, nu după — altfel „lampă" ar sta lângă un cântar trecut. */
  const corp = H.grabFunction(src, "addCatchCore");
  t("starea se golește în addCatchCore", corp.indexOf('m.stare="";') >= 0, true);
  t("…înainte ca prima captură să intre",
    corp.indexOf('m.stare="";') < corp.indexOf("m.catches.push(vr);"), true);
}

/* ================================================================
   5. Standurile nelămurite
   ================================================================ */
console.log("\n=== 5. Cine oprește sfârșitul de concurs ===");
{
  const c = pornire();
  t("la început, cei doi fără cântar", nelamurite(c), ["M1:3,6"]);

  vm.runInContext("puneStarea('p2','zero');", c);
  t("«lampă» e un răspuns — iese din listă", nelamurite(c), ["M1:6"]);

  vm.runInContext("puneStarea('p5','absent');", c);
  t("«absent» e și el un răspuns — lista se golește", nelamurite(c), []);

  vm.runInContext("puneStarea('p5','sarit');", c);
  t("«revin la el» NU e un răspuns — rămâne pe listă", nelamurite(c), ["M1:6"]);
}

console.log("\n=== 5b. Doar manșele disputate se cer ===");
{
  const c = pornire();
  t("manșa 2 n-a început, deci nu se cere", nelamurite(c), ["M1:3,6"]);
  /* se trece un cântar în manșa 2: acum manșa 2 e disputată, iar ceilalți cinci sunt
     necântăriți acolo */
  vm.runInContext("mOf(state.participants[0],2).catches.push(7);", c);
  t("odată începută, manșa 2 își cere și ea standurile",
    nelamurite(c), ["M1:3,6", "M2:2,3,4,5,6"]);
}

console.log("\n=== 5c. Rândul de sub «Am terminat concursul» ===");
{
  const c = pornire();
  vm.runInContext("improspateazaNecantarite();", c);
  const el = c.__el["necantarite"];
  t("se vede", el.style.display, "");
  t("scrie ce se cere", /Standuri nelămurite/.test(text(el.innerHTML)), true);
  t("…cu manșa și standurile", /Manșa 1: 3 Ștefan Bălan · 6 Radu Georgescu/.test(text(el.innerHTML)), true);
  t("…și cu ce e de făcut", /a prins ceva, lampă, sau absent/.test(text(el.innerHTML)), true);

  vm.runInContext("puneStarea('p2','zero'); puneStarea('p5','zero'); improspateazaNecantarite();", c);
  t("lămurite toate, rândul se ascunde", c.__el["necantarite"].style.display, "none");
  t("…și nu mai scrie nimic", c.__el["necantarite"].innerHTML, "");
}

console.log("\n=== 5d. Sfârșitul de concurs întreabă, cu standurile pe nume ===");
{
  /* Nu se blochează de tot: la baltă, cel mai rău lucru e un buton care nu mai merge
     deloc. Se întreabă — dar cu numele și standurile scrise, ca răspunsul să fie dat
     în cunoștință de cauză. */
  t("întrebarea numără standurile nelămurite",
    /standuriNecantarite\(\)[\s\S]{0,900}Salvezi totuși așa\?/.test(src), true);
  t("…le scrie pe manșe, cu stand și nume",
    /"Manșa "\+x\.mi\+": "\+x\.oameni\.map/.test(src), true);
  t("…și spune ce pățesc dacă rămân așa",
    /intră.{0,30}cu 0 kg și[\s\S]{0,80}ultimul loc din sector/.test(src), true);
}

/* ================================================================
   6. În clasament
   ================================================================ */
console.log("\n=== 6. Un 0,000 din clasament spune acum ce fel de zero e ===");
{
  const c = pornire();
  vm.runInContext("puneStarea('p2','zero');", c);
  const h = vm.runInContext("rankRows(sortRankS(state.participants,1),{mi:1,showSector:true})", c);
  t("cel cântărit n-are nicio stare scrisă",
    /Mihai Ionescu.{0,80}Stand 1 · Sec A</.test(h.replace(/<div class="small">/g, "")), true);
  t("cel care a dat lampă o spune", /Stand 3 · Sec A ·.{0,40}Lampă/.test(text(h)), true);
  t("cel neatins de nimeni scrie «necântărit»", /Stand 6 · Sec B ·.{0,40}necântărit/.test(text(h)), true);

  vm.runInContext("puneStarea('p5','sarit');", c);
  const h2 = vm.runInContext("rankRows(sortRankS(state.participants,1),{mi:1,showSector:true})", c);
  t("cel sărit o spune și el", /Revin la el/.test(text(h2)), true);

  /* La General nu se scrie nicio stare: acolo omul are câte una pe fiecare manșă. */
  const hg = vm.runInContext("rankRows(sortRankS(state.participants,'total'),{mi:'total'})", c);
  t("la General nu se scrie nicio stare",
    /necântărit|Lampă|Revin la el|Absent/.test(text(hg)), false);
}

t.raport();
