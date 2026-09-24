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
    console, Math, String, Array, Object,
    state: Object.assign({ manche: 1, numManse: 2, name: "", balta: "Balta", startAt: null,
                           endAt: null, participants: [] }, stare || {}),
    nowSync: () => ACUM,
    arbitruMode: false, arbitruSector: "",
    ensureManche() {}, manseRange: () => [1, 2, 3],
    /* Pasul de la capătul zilei trece prin semafor, deci proba are nevoie și de el.
       Camera lipsește dinadins: fără ea nu e nimic de trimis, iar probele de aici sunt
       despre ORDINEA pașilor, nu despre sincronizare. */
    PRAG_KG: 50, syncRoom: "", syncKey: "", syncPaused: false, syncBusy: false,
    syncLastOk: "12:40", arbNetrimis: false,
  };
  vm.createContext(ctx);
  vm.runInContext([
    "num", "fmt", "mOf", "standOfM", "sectorOfM", "cantOfM", "extraOfM", "totalOfM",
    "stareaLaMansa", "arbGata", "numManse", "stareaMansei", "p2", "hhmm", "fmtDur",
    "nameOf", "nelamurit", "standuriNecantarite", "mancheDisputata", "mansaTrasa",
    "faraStandLaMansa", "verificaConcursul", "pasulUrmator",
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

  /* Era saltul direct la publicare. Acum trece prin semafor — iar butonul spune ce a
     găsit acolo, ca pasul să nu fie orb. Pe verde e o atingere în plus și atât. */
  t("ultima manșă, toți cântăriți, totul curat → verifică și publică",
    pasul({ name: "Cupa", numManse: 2, manche: 2, startAt: ACUM - 4 * ORA, endAt: ACUM - 60000,
            participants: [pescar("a", "1", [3.2], null, 2), pescar("b", "2", [5], null, 2)] }).t,
    "Verifică și publică");
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
   2c. Ora pusă dinainte nu se mai calcă.

   Butonul spunea „Pornește manșa" și când ora era pusă dinainte și n-a venit încă —
   iar apăsat, îți călca ora și sărea peste nădirea grea. Acum spune UNDE ești. Drumul
   rămâne același: pornesteMansa() întreabă înainte să calce ora, deci cine începe mai
   târziu decât scrie pe hârtie tot poate porni pe loc.
   ================================================================ */
console.log("\n=== 2c. Cele 10 minute de nădire grea ===");
{
  const cuOra = (peste, nadire) => ({
    name: "Cupa", numManse: 1, manche: 1, mansaCeas: 1,
    nadireMin: nadire === undefined ? 10 : nadire,
    startAt: ACUM + peste, endAt: ACUM + peste + 4 * ORA,
    participants: [pescar("a", "1"), pescar("b", "2")],
  });

  t("cu o oră înainte, spune când începe și când sună nădirea",
    pasul(cuOra(ORA)).t, "⏱ Manșa 1 începe la 10:00 · nădirea la 09:50");

  /* În cele 10 minute de nădire, butonul arată nădirea, nu pornirea. */
  t("în nădire, butonul spune nădire",
    pasul(cuOra(6 * 60000)).t, "🎣 Nădire grea · mai sunt 0:06:00");

  /* Fără nădire, rămâne doar ora de start. */
  t("cu nădirea pe zero, doar ora de start",
    pasul(cuOra(ORA, 0)).t, "⏱ Manșa 1 începe la 10:00");

  /* Drumul e tot pornirea: ea întreabă înainte să calce ora pusă. */
  ["⏱", "🎣"].forEach(function (semn, i) {
    const p = pasul(cuOra(i === 0 ? ORA : 6 * 60000));
    t("„" + semn + "” duce tot la pornire, care întreabă întâi", p.a, "pornesteMansa()");
  });
  t("pornirea chiar întreabă înainte să calce ora",
    /O pornești acum, la/.test(H.grabFunction(src, "pornesteMansa")), true);

  /* Ceasul altei manșe rămâne ca și cum n-ar fi: acolo se pornește, nu se așteaptă. */
  t("ceasul altei manșe nu ține loc de oră pusă",
    pasul({ name: "Cupa", numManse: 2, manche: 2, mansaCeas: 1,
            startAt: ACUM + ORA, endAt: ACUM + 5 * ORA,
            participants: [pescar("a", "1", [], null, 2), pescar("b", "2", [], null, 2)] }).t,
    "▶️ Pornește manșa 2");
}

/* ================================================================
   3. Ce înseamnă „lămurit" la numărătoare.
   ================================================================ */
console.log("\n=== 3. Cine intră în numărătoare ===");
{
  const cu = (p) => ({ name: "Cupa", numManse: 1, startAt: ACUM - 4 * ORA, endAt: ACUM - 60000,
                       participants: p });

  t("lampa se socotește lămurită",
    pasul(cu([pescar("a", "1", [3]), pescar("b", "2", [], "zero")])).t, "Verifică și publică");

  t("cine e sărit peste, nu",
    pasul(cu([pescar("a", "1", [3]), pescar("b", "2", [], "sarit")])).t, "Cântărește · 1 din 2");

  /* Cine n-a extras stand în manșa asta n-a fost la ea: nu se așteaptă nimeni după el. */
  /* Cel fără stand nu ține cântarul pe loc — dar ÎL vede semaforul, fiindcă exact el e
     cel care dispare din clasament. Pasul spune cifra, nu doar „verifică". */
  t("cine n-a fost la manșă nu ține pe loc cântarul",
    pasul(cu([pescar("a", "1", [3]), pescar("b", "", [])])).t,
    "⛔ Verifică concursul · 1 lucru de reparat");
}

/* ================================================================
   4. Fiecare pas duce undeva. Un buton fără drum e un buton mort.
   ================================================================ */
console.log("\n=== 4. Fiecare buton are un drum ===");
{
  const drumuri = [
    [{}, "showView('nou')"],
    [{ name: "Cupa" }, "showView('cantar')"],
    [{ name: "Cupa", participants: [pescar("a")] }, "laTragere()"],
    [{ name: "Cupa", participants: [pescar("a", "1")] }, "pornesteMansa()"],
    [{ name: "Cupa", startAt: ACUM - ORA, endAt: ACUM + ORA,
       participants: [pescar("a", "1")] }, "opresteMansa()"],
    [{ name: "Cupa", numManse: 2, startAt: ACUM - 4 * ORA, endAt: ACUM - 60000,
       participants: [pescar("a", "1", [3])] }, "treciLaMansa(2)"],
    [{ name: "Cupa", numManse: 1, startAt: ACUM - 4 * ORA, endAt: ACUM - 60000,
       participants: [pescar("a", "1", [3])] }, "showView('verific')"],
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
  /* „Fă concursul" nu mai duce în setări, ci pe ecranul lui: acolo stau exact lucrurile
     care se pun, în ordinea în care se pun. Cardul cu numele e primul de pe el. */
  t("ecranul spre care sare «Fă concursul» există", /id="view-nou"/.test(src), true);
  t("…iar cardul cu numele e pe el",
    /id="view-nou"[\s\S]{0,900}id="card-nume"/.test(src), true);
  /* Ecranul de verificare e ultima răscruce: de acolo se publică, nu de pe Cântar. */
  t("…și ecranul spre care sare «Verifică și publică»", /id="view-verific"/.test(src), true);
  t("…care duce mai departe la cardul de sfârșit de concurs",
    /id="view-verific"[\s\S]{0,900}verific-buton/.test(src) &&
    /meniuGo\(\\?'rank\\?',\\?'card-final\\?'\)/.test(src), true);
  t("…iar acela e chiar cardul cu Am terminat concursul",
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

/* ================================================================
   6. Butonul de pe Cântar a IEȘIT — fiindcă n-a mai avut de ce să stea.

   A fost pus când cântarul era un ecran aparte: panoul cu pasul următor era doar pe
   Acasă, iar treaba se face la cântar, deci erau patru drumuri dus-întors pe concurs.
   Acum cântarul e chiar TREAPTA A PATRA din scară, iar treapta își poartă butonul.
   Două uși spre același lucru, pe același ecran, e tocmai ce scoatem de la o vreme.
   ================================================================ */
console.log("\n=== 6. Butonul de pe Cântar a ieșit ===");
{
  t("nu mai există un al doilea loc pentru el", /status-cantar/.test(src), false);
  t("…nici funcția care îl desena", /butonulPasului/.test(src), false);

  /* Drumul nu s-a rupt: butonul e în treapta manșei, prin panoul ei. */
  const tr = H.grabFunction(src, "treptele");
  t("treapta manșei poartă panoul, cu butonul lui", /corp: statusLiveHtml/.test(tr), true);

  /* Toate drumurile din cod care duceau la cântar ajung acum în scară, pe treapta lui —
     altfel ar fi aterizat pe un ecran din care s-a mutat tot. */
  t("«showView(\'cantar\')» duce în scară, pe treapta a patra",
    /if\(v==="cantar" && !esteArbitru\(\)\)\{[\s\S]{0,500}scaraDeschide\(4, true\); return;/.test(src), true);
  /* `showView("part")` iese din funcție, deci ramura care desena lista nu se mai atinge pe
     drumul ăsta: fără desenare aici, cine venea spre cântar găsea lista goală. */
  t("…și desenează lista pe drumul ăla",
    /showView\("part"\); renderList\(\); scaraDeschide\(4, true\);/.test(src), true);
  /* Ecranul de cântar e depozitul: pentru organizator s-a mutat tot în scară. Cine iese
     din arbitraj trebuie dus în scară, altfel rămâne pe un ecran gol. */
  t("ieșirea din arbitraj duce în scară, nu pe un ecran gol",
    /function iesDinArbitru[\s\S]{0,1200}showView\("part"\);[\s\S]{0,80}Ai ieșit din arbitraj/.test(src), true);
  /* Arbitrul n-are scară: la el, cântarul rămâne ecranul lui, întreg. */
  t("…dar arbitrul rămâne pe ecranul lui", /if\(v==="part" && esteArbitru\(\)\)\{ v="cantar"; \}/.test(src), true);
  t("…și scara nici nu se desenează pentru el",
    /isLocked\(\) \|\| viewerMode \|\| esteArbitru\(\)/.test(src), true);

  const isp = H.grabFunction(src, "improspateazaStatus");
  t("împrospătarea are un singur loc de umplut acum", /getElementById\("scara"\); if\(!el\) return;/.test(isp), true);
  t("…și nu mai caută al doilea", /elC/.test(isp), false);
}

/* ================================================================
   Cutii în cutii
   ================================================================
   „Tot nu îmi place, cum e așezată." Măsurat la 412px, pe Acasă: blocurile late stăteau
   pe OPT margini diferite din stânga, fiindcă treapta e o ramă, iar cardul mutat în ea
   mai punea una — cu alt colț (16px peste 14px) și cu încă 14px de fiecare parte.
   Rândurile foii sectorului ajungeau la 43px de marginea ecranului. */
console.log("\n=== Cutii în cutii ===");
{
  t("cardul mutat în treaptă își pierde rama",
    /\.tr-in > \.card\{background:transparent; border:0; border-radius:0; padding:0;/.test(src), true);
  t("…și umbra", /\.tr-in > \.card\{[^}]*box-shadow:none/.test(src), true);
  t("…iar ultimul din treaptă nu lasă spațiu gol la coadă",
    /\.tr-in > \.card:last-child\{margin-bottom:0;\}/.test(src), true);
  t("clasamentul sectorului își pierde și el rama",
    /\.tr-in > \.sect-live\{background:transparent; border:0/.test(src), true);
  /* Panoul manșei ÎȘI PĂSTREAZĂ rama: culoarea lui spune în ce stare e ziua. */
  t("panoul manșei rămâne cu rama lui", /\.tr-in > \.sl\{/.test(src), false);
  /* Rama nu se pierde acolo unde cardul chiar e singur pe ecran: regula e legată de
     treaptă, nu de card. */
  t("regula ține de treaptă, nu de card", /\.card\{background:var\(--card\); border:1px solid var\(--line\)/.test(src), true);
}

t.raport();
