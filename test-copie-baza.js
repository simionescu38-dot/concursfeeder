/**
 * Copie de siguranță a bazei de pescari.
 *
 * Concursurile și arhivele stau pe server. Baza NU: e în memoria browserului de pe un
 * singur telefon. Ștergi datele aplicației, schimbi telefonul, sau Android curăță singur
 * memoria — și s-a dus. Codurile nu se pot reface din nume: sunt date pe rând, în ordinea
 * în care au intrat oamenii.
 *
 * Lucrul de care atârnă tot: la aducere se ADAUGĂ, nu se înlocuiește. Cine e deja în bază
 * își păstrează codul — altfel un fișier vechi ar da înapoi codurile puse între timp.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = ["uid", "faraSemne", "cheiePescar", "scrierileLui", "tineMinteScrierea", "numePescar", "pescarCauta",
  "pescarCodNou", "pescarNou", "pescariSalveaza", "salveazaBaza",
  "bazaDinFisier", "potrivesteBaza", "aduBaza"];

/** o lume cu o bază, un telefon care poate salva fișiere și unul care nu poate */
function lume(optiuni) {
  const o = optiuni || {};
  const memorie = {};
  const ctx = {
    console, JSON, Date, Math, parseInt, isNaN, Array, String, Object,
    blocat: !!o.blocat, intrebat: [], spus: [], raspuns: o.confirma !== false,
    toasturi: [], desenat: 0, descarcat: [], impartit: [],
    guard() { return ctx.blocat; },
    confirm(q) { ctx.intrebat.push(q); return ctx.raspuns; },
    alert(q) { ctx.spus.push(q); },
    toast(m) { ctx.toasturi.push(m); },
    renderPescari() { ctx.desenat++; },
    downloadJson(json, nume) { ctx.descarcat.push({ json, nume }); },
    localStorage: { getItem: () => null, setItem: (k, v) => { memorie[k] = v; } },
    memorie,
    /* telefonul care poate trimite fișiere de-a dreptul (Android, Chrome) */
    navigator: o.poateTrimite ? {
      canShare: () => true,
      share(x) { ctx.impartit.push(x); return { catch() {} }; }
    } : {},
    File: o.poateTrimite ? function (parti, nume) { this.nume = nume; } : undefined
  };
  vm.createContext(ctx);
  vm.runInContext('var PESCARI_KEY="concurs-pescari-v1"; var pescari=[]; var pescariUltimCod=0;', ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  (o.baza || []).forEach(nm => {
    const sp = nm.indexOf(" ");
    vm.runInContext("pescari.push(pescarNou(" + JSON.stringify(nm.slice(0, sp)) + "," +
                    JSON.stringify(nm.slice(sp + 1)) + "))", ctx);
  });
  return ctx;
}

const baza = ctx => vm.runInContext(
  "pescari.map(function(p){ return p.cod+':'+numePescar(p); })", ctx);
const ultim = ctx => vm.runInContext("pescariUltimCod", ctx);
/** aduce un fișier prin drumul adevărat: FileReader-ul e prefăcut, restul e cod livrat */
function adu(ctx, continut) {
  const text = typeof continut === "string" ? continut : JSON.stringify(continut);
  ctx.FileReader = function () {
    this.readAsText = () => { this.onload({ target: { result: text } }); };
  };
  ctx.input = { value: "x", files: [{ name: "baza.json" }] };
  vm.runInContext("aduBaza(input);", ctx);
  return ctx;
}
const fisier = (pescari, ultimulCod) => ({
  app: "concurs-pescuit-baza", ver: 1, exportatLa: "2026-09-02T12:00:00.000Z",
  ultimulCod: ultimulCod === undefined ? pescari.length : ultimulCod,
  pescari: pescari.map(x => {
    const sp = x.nume.indexOf(" ");
    return { id: "f" + x.cod, cod: x.cod, prenume: x.nume.slice(0, sp), nume: x.nume.slice(sp + 1) };
  })
});

/* ================================================================
   1. Salvarea
   ================================================================ */
console.log("\n=== 1. Ce iese din telefon ===");
{
  const c = lume({ baza: ["Mihai Ionescu", "Vasile Popescu", "Ștefan Bălan"] });
  vm.runInContext("salveazaBaza();", c);
  t("s-a scos un fișier", c.descarcat.length, 1);
  const j = JSON.parse(c.descarcat[0].json);
  t("scrie ce fel de fișier e", j.app, "concurs-pescuit-baza");
  t("duce toți oamenii", j.pescari.length, 3);
  t("…cu codurile lor", j.pescari.map(p => p.cod), [1, 2, 3]);
  t("…și cu numele lor", j.pescari.map(p => (p.prenume + " " + p.nume).trim()),
    ["Mihai Ionescu", "Vasile Popescu", "Ștefan Bălan"]);
  /* Numărătoarea pleacă și ea: altfel, pe telefonul nou, codul unui om scos din bază
     s-ar da din nou altcuiva. */
  t("duce și numărătoarea codurilor", j.ultimulCod, 3);
  t("numele fișierului spune ce e", /^baza-pescari-\d{8}-\d{4}\.json$/.test(c.descarcat[0].nume), true);
}

console.log("\n=== 1b. Pe telefonul care poate trimite, pleacă de-a dreptul ===");
{
  const c = lume({ baza: ["Mihai Ionescu"], poateTrimite: true });
  vm.runInContext("salveazaBaza();", c);
  t("s-a deschis fereastra de trimitere", c.impartit.length, 1);
  t("…cu numele bun", c.impartit[0].title, "Baza de pescari");
  t("nu s-a descărcat degeaba și un fișier", c.descarcat.length, 0);
}

console.log("\n=== 1c. Baza goală n-are ce salva ===");
{
  const c = lume({ baza: [] });
  vm.runInContext("salveazaBaza();", c);
  t("nu se scoate niciun fișier gol", c.descarcat.length, 0);
  t("…și se spune de ce", c.toasturi[0], "Baza e goală — n-am ce salva");
}

/* ================================================================
   2. Ce se citește dintr-un fișier
   ================================================================ */
console.log("\n=== 2. Formele în care poate veni fișierul ===");
{
  const c = lume();
  const cit = x => vm.runInContext("(function(){var b=bazaDinFisier(" + JSON.stringify(x) +
    "); return b ? {n:b.lista.length, ultim:b.ultim} : null;})()", c);
  t("fișierul aplicației", cit(fisier([{ cod: 1, nume: "Mihai Ionescu" }])), { n: 1, ultim: 1 });
  t("o listă scrisă de-a dreptul", cit([{ cod: 5, prenume: "Ion", nume: "Țăranu" }]), { n: 1, ultim: 0 });
  t("un ambalaj fără numărătoare", cit({ pescari: [] }), { n: 0, ultim: 0 });
  t("altceva nu trece", cit({ ceva: 1 }), null);
  t("nici un număr", cit(7), null);
}

console.log("\n=== 2b. Fișier stricat ===");
{
  const c = lume({ baza: ["Mihai Ionescu"] });
  adu(c, "{asta nu-i JSON");
  t("se spune, nu se crapă", c.toasturi[0], "Fișier invalid");
  t("baza n-a fost atinsă", baza(c), ["1:Mihai Ionescu"]);

  const c2 = lume({ baza: ["Mihai Ionescu"] });
  adu(c2, { app: "altceva" });
  t("un fișier de altă natură se refuză", c2.toasturi[0], "Fișier invalid – nu e o bază de pescari");
  t("…și baza rămâne cum era", baza(c2), ["1:Mihai Ionescu"]);
}

/* ================================================================
   3. Aducerea pe un telefon gol — cazul de care atârnă tot
   ================================================================ */
console.log("\n=== 3. Telefon nou, bază goală ===");
{
  const c = lume({ baza: [] });
  adu(c, fisier([{ cod: 1, nume: "Mihai Ionescu" }, { cod: 2, nume: "Vasile Popescu" },
                 { cod: 7, nume: "Ștefan Bălan" }], 9));
  t("au venit toți", baza(c), ["1:Mihai Ionescu", "2:Vasile Popescu", "7:Ștefan Bălan"]);
  t("…cu codurile neschimbate", baza(c).map(x => x.split(":")[0]), ["1", "2", "7"]);
  /* Golul dintre 2 și 7 e al unui om scos din bază cândva. Numărătoarea vine din fișier,
     deci codul lui nu se mai dă nimănui. */
  t("numărătoarea vine din fișier, nu din câți oameni sunt", ultim(c), 9);
  t("următorul venit ia 10", vm.runInContext("pescarCodNou()", c), 10);
  t("s-a salvat pe telefon", "concurs-pescari-v1" in c.memorie, true);
  t("i se spune omului", c.toasturi[0], "3 pescari aduși din fișier");
}

console.log("\n=== 3b. Numărătoarea urcă și după cel mai mare cod adus ===");
{
  /* fișier fără numărătoare scrisă: se ia din codurile aduse */
  const c = lume({ baza: [] });
  adu(c, [{ cod: 4, prenume: "Ion", nume: "Țăranu" }, { cod: 11, prenume: "Radu", nume: "Georgescu" }]);
  t("au venit amândoi", baza(c), ["4:Ion Țăranu", "11:Radu Georgescu"]);
  t("numărătoarea a urcat la cel mai mare", ultim(c), 11);
}

/* ================================================================
   4. Aducerea peste o bază care există deja
   ================================================================ */
console.log("\n=== 4. Cine e deja în bază nu se atinge ===");
{
  const c = lume({ baza: ["Mihai Ionescu", "Vasile Popescu"] });   // codurile 1 și 2
  adu(c, fisier([{ cod: 1, nume: "Mihai Ionescu" }, { cod: 3, nume: "Ion Țăranu" }], 3));
  t("intră doar cel nou", baza(c), ["1:Mihai Ionescu", "2:Vasile Popescu", "3:Ion Țăranu"]);
  t("se spune câți erau deja", /1 sunt deja în bază — nu-i ating\./.test(c.intrebat[0]), true);

  /* Un fișier VECHI, în care cineva avea alt cod, nu dă codurile înapoi: omul e găsit
     după nume și lăsat în pace. Altfel s-ar rescrie codurile puse între timp. */
  const c2 = lume({ baza: ["Mihai Ionescu"] });
  adu(c2, fisier([{ cod: 55, nume: "Mihai Ionescu" }], 55));
  t("codul de acum rămâne, nu-l dă înapoi fișierul", baza(c2), ["1:Mihai Ionescu"]);
  t("…și se spune că n-a fost nimic de adus", c2.toasturi[0], "Toți cei 1 din fișier sunt deja în bază");

  const c3 = lume({ baza: ["Petrică Cazacu"] });
  adu(c3, fisier([{ cod: 9, nume: "Petrica Cazacu" }], 9));
  t("fără diacritice, tot el e — nu intră a doua oară", baza(c3), ["1:Petrică Cazacu"]);
}

console.log("\n=== 4b. Codul din fișier e la altcineva aici ===");
{
  /* Nu se pune peste (ar fi doi cu același cod) și nu se dă altul (n-ar mai fi codul
     lui de la etapele trecute). Se spune, și omul hotărăște. */
  const c = lume({ baza: ["Mihai Ionescu"] });    // Mihai are codul 1
  adu(c, fisier([{ cod: 1, nume: "Ion Țăranu" }], 1));
  t("nu intră", baza(c), ["1:Mihai Ionescu"]);
  t("se spune pe nume, cu pricina",
    /Ion Țăranu \(codul 1 e la Mihai Ionescu\)/.test(c.spus[0] || c.intrebat[0] || ""), true);

  /* când sunt și oameni buni de adus, ciocnirea se spune în aceeași întrebare */
  const c2 = lume({ baza: ["Mihai Ionescu"] });
  adu(c2, fisier([{ cod: 1, nume: "Ion Țăranu" }, { cod: 4, nume: "Radu Georgescu" }], 4));
  t("cel curat intră", baza(c2), ["1:Mihai Ionescu", "4:Radu Georgescu"]);
  t("…iar ciocnirea e scrisă în întrebare",
    /1 nu pot intra/.test(c2.intrebat[0]), true);
}

console.log("\n=== 4c. Rânduri fără cod sau fără nume ===");
{
  const c = lume({ baza: [] });
  adu(c, [{ prenume: "Fara", nume: "Cod" }, { cod: 2, prenume: "Cu", nume: "Cod" },
          { cod: 3, prenume: "", nume: "" }, "nu-i obiect", null]);
  t("intră doar cel întreg", baza(c), ["2:Cu Cod"]);
  t("cel fără cod se spune", /Fara Cod \(fără cod în fișier\)/.test(c.intrebat[0]), true);
  t("rândul fără nume se trece cu vederea, nu se strigă",
    /nu pot intra:\s*\n• Fara Cod \(fără cod în fișier\)\s*$/m.test(c.intrebat[0]), true);
}

/* ================================================================
   5. Plasele
   ================================================================ */
console.log("\n=== 5. Se întreabă înainte, și lacătul oprește ===");
{
  const c = lume({ baza: [], confirma: false });
  adu(c, fisier([{ cod: 1, nume: "Mihai Ionescu" }]));
  t("cu «nu», nu intră nimeni", baza(c), []);
  t("…și nu s-a salvat nimic", "concurs-pescari-v1" in c.memorie, false);

  const blocat = lume({ baza: [], blocat: true });
  adu(blocat, fisier([{ cod: 1, nume: "Mihai Ionescu" }]));
  t("cu lacătul pus nu se aduce nimic", baza(blocat), []);
  t("nici nu s-a întrebat", blocat.intrebat, []);
  t("câmpul de fișier se golește oricum", blocat.input.value, "");
}

console.log("\n=== 5b. Salvarea merge și cu lacătul pus ===");
{
  /* A citi baza și a o pune într-un fișier nu strică nimic — iar dacă telefonul e
     blocat tocmai fiindcă îl ține altcineva, copia de siguranță e cu atât mai bună. */
  const c = lume({ baza: ["Mihai Ionescu"], blocat: true });
  vm.runInContext("salveazaBaza();", c);
  t("fișierul iese", c.descarcat.length, 1);
}

/* ================================================================
   6. Dus-întors
   ================================================================ */
console.log("\n=== 6. Salvat, apoi adus pe alt telefon ===");
{
  const vechi = lume({ baza: ["Mihai Ionescu", "Vasile Popescu", "Ștefan Bălan"] });
  /* unul e scos: codul lui nu se mai dă nimănui, nici după mutarea pe alt telefon */
  vechi.id = vm.runInContext("pescari[1].id", vechi);
  vm.runInContext("pescari=pescari.filter(function(p){ return p.id!==id; });", vechi);
  vm.runInContext("salveazaBaza();", vechi);

  const nou = lume({ baza: [] });
  adu(nou, JSON.parse(vechi.descarcat[0].json));
  t("baza a ajuns întreagă pe telefonul nou", baza(nou), ["1:Mihai Ionescu", "3:Ștefan Bălan"]);
  t("codul celui scos rămâne pierdut", vm.runInContext("pescarCodNou()", nou), 4);

  /* și a doua aducere a aceluiași fișier nu dublează pe nimeni */
  adu(nou, JSON.parse(vechi.descarcat[0].json));
  t("acelasi fișier adus de două ori nu dublează", baza(nou), ["1:Mihai Ionescu", "3:Ștefan Bălan"]);
}

/* ================================================================
   7. Ecranul
   ================================================================ */
console.log("\n=== 7. Ecranul e legat cum trebuie ===");
{
  const ecran = src.slice(src.indexOf('id="view-pescari"'), src.indexOf('id="view-spons"'));
  t("rândul strâns e pe ecranul bazei", /id="pliant-copie"/.test(ecran), true);
  t("e strâns, nu deschis", /id="pliant-copie">[\s\S]{0,400}?<div class="pliant-in" hidden>/.test(ecran), true);
  t("spune cât de des se folosește", /Copie de siguranță <span class="rar">din când în când<\/span>/.test(ecran), true);
  t("butonul de salvat spune ce face", /Salvează baza într-un fișier<\/button>/.test(ecran), true);
  t("butonul de adus spune ce face", /Adu baza dintr-un fișier<\/button>/.test(ecran), true);
  /* Salvarea trebuie să meargă și cu lacătul pus, deci nu are voie să stea în vreo
     bucată ascunsă la lacăt. Bucata serverului e ascunsă; salvarea în fișier, nu. */
  const bucataServer = ecran.slice(ecran.indexOf('id="baza-server"'), ecran.indexOf("Și un fișier"));
  t("bucata serverului chiar e ascunsă la lacăt", /lockhide" id="baza-server"/.test(ecran), true);
  t("…dar butonul de salvat în fișier nu e în ea", /salveazaBaza/.test(bucataServer), false);
  t("aducerea se ascunde la lacăt",
    /<div class="lockhide">[\s\S]{0,400}baza-fis/.test(ecran), true);
  t("ecranul rămâne cu trei carduri", (ecran.match(/class="card/g) || []).length, 3);
  t("un singur buton scos în față", (ecran.match(/btn-primary/g) || []).length, 1);

  const ab = H.grabFunction(src, "aduBaza");
  t("cu lacătul pus nu se aduce", /^\s*function aduBaza\(input\)\{\s*\r?\n\s*if\(guard\(\)\)/.test(ab), true);
  t("se întreabă înainte de a scrie", /if\(!confirm\(q\)\) return;/.test(ab), true);
}

t.raport();
