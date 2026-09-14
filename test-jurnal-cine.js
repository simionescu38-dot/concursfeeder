/**
 * Jurnalul spune CINE.
 *
 * „Corectarea rezultatelor cu istoric — să se vadă cine a modificat, ce și când."
 *
 * „Ce" și „când" erau de mult în jurnal. „Cine" scria mereu „Organizator" — inclusiv când
 * cântărea un arbitru, de pe telefonul lui. Mai rău: rândurile scrise de arbitru nu
 * ajungeau NICIODATĂ pe server. `doarCantaririle` pornește din starea din bază și copiază
 * doar câmpurile de cântar; jurnalul nu e câmp de cântar, deci se pierdea cu totul. Adică
 * tocmai cântăririle făcute de arbitri lipseau din istoric.
 *
 * Aici se probează amândouă jumătățile: semnătura pusă pe telefon, și drumul ei prin
 * server — și dintr-o parte, și din cealaltă.
 *
 * Codul e scos VERBATIM din index.html și worker/index.js.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const wk = H.citeste("worker/index.js");
const t = H.creeazaVerificator();

/* ================================================================
   1. Cine lucrează — pe telefon
   ================================================================ */
console.log("\n=== 1. Cine lucrează ===");
{
  const ctx = { console };
  vm.createContext(ctx);
  ["esteArbitru", "cineLucreaza"].forEach((f) => vm.runInContext(H.grabFunction(src, f), ctx));
  const cine = (mod, sector) => {
    vm.runInContext("var arbitruMode=" + mod + ", arbitruSector=" + JSON.stringify(sector) + ";", ctx);
    return vm.runInContext("cineLucreaza()", ctx);
  };
  t("organizatorul e organizator", cine(false, ""), "Organizator");
  /* Arbitrul n-are nume în aplicație: intră cu un cod și își alege un sector. Sectorul
     ESTE numele lui la baltă — „arbitrul de pe C". */
  t("arbitrul poartă sectorul lui", cine(true, "C"), "Arbitru · sector C");
  t("…iar cel care ia toată balta, tot arbitru e", cine(true, ""), "Arbitru");
}

/* ================================================================
   2. Semnătura ajunge în rândul scris
   ================================================================ */
console.log("\n=== 2. Rândul scris poartă semnătura ===");
function jurnalul(arbitru, sector) {
  const ctx = {
    console, Date, Math, JSON,
    arbitruMode: arbitru, arbitruSector: sector || "",
    uid: (() => { let n = 0; return () => "j" + (++n); })(),
    state: { jurnal: [] },
  };
  vm.createContext(ctx);
  ["esteArbitru", "cineLucreaza", "mOf", "ensureManche", "emptyManche", "numManse",
   "manseRange", "standOfM", "sectorOfM", "nameOf", "scrieInJurnal"].forEach(
    (f) => vm.runInContext(H.grabFunction(src, f), ctx));
  vm.runInContext("var state=state||{}; state.numManse=2;", ctx);
  vm.runInContext("var p={id:'p1',prenume:'Ion',nume:'Luca',stand:'24',sector:'C'," +
    "m:{1:{catches:[],catchTimes:[],extras:[],extraTimes:[],stand:'24',sector:'C'}}};", ctx);
  return ctx;
}
{
  const c = jurnalul(false);
  vm.runInContext("scrieInJurnal(p, 1, 'captura', 'adaugat', 4.2, 0, 4.2);", c);
  t("organizatorul semnează rândul", c.state.jurnal[0].cine, "Organizator");
  t("…cu tot ce trebuie în el",
    Object.keys(c.state.jurnal[0]).sort().join(","),
    "act,cine,dupa,fel,id,inainte,kg,m,nume,pid,sector,stand,t");

  const a = jurnalul(true, "C");
  vm.runInContext("scrieInJurnal(p, 1, 'captura', 'adaugat', 4.2, 0, 4.2);", a);
  t("arbitrul semnează cu sectorul lui", a.state.jurnal[0].cine, "Arbitru · sector C");

  /* Semnăturile puse de mână — importurile — rămân cum erau: ele spun de UNDE a venit
     cifra, nu cine a apăsat, și aia e altă informație. */
  const b = jurnalul(true, "C");
  vm.runInContext("scrieInJurnal(p, 1, 'captura', 'adaugat', 4.2, 0, 4.2, 'de pe WhatsApp');", b);
  t("dar o semnătură pusă de mână nu se calcă", b.state.jurnal[0].cine, "de pe WhatsApp");
}

/* ================================================================
   3. Drumul prin server — de la ARBITRU
   ================================================================
   Aici era paguba adevărată: rândurile arbitrului se pierdeau cu totul. */
console.log("\n=== 3. Scrierea arbitrului, pe server ===");
function serverul() {
  const ctx = { console, JSON, Map, Set, Object, Array };
  vm.createContext(ctx);
  vm.runInContext(/const CAMPURI_CANTAR = \[[\s\S]*?\];/.exec(wk)[0], ctx);
  ["unesteJurnalele", "doarCantaririle", "contopesteStarea"].forEach(
    (f) => vm.runInContext(H.grabFunction(wk, f), ctx));
  return ctx;
}
const pescar = (id, kg) => ({
  id, prenume: "Ion", nume: id.toUpperCase(), stand: "1", sector: "A",
  m: { 1: { catches: kg ? [kg] : [], catchTimes: [], catchIds: kg ? ["c-" + id] : [],
            extras: [], extraTimes: [], extraIds: [], stand: "1", sector: "A", stare: "" } },
});
const rand = (id, cine, t) => ({ id, cine, t, kg: 4.2, fel: "captura", act: "adaugat" });

