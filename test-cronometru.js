/**
 * Cronometrul concursului: se sincronizează în cameră și nu claxonează retroactiv.
 *
 * Rulează funcțiile REALE extrase din index.html (nu copii care pot diverge),
 * cu un ceas fals și un DOM minim, ca să verifice și comportamentul, nu doar textul.
 */
const { grabFunction, citeste, creeazaVerificator } = require("./test-helpers");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(__dirname + "/index.html");

// pragurile se iau din aplicație, ca testul să nu ajungă să verifice alte minute decât cele livrate
const pragurileReale = (src.match(/var WARN_MIN=\[[^\]]*\][^;]*;/) || [])[0];
if (!pragurileReale) { console.log("  ❌ nu găsesc WARN_MIN în index.html"); process.exit(1); }

// ---------- 1. orele urcă în cameră ----------
const setTimerSrc = grabFunction(src, "setTimer");
const clearTimerSrc = grabFunction(src, "clearTimer");
// save() singur scrie doar în telefon; queueSave() cheamă și queueSync()
const cheamaQueueSave = s => /\bqueueSave\(\)/.test(s);
const cheamaSaveGol = s => /(^|[^e])\bsave\(\)/.test(s.replace(/queueSave\(\)/g, ""));

t("setTimer urcă orele în cameră (queueSave)", cheamaQueueSave(setTimerSrc), true);
t("setTimer nu mai salvează doar local (save)", cheamaSaveGol(setTimerSrc), false);
t("clearTimer urcă ștergerea în cameră", cheamaQueueSave(clearTimerSrc), true);
t("clearTimer nu mai salvează doar local", cheamaSaveGol(clearTimerSrc), false);

const pullSrc = grabFunction(src, "pullState");
t("pullState preia orele venite din cameră", /adoptTimer\(\)/.test(pullSrc), true);
t("pullState le preia doar când s-au schimbat", /oldEnd/.test(pullSrc), true);

// ---------- 2. comportamentul cu ceas fals ----------
function mediu(stare) {
  const alarme = [];
  /* Rândurile de ore se desenează din cod, câte unul pe manșă, deci nu se mai poate
     scrie lista de câmpuri dinainte: orice id cerut capătă un element. */
  const camp = {};
  const el = id => (camp[id] = camp[id] || {
    value: "", style: {}, textContent: "", innerHTML: "",
    /* ecranul Acasă nu e „activ" în probă, deci panoul lui nu se redesenează */
    classList: { contains: () => false, toggle: () => {} }
  });
  let acum = 0;
  // ceas fals doar pentru Date.now(); restul (getFullYear ș.a.) rămâne real,
  // fiindcă toLocalInput chiar formatează o dată
  class CeasFals extends Date {}
  CeasFals.now = () => acum;
  const ctx = {
    state: stare,
    Date: CeasFals,
    document: { getElementById: el },
    setInterval: () => 1, clearInterval: () => {},
    alarmWarn: m => alarme.push("warn" + m),
    alarmEnd: () => alarme.push("end"),
    alarmNadire: () => alarme.push("nadire"),
    alarmStart: () => alarme.push("start"),
    console
  };
  vm.createContext(ctx);
  vm.runInContext([
    "var timerInt=null, timerWasRunning=false, nadireAlerted=false, startAlerted=false;",
    // ceasul concursului: în test decalajul e 0, deci ceasul fals rămâne stăpân
    "var clockSkew=0, clockSet=false;",
    grabFunction(src, "nowSync"),
    pragurileReale,
    grabFunction(src, "resetWarnings"),
    grabFunction(src, "adoptTimer"),
    grabFunction(src, "numManse"),
    grabFunction(src, "deseneazaOre"),
    grabFunction(src, "umpleOre"),
    grabFunction(src, "aplicaOreleMansei"),
    grabFunction(src, "scrieCandSunaNadirea"),
    grabFunction(src, "p2"),
    grabFunction(src, "hhmm"),
    grabFunction(src, "toLocalInput"),
    grabFunction(src, "fmtDur"),
    grabFunction(src, "timerTick")
  ].join("\n"), ctx);
  return {
    la: ms => { acum = ms; return ctx; },
    ruleaza: nume => vm.runInContext(nume + "();", ctx),
    alarme, camp, ctx
  };
}

const MIN = 60000;
const FINAL = 1000 * MIN;

