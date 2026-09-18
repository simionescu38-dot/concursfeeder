/**
 * Sectoare care nu-s blocuri egale — scrise ca pe foaie.
 *
 * Pe carnetul organizatorului, scris de mână, pentru Cupa TTX21 Baits:
 *
 *     1-2-3-4-5-6-7-8            Sect A     (opt!)
 *     9-10-11-12-13-14-15-16-17  Sect B
 *     18-19-20-21-22-23-24-25-26 Sect C
 *     27-28-29-30-31-32-33-34-35 Sect D
 *
 * Socoteala care taie 35 de standuri în patru părți cât mai egale n-are cum să
 * nimerească asta: ea dă 9/9/9/8. Nici ordinea literelor nu se potrivește — în camera
 * lui sectoarele stăteau „B, C, A, D" (așa au fost adăugate), iar împărțirea urmează
 * ordinea aia, nu alfabetul. Rezultatul, măsurat pe camera adevărată: aplicația arăta
 * „B 1–9 · C 10–18 · A 19–27 · D 28–35", adică **25 de standuri din 35** cădeau în alt
 * sector decât pe foaie.
 *
 * Acum, în ACEEAȘI căsuță se scrie fie numărul de standuri, ca până acum, fie chiar
 * rândurile de pe foaie. Ce e scris bate orice socoteală.
 *
 * Codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const CARNET = "A 1-8, B 9-17, C 18-26, D 27-35";
/* ordinea din camera lui, nu alfabetul */
const SECTOARELE_LUI = ["B", "C", "A", "D"];

