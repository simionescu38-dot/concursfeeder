/**
 * Codurile din bază, puse pe tot concursul dintr-o apăsare.
 *
 * Codul se putea scrie de mână, unul câte unul, la fiecare pescar. La 44 de oameni e o
 * seară pierdută — iar baza sezonului îi știe deja pe toți. Butonul stă chiar în
 * avertismentul care spune „N pescari fără cod": acolo e spusă problema, acolo e și
 * leacul, nu la capătul celălalt al ecranului.
 *
 * Regula de căpătâi: codurile se dau DIN BAZĂ, niciodată din concurs. Cine nu e în bază
 * rămâne fără cod și se spune pe nume — un cod inventat aici ar fi al nimănui la etapa
 * următoare.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = ["uid", "esc", "faraSemne", "nameOf", "numManse", "manseRange",
  "emptyManche", "ensureManche", "mOf", "sectorOfM", "standOfM", "splitName",
  "codParticipant", "cheiePescar", "scrierileLui", "pescarCauta", "numePescar", "pescarCodNou",
  "pescarNou", "scrieInJurnal", "potrivesteCodurile", "puneCodurile", "updateWarnCod"];

/** un concurs pe telefon plus baza sezonului */
function pornire(optiuni) {
  const o = optiuni || {};
  const elemente = {};
  const ctx = {
    console, JSON, Date, Math, parseInt, isNaN, Object, Array, String,
    blocat: !!o.blocat, intrebat: [], raspuns: o.confirma !== false,
    toasturi: [], salvat: 0, desenat: 0, copii: [],
    document: { getElementById: id => (elemente[id] = elemente[id] || { innerHTML: "", style: {} }) },
    guard() { return ctx.blocat; },
    isLocked() { return ctx.blocat; },
    confirm(q) { ctx.intrebat.push(q); return ctx.raspuns; },
    toast(m) { ctx.toasturi.push(m); },
    queueSave() { ctx.salvat++; },
    renderList() { ctx.desenat++; },
    puneDeoParte(motiv) { ctx.copii.push(motiv); },
    __el: elemente
  };
  ctx.state = {
    name: "Cupa de probă", manche: 1, numManse: 2, sectors: ["A", "B"],
    numStanduri: "12", jurnal: [],
    participants: (o.concurs || []).map((x, i) => {
      const nm = typeof x === "string" ? x : x.nume;
      const sp = nm.indexOf(" ");
      const p = { id: "p" + i, prenume: sp < 0 ? nm : nm.slice(0, sp),
                  nume: sp < 0 ? "" : nm.slice(sp + 1),
                  stand: String(i + 1), sector: "A",
                  m: { 1: { catches: [], extras: [], stand: String(i + 1), sector: "A" },
                       2: { catches: [], extras: [], stand: "", sector: "" } } };
      if (typeof x !== "string" && x.cod !== undefined) p.cod = x.cod;
      return p;
    })
  };
  vm.createContext(ctx);
  vm.runInContext('var PESCARI_KEY="concurs-pescari-v1"; var pescari=[]; var pescariUltimCod=0;', ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  (o.baza || []).forEach(nm => {
    const b = vm.runInContext("splitName(" + JSON.stringify(nm) + ")", ctx);
    vm.runInContext("pescari.push(pescarNou(" + JSON.stringify(b.prenume) + "," + JSON.stringify(b.nume) + "))", ctx);
  });
  return ctx;
}

const BAZA = ["Mihai Ionescu", "Vasile Popescu", "Ștefan Bălan", "Ion Țăranu", "Radu Georgescu"];
const coduri = ctx => vm.runInContext(
  "state.participants.map(function(p){ return nameOf(p)+':'+(p.cod||'-'); })", ctx);
const potrivit = ctx => vm.runInContext(
  "(function(){var g=potrivesteCodurile(); return {" +
  "gasiti:g.gasiti.map(function(x){return nameOf(x.p)+'→'+x.cod;})," +
  "fara:g.fara.map(function(p){return nameOf(p);}), aveau:g.aveau," +
  "incurcate:g.incurcate.map(function(x){return x.cod+':'+x.oameni.map(function(p){return nameOf(p);}).join('+');})" +
  "};})()", ctx);
const text = h => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/\s+([,.:;])/g, "$1").trim();
function avertisment(ctx) {
  vm.runInContext("updateWarnCod();", ctx);
  return ctx.__el["warn-cod"];
}

