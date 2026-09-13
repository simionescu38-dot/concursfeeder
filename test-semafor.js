/**
 * Semaforul concursului — verificarea de dinainte de publicare.
 *
 * „Pe lângă simplitate, aplicația trebuie să inspire încredere și să prevină greșelile."
 *
 * Ce desparte roșul de portocaliu, și de ce contează: pe 7 septembrie 2026, „Cupa
 * Pescarul Hazliu" a intrat în Clasamentul de sezon cu 33 de pescari, 12 dintre ei fără
 * stand, și 0,00 kg cântărite. Aplicația a întrebat — printr-o fereastră lungă, la baltă,
 * în picioare — iar întrebarea s-a apăsat peste. De-aia roșul nu mai întreabă: stinge
 * butonul. Iar portocaliul nu blochează nimic, ca să nu ajungă zgomot peste care se trece.
 *
 * Cazul roșu de aici NU e inventat: e chiar arhiva aceea, citită din `arhiva/`.
 *
 * Codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const fs = require("fs");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = [
  "num", "fmt", "esc", "uid", "numManse", "manseRange", "emptyManche", "ensureManche",
  "mOf", "sectorOfM", "standOfM", "nameOf", "cantOfM", "extraOfM", "totalOfM",
  "stareaLaMansa", "nelamurit", "standuriNecantarite", "mancheDisputata",
  "mansaTrasa", "faraStandLaMansa", "verificaConcursul",
];

/** un participant gata făcut; `m` primește ce-i dai peste manșele goale */
function om(o) {
  const m = {};
  for (let i = 1; i <= 3; i++)
    m[i] = {
      catches: [], catchTimes: [], catchPhotos: [], catchIds: [],
      extras: [], extraTimes: [], extraPhotos: [], extraIds: [],
      stand: "", sector: "", stare: "",
    };
  Object.keys(o.m || {}).forEach((k) => Object.assign(m[k], o.m[k]));
  return {
    id: o.id, prenume: o.prenume || "Ion", nume: o.nume || "Popa",
    stand: o.stand === undefined ? "" : String(o.stand),
    sector: o.sector || "A", m,
  };
}

function pornire(stare, optiuni) {
  const o = optiuni || {};
  const ctx = {
    console, JSON, Date, Math, String, Number, Array, Object, parseInt, parseFloat, isNaN,
    PRAG_KG: +/var PRAG_KG=(\d+)/.exec(src)[1],
    STARI_MANSA: {}, rankScope: "total",
    syncRoom: o.camera === undefined ? "" : o.camera,
    syncKey: o.cheie === undefined ? "" : o.cheie,
    syncPaused: !!o.pauza, syncBusy: !!o.ocupat,
    syncLastOk: o.ultima === undefined ? "12:40" : o.ultima,
    arbNetrimis: !!o.netrimis,
    state: stare,
  };
  vm.createContext(ctx);
  vm.runInContext("var STARI_MANSA=" + /var STARI_MANSA\s*=\s*(\{[\s\S]*?\});/.exec(src)[1] + ";", ctx);
  FUNCTII.forEach((f) => vm.runInContext(H.grabFunction(src, f), ctx));
  return ctx;
}
const verific = (c) => vm.runInContext("verificaConcursul()", c);
/** titlurile găsite, pe scurt — ca probele să spună ce s-a găsit, nu doar câte */
const titluri = (v) => v.gasite.map((x) => x.t);
const nivele = (v) => v.gasite.map((x) => x.nivel);

/* un concurs curat: 4 oameni, 2 manșe, toți cu stand și cu cântar */
function concursCurat() {
  return {
    name: "Cupa de probă", balta: "Remus Lake", numManse: 2, manche: 2, sectors: ["A", "B"],
    participants: [
      om({ id: "p1", nume: "Bălan", stand: 1, m: { 1: { stand: "1", sector: "A", catches: [3], catchTimes: [1000] }, 2: { stand: "5", sector: "B", catches: [2], catchTimes: [9000] } } }),
      om({ id: "p2", nume: "Georgescu", stand: 2, m: { 1: { stand: "2", sector: "A", catches: [4], catchTimes: [1000] }, 2: { stand: "6", sector: "B", catches: [1], catchTimes: [9000] } } }),
      om({ id: "p3", nume: "Luca", stand: 3, m: { 1: { stand: "3", sector: "B", catches: [5], catchTimes: [1000] }, 2: { stand: "7", sector: "A", catches: [6], catchTimes: [9000] } } }),
      om({ id: "p4", nume: "Pavel", stand: 4, m: { 1: { stand: "4", sector: "B", catches: [2], catchTimes: [1000] }, 2: { stand: "8", sector: "A", catches: [3], catchTimes: [9000] } } }),
    ],
  };
}

