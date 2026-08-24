/**
 * Scenariile speciale, duse prin TOATE cele patru ieșiri.
 *
 * Un clasament pleacă din aplicație pe patru drumuri: ecranul, textul copiat, PDF-ul și
 * poza pentru WhatsApp. Celelalte suite verifică motorul — cine pe ce loc, cu ce puncte.
 * Motorul poate fi curat și tot să iasă prost: în august, printRank sorta MEREU după
 * kilograme, chiar și pe „Final · După puncte", dar tipărea coloana Pct și scria
 * „Clasament oficial". Hârtia de la premiere anunța altă ordine decât cea citită cu voce
 * tare, iar toate cele 259 de verificări ale motorului treceau.
 *
 * test-export.js verifică din SURSĂ că cele patru se ramifică la fel. Aici trec
 * concursuri adevărate prin ele și se compară ordinea din produsul lor.
 *
 * Scenariile sunt cele cerute: egalități, zero kg, absenți, sectoare inegale și
 * schimbarea standului între manșe. Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

/* ---------- ce se încarcă, real, din fișierul livrat ---------- */
const MOTOR = [
  "mOf", "cantOfM", "extraOfM", "cmmcOfM", "totalOfM", "cmmcAward",
  "standKey", "byStand", "nameKey", "nameOf", "esc", "fmt", "fmtPts",
  "sectorOfM", "standOfM", "mancheDeAfisat", "manseRange", "numManse", "scalaSectoare",
  "absentLaMansa", "pointsMapS", "mancheDisputata", "pointsCombo", "bestMancheOf",
  "sortByPointsS", "sortRankS", "currentPmap", "scopeLabel", "roDate",
  "rankRows", "rankColumnsHtml"
];
const IESIRI = ["renderRank", "copyRank", "printRank", "planImagine"];

/**
 * Un mediu în care ieșirile chiar rulează.
 *
 * Nu-i trebuie browser: copyRank și planImagine nu ating deloc DOM-ul, iar renderRank
 * și printRank cer doar trei elemente (#rankBody, #cmmcBox, #printArea) din care nu se
 * citește decât innerHTML. Fără asta, verificarea ar trăi doar într-o probă Playwright,
 * adică nicăieri după ce se închide sesiunea.
 */
function mediu() {
  const elemente = {};
  const el = id => (elemente[id] = elemente[id] || { innerHTML: "" });
  let copiat = null;
  const box = {
    console,
    state: { participants: [], numManse: 2, scalaSectoare: false, name: "Cupa de probă" },
    document: { getElementById: el },
    window: { print: function () { box.__tiparit++; } },
    navigator: {
      clipboard: {
        // copyRank cere un „then" cu două brațe; nu se așteaptă nimic asincron
        writeText: function (txt) { copiat = txt; return { then: function (ok) { if (ok) ok(); } }; }
      }
    },
    toast: function () {},
    improspateazaStatistici: function () {},
    __tiparit: 0,
    __el: elemente,
    __copiat: function () { return copiat; }
  };
  vm.createContext(box);
  vm.runInContext(`
    var rankMode="sec", finMethod="kg", rankScope=1;
    function ensureManche(p){
      if(!p.m) p.m={};
      for(var i=1;i<=(state.numManse||2);i++){
        if(!p.m[i]) p.m[i]={catches:[],extras:[],catchTimes:[],catchPhotos:[]};
      }
    }
    ${MOTOR.concat(IESIRI).map(n => H.grabFunction(src, n)).join("\n")}
  `, box);
  return box;
}

/**
 * Așază un concurs, în aceeași formă ca test-scenarii.js — ca să se citească la fel.
 *   pescari: [nume, [ [stand, sector, kg, extra?], ... pe manșe ]]
 *   Stand gol ("") = n-a extras în manșa aceea, adică n-a fost.
 */
function asaza(box, numManse, scala, pescari) {
  box.state.numManse = numManse;
  box.state.scalaSectoare = !!scala;
  box.state.participants = pescari.map(function (p, i) {
    var manse = p[1], m = {};
    for (var mi = 1; mi <= numManse; mi++) {
      var r = manse[mi - 1] || ["", "", 0];
      m[mi] = { stand: r[0], sector: r[1], catches: r[2] ? [r[2]] : [],
                extras: r[3] ? [r[3]] : [], catchTimes: [], catchPhotos: [] };
    }
    return { id: "p" + i, prenume: "", nume: p[0], stand: manse[0][0], sector: manse[0][1], m: m };
  });
}