/* ================================================================
   1. Potrivirea
   ================================================================ */
console.log("\n=== 1. Cine primește ce cod ===");
{
  const c = pornire({ baza: BAZA, concurs: ["Vasile Popescu", "Mihai Ionescu", "Ion Țăranu"] });
  const g = potrivit(c);
  t("fiecare primește codul lui din bază", g.gasiti,
    ["Mihai Ionescu→1", "Vasile Popescu→2", "Ion Țăranu→4"]);
  t("codurile bazei nu se renumerotează după concurs",
    g.gasiti.map(x => x.split("→")[1]), ["1", "2", "4"]);
  t("nimeni nu lipsește", g.fara, []);
  t("nimeni n-avea cod dinainte", g.aveau, 0);
}

console.log("\n=== 1b. Cine nu e în bază rămâne fără cod ===");
{
  const c = pornire({ baza: BAZA, concurs: ["Mihai Ionescu", "Ionuț Patronu", "Damian Pascha"] });
  const g = potrivit(c);
  t("intră doar cel găsit", g.gasiti, ["Mihai Ionescu→1"]);
  t("ceilalți doi se spun pe nume", g.fara, ["Ionuț Patronu", "Damian Pascha"]);
  /* Nu li se inventează un cod: unul dat aici ar fi al nimănui la etapa următoare. */
  vm.runInContext("puneCodurile();", c);
  t("cei negăsiți rămân fără cod", coduri(c),
    ["Mihai Ionescu:1", "Ionuț Patronu:-", "Damian Pascha:-"]);
}

console.log("\n=== 1c. Numele scris altfel e tot el ===");
{
  const c = pornire({ baza: ["Petrică Cazacu", "Ștefan Bălan"],
                      concurs: ["Petrica Cazacu", "STEFAN BALAN"] });
  t("fără diacritice și cu majuscule, tot ei sunt",
    potrivit(c).gasiti, ["Petrica Cazacu→1", "STEFAN BALAN→2"]);
}

console.log("\n=== 1d. Cine are deja cod nu se atinge ===");
{
  const c = pornire({ baza: BAZA, concurs: [{ nume: "Mihai Ionescu", cod: 99 }, "Vasile Popescu"] });
  const g = potrivit(c);
  t("cel cu cod e numărat deoparte", g.aveau, 1);
  t("…și nu apare printre cei de legat", g.gasiti, ["Vasile Popescu→2"]);
  vm.runInContext("puneCodurile();", c);
  t("codul lui de dinainte rămâne neatins", coduri(c)[0], "Mihai Ionescu:99");
}

console.log("\n=== 1e. Un cod scris strâmb se socotește lipsă ===");
{
  /* codParticipant, funcția casei, spune ce e un cod bun: număr întreg, mai mare ca
     zero. Ce nu trece de ea e ca și cum n-ar fi — deci omul poate primi codul din bază. */
  const c = pornire({ baza: BAZA, concurs: [{ nume: "Mihai Ionescu", cod: "abc" }] });
  t("codul strâmb nu se numără drept cod", potrivit(c).aveau, 0);
  t("…iar omul primește codul lui din bază", potrivit(c).gasiti, ["Mihai Ionescu→1"]);
}

/* ================================================================
   2. Când doi oameni duc la același cod
   ------------------------------------------------------------------
   Nu se poate ști care e cel adevărat, iar două coduri la fel ar strica tocmai
   clasamentul de sezon. Nu primește niciunul.
   ================================================================ */
console.log("\n=== 2. Două rânduri, același om din bază ===");
{
  const c = pornire({ baza: BAZA, concurs: ["Mihai Ionescu", "Mihai Ionescu", "Vasile Popescu"] });
  const g = potrivit(c);
  t("codul încurcat e oprit", g.incurcate, ["1:Mihai Ionescu+Mihai Ionescu"]);
  t("nu primește niciunul din ei", g.gasiti, ["Vasile Popescu→2"]);
  vm.runInContext("puneCodurile();", c);
  t("amândoi rămân fără cod", coduri(c).slice(0, 2), ["Mihai Ionescu:-", "Mihai Ionescu:-"]);
  t("cel curat și-a primit codul", coduri(c)[2], "Vasile Popescu:2");
}