/* ================================================================
   1. Verde — cazul care se vede de cele mai multe ori
   ================================================================ */
console.log("\n=== 1. Verde ===");
{
  const c = pornire(concursCurat(), { camera: "cupa", cheie: "k" });
  const v = verific(c);
  t("un concurs curat e verde", v.stare, "verde");
  t("…și n-are nimic de arătat", v.gasite.length, 0);
  t("…nici roșu, nici portocaliu", [v.rosii, v.portocalii], [0, 0]);
}

/* ================================================================
   2. Roșu — cele trei lucruri care strică rezultatul
   ================================================================ */
console.log("\n=== 2. Roșu ===");
{
  /* Cine n-are stand nu intră în niciun sector: pointsMapS îl scoate din socoteală
     prin absentLaMansa. Deci nu „lipsește ceva" — omul DISPARE din clasament. */
  const s = concursCurat();
  s.participants[2].m[1].stand = "";
  const v = verific(pornire(s));
  t("un pescar fără stand face roșu", v.stare, "rosu");
  t("…și e numit pe nume", /Luca/.test(v.gasite[0].d), true);
  t("…cu manșa scrisă, fiindcă sunt două", /la manșa 1/.test(v.gasite[0].t), true);
  t("…și te duce la tragere", v.gasite[0].a, "laTragere()");
}
{
  /* Cel trecut ABSENT are voie să n-aibă stand: ăsta e un răspuns, nu o scăpare.
     Fără deosebirea asta, fiecare concurs cu un absent ar ieși roșu — iar roșul care
     se aprinde degeaba nu mai oprește pe nimeni. */
  const s = concursCurat();
  s.participants[2].m[1].stand = "";
  s.participants[2].m[1].catches = [];
  s.participants[2].m[1].stare = "absent";
  const v = verific(pornire(s));
  t("dar cel trecut absent nu e o greșeală", v.stare, "verde");
}
{
  const s = concursCurat();
  s.participants[1].m[1].stand = "1";     // același cu p1
  const v = verific(pornire(s));
  t("două standuri la fel fac roșu", v.stare, "rosu");
  t("…și spune care", /Standul 1 e dat de două ori/.test(v.gasite[0].t), true);
}
{
  const s = concursCurat();
  s.participants.forEach((p) => { p.m[1].catches = []; p.m[2].catches = []; });
  const v = verific(pornire(s));
  t("un concurs fără niciun kilogram e roșu", v.stare, "rosu");
  t("…și o spune pe șleau", /Niciun kilogram trecut/.test(titluri(v).join("|")), true);
}
{
  const v = verific(pornire({ name: "", balta: "", numManse: 2, manche: 1, sectors: ["A"], participants: [] }));
  t("lista goală e roșie", v.stare, "rosu");
  t("…și nu mai caută altceva", v.gasite.length, 1);
}

/* ================================================================
   3. Portocaliu — te uiți, dar tot tu hotărăști
   ================================================================ */
