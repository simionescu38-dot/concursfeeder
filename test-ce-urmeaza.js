/**
 * Ce urmează — butonul de pe Acasă, pentru toată ziua.
 *
 * Panoul de pe Acasă spunea de mult, într-un comentariu, „un singur buton, cel care are
 * sens acum". Dar știa doar de ceas: pornește manșa, oprește manșa. Restul zilei nu era
 * nicăieri — iar un om care deschidea aplicația prima oară nimerea peste un ecran gol,
 * fiindcă fără pescari panoul nu se desena deloc.
 *
 * Acum aceeași socoteală acoperă ziua întreagă:
 *
 *     fă concursul → înscrie pescarii → trage la sorți → pornește manșa →
 *     cântărește → gata manșa → treci la manșa 2 → publică rezultatul
 *
 * Se rulează funcția ADEVĂRATĂ din index.html, pe stări de concurs adevărate.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const t = H.creeazaVerificator();
const src = H.citeste("index.html");

const ORA = 3600000;
const ACUM = Date.parse("2026-09-13T09:00:00");

/** un pescar cu standul, sectorul și cântăririle lui în manșa dată */
function pescar(id, stand, kg, stare, mansa) {
  const m = {};
  for (let i = 1; i <= 3; i++) {
    m[i] = { catches: [], catchIds: [], catchTimes: [], extras: [], extraIds: [], extraTimes: [],
             stand: "", sector: "" };
  }
  const mi = mansa || 1;
  m[mi].stand = stand || "";
  m[mi].sector = stand ? "A" : "";
  m[mi].catches = (kg || []).slice();
  if (stare) m[mi].stare = stare;
  return { id: id, prenume: id, nume: "P", stand: stand || "", sector: stand ? "A" : "", m: m };
}

/** contextul cu funcțiile adevărate de care depinde pasul următor */
function pornire(stare) {
  const ctx = {
    console,
    state: Object.assign({ manche: 1, numManse: 2, name: "", startAt: null, endAt: null,
                           participants: [] }, stare || {}),
    nowSync: () => ACUM,
    arbitruMode: false, arbitruSector: "",
    ensureManche() {}, manseRange: () => [1, 2, 3],
  };
  vm.createContext(ctx);
  vm.runInContext([
    "num", "mOf", "standOfM", "sectorOfM", "cantOfM", "extraOfM", "totalOfM",
    "stareaLaMansa", "arbGata", "numManse", "stareaMansei", "pasulUrmator",
  ].map((n) => H.grabFunction(src, n)).join("\n"), ctx);
  vm.runInContext(/var STARI_MANSA=\{[^}]*\};/.exec(src)[0], ctx);
  return ctx;
}
const pasul = (stare) => vm.runInContext("pasulUrmator()", pornire(stare));

/* ================================================================
   1. Drumul unei zile, de la un capăt la altul.
   ================================================================ */
console.log("\n=== 1. Ziua de concurs, pas cu pas ===");
{
  t("telefon gol → fă concursul", pasul({}).t, "Fă concursul");

  t("concurs cu nume, fără pescari → înscrie-i",
    pasul({ name: "Cupa de toamnă" }).t, "Înscrie pescarii");

  t("pescari fără standuri → trage la sorți",
    pasul({ name: "Cupa", participants: [pescar("a"), pescar("b")] }).t, "Trage la sorți");

  t("standuri puse, ceasul nepornit → pornește manșa",
    pasul({ name: "Cupa", participants: [pescar("a", "1"), pescar("b", "2")] }).t,
    "▶️ Pornește manșa 1");

  t("manșa în desfășurare → gata, s-a terminat",
    pasul({ name: "Cupa", startAt: ACUM - ORA, endAt: ACUM + ORA,
            participants: [pescar("a", "1"), pescar("b", "2")] }).t,
    "🏁 Gata, s-a terminat manșa");

  t("ceasul s-a scurs, mai sunt de cântărit → cântărește, cu numărătoarea",
    pasul({ name: "Cupa", startAt: ACUM - 4 * ORA, endAt: ACUM - 60000,
            participants: [pescar("a", "1", [3.2]), pescar("b", "2")] }).t,
    "Cântărește · 1 din 2");

  t("toți cântăriți, mai e o manșă → treci la manșa 2",
    pasul({ name: "Cupa", numManse: 2, startAt: ACUM - 4 * ORA, endAt: ACUM - 60000,
            participants: [pescar("a", "1", [3.2]), pescar("b", "2", [5])] }).t,
    "Treci la manșa 2");

  t("ultima manșă, toți cântăriți → publică",
    pasul({ name: "Cupa", numManse: 2, manche: 2, startAt: ACUM - 4 * ORA, endAt: ACUM - 60000,
            participants: [pescar("a", "1", [3.2], null, 2), pescar("b", "2", [5], null, 2)] }).t,
    "Publică rezultatul");
}