function pune(box, mod, metoda, scop) {
  vm.runInContext("rankMode=" + JSON.stringify(mod) + "; finMethod=" + JSON.stringify(metoda) +
                  "; rankScope=" + JSON.stringify(scop) + ";", box);
}

/* ---------- ordinea, citită din PRODUSUL fiecărei ieșiri ---------- */

/** ecran: celula e „<td>Nume<div class="small">Stand 3 · Sec A</div></td>" */
function deLaEcran(box) {
  vm.runInContext("renderRank();", box);
  const html = box.__el["rankBody"].innerHTML;
  return [...html.matchAll(/<td>([^<]*)<div class="small">/g)].map(m => m[1]);
}
/** copiere: rândurile numerotate din textul dus în clipboard */
function deLaCopiere(box) {
  vm.runInContext("copyRank();", box);
  return (box.__copiat() || "").split("\n")
    .filter(l => /^\d+\.\s/.test(l))
    .map(l => l.replace(/^\d+\.\s*/, "").split(" (")[0].trim());
}
/** PDF: primul tabel din printArea („Clasament final"); cele pe sectoare vin după */
function deLaPdf(box) {
  vm.runInContext("printRank();", box);
  const primulTabel = box.__el["printArea"].innerHTML.split("</table>")[0];
  return [...primulTabel.matchAll(/<td class="c">\d+<\/td><td>([^<]*)<\/td>/g)].map(m => m[1]);
}
/** poză: prima secțiune a planului */
function deLaPoza(box) {
  const plan = vm.runInContext("planImagine()", box);
  const s = plan.sectiuni[0];
  return s ? s.randuri.map(r => r.nume) : [];
}
/** ce spune motorul, adică adevărul cu care se compară toate patru */
function deLaMotor(box, pePuncte) {
  return vm.runInContext(
    pePuncte ? "sortByPointsS(state.participants,currentPmap(),rankScope).map(function(p){return nameOf(p);})"
             : "sortRankS(state.participants,rankScope).map(function(p){return nameOf(p);})", box);
}
/** subtitlul hârtiei de la premiere */
function subtitlulPdf(box) {
  const m = box.__el["printArea"].innerHTML.match(/<div class="pr-sub">([^<]*)<\/div>/);
  return m ? m[1] : "";
}

/**
 * Miezul: același concurs, prin toate patru, în amândouă felurile de clasament.
 * Se cere și ca ordinea să fie ALTA între puncte și kilograme — altfel scenariul n-ar
 * discrimina nimic și testul ar trece degeaba, oricât de stricat ar fi codul.
 */
function toatePatru(nume, box, scop, cereDiferenta) {
  const rezultate = {};
  [["pct", true], ["kg", false]].forEach(function (par) {
    const metoda = par[0], pePuncte = par[1];
    pune(box, "fin", metoda, scop);
    const motor = deLaMotor(box, pePuncte);
    const ecran = deLaEcran(box), copiere = deLaCopiere(box), pdf = deLaPdf(box), poza = deLaPoza(box);
    const eticheta = nume + " · " + (pePuncte ? "După puncte" : "După kg");
    t(eticheta + " — ecranul urmează motorul", ecran, motor);
    t(eticheta + " — copierea dă aceeași ordine", copiere, ecran);
    t(eticheta + " — PDF-ul dă aceeași ordine", pdf, ecran);
    t(eticheta + " — poza dă aceeași ordine", poza, ecran);
    t(eticheta + " — hârtia își scrie felul",
      new RegExp(pePuncte ? "După puncte" : "După kg").test(subtitlulPdf(box)), true);
    rezultate[metoda] = ecran;
  });
  if (cereDiferenta) {
    t(nume + " — scenariul chiar discriminează (puncte ≠ kilograme)",
      JSON.stringify(rezultate.pct) !== JSON.stringify(rezultate.kg), true);
  }
  return rezultate;
}

