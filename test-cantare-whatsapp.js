/**
 * Cântarele lipite de pe WhatsApp.
 *
 * „Practic tot eu trebuie să fac manual toate cântarele, luate de pe WhatsApp, sau să le
 * trec când sunt la baltă manual, după concurs… când deja eu tot pe hârtie le fac."
 *
 * Măsurat pe telefon de 412px, cu 20 de pescari pe ecranul de Cântar: un card de pescar
 * are 405px, încap 2,3 pe ecran, lista are 9072px = 10 ecrane. Ca să treci 20 de juvelnice
 * îți trebuie 40 de atingeri și 9 derulări. Pe hârtie sunt 20 de numere scrise într-o
 * coloană. De-aia câștiga hârtia, și de-aia se făcea totul de două ori.
 *
 * Aici se lipește mesajul de pe grup și intră toate deodată — dar numai după ce se vede
 * pe ecran ce s-a înțeles din el. Un cântar intrat pe cine nu trebuie e mai rău decât unul
 * netrecut: netrecutul se vede, cel greșit nu.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = ["num", "fmt", "esc", "uid", "numManse", "manseRange", "emptyManche", "ensureManche", "mOf",
  "sectorOfM", "standOfM", "nameOf", "cantOfM", "extraOfM", "totalOfM", "scrieInJurnal",
  "faraSemne", "greutateaRandului", "citesteCantare", "pescarulCantarului", "randuriCantare",
  "verificaCantare", "treceCantare"];

/** un context cu starea unui concurs adevărat și cu DOM-ul strict cât îi trebuie */
function pornire(pescari, optiuni) {
  const o = optiuni || {};
  const camp = { value: o.text || "" };
  const preview = { innerHTML: "" };
  const stTotal = { textContent: "" };
  const ctx = {
    console, JSON, Date, Math, parseInt, parseFloat, isNaN,
    blocat: !!o.blocat,
    intrebat: [], raspunsLaConfirm: o.confirma !== false,
    toasturi: [], salvat: 0, desenat: 0, copii: [],
    strigate: [],
    document: {
      getElementById(id) {
        if (id === "cnt-text") return camp;
        if (id === "cnt-preview") return preview;
        if (id === "st-total") return stTotal;
        return null;
      }
    },
    guard() { return ctx.blocat; },
    confirm(q) { ctx.intrebat.push(q); return ctx.raspunsLaConfirm; },
    toast(m) { ctx.toasturi.push(m); },
    queueSave() { ctx.salvat++; },
    renderList() { ctx.desenat++; },
    improspateazaCantariti() {},
    puneDeoParte(motiv) { ctx.copii.push(motiv); },
    sumAll() { return 0; },
    // dacă vreuna dintre astea ar fi chemată la import, s-ar auzi 20 de anunțuri odată
    announceCatch(p, v) { ctx.strigate.push("anunt:" + v); },
    showNewLeader(p) { ctx.strigate.push("lider"); },
    speak(x) { ctx.strigate.push("vorbit"); }
  };
  ctx.camp = camp; ctx.preview = preview; ctx.stTotal = stTotal;
  ctx.state = {
    name: "Probă", manche: o.mansa || 1, numManse: 2, sectors: ["A", "B"], jurnal: [],
    participants: pescari.map((x, i) => ({
      id: "p" + i, prenume: x.prenume, nume: x.nume, stand: x.stand, sector: x.sector || "A",
      m: { 1: { catches: (x.catches || []).slice(), catchTimes: [], catchPhotos: [], extras: [], extraTimes: [], extraPhotos: [], stand: x.stand, sector: x.sector || "A" },
           2: { catches: [], catchTimes: [], catchPhotos: [], extras: [], extraTimes: [], extraPhotos: [], stand: x.standM2 !== undefined ? x.standM2 : x.stand, sector: x.sector || "A" } }
    }))
  };
  vm.createContext(ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  return ctx;
}

/** cei 14 de pe foaia adevărată de la Rediu Galian, cu diacritice cu tot */
const LOT = [
  { stand: "1", prenume: "Remus", nume: "Catalin" },
  { stand: "2", prenume: "Mihai", nume: "Ionescu" },
  { stand: "3", prenume: "Vasile", nume: "Popescu" },
  { stand: "4", prenume: "David", nume: "Caramb" },
  { stand: "5", prenume: "Ștefan", nume: "Bălan" },
  { stand: "6", prenume: "Cristi", nume: "Enache" },
  { stand: "7", prenume: "Ion", nume: "Țăranu" },
  { stand: "8", prenume: "TOX", nume: "" }
];

const citeste = (ctx, text) => vm.runInContext("citesteCantare(" + JSON.stringify(text) + ")", ctx);
const randuri = (ctx, text) => vm.runInContext(
  "randuriCantare(" + JSON.stringify(text) + ").map(function(x){" +
  "return {stand:x.stand, nume:x.nume, kg:x.kg, cine:x.p?nameOf(x.p):null, cum:x.cum," +
  " nepotrivire:x.nepotrivire, deja:x.deja};})", ctx);

/* ================================================================
   1. Ce se citește dintr-un rând
   ================================================================ */
console.log("\n=== 1. Formele în care vin cântarele pe grup ===");
{
  const c = pornire(LOT);
  const unul = txt => { const r = citeste(c, txt); return r.length ? { stand: r[0].stand, nume: r[0].nume, kg: r[0].kg } : null; };

  t("stand, nume, kg", unul("1 Mihai Ionescu 12,340"), { stand: "1", nume: "Mihai Ionescu", kg: 12.34 });
  t("numerotat cu punct", unul("1. Mihai Ionescu 12,340"), { stand: "1", nume: "Mihai Ionescu", kg: 12.34 });
  t("numerotat lipit", unul("1.Mihai Ionescu 12,340"), { stand: "1", nume: "Mihai Ionescu", kg: 12.34 });
  t("cu liniuțe între", unul("1 - Mihai Ionescu - 12,340"), { stand: "1", nume: "Mihai Ionescu", kg: 12.34 });
  t("cu virgule între", unul("1, Mihai Ionescu, 12,340"), { stand: "1", nume: "Mihai Ionescu", kg: 12.34 });
  t("cu „kg\" la coadă", unul("1 Mihai Ionescu 12,340 kg"), { stand: "1", nume: "Mihai Ionescu", kg: 12.34 });
  t("cu „Stand\" în față", unul("Stand 1 Mihai Ionescu 12,340"), { stand: "1", nume: "Mihai Ionescu", kg: 12.34 });
  t("cu „St.\" în față", unul("St. 1 Mihai Ionescu 12,340"), { stand: "1", nume: "Mihai Ionescu", kg: 12.34 });
  t("numai standul și kg", unul("1 12,340"), { stand: "1", nume: "", kg: 12.34 });
  t("numai numele și kg", unul("Mihai Ionescu 12,340"), { stand: "", nume: "Mihai Ionescu", kg: 12.34 });
  t("nume: kg (fără stand)", unul("Ionescu: 12,340"), { stand: "", nume: "Ionescu", kg: 12.34 });
  t("punctul ca zecimală", unul("1 Mihai Ionescu 12.340"), { stand: "1", nume: "Mihai Ionescu", kg: 12.34 });
  t("greutate întreagă", unul("1 Mihai Ionescu 12"), { stand: "1", nume: "Mihai Ionescu", kg: 12 });
  t("sub un kil", unul("1 Mihai Ionescu 0,850"), { stand: "1", nume: "Mihai Ionescu", kg: 0.85 });

  /* Mesajul copiat cu tot cu ora și cine l-a scris. Cine l-a scris se taie DOAR aici —
     la „Ionescu: 12,340" ar fi tăiat chiar pescarul (proba de mai sus). */
  t("copiat întreg din WhatsApp",
    unul("[12:45, 28.08.2026] Cristi: 1 Mihai Ionescu 12,340"), { stand: "1", nume: "Mihai Ionescu", kg: 12.34 });
}

/* ================================================================
   2. Care număr de pe rând e greutatea
   ================================================================ */
console.log("\n=== 2. Care număr e cântarul ===");
{
  const c = pornire(LOT);
  const kg = txt => { const r = citeste(c, txt); return r.length ? r[0].kg : null; };

  /* Buba care ar fi trecut neobservată: un rând de clasament are punctele la coadă. Cu
     „ultimul număr", Ionescu ar fi intrat cu 15 kg în loc de 12,340. */
  t("punctele de la coadă nu sunt cântarul", kg("1. Mihai Ionescu 12,340 — 15 puncte"), 12.34);
  t("nici locul din față", kg("Locul 1 Mihai Ionescu 12,340"), 12.34);
  t("ora din rând nu e cântarul", kg("1 Mihai Ionescu 12,340 la 14:30"), 12.34);
}

/* ================================================================
   3. Ce NU e cântar — și se spune, nu se înghite
   ================================================================ */
console.log("\n=== 3. Rândurile care nu sunt cântare ===");
{
  const c = pornire(LOT);
  const r = citeste(c, [
    "Rezultate Rediu Galian 27.08.2026",
    "1 Mihai Ionescu 12,340",
    "7 Ion Țăranu",
    "2 Vasile Popescu 8,150",
    "Felicitari tuturor!"
  ].join("\n"));

  t("ies doar cele două cântare", r.length, 2);
  /* „7 Ion Țăranu" e un pescar necântărit, nu 7 kg. Dacă ar intra ca greutate, un rând
     uitat pe grup s-ar transforma într-un cântar din senin. */
  t("un pescar fără greutate nu devine 7 kg", r.some(x => x.kg === 7), false);
  t("rândurile sărite se raportează", r.sarite.length, 3);
  t("…și se spun pe nume", r.sarite.indexOf("7 Ion Țăranu") >= 0, true);
  t("titlul cu dată nu devine cântar", r.some(x => /Rediu/.test(x.nume)), false);
}

/* ================================================================
   4. Pe cine cade cântarul
   ================================================================ */
console.log("\n=== 4. Potrivirea cu pescarul ===");
{
  const c = pornire(LOT);
  const unul = txt => randuri(c, txt)[0];

  t("după stand", unul("4 12,340").cine, "David Caramb");
  t("…și se spune că după stand", unul("4 12,340").cum, "stand");
  t("după nume întreg", unul("David Caramb 12,340").cine, "David Caramb");
  t("după nume pe dos", unul("Caramb David 12,340").cine, "David Caramb");
  t("după nume cu litere mici", unul("david caramb 12,340").cine, "David Caramb");
  t("numai după numele de familie", unul("Caramb 12,340").cine, "David Caramb");

  /* Pe grup unul scrie cu diacritice, altul fără. Aceeași persoană. */
  t("fără diacritice, tot el e", unul("Stefan Balan 12,340").cine, "Ștefan Bălan");
  t("cu diacritice, tot el e", unul("Țăranu 9,100").cine, "Ion Țăranu");
  t("un nume scurt, tot majuscule", unul("TOX 4,200").cine, "TOX");

  t("cine nu e în listă rămâne pe dinafară", unul("Gigel Necunoscut 5,000").cine, null);
  t("…și se spune de ce", unul("Gigel Necunoscut 5,000").cum, "negasit");
  t("un stand care nu există nu inventează pescar", unul("99 5,000").cine, null);
}
{
  /* Doi frați cu același nume de familie: nu se ghicește niciodată. Un cântar pus pe cine
     nu trebuie nu se mai vede — spre deosebire de unul netrecut. */
  const c = pornire([
    { stand: "1", prenume: "Ion", nume: "Popa" },
    { stand: "2", prenume: "Vasile", nume: "Popa" }
  ]);
  const r = randuri(c, "Popa 12,340")[0];
  t("doi cu același nume — nu se alege niciunul", r.cine, null);
  t("…și se spune că sunt doi", r.cum, "doi");
  t("cu prenumele, se alege cel bun", randuri(c, "Vasile Popa 12,340")[0].cine, "Vasile Popa");
}

/* ================================================================
   5. Standul spune una, numele alta
   ================================================================ */
console.log("\n=== 5. Când lista e de la altă tragere la sorți ===");
{
  const c = pornire(LOT);
  const r = randuri(c, "2 David Caramb 12,340")[0];
  t("standul are întâietate", r.cine, "Mihai Ionescu");
  /* Dar nu în tăcere: dacă lista lipită e de la altă tragere, TOATE cântarele ar cădea
     pe cine nu trebuie. Se arată pe ecran, ca omul să se prindă din primul rând. */
  t("…dar nepotrivirea se strigă", r.nepotrivire, true);
  t("când numele se potrivește, nu se strigă degeaba", randuri(c, "2 Mihai Ionescu 12,340")[0].nepotrivire, false);
  t("nici când rândul n-are nume", randuri(c, "2 12,340")[0].nepotrivire, false);
}

/* ================================================================
   6. Cine are deja cântar
   ================================================================ */
console.log("\n=== 6. Cei cântăriți deja ===");
{
  const c = pornire([
    { stand: "1", prenume: "Mihai", nume: "Ionescu", catches: [10.5] },
    { stand: "2", prenume: "Vasile", nume: "Popescu" }
  ]);
  const r = randuri(c, "1 12,340\n2 8,150");
  t("cel cântărit e însemnat", r[0].deja, true);
  t("cel gol, nu", r[1].deja, false);
}

/* ================================================================
   7. Trecerea propriu-zisă
   ================================================================ */
console.log("\n=== 7. Ce se scrie în concurs ===");
{
  const c = pornire(LOT, { text: "1 Remus Catalin 12,340\n2 Mihai Ionescu 8,150\n4 6,700" });
  vm.runInContext("treceCantare()", c);

  const kg = id => vm.runInContext("state.participants[" + id + "].m[1].catches", c);
  t("primul a primit cântarul", kg(0), [12.34]);
  t("al doilea la fel", kg(1), [8.15]);
  t("al treilea, găsit doar după stand", kg(3), [6.7]);
  t("ceilalți au rămas goi", kg(2), []);

  t("s-a întrebat înainte", c.intrebat.length, 1);
  t("…și întrebarea spune câte și în ce manșă", /Treci 3 cântare în manșa 1\?/.test(c.intrebat[0]), true);
  t("s-a pus o copie deoparte", c.copii, ["înainte de cântarele de pe WhatsApp"]);
  t("s-a salvat", c.salvat > 0, true);
  t("s-a redesenat lista", c.desenat > 0, true);
  t("câmpul s-a golit", c.camp.value, "");
  t("s-a spus câte au intrat", /3 cântare trecute/.test(c.toasturi.join(" ")), true);

  /* Douăzeci de anunțuri unul peste altul, la o singură apăsare, ar fi de nesuportat —
     și niciunul n-ar mai însemna ceva. Cine s-a schimbat se vede în clasament. */
  t("nu se strigă nimic la import", c.strigate, []);

  const j = vm.runInContext("state.jurnal", c);
  t("fiecare cântar a intrat în jurnal", j.length, 3);
  t("…cu greutatea", j.map(x => x.kg), [12.34, 8.15, 6.7]);
  t("…cu totalul de dinainte și de după", [j[0].inainte, j[0].dupa], [0, 12.34]);
  /* Peste o lună, la o contestație, trebuie să se vadă care cântar a fost trecut la baltă
     și care lipit de pe grup. */
  t("…și cu de unde a venit", j[0].cine, "de pe WhatsApp");
  t("cântarele trecute de mână rămân „Organizator\"",
    /cine: cine\|\|"Organizator"/.test(H.grabFunction(src, "scrieInJurnal")), true);
}

/* ================================================================
   8. Ce NU trebuie să se întâmple
   ================================================================ */
console.log("\n=== 8. Paze ===");
{
  // pe telefonul dat altcuiva să se uite, nu se scrie nimic
  const c = pornire(LOT, { text: "1 12,340", blocat: true });
  vm.runInContext("treceCantare()", c);
  t("pe telefonul blocat nu intră nimic", vm.runInContext("state.participants[0].m[1].catches", c), []);
  t("…și nici nu se întreabă", c.intrebat.length, 0);
}
{
  // dacă omul se răzgândește la întrebare, nu se scrie nimic
  const c = pornire(LOT, { text: "1 12,340", confirma: false });
  vm.runInContext("treceCantare()", c);
  t("dacă răspunde „nu\", nu intră nimic", vm.runInContext("state.participants[0].m[1].catches", c), []);
  t("…și nici copia nu se pune degeaba", c.copii, []);
}
{
  /* Al doilea „Trece cântarele" pe același text ar dubla toate greutățile. Cine are deja
     cântar se sare — de-aia contează. */
  const c = pornire(LOT, { text: "1 12,340" });
  vm.runInContext("treceCantare()", c);
  c.camp.value = "1 12,340";
  vm.runInContext("treceCantare()", c);
  t("a doua lipire nu dublează cântarul", vm.runInContext("state.participants[0].m[1].catches", c), [12.34]);
  t("…și se spune că n-a fost nimic de trecut", /Niciun cântar de trecut/.test(c.toasturi.join(" ")), true);
}
{
  // cântarele intră în manșa deschisă, nu într-alta
  const c = pornire(LOT, { text: "1 12,340", mansa: 2 });
  vm.runInContext("treceCantare()", c);
  t("intră în manșa 2, nu în 1", vm.runInContext("state.participants[0].m[2].catches", c), [12.34]);
  t("…iar manșa 1 rămâne goală", vm.runInContext("state.participants[0].m[1].catches", c), []);
}
{
  // un text fără niciun cântar nu strică nimic
  const c = pornire(LOT, { text: "Felicitari tuturor!\nNe vedem duminica." });
  vm.runInContext("treceCantare()", c);
  t("un mesaj fără cifre nu scrie nimic", vm.runInContext("state.jurnal.length", c), 0);
  t("…și nu se întreabă degeaba", c.intrebat.length, 0);
}

/* ================================================================
   9. „Verifică" — ce vede omul înainte să apese
   ================================================================ */
console.log("\n=== 9. Ce arată „Verifică\" ===");
{
  const c = pornire([
    { stand: "1", prenume: "Mihai", nume: "Ionescu", catches: [10.5] },
    { stand: "2", prenume: "Vasile", nume: "Popescu" }
  ], { text: "1 12,340\n2 8,150\nGigel Necunoscut 5,000\n3 Cineva" });
  vm.runInContext("verificaCantare()", c);
  const h = c.preview.innerHTML;

  t("spune câte intră", /<b>1<\/b> cântar intră în manșa 1/.test(h), true);
  t("…pe cine, cu stand și nume", /St\.2 Vasile Popescu/.test(h), true);
  t("…și cu ce greutate", /<b>8,150<\/b> kg/.test(h), true);
  t("spune cine are deja cântar", /<b>1<\/b> au deja cântar/.test(h), true);
  t("…și cât are", /Mihai Ionescu \(are 10,500 kg\)/.test(h), true);
  t("spune ce n-a găsit", /<b>1<\/b> nu știu pe cine sunt/.test(h), true);
  t("…arătând rândul întreg", /Gigel Necunoscut 5,000/.test(h), true);
  t("spune și ce a sărit", /Am sărit <b>1<\/b> rând fără greutate/.test(h), true);

  // „Verifică" doar se uită: nu scrie nimic în concurs
  t("„Verifică\" nu scrie nimic", vm.runInContext("state.jurnal.length", c), 0);
  t("…și nu golește câmpul", c.camp.value !== "", true);
}
{
  const c = pornire(LOT, { text: "2 David Caramb 12,340" });
  vm.runInContext("verificaCantare()", c);
  t("nepotrivirea se vede pe ecran, cu numele de pe rând",
    /Mihai Ionescu.*pe rând scrie „David Caramb"/.test(c.preview.innerHTML), true);
}
{
  const c = pornire(LOT, { text: "nimic aici" });
  vm.runInContext("verificaCantare()", c);
  t("când nu găsește nimic, o spune", /N-am găsit niciun cântar/.test(c.preview.innerHTML), true);
}

/* ================================================================
   10. Legat unde trebuie pe ecran
   ================================================================ */
console.log("\n=== 10. Locul pe ecranul de Cântar ===");
{
  t("stă strâns, nu deschis", /id="pliant-cantare"[\s\S]{0,900}?class="pliant-in" hidden/.test(src), true);
  t("se deschide cu plianteaza", /onclick="plianteaza\('pliant-cantare'\)"/.test(src), true);
  t("nu se vede pe telefonul dat la vizualizare", /class="pliant mt lockhide" id="pliant-cantare"/.test(src), true);
  t("are butonul de verificat", /onclick="verificaCantare\(\)"/.test(src), true);
  t("…și pe cel de trecut", /onclick="treceCantare\(\)"/.test(src), true);
  /* Un singur buton albastru pe ecran: „+ Adaugă la listă" e deja btn-primary pe Cântar.
     Dacă ar mai fi unul, niciunul n-ar mai fi cel important. */
  const cantar = src.slice(src.indexOf('id="view-cantar"'), src.indexOf('id="view-cal"'));
  t("rămâne un singur buton albastru pe ecran", (cantar.match(/btn-primary/g) || []).length, 1);
  t("e pe ecranul de Cântar, nu prin Setări",
    cantar.indexOf('id="pliant-cantare"') > 0, true);
}

t.raport();
