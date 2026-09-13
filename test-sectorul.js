/**
 * Clasamentul sectorului, chiar sub cântar.
 *
 * „Desfășori manșa — programul și cântăririle, cu clasamentul imediat dedesubt."
 *
 * Până acum clasamentul era pe alt ecran. În mijlocul manșei te duceai până acolo dintr-un
 * singur motiv: să vezi unde a intrat cel pe care tocmai l-ai cântărit. Blocul ăsta
 * răspunde exact la atât — sectorul în care ești, primii cinci, plus ultimul cântărit dacă
 * n-a intrat între ei.
 *
 * Nu tot clasamentul: ăla se uită la final, nu în manșă, și ar împinge lista de pescari
 * sub marginea ecranului.
 *
 * Codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = [
  "num", "fmt", "esc", "numManse", "manseRange", "emptyManche", "ensureManche",
  "mOf", "sectorOfM", "standOfM", "nameOf", "cantOfM", "extraOfM", "totalOfM",
  "byStand", "sortRankS", "esteArbitru", "stareaLaMansa",
  "sectorulDeAcum", "deseneazaSectorul",
];

/** un pescar cu standul, sectorul și cântăririle lui, cu ORELE lor */
function om(id, stand, sector, kg, ora) {
  const m = {};
  for (let i = 1; i <= 3; i++)
    m[i] = { catches: [], catchTimes: [], catchPhotos: [], catchIds: [],
             extras: [], extraTimes: [], extraPhotos: [], extraIds: [],
             stand: "", sector: "", stare: "" };
  m[1].stand = String(stand); m[1].sector = sector;
  if (kg !== undefined && kg !== null) { m[1].catches = [kg]; m[1].catchTimes = [ora || 1000]; }
  return { id, prenume: "Ion", nume: id.toUpperCase(), stand: String(stand), sector, m };
}

function pornire(pescari, optiuni) {
  const o = optiuni || {};
  const cutie = { innerHTML: "", style: {} };
  const ctx = {
    console, Math, String, Number, Array, Object, JSON, parseInt, parseFloat, isNaN,
    arbitruMode: !!o.arbitru, arbitruSector: o.sector || "",
    state: { manche: o.mansa || 1, numManse: 2, sectors: ["A", "B"], participants: pescari },
    document: { getElementById: (id) => (id === "sectorul" ? cutie : null) },
  };
  vm.createContext(ctx);
  vm.runInContext("var STARI_MANSA=" + /var STARI_MANSA\s*=\s*(\{[\s\S]*?\});/.exec(src)[1] + ";", ctx);
  FUNCTII.forEach((f) => vm.runInContext(H.grabFunction(src, f), ctx));
  ctx.__cutie = cutie;
  return ctx;
}
const deseneaza = (c) => { vm.runInContext("deseneazaSectorul()", c); return c.__cutie; };
/** rândurile desenate: [loc, „stand nume", kg], plus dacă e cel tocmai cântărit */
function randuri(cutie) {
  return (cutie.innerHTML.match(/<div class="sl-r[^"]*">[\s\S]*?<\/div><\/div>|<div class="sl-r[^"]*">.*?<\/span><\/div>/g) || [])
    .map((r) => {
      const c = r.match(/class="sl-r([^"]*)"/)[1];
      const s = [...r.matchAll(/<span class="sl-(loc|nm|kg)">(.*?)<\/span>/g)].map((m) => m[2]);
      return { loc: s[0], cine: s[1], kg: s[2], acum: /\bacum\b/.test(c), rupt: /sl-rupt/.test(c) };
    });
}
const titlu = (cutie) => (cutie.innerHTML.match(/<div class="sl-t">(.*?)<\/div>/) || [])[1] || "";

/* ================================================================
   1. Când NU se desenează deloc
   ================================================================ */
console.log("\n=== 1. Când nu are ce arăta ===");
{
  /* Un concurs în care n-a cântărit nimeni n-are „sector în care ești": blocul ar fi o
     cutie goală lipită sus, exact felul de balast pe care l-am scos din aplicație. */
  const c = pornire([om("a", 1, "A"), om("b", 2, "A")]);
  const cutie = deseneaza(c);
  t("nimeni cântărit → blocul nu se vede", cutie.style.display, "none");
  t("…și nici nu lasă ceva desenat", cutie.innerHTML, "");
}
{
  const c = pornire([om("a", 1, "A", 3, 1000)]);
  t("un singur om în sector → n-ai ce clasament să vezi", deseneaza(c).style.display, "none");
}