console.log("\n=== 2b. Un cod purtat deja de altcineva ===");
{
  /* Cineva poartă din greșeală codul 2, iar Vasile Popescu — al cărui cod e 2 — ar
     trebui să-l primească. Nu se pune peste: se spune. */
  const c = pornire({ baza: BAZA, concurs: [{ nume: "Ion Țăranu", cod: 2 }, "Vasile Popescu"] });
  const g = potrivit(c);
  t("codul luat e oprit", g.incurcate, ["2:Vasile Popescu"]);
  t("nu se pune nimic peste", g.gasiti, []);
  vm.runInContext("puneCodurile();", c);
  t("nimic nu s-a schimbat", coduri(c), ["Ion Țăranu:2", "Vasile Popescu:-"]);
  t("…și se spune de ce", c.toasturi[0], "N-am ce cod să pun");
}

/* ================================================================
   3. Apăsatul
   ================================================================ */
console.log("\n=== 3. Ce se întâmplă la apăsare ===");
{
  const c = pornire({ baza: BAZA, concurs: ["Mihai Ionescu", "Ionuț Patronu", "Vasile Popescu"] });
  vm.runInContext("puneCodurile();", c);
  t("codurile s-au pus", coduri(c),
    ["Mihai Ionescu:1", "Ionuț Patronu:-", "Vasile Popescu:2"]);
  t("s-a salvat", c.salvat, 1);
  t("s-a redesenat lista", c.desenat, 1);
  t("se poate da înapoi", c.copii, ["înainte de punerea codurilor"]);
  t("i se spune omului", c.toasturi[0], "2 coduri puse");

  t("s-a întrebat întâi", c.intrebat.length, 1);
  t("…cu câți primesc", /Pui codurile din bază la 2 pescari\?/.test(c.intrebat[0]), true);
  t("…și cu cine rămâne fără", /1 nu sunt în baza de pescari — rămân fără cod\./.test(c.intrebat[0]), true);

  /* Jurnalul: la o contestație, „cine i-a pus codul, și la ce oră" contează. */
  t("s-a scris în jurnal",
    vm.runInContext("state.jurnal.map(function(x){ return [x.fel,x.act,x.dupa,x.cine].join('|'); })", c),
    ["cod|pus|1|din baza de pescari", "cod|pus|2|din baza de pescari"]);
}

console.log("\n=== 3b. Cu «nu» nu se schimbă nimic ===");
{
  const c = pornire({ baza: BAZA, concurs: ["Mihai Ionescu"], confirma: false });
  vm.runInContext("puneCodurile();", c);
  t("niciun cod pus", coduri(c), ["Mihai Ionescu:-"]);
  t("nici copie de siguranță", c.copii, []);
}

console.log("\n=== 3c. Cu lacătul pus ===");
{
  const c = pornire({ baza: BAZA, concurs: ["Mihai Ionescu"], blocat: true });
  vm.runInContext("puneCodurile();", c);
  t("nu se pune niciun cod", coduri(c), ["Mihai Ionescu:-"]);
  t("nici nu s-a întrebat", c.intrebat, []);
  t("nici butonul nu se arată", /puneCodurile/.test(avertisment(c).innerHTML), false);
}

console.log("\n=== 3d. A doua apăsare n-are ce pune ===");
{
  const c = pornire({ baza: BAZA, concurs: ["Mihai Ionescu", "Vasile Popescu"] });
  vm.runInContext("puneCodurile(); puneCodurile();", c);
  t("codurile au rămas cele dintâi", coduri(c), ["Mihai Ionescu:1", "Vasile Popescu:2"]);
  t("…și se spune", c.toasturi[1], "N-am ce cod să pun");
  t("s-a întrebat o singură dată", c.intrebat.length, 1);
}

/* ================================================================
   4. Butonul stă în avertisment
   ------------------------------------------------------------------
   Avertismentul spunea ce e greșit, dar nu și cum se drege. Acum poartă leacul.
   ================================================================ */
console.log("\n=== 4. Avertismentul poartă leacul ===");
{
  const c = pornire({ baza: BAZA, concurs: ["Mihai Ionescu", "Ionuț Patronu", "Vasile Popescu"] });
  const w = avertisment(c);
  t("se vede", w.style.display, "block");
  t("spune cine n-are cod", /3 pescari fără cod/.test(text(w.innerHTML)), true);
  t("…și poartă butonul", /onclick="puneCodurile\(\)"/.test(w.innerHTML), true);
  t("butonul spune câte coduri pune", /Pune 2 coduri din baza de pescari/.test(text(w.innerHTML)), true);
  t("butonul nu e scos în față", /btn-primary/.test(w.innerHTML), false);

  vm.runInContext("puneCodurile();", c);
  const w2 = avertisment(c);
  t("după apăsare, tot avertizează pentru cel rămas", /1 pescar fără cod/.test(text(w2.innerHTML)), true);
  t("…dar butonul dispare, n-are ce pune", /puneCodurile/.test(w2.innerHTML), false);
}