function aplicatie(numStanduri, sectors, nrPescari) {
  const ctx = {
    console, Math,
    state: {
      numStanduri: numStanduri === undefined ? "" : numStanduri,
      sectors: (sectors || SECTOARELE_LUI).slice(),
      participants: new Array(nrPescari || 0).fill(0).map((_, i) => ({ id: "p" + i })),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(["sectorRanges", "sectorForStand", "intervaleScrise", "intervalele",
    "currentRanges", "sirScurt"].map((n) => H.grabFunction(src, n)).join("\n"), ctx);
  return ctx;
}
const ranges = (ctx) => JSON.parse(vm.runInContext("JSON.stringify(currentRanges())", ctx));
const scurt = (ctx) => ranges(ctx).map((x) => x.sector + " " + x.from + "–" + x.to).join(" · ");

/* ================================================================
   1. Ce se scrie în căsuță
   ================================================================ */
console.log("\n=== 1. O cifră, sau rândurile de pe foaie ===");
{
  const c = aplicatie();
  const scrise = (txt, secs) => JSON.parse(vm.runInContext(
    "JSON.stringify(intervaleScrise(" + JSON.stringify(txt) + ", " +
    JSON.stringify(secs || SECTOARELE_LUI) + "))", c));

  t("o cifră singură rămâne cifră — socoteala de dinainte", scrise("35"), null);
  t("gol tot așa", scrise(""), null);
  t("o valoare fără cifre nu se ia drept intervale", scrise("abc"), null);
  t("nici un text oarecare", scrise("nu stiu inca"), null);

  t("rândurile de pe foaie se citesc întocmai", scrise(CARNET),
    [{sector:"A",from:1,to:8},{sector:"B",from:9,to:17},
     {sector:"C",from:18,to:26},{sector:"D",from:27,to:35}]);

  /* Foaia se scrie cum îi vine omului: cu punct și virgulă, pe rânduri, cu litere mici,
     cu liniuță lungă, cu două puncte. Toate înseamnă același lucru. */
  t("merge și cu punct și virgulă",
    scrise("A 1-8; B 9-17; C 18-26; D 27-35").length, 4);
  t("…și scris pe rânduri, ca pe carnet",
    scrise("A 1-8\nB 9-17\nC 18-26\nD 27-35").length, 4);
  t("…și cu litere mici", scrise("a 1-8, b 9-17").map((x) => x.sector), ["A", "B"]);
  t("…și cu liniuța lungă", scrise("A 1–8, B 9–17").length, 2);
  t("…și cu două puncte", scrise("A: 1-8, B: 9-17").length, 2);
  t("…iar cifrele întoarse se îndreaptă", scrise("A 8-1"), [{sector:"A",from:1,to:8}]);

  /* O literă care nu e sector al concursului NU se inventează: ar naște un sector
     fantomă în clasament. Se spune, și omul o adaugă cu butonul lui. */
  const cuStrain = scrise("A 1-8, E 9-17");
  t("o literă străină nu intră în intervale", cuStrain.map((x) => x.sector), ["A"]);
  t("…dar se ține minte, ca să fie spusă",
    JSON.parse(vm.runInContext("JSON.stringify((intervaleScrise('A 1-8, E 9-17', " +
      JSON.stringify(SECTOARELE_LUI) + ")||{}).straine)", c)), ["E"]);
}

/* ================================================================
   2. Carnetul lui bate socoteala
   ================================================================ */
console.log("\n=== 2. Concursul lui, cu sectoarele amestecate în cameră ===");
{
  const socoteala = aplicatie("35", SECTOARELE_LUI, 35);
  t("cu numărul singur, iese ce-i arăta lui pe ecran",
    scurt(socoteala), "B 1–9 · C 10–18 · A 19–27 · D 28–35");

  const foaia = aplicatie(CARNET, SECTOARELE_LUI, 35);
  t("cu rândurile scrise, iese chiar carnetul",
    scurt(foaia), "A 1–8 · B 9–17 · C 18–26 · D 27–35");
  t("…deși în cameră literele stau amestecate (B, C, A, D)",
    foaia.state.sectors, SECTOARELE_LUI);

  /* Cele opt capete de sector, unul câte unul. */
  const unde = (ctx, s) => vm.runInContext("sectorForStand(" + s + ", currentRanges())", ctx);
  [[1,"A"],[8,"A"],[9,"B"],[17,"B"],[18,"C"],[26,"C"],[27,"D"],[35,"D"]]
    .forEach(function(p){ t("standul " + p[0] + " e în " + p[1], unde(foaia, p[0]), p[1]); });

  /* Câți ies altfel decât pe foaie, cu fiecare fel de socoteală. */
  const alLui = (s) => s <= 8 ? "A" : s <= 17 ? "B" : s <= 26 ? "C" : "D";
  const gresite = (ctx) => {
    let n = 0;
    for (let s = 1; s <= 35; s++) if (unde(ctx, s) !== alLui(s)) n++;
    return n;
  };
  t("cu numărul singur, 25 din 35 cad în alt sector", gresite(socoteala), 25);
  t("cu foaia scrisă, niciunul", gresite(foaia), 0);

  t("8 în A, 9 în B, C și D",
    ranges(foaia).map((x) => x.sector + ":" + (x.to - x.from + 1)),
    ["A:8", "B:9", "C:9", "D:9"]);
}

/* ================================================================
   3. Ce nu s-a stricat
   ================================================================ */
console.log("\n=== 3. Cum era înainte, a rămas ===");
{
  t("numărul scris de mână bate numărul de pescari",
    ranges(aplicatie("64", ["A","B"], 10)).map((x) => x.to), [32, 64]);
  t("nescris, se presupune un stand de fiecare pescar",
    ranges(aplicatie("", ["A","B"], 10)).map((x) => x.to), [5, 10]);
  t("o valoare fără cifre nu strică împărțirea",
    ranges(aplicatie("abc", ["A","B"], 10)).map((x) => x.to), [5, 10]);
  t("fără pescari și fără număr, nu există intervale",
    ranges(aplicatie("", ["A","B"], 0)).length, 0);
}

/* ================================================================
   4. Greșelile de tastat se văd pe loc
   ================================================================ */
console.log("\n=== 4. Găuri și suprapuneri ===");
{
  const f = H.grabFunction(src, "previewSectoare");
  t("rândul de sub căsuță spune ce litere nu-s sectoare", /straine/.test(f), true);
  t("…ce standuri rămân fără sector", /Fără sector/.test(f), true);
  t("…care-s în două sectoare deodată", /În două sectoare deodată/.test(f), true);
  /* Un sector uitat de tot nu lasă gaură — scurtează balta. Se prinde numai punând
     rândurile față în față cu câți pescari sunt în concurs. */
  t("…și dacă rândurile nu ajung la toți pescarii",
    /pescari, dar rândurile scrise ajung doar la standul/.test(f), true);

  const c = aplicatie();
  const s = (v) => vm.runInContext("sirScurt(" + JSON.stringify(v) + ")", c);
  t("cifrele înșirate se strâng în intervale", s([1,2,3,7,8]), "1–3, 7–8");
  t("…una singură rămâne singură", s([5]), "5");
  t("…iar niciuna nu scrie nimic", s([]), "");
}

/* ================================================================
   5. Căsuța
   ================================================================ */
console.log("\n=== 5. Căsuța în care se scrie ===");
{
  /* Tastatura numai-cifre n-ar lăsa literele să intre. */
  t("căsuța nu mai cere tastatura de cifre",
    /id="in-standuri"[^>]*inputmode="numeric"/.test(src), false);
  t("…iar ce se poate scrie în ea se vede din exemplu",
    /id="in-standuri"[^>]*placeholder="35   sau   A 1-8, B 9-17, C 18-26, D 27-35"/.test(src), true);

  /* Un singur drum pentru toți: tragerea, importul și scrisul de mână socotesc la fel. */
  ["currentRanges", "intervaleleTragerii"].forEach((n) =>
    t("„" + n + "” trece prin aceleași intervale",
      /return intervalele\(/.test(H.grabFunction(src, n)), true));
  t("…și importul de participanți la fel",
    /var ranges=intervalele\(/.test(H.grabFunction(src, "doImport")), true);
}

/* ================================================================
   6. Varianta nouă ajunge pe telefon
   ================================================================ */
console.log("\n=== 6. Telefonul ia varianta nouă ===");
{
  const m = H.citeste("sw.js").match(/concurs-pescuit-v(\d+)/);
  t("sw.js e urcat cel puțin la 204", m && parseInt(m[1], 10) >= 204, true);
}

t.raport();