{
  /* Hiba găsită la probă, nu la citit: cu tot sectorul înăuntru, la începutul manșei
     blocul era o listă de zerouri cu un singur nume adevărat în vârf. */
  const c = pornire([om("a", 1, "A", 3, 1000), om("b", 2, "A"), om("c", 3, "A"), om("d", 4, "A")]);
  t("unul cântărit din patru → tot nu se desenează", deseneaza(c).style.display, "none");
}
{
  const c = pornire([om("a", 1, "A", 3, 1000), om("b", 2, "A", 8, 2000), om("c", 3, "A"), om("d", 4, "A")]);
  const r = randuri(deseneaza(c));
  t("doi cântăriți din patru → DOUĂ rânduri, nu patru", r.length, 2);
  t("…cei necântăriți nu apar cu zero", r.map((x) => x.kg), ["8,000", "3,000"]);
}
{
  /* Lampa e un rezultat: omul a pescuit și n-a prins. Intră în clasament, pe ultimul loc. */
  const c = pornire([om("a", 1, "A", 3, 1000), om("b", 2, "A", 8, 2000), om("c", 3, "A")]);
  c.state.participants[2].m[1].stare = "zero";
  const r = randuri(deseneaza(c));
  t("lampa intră în clasament", r.map((x) => x.cine), ["2 Ion B", "1 Ion A", "3 Ion C"]);
  t("…cu zero kilograme", r[2].kg, "0");
}
{
  /* Absentul nu: el n-a pescuit, n-are ce loc să ocupe. */
  const c = pornire([om("a", 1, "A", 3, 1000), om("b", 2, "A", 8, 2000), om("c", 3, "A")]);
  c.state.participants[2].m[1].stare = "absent";
  t("absentul nu intră", randuri(deseneaza(c)).map((x) => x.cine), ["2 Ion B", "1 Ion A"]);
}

/* ================================================================
   2. Sectorul ales e unde ai cântărit ULTIMA oară
   ================================================================ */
console.log("\n=== 2. În ce sector ești ===");
{
  /* Organizatorul umblă prin toate sectoarele. „Unde ești" nu poate fi o setare pe care
     s-o țină el minte — e locul unde tocmai a pus o greutate. */
  const c = pornire([
    om("a", 1, "A", 3, 1000), om("b", 2, "A", 4, 2000),
    om("c", 11, "B", 5, 9000), om("d", 12, "B", 6, 3000),
  ]);
  const cutie = deseneaza(c);
  t("sectorul e cel al ultimei cântăriri", titlu(cutie), "Sector B · manșa 1");
  t("…și se văd doar oamenii lui", randuri(cutie).map((r) => r.cine), ["12 Ion D", "11 Ion C"]);
}
{
  /* Arbitrul are un singur sector, ales de el. Nu se mută după cine a cântărit ultimul —
     el răspunde de sectorul lui, chiar dacă altcineva a cântărit între timp în altul. */
  const c = pornire([
    om("a", 1, "A", 3, 1000), om("b", 2, "A", 4, 2000),
    om("c", 11, "B", 5, 9000), om("d", 12, "B", 6, 3000),
  ], { arbitru: true, sector: "A" });
  t("arbitrul rămâne în sectorul lui", titlu(deseneaza(c)), "Sector A · manșa 1");
}

/* ================================================================
   3. Ordinea și cifrele
   ================================================================ */
console.log("\n=== 3. Ce scrie în rânduri ===");
{
  const c = pornire([
    om("a", 1, "A", 3.2, 1000), om("b", 2, "A", 8.94, 2000),
    om("c", 3, "A", 6.11, 3000), om("d", 4, "A", 4.2, 9000),
  ]);
  const r = randuri(deseneaza(c));
  t("patru rânduri", r.length, 4);
  t("…în ordinea kilogramelor", r.map((x) => x.kg), ["8,940", "6,110", "4,200", "3,200"]);
  t("…cu locurile scrise", r.map((x) => x.loc), ["1", "2", "3", "4"]);
  t("…cu standul în fața numelui", r[0].cine, "2 Ion B");
  /* Ăsta e motivul pentru care există blocul: să vezi unde a intrat ultimul, fără să-l cauți. */
  t("cel tocmai cântărit e însemnat", r.filter((x) => x.acum).map((x) => x.cine), ["4 Ion D"]);
  t("…și e singurul însemnat", r.filter((x) => x.acum).length, 1);
}

/* ================================================================
   4. Primii cinci, plus ultimul cântărit
   ================================================================ */
