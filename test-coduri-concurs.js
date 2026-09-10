/**
 * Codurile din bază, puse pe tot concursul dintr-o apăsare.
 *
 * Codul se putea scrie de mână, unul câte unul, la fiecare pescar. La 44 de oameni e o
 * seară pierdută — iar baza sezonului îi știe deja pe toți.
 *
 * Butonul a stat o vreme în avertismentul de pe ecranul Cântar, unde era spusă problema.
 * Dar codul nu e o problemă a zilei de concurs: fără el, sezonul leagă după nume, ca
 * înainte să existe coduri. Iar pe ecranul acela se uită acum arbitrii, cărora codul nu
 * le spune nimic. Așa că leacul s-a mutat la Baza de pescari — de acolo vin codurile,
 * acolo se pun, o dată, înainte de concurs.
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
  "codParticipant", "cheiePescar", "cheieCuvinte", "scrierileLui", "pescarCauta", "numePescar", "pescarCodNou",
  "pescarNou", "scrieInJurnal", "potrivesteCodurile", "puneCodurile", "updateWarnCod"];

/** un concurs pe telefon plus baza sezonului */
function pornire(optiuni) {
  const o = optiuni || {};
  const elemente = {};
  const ctx = {
    console, JSON, Date, Math, parseInt, isNaN, Object, Array, String,
    blocat: !!o.blocat, intrebat: [], raspuns: o.confirma !== false,
    toasturi: [], salvat: 0, desenat: 0, desenatBaza: 0, copii: [],
    document: { getElementById: id => (elemente[id] = elemente[id] || { innerHTML: "", style: {} }) },
    guard() { return ctx.blocat; },
    isLocked() { return ctx.blocat; },
    confirm(q) { ctx.intrebat.push(q); return ctx.raspuns; },
    toast(m) { ctx.toasturi.push(m); },
    queueSave() { ctx.salvat++; },
    renderList() { ctx.desenat++; },
    renderPescari() { ctx.desenatBaza++; },
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
   4. Avertismentul de pe Cântar strigă doar ce strică ceva
   ------------------------------------------------------------------
   Spunea „⚠ N pescari fără cod. Completează codurile înainte de concurs" — adică cerea
   ca pe o datorie ceva de care ziua de concurs nu depinde. Acum tace despre ce lipsește
   și vorbește numai despre ce se strică: două persoane cu același cod se topesc într-una
   singură la clasamentul de sezon, iar asta nu se vede până la finalul lui.
   ================================================================ */
console.log("\n=== 4. Avertismentul nu mai cere coduri ===");
{
  const c = pornire({ baza: BAZA, concurs: ["Mihai Ionescu", "Ionuț Patronu", "Vasile Popescu"] });
  const w = avertisment(c);
  t("trei oameni fără cod nu mai sunt o problemă", w.style.display, "none");
  /* Se golește, nu doar se ascunde: altfel textul ar rămâne în pagină, nevăzut,
     purtând o socoteală de acum două apăsări. */
  t("…și nu rămâne niciun text vechi în pagină", w.innerHTML, "");
  t("nici butonul nu mai stă acolo", /puneCodurile/.test(w.innerHTML), false);
}

console.log("\n=== 4b. Codul dublu se strigă mai departe ===");
{
  const c = pornire({ baza: [], concurs: [{ nume: "Ana Unu", cod: 4 },
                                          { nume: "Dan Doi", cod: 4 },
                                          "Mihai Ionescu"] });
  const w = avertisment(c);
  t("se vede", w.style.display, "block");
  t("spune cine se bate pe cod", /codul 4 este la Ana Unu și Dan Doi/.test(text(w.innerHTML)), true);
  t("…și spune ce se strică", /se amestecă între ei/.test(text(w.innerHTML)), true);
  /* Al treilea om n-are cod deloc, și e în regulă așa. */
  t("dar tace despre cine n-are cod", /fără cod/.test(text(w.innerHTML)), false);
  t("…și nu mai dă ordine", /Completează/.test(text(w.innerHTML)), false);
}

console.log("\n=== 4c. Numele nu pot intra ca HTML ===");
{
  /* Numele vin din lista lipită de pe grup, deci trec prin esc() — altfel un nume cu
     semne de cod ar ajunge etichetă adevărată în pagină. */
  const c = pornire({ baza: [], concurs: [{ nume: "<script> alert", cod: 4 },
                                          { nume: "Vasile Popescu", cod: 4 }] });
  const w = avertisment(c);
  t("numele ajunge în avertisment", /codul 4 este la/.test(text(w.innerHTML)), true);
  t("un nume cu semne de cod se scrie ca text", /&lt;script&gt;/.test(w.innerHTML), true);
  t("…și nu ajunge etichetă adevărată", /<script>/.test(w.innerHTML), false);
}

/* ================================================================
   5. Legat cum trebuie
   ================================================================ */
console.log("\n=== 5. Legat cum trebuie ===");
{
  const wc = H.grabFunction(src, "updateWarnCod");
  t("avertismentul nu mai caută prin bază", /potrivesteCodurile/.test(wc), false);
  t("…nici nu mai poartă butonul", /puneCodurile/.test(wc), false);
  t("numele trec prin esc()", /esc\(duble\.map/.test(wc), true);

  const rl = H.grabFunction(src, "renderList");
  t("avertismentul se împrospătează odată cu lista", /updateWarnCod\(\);/.test(rl), true);

  /* Cardul care poartă butonul stă în ecranul Bazei de pescari, se umple la desenarea
     lui și se ascunde când n-are ce pune — altfel ar fi un buton care spune doar
     „N-am ce cod să pun". */
  const rp = H.grabFunction(src, "renderPescari");
  t("ecranul bazei cheamă potrivirea", /potrivesteCodurile\(\)/.test(rp), true);
  t("…umple cardul", /pune-coduri-cati/.test(rp), true);
  t("…și îl ascunde când n-are ce pune",
    /pcard\.style\.display = g\.gasiti\.length \? "" : "none";/.test(rp), true);
  t("pliantul e chiar în ecranul bazei",
    /id="view-pescari"[\s\S]*?id="pliant-coduri"/.test(src), true);
  t("…și e ascuns de lacăt, ca tot ce schimbă concursul",
    /<div class="pliant mt lockhide" id="pliant-coduri">/.test(src), true);
  /* Strâns, nu adăugat: ecranul bazei rămâne cu trei carduri. */
  t("…fără să crească ecranul bazei",
    (src.slice(src.indexOf('id="view-pescari"'), src.indexOf('id="view-spons"'))
       .match(/class="card/g) || []).length, 3);

  const pc = H.grabFunction(src, "puneCodurile");
  t("cu lacătul pus nu se pune nimic", /^\s*function puneCodurile\(\)\{\s*\r?\n\s*if\(guard\(\)\) return;/.test(pc), true);
  t("se întreabă înainte", /if\(!confirm\(q\)\) return;/.test(pc), true);
  t("se pune deoparte o copie", /puneDeoParte\("înainte de punerea codurilor"\)/.test(pc), true);
  t("se scrie în jurnal", /scrieInJurnal\(x\.p, mi, "cod", "pus"/.test(pc), true);
  t("după punere se împrospătează și ecranul bazei",
    /queueSave\(\); renderList\(\); renderPescari\(\);/.test(pc), true);

  /* Nu s-a adăugat nimic pe ecranul Cântar — dimpotrivă, de acolo au ieșit un avertisment
     și un buton. Pliantul codurilor stă în ecranul bazei, nu aici. */
  const cantar = src.slice(src.indexOf('id="view-cantar"'), src.indexOf('id="view-rank"'));
  t("niciun pliant de coduri la Cântar", /pliant-coduri/.test(cantar), false);
  t("…și niciun buton de pus coduri", /puneCodurile/.test(cantar), false);
}

t.raport();
