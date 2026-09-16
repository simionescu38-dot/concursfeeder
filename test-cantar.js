/**
 * Cântarul de mână — un pescar pe ecran, în ordinea în care mergi pe mal.
 *
 * „stand + nume → greutate → «Salvează și următorul»." Cuvintele lui, de la cei șase pași.
 * Lista sortată pe standuri era jumătatea de drum: ordinea era bună, dar omul tot trebuia
 * căutat în ea. Măsurat pe un telefon de 412px, la un concurs de 24 de pescari: de la
 * standul 1 la 24 erau 13 ecrane de derulat, fiindcă un rând ține 463 de pixeli.
 *
 * Aici se probează inima ideii: CINE urmează. Coada nu se ține minte nicăieri — e chiar
 * starea manșei, citită în ordinea standurilor. De-aia nu poate rămâne în urma
 * adevărului: dacă altcineva cântărește standul 7 de pe telefonul lui, el iese singur
 * din coadă și aici.
 *
 * Codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = [
  "num", "numManse", "manseRange", "emptyManche", "ensureManche", "mOf",
  "standOfM", "sectorOfM", "nameOf", "nameKey", "standKeyM", "byStandM",
  "esteArbitru", "arbAiLui", "stareaLaMansa", "nelamurit", "cantarSir",
];

/** un pescar cu standul și sectorul lui, la manșa 1 */
function om(stand, sector, cum) {
  const m = {};
  for (let i = 1; i <= 3; i++)
    m[i] = { catches: [], catchTimes: [], catchPhotos: [], catchIds: [],
             extras: [], extraTimes: [], extraPhotos: [], extraIds: [],
             stand: "", sector: "", stare: "" };
  m[1].stand = String(stand); m[1].sector = sector;
  if (cum === "cantarit") { m[1].catches = [5.5]; m[1].catchTimes = [1000]; }
  else if (cum) m[1].stare = cum;            /* zero · absent · sarit */
  return { id: "s" + stand, prenume: "Ion", nume: "Pescar" + stand,
           stand: String(stand), sector, m };
}

function pornire(pescari, optiuni) {
  const o = optiuni || {};
  const ctx = {
    console, Math, String, Number, Array, Object, JSON, parseInt, parseFloat, isNaN,
    arbitruMode: !!o.arbitru, arbitruSector: o.sector || "",
    state: { manche: o.mansa || 1, numManse: 2, sectors: ["A", "B", "C"], participants: pescari },
  };
  vm.createContext(ctx);
  vm.runInContext("var STARI_MANSA=" + /var STARI_MANSA\s*=\s*(\{[\s\S]*?\});/.exec(src)[1] + ";", ctx);
  FUNCTII.forEach((f) => vm.runInContext(H.grabFunction(src, f), ctx));
  return ctx;
}
/** standurile din coadă, în ordinea în care le dă aplicația.
    Standul se ia din MANȘA curentă, nu de pe pescar: după o tragere nouă, cele două
    sunt lucruri diferite, iar cel de pe mal e al manșei. */
const sir = (c) => vm.runInContext(
  "cantarSir().map(function(p){ return standOfM(p, state.manche||1); })", c);

/* ================================================================
   1. Ordinea de pe mal
   ================================================================ */
console.log("\n=== 1. Ordinea în care mergi pe mal ===");
{
  const c = pornire([om(3, "A"), om(1, "A"), om(2, "A")]);
  t("coada merge pe standuri, nu pe ordinea înscrierii", sir(c), ["1", "2", "3"]);
}
{
  /* Standurile se scriu și cu litere pe unele bălți („12 B"). Cifra dinăuntru hotărăște. */
  const c = pornire([om("10 A", "A"), om("2 A", "A"), om("1 A", "A")]);
  t("cifra din stand hotărăște, nu litera", sir(c), ["1 A", "2 A", "10 A"]);
}

/* ================================================================
   2. Cine iese din coadă
   ================================================================ */