/* ================================================================
   1. Egalitate perfectă
   Doi la aceleași puncte și aceleași kilograme. Îi desparte cel mai mare pește, apoi
   numărul standului — treptele 4 și 5 din lanțul de departajare, adică exact acolo unde
   contestația e cea mai probabilă. Dacă o ieșire ar sorta singură, aici s-ar vedea.
   ================================================================ */
console.log("\n=== 1. Egalitate perfectă (departajare pe pește și pe stand) ===");
{
  const box = mediu();
  asaza(box, 1, false, [
    ["Greu",     [["1", "A", 20.0]]],
    ["CuPeste",  [["7", "B", 10.0, 4.0]]],   // 14,0 kg în total, cu un pește de 4,0
    ["FaraPeste",[["2", "B", 14.0]]],        // 14,0 kg fix, fără pești extra
    ["Ultim",    [["3", "A",  2.0]]]
  ]);
  toatePatru("egalitate perfectă", box, 1, true);
  /* Treapta „cel mai mare pește" e în sortByPointsS, nu în sortRankS: pe „După kg",
     doi la aceleași kilograme se despart după numărul standului. Deci se cere pe puncte. */
  pune(box, "fin", "pct", 1);
  const ord = deLaEcran(box);
  t("pe puncte, cel mai mare pește îl trece înaintea celui fără",
    ord.indexOf("CuPeste") < ord.indexOf("FaraPeste"), true);
  pune(box, "fin", "kg", 1);
  const ordKg = deLaEcran(box);
  t("pe kilograme, la egalitate departajează standul mai mic",
    ordKg.indexOf("FaraPeste") < ordKg.indexOf("CuPeste"), true);
}

/* ================================================================
   2. Zero kg — un sector întreg fără captură, lângă unul normal
   ================================================================ */
console.log("\n=== 2. Zero kg (sector întreg fără captură) ===");
{
  const box = mediu();
  asaza(box, 1, false, [
    ["Cristi", [["1", "A", 8.0]]],
    ["Paul",   [["2", "A", 0]]],      // a fost, a stat, n-a prins
    ["Harry",  [["3", "A", 0]]],
    ["Mimi",   [["4", "B", 0]]],      // sectorul B, întreg, fără nimic
    ["Seby",   [["5", "B", 0]]]
  ]);
  toatePatru("zero kg", box, 1, true);
  pune(box, "fin", "kg", 1);
  t("cel cu 8 kg e primul peste tot",
    [deLaEcran(box)[0], deLaCopiere(box)[0], deLaPdf(box)[0], deLaPoza(box)[0]],
    ["Cristi", "Cristi", "Cristi", "Cristi"]);
  t("nimeni nu dispare din vreo ieșire când toți sunt pe zero",
    [deLaEcran(box).length, deLaCopiere(box).length, deLaPdf(box).length, deLaPoza(box).length],
    [5, 5, 5, 5]);
}
{
  // și cazul în care NIMENI n-a prins nimic: ieșirile trebuie să existe, nu să crape
  const box = mediu();
  asaza(box, 1, false, [
    ["Unu", [["1", "A", 0]]], ["Doi", [["2", "A", 0]]], ["Trei", [["3", "B", 0]]]
  ]);
  pune(box, "fin", "pct", 1);
  t("nimeni n-a prins nimic: toate patru scot tot atâția oameni",
    [deLaEcran(box).length, deLaCopiere(box).length, deLaPdf(box).length, deLaPoza(box).length],
    [3, 3, 3, 3]);
  t("…și aceeași ordine", [deLaCopiere(box), deLaPdf(box), deLaPoza(box)],
    [deLaEcran(box), deLaEcran(box), deLaEcran(box)]);
}

/* ================================================================
   3. Absenți — unul care n-a venit deloc, unul retras după manșa 1
   ================================================================ */