console.log("\n=== 4b. Când toți au cod, avertismentul se stinge ===");
{
  const c = pornire({ baza: BAZA, concurs: ["Mihai Ionescu", "Vasile Popescu"] });
  vm.runInContext("puneCodurile();", c);
  const w = avertisment(c);
  t("nu se mai vede", w.style.display, "none");
  /* Se golește, nu doar se ascunde: altfel butonul ar rămâne în pagină, nevăzut,
     purtând o socoteală de acum două apăsări. */
  t("…și nu rămâne niciun buton vechi în pagină", w.innerHTML, "");
}

console.log("\n=== 4c. Un singur cod de pus se scrie la singular ===");
{
  const c = pornire({ baza: BAZA, concurs: [{ nume: "Vasile Popescu", cod: 2 }, "Mihai Ionescu"] });
  t("«Pune 1 cod», nu «1 coduri»",
    /Pune 1 cod din baza de pescari/.test(text(avertisment(c).innerHTML)), true);
}

console.log("\n=== 4d. Numele nu pot intra ca HTML ===");
{
  /* Avertismentul scrie acum HTML, ca să poată purta butonul. Numele vin din lista
     lipită de pe grup, deci trec prin esc() — altfel un nume cu semne de cod ar ajunge
     etichetă adevărată în pagină. */
  /* Numele ajung în avertisment doar pe ramura codurilor duble — acolo se scrie
     „codul 4 este la X și Y". Deci proba trebuie să treacă pe acolo. */
  const c = pornire({ baza: [], concurs: [{ nume: "<script> alert", cod: 4 },
                                          { nume: "Vasile Popescu", cod: 4 }] });
  const w = avertisment(c);
  t("numele ajunge în avertisment", /codul 4 este la/.test(text(w.innerHTML)), true);
  t("un nume cu semne de cod se scrie ca text", /&lt;script&gt;/.test(w.innerHTML), true);
  t("…și nu ajunge etichetă adevărată", /<script>/.test(w.innerHTML), false);
}

console.log("\n=== 4e. Fără bază, avertismentul rămâne cum era ===");
{
  const c = pornire({ baza: [], concurs: ["Mihai Ionescu", "Vasile Popescu"] });
  const w = avertisment(c);
  t("tot spune cine n-are cod", /2 pescari fără cod/.test(text(w.innerHTML)), true);
  t("…dar n-are de unde lua, deci niciun buton", /puneCodurile/.test(w.innerHTML), false);
}

/* ================================================================
   5. Legat cum trebuie
   ================================================================ */
console.log("\n=== 5. Legat cum trebuie ===");
{
  const wc = H.grabFunction(src, "updateWarnCod");
  t("avertismentul cheamă potrivirea", /potrivesteCodurile\(\)/.test(wc), true);
  t("numele trec prin esc()", /esc\(buc\.join/.test(wc), true);
  t("butonul nu apare cu lacătul pus", /&& !isLocked\(\)/.test(wc), true);

  const rl = H.grabFunction(src, "renderList");
  t("avertismentul se împrospătează odată cu lista", /updateWarnCod\(\);/.test(rl), true);

  const pc = H.grabFunction(src, "puneCodurile");
  t("cu lacătul pus nu se pune nimic", /^\s*function puneCodurile\(\)\{\s*\r?\n\s*if\(guard\(\)\) return;/.test(pc), true);
  t("se întreabă înainte", /if\(!confirm\(q\)\) return;/.test(pc), true);
  t("se pune deoparte o copie", /puneDeoParte\("înainte de punerea codurilor"\)/.test(pc), true);
  t("se scrie în jurnal", /scrieInJurnal\(x\.p, mi, "cod", "pus"/.test(pc), true);

  /* Nu s-a adăugat niciun rând nou pe ecranul Cântar: leacul stă în avertismentul
     care exista deja. */
  t("niciun pliant nou la Cântar", /id="pliant-coduri"/.test(src), false);
}

t.raport();
