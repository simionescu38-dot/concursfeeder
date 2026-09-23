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
  "esteArbitru", "arbAiLui", "stareaLaMansa", "nelamurit",
  "sectoareleCantarului", "deCantaritIn", "cantarSector", "cantarUrmatorul", "cantarSir",
  "cantarOmul", "cantarSariLa",
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
    /* Fiecare pornire cu pescarii ei: „parcurs" chiar cântărește, iar obiectele erau
       împărțite între probe — o probă o murdărea pe următoarea. */
    state: { manche: o.mansa || 1, numManse: 2, sectors: ["A", "B", "C"],
             participants: JSON.parse(JSON.stringify(pescari)) },
  };
  ctx.cantarSectorul = o.sectorCantar === undefined ? "" : o.sectorCantar;
  ctx.cantarTinta = "";
  ctx.toast = function(t){ ctx.__toast = t; };
  ctx.deseneazaCantarul = function(){};
  ctx.improspateazaCantariti = function(){};
  ctx.deseneazaSectorul = function(){};
  ctx.document = { getElementById: function(){ return null; } };
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

/** Drumul adevărat: cine-ți vine în față, unul după altul, până nu mai e nimeni.
    Coada arată doar sectorul de acum, deci întrebarea „în ce ordine îi întâlnesc"
    nu se mai poate pune dintr-o singură privire — se parcurge. */
const parcurs = (c) => vm.runInContext(`(function(){
  var mi = state.manche||1, out = [], paza = 0;
  while(paza++ < 300){
    var s = cantarSir();
    if(!s.length){
      var urm = cantarUrmatorul();
      if(!urm) break;
      cantarSectorul = urm;
      continue;
    }
    var p = s[0];
    out.push(standOfM(p, mi));
    mOf(p, mi).catches = [1]; mOf(p, mi).stare = "";
  }
  return out;
})()`, c);

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
  /* Coada de ACUM e doar a celor de cântărit; cel amânat nu ți se mai pune în față. */
  t("cel amânat iese din coada de acum", sir(c), ["2", "3"]);
  /* Dar nu se pierde: la capătul drumului tot îl întâlnești. */
  t("…și-l întâlnești la sfârșit, după ceilalți", parcurs(c), ["2", "3", "1"]);
}
{
  /* Te-ai hotărât o dată să-l amâni: nu ți-l pune înapoi în față la următoarea atingere. */
  const c = pornire([om(1, "A", "sarit"), om(2, "A", "sarit"), om(3, "A")]);
  t("doi amânați vin amândoi la sfârșit, în ordinea standurilor",
    parcurs(c), ["3", "1", "2"]);
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

  /* Cine ia toată balta merge ca organizatorul: sector cu sector, pe mal. */
  const tot = pornire(toti, { arbitru: true, sector: "" });
  t("arbitrul fără sector începe cu primul sector", sir(tot), ["1", "2"]);
  t("…dar îi întâlnește pe toți, la rând", parcurs(tot), ["1", "2", "9", "10", "17"]);

  /* „Cântăresc pe sectoare. Le iau la rând, A, B, C, D." — vorbele lui, despre ziua lui.
     Coada e a sectorului de acum, nu a întregului concurs. */
  const org = pornire(toti);
  t("organizatorul primește un sector odată", sir(org), ["1", "2"]);
  t("…iar după el urmează sectorul B", vm.runInContext("cantarUrmatorul()", org), "B");
  t("…și-i întâlnește pe toți, în ordinea malului", parcurs(org), ["1", "2", "9", "10", "17"]);
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

  /* În manșa 2 cei doi sunt în sectoare diferite (A și C), deci coada de acum îl are
     doar pe cel din primul sector — iar drumul îi are pe amândoi, în ordinea malului. */
  const m2 = pornire([a, b], { mansa: 2 });
  t("manșa 2 pornește de la capăt, din primul sector", sir(m2), ["5"]);
  t("…pe standurile ei, nu pe cele vechi", parcurs(m2), ["5", "20"]);
}

/* ================================================================
   7. Ce scrie pe ecran
   ================================================================ */
