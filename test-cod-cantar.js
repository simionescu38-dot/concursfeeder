/**
 * Codul pescarului pe ecranul Cântar.
 *
 * Codul exista deja în baza sezonului și putea ajunge la participant prin foaia de
 * tragere. Aici se verifică puntea lipsă: se vede, se scrie, se caută și nu se poate
 * dubla sau lipi de alt om decât cel din bază.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));

console.log("\n=== 1. Codul este legat de ecranul Cântar ===");
t("formularul de adăugare are câmp de cod", /id="in-cod"[^>]*inputmode="numeric"/.test(src), true);
t("editarea participantului are câmp de cod", /id="ed-cod-'\+p\.id\+'"/.test(src), true);
t("cardul afișează codul", /<span>Cod '\+esc\(String\(p\.cod\)\)/.test(src), true);
/* Eticheta „Fără cod" stătea pe fiecare pescar din listă, ca un lucru nefăcut. Acum codul
   se arată când există și tace când nu — ca sectorul, de deasupra. */
t("cardul arată codul când îl are", /<span>Cod '\+esc\(String\(p\.cod\)\)/.test(src), true);
t("…și nu mai spune nimic când lipsește", /<span>Fără cod<\/span>/.test(src), false);
t("căutarea spune că acceptă și cod", /Caută după nume, stand sau cod/.test(src), true);
t("căutarea include codul participantului", /\(p\.cod\|\|""\)/.test(grabFunction(src, "renderList")), true);
t("există avertisment separat pentru coduri", /id="warn-cod"/.test(src), true);

console.log("\n=== 2. Codurile sunt validate înainte de salvare ===");
{
  const ctx = {
    state: { participants: [
      { id: "p1", cod: 7, prenume: "Mihai", nume: "Ionescu" },
      { id: "p2", cod: 3, prenume: "Vasile", nume: "Popescu" }
    ] },
    pescari: [
      { cod: 7, prenume: "Mihai", nume: "Ionescu" },
      { cod: 3, prenume: "Vasile", nume: "Popescu" }
    ],
    String, parseInt, isNaN
  };
  ctx.nameOf = p => (p.prenume + " " + p.nume).trim();
  ctx.numePescar = p => (p.prenume + " " + p.nume).trim();
  ctx.pescarDupaCod = cod => ctx.pescari.find(p => Number(p.cod) === Number(cod)) || null;
  ctx.numeleSePotriveste = (n, p) => n.toLowerCase() === ctx.numePescar(p).toLowerCase();
  vm.createContext(ctx);
  vm.runInContext(grabFunction(src, "codParticipant") + "\n" +
                  grabFunction(src, "problemaCodParticipant"), ctx);

  const run = code => vm.runInContext(code, ctx);
  t("codul gol rămâne permis pentru concursurile vechi", run("codParticipant('')"), null);
  t("codul numeric se normalizează", run("codParticipant('007')"), 7);
  t("literele nu devin cod", Number.isNaN(run("codParticipant('7A')")), true);
  t("zero nu devine cod", Number.isNaN(run("codParticipant('0')")), true);
  t("același cod pe alt participant este oprit",
    /deja la Mihai Ionescu/.test(run("problemaCodParticipant(7,'p2','Vasile','Popescu')")), true);
  t("codul altui om din bază este oprit",
    /este al lui Mihai Ionescu/.test(run("problemaCodParticipant(7,'p1','Ion','Marin')")), true);
  t("codul corect al aceluiași om este acceptat",
    run("problemaCodParticipant(7,'p1','Mihai','Ionescu')"), "");
}

console.log("\n=== 3. Avertismentul strigă doar ce strică ceva ===");
{
  /* Codul nu e o condiție a zilei de concurs: fără el, sezonul leagă după nume, ca înainte
     să existe coduri. De-aia ecranul de cântar nu-l mai cere — pe el se uită acum arbitrii.
     A rămas strigat doar codul dublu, fiindcă acela topește doi oameni într-unul singur la
     clasamentul de sezon, și nu se vede nicăieri până la finalul lui. */
  const warn = { style: {}, innerHTML: "" };
  function pornire(participanti) {
    const ctx = {
      state: { participants: participanti },
      document: { getElementById: id => id === "warn-cod" ? warn : null },
      String, parseInt, isNaN, Object, Array,
    };
    ctx.nameOf = p => ((p.prenume || "") + " " + (p.nume || "")).trim();
    vm.createContext(ctx);
    vm.runInContext(["codParticipant", "esc", "updateWarnCod"]
      .map(n => grabFunction(src, n)).join("\n"), ctx);
    vm.runInContext("updateWarnCod()", ctx);
    return warn;
  }

  const dublu = pornire([
    { id: "1", cod: 4, prenume: "Ana", nume: "Unu" },
    { id: "2", cod: 4, prenume: "Dan", nume: "Doi" },
    { id: "3", prenume: "Ion", nume: "Trei" },
  ]);
  t("spune cine are cod dublu", /codul 4 este la Ana Unu și Dan Doi/.test(dublu.innerHTML), true);
  t("…și spune ce strică", /se amestecă între ei/.test(dublu.innerHTML), true);
  t("avertismentul este vizibil", dublu.style.display, "block");
  /* Al treilea om din listă n-are cod deloc, și e în regulă așa. */
  t("nu mai cere codurile care lipsesc", /fără cod/.test(dublu.innerHTML), false);
  t("…și nu mai dă ordine", /Completează/.test(dublu.innerHTML), false);

  const curat = pornire([
    { id: "1", cod: 4, prenume: "Ana", nume: "Unu" },
    { id: "2", prenume: "Dan", nume: "Doi" },
    { id: "3", prenume: "Ion", nume: "Trei" },
  ]);
  t("doi oameni fără cod nu mai sunt o problemă", curat.style.display, "none");
  /* Se golește, nu doar se ascunde: altfel textul rămâne în pagină, nevăzut. */
  t("…iar textul vechi nu rămâne în pagină", curat.innerHTML, "");
}

console.log("\n=== 4. Leacul stă unde vin codurile ===");
{
  /* Butonul care pune codurile stătea în avertismentul de pe Cântar. S-a mutat la Baza de
     pescari: acolo se face treaba asta, o dată, înainte de concurs — nu la baltă. */
  const wc = grabFunction(src, "updateWarnCod");
  t("avertismentul nu mai poartă butonul", /puneCodurile/.test(wc), false);
  t("…nici nu mai caută prin bază", /potrivesteCodurile/.test(wc), false);
  t("butonul are pliantul lui la Baza de pescari", /id="pliant-coduri"/.test(src), true);
  t("…și e chiar în ecranul bazei",
    /id="view-pescari"[\s\S]*?id="pliant-coduri"/.test(src), true);
  t("…cu butonul care pune codurile",
    /id="pliant-coduri"[\s\S]{0,700}onclick="puneCodurile\(\)"/.test(src), true);
  t("pliantul spune că nu e obligatoriu",
    /id="pliant-coduri"[\s\S]{0,1200}Nu e obligatoriu/.test(src), true);
  t("butonul nu e scos în față",
    /id="pliant-coduri"[\s\S]{0,700}btn-primary/.test(src), false);
  /* Strâns, nu adăugat: ecranul bazei rămâne cu trei carduri, ca până acum. */
  t("nu s-a pus un card în plus pe ecranul bazei",
    (src.slice(src.indexOf('id="view-pescari"'), src.indexOf('id="view-spons"'))
       .match(/class="card/g) || []).length, 3);

  const rp = grabFunction(src, "renderPescari");
  t("ecranul bazei umple cardul", /pune-coduri-cati/.test(rp), true);
  t("…și îl ascunde când n-are ce pune",
    /pcard\.style\.display = g\.gasiti\.length \? "" : "none";/.test(rp), true);
  t("…și e chiar pliantul, nu altceva", /getElementById\("pliant-coduri"\)/.test(rp), true);
  t("după punere se împrospătează și cardul",
    /queueSave\(\); renderList\(\); renderPescari\(\);/.test(grabFunction(src, "puneCodurile")), true);
}

t.raport();