console.log("\n=== 4. Un sector mare ===");
{
  /* Opt oameni într-un sector. Cinci rânduri, nu opt: blocul stă deasupra listei de
     pescari, iar fiecare rând în plus împinge cântarul mai jos. */
  const kg = [9, 8, 7, 6, 5, 4, 3, 2];
  const c = pornire(kg.map((k, i) => om("p" + i, i + 1, "A", k, 1000 + i)));
  const r = randuri(deseneaza(c));
  t("opt oameni, dar cinci rânduri", r.length, 5);
  t("…primii patru", r.slice(0, 4).map((x) => x.loc), ["1", "2", "3", "4"]);
  /* Al optulea a fost cântărit ultimul și e pe locul 8. Apare cu locul LUI, nu al cincilea. */
  t("…iar ultimul cântărit se adaugă, cu locul lui adevărat", r[4].loc, "8");
  t("…însemnat ca atare", r[4].acum, true);
  t("…și despărțit printr-o linie, ca să nu pară al cincilea", r[4].rupt, true);
}
{
  /* Dacă ultimul cântărit e DEJA între primii cinci, nu se scrie de două ori. */
  const kg = [9, 8, 7, 6, 5, 4, 3, 2];
  const c = pornire(kg.map((k, i) => om("p" + i, i + 1, "A", k, i === 0 ? 9000 : 1000 + i)));
  const r = randuri(deseneaza(c));
  t("primul e și ultimul cântărit → patru rânduri, nu cinci", r.length, 4);
  t("…și apare o singură dată", r.filter((x) => x.acum).length, 1);
  t("…pe locul 1", r.filter((x) => x.acum)[0].loc, "1");
}

/* ================================================================
   5. Manșa
   ================================================================ */
console.log("\n=== 5. Manșa scrisă în titlu ===");
{
  const c = pornire([om("a", 1, "A", 3, 1000), om("b", 2, "A", 4, 2000)], { mansa: 2 });
  /* Cântăririle de mai sus sunt în manșa 1; manșa 2 e goală, deci n-are ce arăta. */
  t("manșa 2 goală → nu se desenează", deseneaza(c).style.display, "none");

  const c2 = pornire([om("a", 1, "A", 3, 1000), om("b", 2, "A", 4, 2000)]);
  t("titlul scrie manșa, ca să nu treci cifre în cea greșită",
    /manșa 1$/.test(titlu(deseneaza(c2))), true);
}

/* ================================================================
   6. Codul e chemat de unde trebuie
   ================================================================ */
console.log("\n=== 6. Unde stă și când se împrospătează ===");
{
  /* După o cântărire (refreshCard) și la fiecare redesenare a listei — altfel blocul ar
     rămâne pe cifrele de acum un sfert de oră. */
  t("se redesenează după fiecare cântărire",
    /function refreshCard[\s\S]{0,600}deseneazaSectorul\(\)/.test(src), true);
  t("…și la fiecare redesenare a listei",
    /function renderList[\s\S]{0,400}deseneazaSectorul\(\)/.test(src), true);
  /* Stă sub cifrele de sus, nu la capătul listei: după o cântărire nu derulezi peste 33
     de pescari ca să vezi ce s-a schimbat. */
  t("stă deasupra listei de pescari",
    src.indexOf('id="sectorul"') < src.indexOf('<div id="list">'), true);
  t("…și deasupra căsuței de căutare",
    src.indexOf('id="sectorul"') < src.indexOf('id="search-part"'), true);
  t("…dar sub cifrele de sus",
    src.indexOf('id="st-total"') < src.indexOf('id="sectorul"'), true);
}

/* ================================================================
   7. „Ies din arbitraj" — o hibă veche, găsită în poza de la 412px
   ================================================================
   Butonul are „hidden" scris în pagină de la început, dar `.arb-iesire{display:block}` îl
   bate: un atribut nu e mai tare decât o regulă de clasă. Adică se vedea TOT timpul, și
   organizatorului, pe ecranul de cântar — iar apăsat, îi strica singur camera. */
console.log("\n=== 7. Butonul arbitrului stă ascuns ===");
{
  t("butonul e scris cu hidden în pagină",
    /class="arb-iesire" id="arb-iesire" hidden/.test(src), true);
  t("…și acum există regula care chiar îl ascunde",
    /\.arb-iesire\[hidden\]\{display:none;\}/.test(src), true);
  /* Ordinea contează: regula trebuie să vină DUPĂ display:block, altfel n-are efect. */
  t("…scrisă după cea care îl arăta",
    src.indexOf(".arb-iesire{") < src.indexOf(".arb-iesire[hidden]"), true);
  t("…iar intrarea în arbitraj tot îl arată",
    /arbitruMode = true;[\s\S]{0,400}arb-iesire"\); if\(bi\) bi\.hidden=false;/.test(src), true);
}

t.raport();