/* ================================================================
   2. Ordinea verificărilor E regula.
   ================================================================ */
console.log("\n=== 2. De ce se întreabă tragerea la sorți întâi ===");
{
  /* Cine n-are stand în manșa asta iese „absent" — adică lămurit, adică gata. Fără
     pescari pe standuri, TOȚI ies absenți, deci socoteala ar spune că s-a terminat
     cântărirea înainte să înceapă, și butonul ar sări direct la „Publică rezultatul". */
  const fara = { name: "Cupa", numManse: 1,
                 participants: [pescar("a"), pescar("b"), pescar("c")] };
  t("fără standuri nu se sare la publicare", pasul(fara).t, "Trage la sorți");

  /* Un singur stand tras e destul ca să nu mai fie „tragerea la sorți" pasul următor:
     restul se completează pe măsură ce se citește foaia. */
  t("de la primul stand tras, pasul se schimbă",
    pasul({ name: "Cupa", participants: [pescar("a", "1"), pescar("b")] }).t,
    "▶️ Pornește manșa 1");
}

/* ================================================================
   2b. Ceasul e al unei manșe anume.

   `startAt`/`endAt` sunt ale manșei care rulează. După „Treci la manșa 2" ele rămân
   cele ale manșei 1 — deci ora e demult trecută. Fără să știm A CUI e ceasul, socoteala
   crede că manșa 2 s-a și terminat, și cere cântărirea în loc de pornire.
   ================================================================ */
console.log("\n=== 2b. Ceasul e al manșei lui ===");
{
  const dupaSchimbare = {
    name: "Cupa", numManse: 2, manche: 2,
    mansaCeas: 1,                       // ceasul e al manșei 1, care s-a terminat
    startAt: ACUM - 5 * ORA, endAt: ACUM - ORA,
    participants: [pescar("a", "1", [], null, 2), pescar("b", "2", [], null, 2)],
  };
  t("după trecerea la manșa 2, se pornește manșa 2",
    pasul(dupaSchimbare).t, "▶️ Pornește manșa 2");

  /* Iar cazul adevărat de la manșa 1 nu se strică: s-a strigat stop, pescarii vin cu
     juvelnicele, încă n-a cântărit nimeni — atunci se cântărește, nu se repornește. */
  t("ceasul manșei de acum, scurs, cere cântărire",
    pasul({ name: "Cupa", numManse: 2, manche: 1, mansaCeas: 1,
            startAt: ACUM - 5 * ORA, endAt: ACUM - ORA,
            participants: [pescar("a", "1"), pescar("b", "2")] }).t,
    "Cântărește · 0 din 2");

  /* Concursurile de dinainte n-au câmpul ăsta: acolo rămâne purtarea veche. */
  t("fără însemnul ceasului, purtarea rămâne cea de dinainte",
    pasul({ name: "Cupa", numManse: 2, manche: 2,
            startAt: ACUM - 5 * ORA, endAt: ACUM - ORA,
            participants: [pescar("a", "1", [], null, 2), pescar("b", "2", [], null, 2)] }).t,
    "Cântărește · 0 din 2");
}

/* ================================================================
   3. Ce înseamnă „lămurit" la numărătoare.
   ================================================================ */