{
  const c = serverul();
  /* În bază: concursul organizatorului, cu un rând în jurnal. */
  c.baza = { name: "Cupa", participants: [pescar("a"), pescar("b")],
             jurnal: [rand("j1", "Organizator", 1000)] };
  /* De pe telefonul arbitrului: a tras starea, a cântărit, are AMÂNDOUĂ rândurile. */
  c.dela = { name: "Cupa", participants: [pescar("a", 8.94), pescar("b")],
             jurnal: [rand("j1", "Organizator", 1000), rand("j2", "Arbitru · sector A", 2000)] };
  const rez = vm.runInContext("doarCantaririle(baza, dela)", c);

  t("cântărirea arbitrului ajunge", rez.participants[0].m[1].catches, [8.94]);
  t("…și rândul lui de jurnal ajunge ȘI EL", rez.jurnal.map((x) => x.id), ["j1", "j2"]);
  t("…semnat de el", rez.jurnal[1].cine, "Arbitru · sector A");
  t("…iar rândul organizatorului rămâne neatins", rez.jurnal[0].cine, "Organizator");
}
{
  /* Arbitrul poate doar să ADAUGE. O scriere care ar veni cu jurnalul „curățat" nu poate
     șterge nimic din ce e în bază — jurnalul e prin firea lui doar-adăugare. */
  const c = serverul();
  c.baza = { participants: [pescar("a")], jurnal: [rand("j1", "Organizator", 1000), rand("j2", "Organizator", 2000)] };
  c.dela = { participants: [pescar("a", 5)], jurnal: [] };
  const rez = vm.runInContext("doarCantaririle(baza, dela)", c);
  t("un jurnal gol de la arbitru nu șterge nimic", rez.jurnal.map((x) => x.id), ["j1", "j2"]);

  c.dela2 = { participants: [pescar("a", 5)], jurnal: [rand("j1", "SCHIMBAT", 1000)] };
  const rez2 = vm.runInContext("doarCantaririle(baza, dela2)", c);
  t("…și nu poate rescrie un rând care există deja", rez2.jurnal[0].cine, "Organizator");
}

/* ================================================================
   4. Drumul prin server — de la ORGANIZATOR, peste o revizie mai nouă
   ================================================================ */
console.log("\n=== 4. Contopirea, când a scris cineva între timp ===");
{
  const c = serverul();
  /* În bază a apucat să scrie arbitrul. Organizatorul scrie acum, de pe o revizie veche:
     nu știe de rândul lui. Fără unire, rândul arbitrului ar fi dispărut. */
  c.baza = { participants: [pescar("a", 8.94)],
             jurnal: [rand("j1", "Organizator", 1000), rand("j2", "Arbitru · sector A", 2000)] };
  c.dela = { participants: [pescar("a")],
             jurnal: [rand("j1", "Organizator", 1000), rand("j3", "Organizator", 3000)] };
  vm.runInContext("contopesteStarea(baza, dela, [])", c);

  t("rândul arbitrului nu se pierde", c.dela.jurnal.map((x) => x.id), ["j1", "j2", "j3"]);
  t("…și rândurile stau în ordinea orei", c.dela.jurnal.map((x) => x.t), [1000, 2000, 3000]);
  t("…fiecare cu semnătura lui",
    c.dela.jurnal.map((x) => x.cine), ["Organizator", "Arbitru · sector A", "Organizator"]);
  /* Aceeași grijă ca la cântăriri: cine scrie mai târziu nu-l acoperă pe celălalt. */
  t("cântărirea arbitrului se întoarce și ea", c.dela.participants[0].m[1].catches, [8.94]);
}
{
  /* Un concurs vechi, dinainte de jurnal, n-are ce uni — și nu trebuie să crape. */
  const c = serverul();
  c.baza = { participants: [pescar("a")] };
  c.dela = { participants: [pescar("a", 3)] };
  vm.runInContext("contopesteStarea(baza, dela, [])", c);
  t("o stare fără jurnal nu crapă contopirea", Array.isArray(c.dela.jurnal), true);
  t("…și rămâne goală, nu inventează rânduri", c.dela.jurnal.length, 0);
}

/* ================================================================
   5. Ce se vede pe ecran
   ================================================================ */
console.log("\n=== 5. Pe ecran ===");
{
  t("rândul din jurnal arată cine",
    /👤 '\+esc\(x\.cine\|\|"Organizator"\)/.test(H.grabFunction(src, "jurnalHtml")), true);
  t("…și când", /🕒 '\+jurnalDataOra\(x\.t\)/.test(H.grabFunction(src, "jurnalHtml")), true);
  /* Jurnalul merge cu cântărirea, deci arbitrul îl are pe ecranul lui: el vede ce a
     trecut, nu doar organizatorul. */
  t("jurnalul nu e ascuns arbitrilor",
    /<div class="pliant mt" id="pliant-jurnal">/.test(src), true);
}

t.raport();