console.log("\n=== 3. Absenți (n-a venit / s-a retras) ===");
{
  const box = mediu();
  /* Sectorul B e slab dinadins: cine îl câștigă are mai puține kilograme decât al doilea
     din A. Fără asta, punctele ar da aceeași ordine ca kilogramele și scenariul n-ar
     deosebi un cod bun de unul care sortează mereu pe kilograme. */
  asaza(box, 2, false, [
    ["Cristi",  [["1", "A", 10.0], ["1", "A", 9.0]]],
    ["Paul",    [["2", "A",  8.0], ["2", "A", 7.0]]],
    ["Slab",    [["5", "B",  2.0], ["5", "B", 2.5]]],
    ["Retras",  [["3", "B",  3.0], ["",  "",  0]]],   // a pescuit manșa 1, pe urmă a plecat
    ["N-a fost",[["",  "",   0],   ["",  "",  0]]]
  ]);
  const r = toatePatru("absenți · General", box, "total", true);
  t("cine n-a venit deloc e ultimul, și pe puncte, și pe kilograme",
    [r.pct[r.pct.length - 1], r.kg[r.kg.length - 1]], ["N-a fost", "N-a fost"]);
  // pe manșa 2, retrasul e absent la fel ca cel care n-a venit niciodată
  toatePatru("absenți · manșa 2", box, 2, false);
}

/* ================================================================
   4. Sectoare inegale (4 · 3 · 2), în amândouă scalele
   ================================================================ */
console.log("\n=== 4. Sectoare inegale, „Locul 3 = 3 puncte\" ===");
const SECTOARE_INEGALE = [
  ["A1", [["1", "A", 12.0]]], ["A2", [["2", "A", 9.0]]], ["A3", [["3", "A", 6.0]]], ["A4", [["4", "A", 3.0]]],
  ["B1", [["5", "B", 11.0]]], ["B2", [["6", "B", 8.0]]], ["B3", [["7", "B", 5.0]]],
  // sectorul C e mic ȘI slab: câștigătorul lui are 4,0 kg, deci pe puncte urcă mult
  // peste locul pe care i-l dau kilogramele — răsturnarea pe care o ascundea PDF-ul
  ["C1", [["8", "C", 4.0]]], ["C2", [["9", "C", 1.0]]]
];
{
  const box = mediu();
  asaza(box, 1, false, SECTOARE_INEGALE);
  toatePatru("sectoare inegale · simplu", box, 1, true);
}
console.log("\n=== 4b. Aceleași sectoare, cu „Îndreptat\" ===");
{
  const box = mediu();
  asaza(box, 1, true, SECTOARE_INEGALE);
  const r = toatePatru("sectoare inegale · îndreptat", box, 1, true);
  // scala schimbă punctele, deci poate schimba ordinea — dar toate patru la fel
  const box2 = mediu();
  asaza(box2, 1, false, SECTOARE_INEGALE);
  pune(box2, "fin", "pct", 1);
  t("„Îndreptat\" chiar dă altă ordine decât „Locul 3 = 3 puncte\"",
    JSON.stringify(r.pct) !== JSON.stringify(deLaEcran(box2)), true);
}

/* ================================================================
   5. Tragere nouă între manșe — alt stand și alt sector în manșa 2
   ================================================================ */
console.log("\n=== 5. Tragere nouă între manșe ===");
{
  const box = mediu();
  /* Sectorul slab e B în manșa 1 și tot B în manșa 2 — dar cu alți oameni în el, fiindcă
     s-a tras din nou la sorți. Dacă o ieșire ar citi sectorul de ACUM în loc de cel al
     manșei, ordinea manșei 1 s-ar strica. */
  asaza(box, 2, false, [
    ["Ana",   [["1", "A", 9.0], ["8", "B", 3.0]]],
    ["Bogdan",[["2", "A", 8.0], ["9", "B", 2.0]]],
    ["Cezar", [["3", "B", 4.0], ["1", "A", 9.0]]],
    ["Dan",   [["4", "B", 3.0], ["2", "A", 8.0]]]
  ]);
  toatePatru("tragere nouă · manșa 1", box, 1, true);
  toatePatru("tragere nouă · manșa 2", box, 2, true);
  /* La General, tragerea asta dă aceeași ordine pe puncte și pe kilograme: fiecare a
     pescuit o dată în sectorul tare și o dată în cel slab, deci se echilibrează — chiar
     scopul tragerii la sorți. Nu se cere diferență aici; General cu puncte ≠ kilograme
     e acoperit de scenariul cu absenți. */
  toatePatru("tragere nouă · General", box, "total", false);

  // standul scris pe hârtie trebuie să fie cel al manșei citite, nu cel de acum
  pune(box, "fin", "pct", 1);
  vm.runInContext("printRank();", box);
  const pdfM1 = box.__el["printArea"].innerHTML.split("</table>")[0];
  pune(box, "fin", "pct", 2);
  vm.runInContext("printRank();", box);
  const pdfM2 = box.__el["printArea"].innerHTML.split("</table>")[0];
  const standul = (html, nume) => {
    const m = html.match(new RegExp('<td>' + nume + '</td><td class="c">([^<]*)</td>'));
    return m ? m[1] : null;
  };
  t("PDF-ul manșei 1 scrie standul din manșa 1", standul(pdfM1, "Ana"), "1");
  t("PDF-ul manșei 2 scrie standul din manșa 2", standul(pdfM2, "Ana"), "8");
}

