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
  const camp = { "t-start": { value: "" }, "t-end": { value: "" }, "t-nadire": { value: "" }, "timerBar": { style: {}, textContent: "" } };
  let acum = 0;
  // ceas fals doar pentru Date.now(); restul (getFullYear ș.a.) rămâne real,
  // fiindcă toLocalInput chiar formatează o dată
  class CeasFals extends Date {}
  CeasFals.now = () => acum;
  const ctx = {
    state: stare,
    Date: CeasFals,
    document: { getElementById: id => camp[id] || null },
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

// ora primită se vede și în câmpurile din Setări, ca organizatorul al doilea să o vadă
{
  const m = mediu({ startAt: FINAL - 240 * MIN, endAt: FINAL, nadireMin: 15 });
  m.la(FINAL - 60 * MIN);
  m.ruleaza("adoptTimer");
  t("campul cu ora de final se completeaza din camera", /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(m.camp["t-end"].value), true);
  t("minutele de nădire vin și ele", m.camp["t-nadire"].value, 15);
}

// ștergerea cronometrului în cameră golește câmpurile pe celălalt telefon
{
  const m = mediu({ startAt: null, endAt: null, nadireMin: 10 });
  m.la(FINAL);
  m.ruleaza("adoptTimer");
  t("cronometru șters în cameră: câmpurile se golesc", m.camp["t-end"].value, "");
  t("cronometru șters: bara se ascunde", m.camp.timerBar.style.display, "none");
}

t.raport();