console.log("\n=== 2. Cine iese din coadă ===");
{
  const c = pornire([om(1, "A", "cantarit"), om(2, "A"), om(3, "A")]);
  t("cine are cifră a ieșit", sir(c), ["2", "3"]);
}
{
  /* „Lampă" e un rezultat, nu o lipsă: omul a fost cântărit și n-a prins. */
  const c = pornire([om(1, "A", "zero"), om(2, "A")]);
  t("„Lampă” îl scoate din coadă", sir(c), ["2"]);
}
{
  const c = pornire([om(1, "A", "absent"), om(2, "A")]);
  t("„Absent” îl scoate și el", sir(c), ["2"]);
}
{
  /* Cine n-a extras stand la manșa asta n-a fost la ea — aplicația o știe singură. */
  const fara = om(0, "A"); fara.m[1].stand = ""; fara.stand = "";
  const c = pornire([fara, om(2, "A")]);
  t("cine n-are stand în manșă nu intră în coadă", sir(c), ["2"]);
}

/* ================================================================
   3. „Revin la el" — amânarea
   ================================================================
   Asta e singura stare care NU scoate din coadă: e o amânare, nu un rezultat. */
console.log("\n=== 3. „Revin la el” ===");
{
  const c = pornire([om(1, "A", "sarit"), om(2, "A"), om(3, "A")]);
  t("cel amânat rămâne în coadă", sir(c).indexOf("1") >= 0, true);
  t("…dar se așază la sfârșit", sir(c), ["2", "3", "1"]);
}
{
  /* Te-ai hotărât o dată să-l amâni: nu ți-l pune înapoi în față la următoarea atingere. */
  const c = pornire([om(1, "A", "sarit"), om(2, "A", "sarit"), om(3, "A")]);
  t("doi amânați stau amândoi la coadă, în ordinea standurilor", sir(c), ["3", "1", "2"]);
}
{
  const c = pornire([om(1, "A", "sarit"), om(2, "A", "cantarit")]);
  t("dacă n-a mai rămas nimeni, amânatul e la rând", sir(c), ["1"]);
}

/* ================================================================
   4. Când s-a terminat
   ================================================================ */
console.log("\n=== 4. Când s-a terminat ===");
{
  const c = pornire([om(1, "A", "cantarit"), om(2, "A", "zero"), om(3, "A", "absent")]);
  t("toți lămuriți → coada e goală", sir(c), []);
}
{
  t("fără niciun pescar, coada e goală", sir(pornire([])), []);
}

/* ================================================================
   5. Arbitrul are coada lui
   ================================================================ */
console.log("\n=== 5. Coada arbitrului ===");
{
  const toti = [om(1, "A"), om(2, "A"), om(9, "B"), om(10, "B"), om(17, "C")];
  const c = pornire(toti, { arbitru: true, sector: "C" });
  t("arbitrul vede numai sectorul lui", sir(c), ["17"]);

  const b = pornire(toti, { arbitru: true, sector: "B" });
  t("…fiecare pe al lui", sir(b), ["9", "10"]);

  /* Cine ia toată balta îi are pe toți, ca organizatorul. */
  const tot = pornire(toti, { arbitru: true, sector: "" });
  t("arbitrul fără sector îi are pe toți", sir(tot), ["1", "2", "9", "10", "17"]);

  const org = pornire(toti);
  t("organizatorul îi are pe toți", sir(org), ["1", "2", "9", "10", "17"]);
}

/* ================================================================
   6. Fiecare manșă are coada ei
   ================================================================ */
console.log("\n=== 6. Manșa a doua ===");
{
  /* După o tragere nouă, standurile se schimbă. Coada merge pe standurile manșei
     CURENTE, nu pe cele din manșa 1 — altfel ai umbla pe mal după o hârtie veche. */
  const a = om(1, "A", "cantarit");
  a.m[2].stand = "20"; a.m[2].sector = "C";
  const b = om(2, "A", "cantarit");
  b.m[2].stand = "5"; b.m[2].sector = "A";

  const m1 = pornire([a, b], { mansa: 1 });
  t("manșa 1 e cântărită", sir(m1), []);

  const m2 = pornire([a, b], { mansa: 2 });
  t("manșa 2 pornește de la capăt", sir(m2).length, 2);
  t("…pe standurile ei, nu pe cele vechi", sir(m2), ["5", "20"]);
}

/* ================================================================
   7. Ce scrie pe ecran
   ================================================================ */