/* ================================================================
   6. Concursul adevărat: Brăila, 23.08
   ================================================================ */
console.log("\n=== 6. Brăila, 23.08 — concurs adevărat ===");
{
  const box = mediu();
  // exact datele din test-scenarii.js §9: 6 oameni în A, 5 în B, cu peștele lui Harry
  asaza(box, 1, false, [
    ["Mimi Fedor",       [["34", "A", 23.010]]],
    ["Hritcu Bogdan",    [["36", "A", 13.760]]],
    ["Calfa Cristi",     [["38", "A", 15.640]]],
    ["Sandel Hartopeanu",[["40", "A",  9.010]]],
    ["Cristi Enache",    [["42", "A", 18.030]]],
    ["Codrin",           [["44", "A",  9.090]]],
    ["Paul Selig",       [["46", "B", 11.610]]],
    ["Fabian Cretu",     [["48", "B", 12.320]]],
    ["Petrica Cazacu",   [["50", "B",  8.930]]],
    ["Danut Hostina",    [["52", "B", 10.000]]],
    ["Harry",            [["54", "B", 20.195, 3.460]]]
  ]);
  toatePatru("Brăila 23.08", box, 1, true);
}

/* ================================================================
   7. „Pe sectoare" rămâne pe kilograme, și pe ecran, și pe hârtie
   ================================================================ */
console.log("\n=== 7. Pe sectoare: kilogramele, peste tot ===");
{
  const box = mediu();
  asaza(box, 1, false, SECTOARE_INEGALE);
  pune(box, "sec", "kg", 1);
  vm.runInContext("renderRank();", box);
  const ecranSec = box.__el["rankBody"].innerHTML;
  vm.runInContext("printRank();", box);
  const pdfSec = box.__el["printArea"].innerHTML;
  const sectorA = vm.runInContext(
    "sortRankS(state.participants.filter(function(p){return sectorOfM(p,1)==='A';}),1).map(function(p){return nameOf(p);})", box);
  const dinEcran = [...ecranSec.matchAll(/<td>([^<]*)<div class="small">/g)].map(m => m[1]).slice(0, 4);
  const dinPdf = [...pdfSec.split("</table>")[1].matchAll(/<td class="c">\d+<\/td><td>([^<]*)<\/td>/g)].map(m => m[1]);
  t("sectorul A de pe ecran e pe kilograme", dinEcran, sectorA);
  t("sectorul A din PDF e același", dinPdf, sectorA);
}

/* ================================================================
   8. Harnașamentul chiar rulează codul livrat
   Dacă vreo ieșire ar fi ocolită (o excepție înghițită, un element care nu se umple),
   verificările de mai sus ar compara liste goale între ele și ar trece toate. Aici se
   cere ca fiecare ieșire să fi produs ceva.
   ================================================================ */
console.log("\n=== 8. Fiecare ieșire chiar a produs ceva ===");
{
  const box = mediu();
  asaza(box, 1, false, SECTOARE_INEGALE);
  pune(box, "fin", "pct", 1);
  t("ecranul a scris un tabel", deLaEcran(box).length, 9);
  t("copierea a dus un text în clipboard", deLaCopiere(box).length, 9);
  t("PDF-ul a umplut printArea", deLaPdf(box).length, 9);
  t("poza are un plan", deLaPoza(box).length, 9);
  t("…și tipărirea chiar s-a cerut", box.__tiparit > 0, true);
}

t.raport();