// telefon care intră în cameră cu 12 minute rămase: pragurile 30 (trecut) nu sună,
// dar 10, 5 și 1 trebuie să sune la momentul lor
{
  const m = mediu({ startAt: FINAL - 240 * MIN, endAt: FINAL, nadireMin: 10 });
  m.la(FINAL - 12 * MIN);
  m.ruleaza("adoptTimer");
  t("intrare cu 12 min rămase: fără claxoane retroactive", m.alarme.slice(), []);
  m.la(FINAL - 9 * MIN); m.ruleaza("timerTick");
  t("la 9 minute sună avertismentul de 10", m.alarme.slice(), ["warn10"]);
  m.la(FINAL - 4 * MIN); m.ruleaza("timerTick");
  m.la(FINAL - 30000); m.ruleaza("timerTick");
  t("apoi 5 și 1 minut, în ordine", m.alarme.slice(), ["warn10", "warn5", "warn1"]);
  m.la(FINAL + 1000); m.ruleaza("timerTick");
  t("claxonul de final sună pe telefonul care privea", m.alarme.slice(-1), ["end"]);
}

// telefon care intră DUPĂ ce s-a terminat concursul: nu sună nimic
{
  const m = mediu({ startAt: FINAL - 240 * MIN, endAt: FINAL, nadireMin: 10 });
  m.la(FINAL + 20 * MIN);
  m.ruleaza("adoptTimer");
  m.ruleaza("timerTick");
  t("intrare după final: niciun claxon", m.alarme.slice(), []);
  t("bara arata concurs incheiat", /încheiat/.test(m.camp.timerBar.textContent), true);
}

/* Ora primită se vede și în câmpurile din Setări, ca organizatorul al doilea să o vadă.
   Ce vine prin cameră e `startAt`/`endAt`, fără manșe — telefonul care primește le trece
   pe manșa lor în `normalize()`, chemat de `pullState`. Aici starea e dată deja trecută
   prin el; că `normalize` chiar face mutarea se verifică mai jos, pe funcția adevărată. */
{
  const m = mediu({ startAt: FINAL - 240 * MIN, endAt: FINAL, nadireMin: 15,
                    oreManse: { 1: { s: FINAL - 240 * MIN, e: FINAL } } });
  m.la(FINAL - 60 * MIN);
  m.ruleaza("adoptTimer");
  t("campul cu ora de final se completeaza din camera", /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(m.camp["ora-e-1"].value), true);
  t("minutele de nădire vin și ele", m.camp["t-nadire"].value, 15);
  t("…și se scrie când sună nădirea", /nădirea la <b>\d{2}:\d{2}<\/b>/.test(m.camp["ore-nadire-cand"].innerHTML), true);
}

/* ---------- orele sunt ale manșelor ---------- */
{
  const nor = grabFunction(src, "normalize");
  t("concursurile de dinainte își mută ceasul pe manșa lui",
    /state\.oreManse\[state\.mansaCeas \|\| state\.manche \|\| 1\] =/.test(nor), true);
  t("…doar dacă nu are deja ore pe manșe",
    /if\(!Object\.keys\(state\.oreManse\)\.length && \(state\.startAt \|\| state\.endAt\)\)/.test(nor), true);

  /* Trecerea la manșa următoare îi ia ceasul ei. Fără asta, manșa 2 rămânea cu orele
     manșei 1 — demult trecute — și ziua părea încheiată înainte să înceapă. */
  const START2 = FINAL + 60 * MIN;
  const m = mediu({ manche: 1, numManse: 2, nadireMin: 10,
                    startAt: FINAL - 240 * MIN, endAt: FINAL,
                    oreManse: { 1: { s: FINAL - 240 * MIN, e: FINAL },
                                2: { s: START2, e: START2 + 240 * MIN } } });
  m.la(FINAL + 10 * MIN);
  t("manșa 2 are ceasul ei", vm.runInContext("aplicaOreleMansei(2)", m.ctx), true);
  t("…iar ceasul care merge e al ei", m.ctx.state.startAt, START2);
  t("…și se ține minte a cui e", m.ctx.state.mansaCeas, 2);
  t("o manșă fără ore nu clatină ceasul", vm.runInContext("aplicaOreleMansei(3)", m.ctx), false);
  t("…ceasul rămâne al manșei 2", m.ctx.state.startAt, START2);

  /* Câte rânduri se desenează: unul pe manșă, nici unul în plus. */
  m.ctx.state.numManse = 3;
  m.ruleaza("deseneazaOre");
  t("trei manșe, trei rânduri",
    (m.camp["ore-manse"].innerHTML.match(/id="ora-s-\d"/g) || []).length, 3);
  m.ctx.state.numManse = 2;
  m.ruleaza("deseneazaOre");
  t("înapoi la două, două rânduri",
    (m.camp["ore-manse"].innerHTML.match(/id="ora-s-\d"/g) || []).length, 2);
}

// ștergerea cronometrului în cameră golește câmpurile pe celălalt telefon
{
  const m = mediu({ startAt: null, endAt: null, nadireMin: 10 });
  m.la(FINAL);
  m.ruleaza("adoptTimer");
  t("cronometru șters în cameră: câmpurile se golesc", m.camp["ora-e-1"].value, "");
  t("cronometru șters: bara se ascunde", m.camp.timerBar.style.display, "none");
}