console.log("\n=== 3. Cine intră în numărătoare ===");
{
  const cu = (p) => ({ name: "Cupa", numManse: 1, startAt: ACUM - 4 * ORA, endAt: ACUM - 60000,
                       participants: p });

  t("lampa se socotește lămurită",
    pasul(cu([pescar("a", "1", [3]), pescar("b", "2", [], "zero")])).t, "Publică rezultatul");

  t("cine e sărit peste, nu",
    pasul(cu([pescar("a", "1", [3]), pescar("b", "2", [], "sarit")])).t, "Cântărește · 1 din 2");

  /* Cine n-a extras stand în manșa asta n-a fost la ea: nu se așteaptă nimeni după el. */
  t("cine n-a fost la manșă nu ține pe loc cântarul",
    pasul(cu([pescar("a", "1", [3]), pescar("b", "", [])])).t, "Publică rezultatul");
}

/* ================================================================
   4. Fiecare pas duce undeva. Un buton fără drum e un buton mort.
   ================================================================ */
console.log("\n=== 4. Fiecare buton are un drum ===");
{
  const drumuri = [
    [{}, "meniuGo('set','card-nume')"],
    [{ name: "Cupa" }, "showView('cantar')"],
    [{ name: "Cupa", participants: [pescar("a")] }, "laTragere()"],
    [{ name: "Cupa", participants: [pescar("a", "1")] }, "pornesteMansa()"],
    [{ name: "Cupa", startAt: ACUM - ORA, endAt: ACUM + ORA,
       participants: [pescar("a", "1")] }, "opresteMansa()"],
    [{ name: "Cupa", numManse: 2, startAt: ACUM - 4 * ORA, endAt: ACUM - 60000,
       participants: [pescar("a", "1", [3])] }, "treciLaMansa(2)"],
    [{ name: "Cupa", numManse: 1, startAt: ACUM - 4 * ORA, endAt: ACUM - 60000,
       participants: [pescar("a", "1", [3])] }, "meniuGo('rank','card-final')"],
  ];
  drumuri.forEach(function (d) {
    const p = pasul(d[0]);
    t("„" + p.t + "” → " + d[1], p.a, d[1]);
  });

  /* Toate drumurile trebuie să existe în pagină, altfel butonul crapă la apăsare. */
  ["laTragere", "treciLaMansa", "pornesteMansa", "opresteMansa", "meniuGo", "showView"]
    .forEach(function (f) {
      t("funcția " + f + " există în aplicație",
        new RegExp("function\\s+" + f + "\\s*\\(").test(src), true);
    });
  t("cardul spre care sare «Fă concursul» există", /id="card-nume"/.test(src), true);
  t("…și cel spre care sare «Publică rezultatul»", /id="card-final"/.test(src), true);
  t("…care e chiar cardul cu Am terminat concursul",
    /id="card-final"[\s\S]{0,600}amTerminatConcursul\(\)/.test(src), true);
}

/* ================================================================
   5. Panoul îl arată, și îl împrospătează când se schimbă.
   ================================================================ */
console.log("\n=== 5. Panoul de pe Acasă ===");
{
  const panou = H.grabFunction(src, "statusLiveHtml");
  t("ecranul gol nu mai e gol", /if\(!state\.participants\.length\)\{/.test(panou), true);
  /* Rândul spune UNDE ești, butonul CE FACI. Amândouă cu același text ar fi două rânduri
     care spun același lucru. */
  t("rândul de sus spune unde ești, nu ce faci",
    /niciun pescar înscris[\s\S]{0,200}Niciun concurs pe telefonul ăsta/.test(panou), true);
  t("…iar butonul poartă pasul", /class="sl-act" onclick="'\+pas0\.a\+'">'\+esc\(pas0\.t\)/.test(panou), true);
  t("…dar rămâne gol pentru cine doar privește",
    /if\(!state\.participants\.length\)\{[\s\S]{0,120}if\(isLocked\(\)\) return "";/.test(panou), true);

  /* Fără pasul următor în semnătură, panoul rămâne cu butonul vechi: după tragerea la
     sorți nu se schimbă nici starea, nici capturile, nici kilogramele. */
  const semn = H.grabFunction(src, "semnaturaStatus");
  t("pasul intră în semnătura panoului", /pasulUrmator\(\)\.t/.test(semn), true);
}

t.raport();