console.log("\n=== 3. Portocaliu ===");
{
  /* 53,99 kg s-au cântărit cu adevărat la Brăila Rediu Galian, pe 27 august. Aplicația
     o ARATĂ, n-o refuză: dacă portocaliul ar opri publicarea, cifra adevărată n-ar mai
     putea intra în sezon. */
  const s = concursCurat();
  s.participants[0].m[1].catches = [53.99];
  const v = verific(pornire(s));
  t("o captură peste prag e portocalie", v.stare, "portocaliu");
  t("…și NU oprește publicarea", v.rosii, 0);
  t("…spune cât și al cui e", /53,990 kg la 1 Ion Bălan/.test(v.gasite[0].d), true);
}
{
  const s = concursCurat();
  s.participants[0].m[1].catches = [4.2, 4.2];
  s.participants[0].m[1].catchTimes = [1000, 9000];   // 8 secunde
  const v = verific(pornire(s));
  t("două cântăriri identice la 8 secunde sunt portocalii", v.stare, "portocaliu");
  t("…și spune ce s-ar fi putut întâmpla", /ți-a sărit degetul pe buton/.test(v.gasite[0].d), true);
}
{
  /* Aceleași cifre, la o oră distanță: doi pești la fel, nu un deget sărit. */
  const s = concursCurat();
  s.participants[0].m[1].catches = [4.2, 4.2];
  s.participants[0].m[1].catchTimes = [1000, 1000 + 3600000];
  t("aceleași cifre la o oră distanță nu sunt o dublură", verific(pornire(s)).stare, "verde");
}
{
  const s = concursCurat();
  s.participants[0].m[2].stare = "sarit";
  s.participants[0].m[2].catches = [];
  const v = verific(pornire(s));
  t("un stand nelămurit e portocaliu", v.stare, "portocaliu");
  t("…și spune ce pățește dacă rămâne așa", /ultimul loc din sector/.test(v.gasite[0].d), true);
  t("…și te duce la Cântar", v.gasite[0].a, "showView('cantar')");
}
{
  const s = concursCurat(); s.balta = "";
  const v = verific(pornire(s));
  t("fără baltă e portocaliu", v.stare, "portocaliu");
  t("…și spune de ce contează", /două clasamente de sezon diferite/.test(v.gasite[0].d), true);
}
{
  const s = concursCurat();
  t("sincronizarea oprită e portocalie",
    verific(pornire(s, { camera: "cupa", cheie: "k", pauza: true })).stare, "portocaliu");
  t("…la fel și ce n-a plecat încă",
    verific(pornire(s, { camera: "cupa", cheie: "k", netrimis: true })).stare, "portocaliu");
  /* Fără cameră pusă n-are ce să nu plece: altfel fiecare concurs ținut doar pe telefon
     ar ieși portocaliu fără motiv. */
  t("fără cameră, nu se plânge de cameră", verific(pornire(s)).stare, "verde");
}

/* ================================================================
   4. Roșul bate portocaliul
   ================================================================ */
console.log("\n=== 4. Când sunt și unele, și altele ===");
{
  const s = concursCurat();
  s.participants[2].m[1].stand = "";        // roșu
  s.participants[0].m[1].catches = [99];    // portocaliu
  const v = verific(pornire(s));
  t("verdictul e roșu", v.stare, "rosu");
  t("…dar amândouă se văd", [v.rosii, v.portocalii], [1, 1]);
  t("…iar roșul e primul la rând", nivele(v)[0], "rosu");
}

/* ================================================================
   5. Concursul adevărat din 7 septembrie 2026
   ================================================================ */
console.log("\n=== 5. „Cupa Pescarul Hazliu”, din arhivă ===");
{
  const a = JSON.parse(fs.readFileSync("arhiva/2026-09-07-cupa-pescarul-hazliu.json", "utf8"));
  const d = a.data || a;
  d.participants.forEach((p) => { for (let i = 1; i <= 3; i++) p.m = p.m || {}; });
  const c = pornire(d);
  const v = verific(c);

  t("concursul are 33 de pescari", d.participants.length, 33);
  t("semaforul îl oprește", v.stare, "rosu");
  t("…pentru cele două lucruri care chiar l-au stricat", v.rosii, 2);
  t("…12 pescari fără stand", /^12 pescari n-au stand/.test(titluri(v)[0]), true);
  t("…și niciun kilogram", /Niciun kilogram trecut/.test(titluri(v)[1]), true);
  /* Asta e proba care contează: cu ecranul ăsta, concursul acela NU putea fi publicat. */
  t("butonul de publicare ar fi fost stins", v.stare === "rosu", true);
}

/* ================================================================
   6. Concursul adevărat din 4 septembrie — celălalt capăt
   ================================================================ */
console.log("\n=== 6. „Antrenamentul lu' Hazliu”, din arhivă ===");
{
  const a = JSON.parse(fs.readFileSync("arhiva/2026-09-04-antrenamentul-lu-hazliu.json", "utf8"));
  const d = a.data || a;
  const v = verific(pornire(d));
  t("24 de pescari, toți cu stand", d.participants.length, 24);
  t("…niciun lucru care să strice rezultatul", v.rosii, 0);
  t("…deci se poate publica", v.stare !== "rosu", true);
}

t.raport();