// ---------- 3. la DESCHIDEREA aplicației ----------
/* Pe telefonul organizatorului nimic nu venea din cameră, deci nimeni nu chema
   adoptTimer la pornire: startAlerted rămânea fals și aplicația striga „Start pescuit!"
   de fiecare dată când o deschidea, chiar cu vocea oprită din setări (alarmele de start
   și de final își aprind singure vocea o clipă). */
const initSrc = require("./test-helpers").grabIIFE(src, "// ---------- init ----------");

t("la pornire se preiau orele așa cum sunt acum", /adoptTimer\(\);/.test(initSrc), true);
t("…și nu se mai cheamă doar resetWarnings", /\bresetWarnings\(\);/.test(initSrc), false);
t("bucla ceasului pornește mai departe", /startTimerLoop\(\);/.test(initSrc), true);
/* adoptTimer completează el câmpurile din Setări, deci cele trei rânduri care le
   completau de mână au ieșit — altfel am fi avut aceeași treabă făcută de două ori */
t("câmpurile din Setări nu se mai completează de două ori",
  (initSrc.match(/t-nadire/g) || []).length, 0);

// deschide aplicația în minutul 40 din 60: nu se aude nimic, dar finalul sună la ora lui
{
  const m = mediu({ startAt: FINAL - 60 * MIN, endAt: FINAL, nadireMin: 10 });
  m.la(FINAL - 20 * MIN);
  m.ruleaza("adoptTimer");          // ce face acum pornirea aplicației
  m.ruleaza("timerTick");
  t("deschidere în timpul concursului: tăcere", m.alarme.slice(), []);
  t("…dar bara arată cât a mai rămas", /Timp rămas/.test(m.camp.timerBar.textContent), true);
  m.la(FINAL - 9 * MIN); m.ruleaza("timerTick");
  t("avertismentul de 10 minute sună mai departe", m.alarme.slice(), ["warn10"]);
  m.la(FINAL + 1000); m.ruleaza("timerTick");
  t("și claxonul de final, la ora lui", m.alarme.slice(-1), ["end"]);
}

// deschide aplicația în timpul nădirii grele: nici nădirea nu se repetă
{
  const START = FINAL - 60 * MIN;
  const m = mediu({ startAt: START, endAt: FINAL, nadireMin: 10 });
  m.la(START - 5 * MIN);            // nădirea a fost strigată acum 5 minute
  m.ruleaza("adoptTimer");
  m.ruleaza("timerTick");
  t("deschidere în timpul nădirii: nu se strigă a doua oară", m.alarme.slice(), []);
  m.la(START); m.ruleaza("timerTick");
  t("startul adevărat sună la ora lui", m.alarme.slice(), ["start"]);
}

/* Partea care contează cel mai mult: nu cumva am stins claxoanele adevărate.
   Deschide aplicația ÎNAINTE de concurs — toate trei trebuie să sune, la rând. */
{
  const START = FINAL - 60 * MIN;
  const m = mediu({ startAt: START, endAt: FINAL, nadireMin: 10 });
  m.la(START - 30 * MIN);           // deschide cu jumătate de oră înainte
  m.ruleaza("adoptTimer");
  m.ruleaza("timerTick");
  t("înainte de concurs: încă tăcere", m.alarme.slice(), []);
  m.la(START - 9 * MIN); m.ruleaza("timerTick");
  t("nădirea grea sună", m.alarme.slice(), ["nadire"]);
  m.la(START); m.ruleaza("timerTick");
  t("startul sună", m.alarme.slice(), ["nadire", "start"]);
  m.la(FINAL + 1000); m.ruleaza("timerTick");
  t("finalul sună", m.alarme.slice(), ["nadire", "start", "end"]);
}

// deschide aplicația a doua zi, cu concursul de ieri încă în telefon
{
  const m = mediu({ startAt: FINAL - 60 * MIN, endAt: FINAL, nadireMin: 10 });
  m.la(FINAL + 18 * 60 * MIN);
  m.ruleaza("adoptTimer");
  m.ruleaza("timerTick");
  t("concurs vechi în telefon: niciun claxon", m.alarme.slice(), []);
}

// aplicație deschisă fără niciun concurs pus: nimic de sunat, nimic de arătat
{
  const m = mediu({ startAt: null, endAt: null, nadireMin: 10 });
  m.la(FINAL);
  m.ruleaza("adoptTimer");
  m.ruleaza("timerTick");
  t("fără concurs: tăcere", m.alarme.slice(), []);
  t("fără concurs: bara stă ascunsă", m.camp.timerBar.style.display, "none");
}

t.raport();