console.log("\n=== 7. Pe ecran ===");
{
  const coaja = H.grabFunction(src, "construiesteCantarul");
  /* Un singur buton scos în față PE ECRAN. Coaja are doi — cel de salvat și cel de
     trecut la sectorul următor — dar cele două blocuri nu stau niciodată împreună:
     unul e în „cm-lucru", celălalt în oprirea dintre sectoare. */
  const bucLucru = coaja.slice(coaja.indexOf("cm-lucru"), coaja.indexOf("cm-gata"));
  t("în timpul cântăririi e un singur buton albastru",
    (bucLucru.match(/btn-primary/g) || []).length, 1);
  t("…iar oprirea dintre sectoare îl are pe al ei, în alt bloc",
    /id="cm-sector-gata"[\s\S]*btn-primary[\s\S]*cantarTreciLaSector/.test(coaja), true);
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

/* ================================================================
   9. Un sector odată — și oprirea dintre ele
   ================================================================ */
console.log("\n=== 9. Sector cu sector, ca pe mal ===");
{
  const toti = [om(1, "A"), om(2, "A"), om(9, "B"), om(17, "B"), om(20, "C")];

  const c = pornire(toti);
  t("sectoarele vin în ordinea malului, nu a alfabetului",
    vm.runInContext("JSON.stringify(sectoareleCantarului())", c), '["A","B","C"]');
  t("„de cântărit” numără doar pe cei neatinși", vm.runInContext("deCantaritIn('B')", c), 2);
  t("primul sector cu treabă e A", vm.runInContext("cantarSector()", c), "A");

  /* Cel amânat NU ține sectorul pe loc — ăsta e rostul butonului. */
  const cuAmanat = pornire([om(1, "A", "sarit"), om(2, "A", "cantarit"), om(9, "B")]);
  t("un sector cu un singur amânat e socotit terminat",
    vm.runInContext("deCantaritIn('A')", cuAmanat), 0);
  /* …deci cântarul nu se oprește în el: trece direct la B, iar amânatul vine la sfârșit. */
  t("…deci cântarul pornește direct de la B", vm.runInContext("cantarSector()", cuAmanat), "B");
  t("…iar amânatul îl întâlnești la capătul zilei", parcurs(cuAmanat), ["9", "1"]);

  /* Sectorul ținut minte se uită când nu mai e al manșei — altfel cântarul ar rămâne
     agățat de drumul de ieri. Prins la probă, pe datele lui adevărate: cu sectoarele
     vechi ale listei, standul 1 era în B, iar cântarul rămânea în B și după ce tragerea
     îl mutase în A. */
  const strain = pornire(toti, { sectorCantar: "Z" });
  t("un sector care nu mai e al manșei se uită", vm.runInContext("cantarSector()", strain), "A");

  /* …iar cele două uși prin care se schimbă drumul îl șterg ele însele. */
  t("tragerea nouă șterge sectorul ținut minte",
    /cantarSectorul="";/.test(H.grabFunction(src, "treceTragerea")), true);
  t("…și pornirea manșei la fel",
    /cantarSectorul="";/.test(H.grabFunction(src, "pornesteMansa")), true);
  t("…și trecerea la altă manșă", /cantarSectorul="";/.test(H.grabFunction(src, "setManche")), true);
}
{
  /* Oprirea dintre sectoare: ce scrie pe ea și ce face butonul. */
  const coaja = H.grabFunction(src, "construiesteCantarul");
  t("oprirea are blocul ei", /id="cm-sector-gata"/.test(coaja), true);
  const d = H.grabFunction(src, "deseneazaCantarul");
  t("…apare doar când sectorul s-a golit, dar mai e unul",
    /!sir\.length && !cantarTinta && urm/.test(d), true);
  /* Dacă ai sărit anume la cineva, oprirea nu se pune în fața ta: l-ai cerut, îl primești. */
  t("…și nu se pune în fața ta când ai sărit la cineva",
    /!cantarTinta/.test(d), true);
  t("…spune ce sector s-a terminat", /"Sectorul "\+cantarSectorul\+" e gata"/.test(d), true);
  t("…și câți ai amânat în el", /amânat, revii la el la sfârșit/.test(d), true);
  t("butonul spune unde mergi", /"Trec la sectorul "\+urm/.test(d), true);
  t("…iar apăsarea chiar mută cântarul acolo",
    /cantarSectorul = cantarUrmatorul\(\)/.test(H.grabFunction(src, "cantarTreciLaSector")), true);
}
{
  /* Numărătoarea de sus e a sectorului, nu a concursului. */
  const f = H.grabFunction(src, "improspateazaCantariti");
  t("cifra de sus se uită la sectorul de acum", /sec=cantarSector\(\)/.test(f), true);
  t("…iar eticheta spune care sector", /"Cântăriți · sectorul "\+sec/.test(f), true);
  t("…și se întoarce la tot concursul când nu mai e niciun sector",
    /et0\.textContent = "Cântăriți"/.test(f), true);
}

/* ================================================================
   10. Săritura: cântarul nu-ți mai impune ordinea
   ================================================================
   „Vreau mai multă libertate în aplicație." Cântarul dădea pescarii unul câte unul, în
   ordinea standurilor — dacă venea unul la tine mai devreme, și la baltă vine, trebuia
   să-l cauți în „Toți pescarii". Acum atingi numărul standului, scrii altul, și sare.
   ================================================================ */
console.log("\n=== 10. Sari la cine vrei ===");
{
  const lot = [om(1, "A"), om(2, "A"), om(9, "B"), om(20, "C")];
  const c = pornire(lot);
  const peCantar = () => vm.runInContext("(cantarOmul()||{}).id", c);
  const standul = () => vm.runInContext(
    "cantarOmul() ? standOfM(cantarOmul(), state.manche||1) : null", c);

  t("fără săritură, pe cântar e primul din șir", standul(), "1");

  vm.runInContext("cantarSariLa('20')", c);
  t("sari la standul 20 — chiar acolo ajungi", standul(), "20");
  /* Săritura e un ocol, nu o mutare: tu rămâi unde stai pe mal. */
  t("…dar sectorul de acum NU se mută după el", c.cantarSectorul, "A");

  /* Săritura ține un singur om: după ce l-ai lămurit, cântarul se întoarce în șir. */
  vm.runInContext("cantarTinta=''", c);
  t("după ce l-ai lămurit, te întorci exact de unde erai", standul(), "1");

  /* Un stand care nu există nu te mută nicăieri, dar ți-o spune. */
  const d = pornire(lot);
  vm.runInContext("cantarSariLa('99')", d);
  t("un stand inexistent nu te mută", vm.runInContext("(cantarOmul()||{}).id", d),
    vm.runInContext("(cantarSir()[0]||{}).id", d));
  t("…dar îți spune de ce", /Niciun pescar pe standul 99/.test(d.__toast || ""), true);

  /* „12" îl găsește și pe cel scris „12 B". */
  const e = pornire([om("12 B", "B"), om(3, "A")]);
  vm.runInContext("cantarSariLa('12')", e);
  t("cifra din stand e de ajuns, chiar dacă standul are literă",
    vm.runInContext("standOfM(cantarOmul(), state.manche||1)", e), "12 B");

  /* Gol înseamnă „lasă-mă înapoi în șir". */
  const f = pornire(lot);
  vm.runInContext("cantarSariLa('9'); cantarSariLa('')", f);
  t("scrii gol și te întorci în șir", vm.runInContext("cantarTinta", f), "");
}
{
  /* Mânerul: numărul standului e și butonul, fără să fi apărut vreun buton nou. */
  const coaja = H.grabFunction(src, "construiesteCantarul");
  t("numărul standului se poate atinge", /id="cm-stand"[^>]*onclick="cantarSariDeschide\(\)"/.test(coaja), true);
  t("…și de la tastatură", /id="cm-stand"[\s\S]{0,200}onkeydown/.test(coaja), true);
  t("…iar capul spune că se atinge", /Standul · atinge/.test(coaja), true);
  t("câmpul de sărit spune ce vrea", /placeholder="sari la standul…"/.test(coaja), true);
  t("…Enter sare, Escape renunță",
    /cantarSariGata\(\)[\s\S]{0,120}Escape[\s\S]{0,40}cantarSariInchide/.test(coaja), true);
  /* Capcana obișnuită: fără `!important`, numărul ar rămâne pe ecran peste câmp. */
  t("ascunderea numărului chiar ține", /\.cm-stand\[hidden\]\{display:none !important;\}/.test(src), true);
  t("…și a câmpului la fel", /\.cm-sari\[hidden\]\{display:none !important;\}/.test(src), true);

  const sv = H.grabFunction(src, "cantarSalveaza");
  t("după cântărire, ocolul se termină", /cantarTinta = "";/.test(sv), true);
  const st = H.grabFunction(src, "cantarStare");
  t("…și după o stare, la fel", /cantarTinta = "";/.test(st), true);
}
{
  const m = H.citeste("sw.js").match(/concurs-pescuit-v(\d+)/);
  t("telefonul ia varianta nouă (v209 sau mai nouă)", m && parseInt(m[1], 10) >= 209, true);
}

t.raport();