console.log("\n=== 7. Pe ecran ===");
{
  const coaja = H.grabFunction(src, "construiesteCantarul");
  t("butonul mare e unul singur",
    (coaja.match(/btn-primary/g) || []).length, 1);
  /* Numele sunt ale lui, din STARI_MANSA — nu unele scornite de mine. */
  t("scrie „Lampă”, cuvântul lui", /Lampă/.test(coaja), true);
  t("…și „Revin la el”, tot al lui", /Revin la el/.test(coaja), true);
  /* „Absent" e a treia stare, și e alta decât „Lampă": lampă înseamnă a pescuit și n-a
     prins — ia locul lui în sector. Absent înseamnă n-a fost acolo, și ia un punct peste
     ultimul loc, ca absența să nu iasă niciodată mai bine decât prezența.
     Lipsea de pe cântar: la 36 de înscriși cineva sigur nu vine, iar fără el singurele
     alegeri erau amândouă greșite. */
  t("…și „Absent”, care lipsea", /Absent/.test(coaja), true);
  t("cele trei stări sunt toate pe cântar",
    ["zero", "absent", "sarit"].every((k) => coaja.indexOf("cantarStare(\\'" + k + "\\')") >= 0), true);
  t("câmpul cheamă tastatura de cifre", /inputmode="decimal"/.test(coaja), true);
  /* Apostrofurile sunt scăpate cu „\” înăuntrul șirului din care se scrie HTML-ul,
     deci se caută după înțeles, nu după forma exactă. */
  t("…și Enter salvează, ca în restul aplicației",
    /event\.key===[^)]*Enter[\s\S]{0,60}cantarSalveaza\(\)/.test(coaja), true);

  const deseneaza = H.grabFunction(src, "deseneazaCantarul");
  t("cine doar privește nu vede cântarul", /isLocked\(\) \|\| viewerMode/.test(deseneaza), true);
  t("butonul spune unde mergi după", /mergi la/.test(deseneaza), true);
  t("…iar la ultimul spune că e ultimul", /gata manșa/.test(deseneaza), true);
  /* Coaja se face o singură dată: altfel câmpul ar fi alt câmp la fiecare pește, iar
     tastatura telefonului s-ar închide în mâna omului. */
  t("coaja se face o singură dată", /box\.dataset\.gata/.test(H.grabFunction(src, "construiesteCantarul")), true);

  const salv = H.grabFunction(src, "cantarSalveaza");
  t("fără cifră nu salvează", /!\(v>0\)/.test(salv), true);
  t("…și te trimite la „Lampă”", /Lampă/.test(salv), true);
  t("lacătul oprește și cântarul", /guard\(\)/.test(salv), true);
}

/* ================================================================
   7b. Absent nu e totuna cu lampă
   ================================================================ */
console.log("\n=== 7b. Absent ≠ Lampă ===");
{
  /* Amândouă scot omul din coadă, dar la punctaj sunt lucruri diferite. */
  const c = pornire([om(1, "A", "absent"), om(2, "A", "zero"), om(3, "A", "cantarit")]);
  t("amândouă îl scot din coadă", sir(c), []);
  t("…dar starea rămâne a lui",
    vm.runInContext("[stareaLaMansa(state.participants[0],1), stareaLaMansa(state.participants[1],1)]", c),
    ["absent", "zero"]);
}

/* ================================================================
   8. Cântarul stă în treapta manșei, primul
   ================================================================ */
console.log("\n=== 8. Locul lui în scară ===");
{
  const muta = /var MUTA = \{[\s\S]*?\};/.exec(src)[0];
  const t4 = /4: \[([\s\S]*?)\]/.exec(muta)[1].replace(/\s+/g, " ");
  t("cântarul e PRIMUL în treapta manșei", /^\s*"cantar-mana"/.test(t4), true);
  t("…iar lista tuturor e acolo ca pliant", /"pliant-toti"/.test(t4), true);
  t("…și nu mai stă desfăcută", /"list"/.test(t4), false);

  const ordine = /var ORDINE_DEPOZIT = \[[\s\S]*?\];/.exec(src)[0];
  t("pe ecranul arbitrului stă tot primul",
    /ORDINE_DEPOZIT = \["cantar-mana"/.test(ordine.replace(/\s+/g, " ")), true);

  /* Panoul treptei (ceasul, cifrele, liderul) trece dedesubt: se privește între doi
     pești, nu se atinge. Măsurat: stătea 228px deasupra cântarului și creștea cu 45 la
     primul pește — adică ecranul se ducea în jos tocmai sub degetul omului. */
  t("panoul treptei trece sub cântar",
    /nr === 4[\s\S]{0,200}tr-btn-[\s\S]{0,120}appendChild\(panou\)/.test(H.grabFunction(src, "mutaInTreapta")), true);
}

t.raport();
