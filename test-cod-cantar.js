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
t("cardul spune când lipsește", /<span>Fără cod<\/span>/.test(src), true);
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

console.log("\n=== 3. Avertismentul prinde lipsurile și duplicatele vechi ===");
{
  /* Avertismentul scrie acum HTML, ca să poată purta butonul „Pune codurile din bază":
     deci numele trec prin esc(), iar proba se uită la innerHTML. */
  const warn = { style: {}, innerHTML: "" };
  const ctx = {
    state: { participants: [
      { id: "1", cod: 4, prenume: "Ana", nume: "Unu" },
      { id: "2", cod: 4, prenume: "Dan", nume: "Doi" },
      { id: "3", prenume: "Ion", nume: "Trei" }
    ] },
    document: { getElementById: id => id === "warn-cod" ? warn : null },
    String, parseInt, isNaN, Object, Array, Math, Date, JSON,
    isLocked: () => false,
    pescari: []
  };
  ctx.nameOf = p => ((p.prenume || "") + " " + (p.nume || "")).trim();
  vm.createContext(ctx);
  vm.runInContext(["codParticipant", "esc", "faraSemne", "cheiePescar", "pescarCauta",
                   "potrivesteCodurile", "updateWarnCod"]
    .map(n => grabFunction(src, n)).join("\n"), ctx);
  vm.runInContext("updateWarnCod()", ctx);
  t("spune cine n-are cod", /1 pescar fără cod/.test(warn.innerHTML), true);
  t("spune cine are cod dublu", /codul 4 este la Ana Unu și Dan Doi/.test(warn.innerHTML), true);
  t("avertismentul este vizibil", warn.style.display, "block");
  /* baza e goală în proba asta, deci n-are de unde lua coduri: niciun buton */
  t("fără bază, niciun buton de pus coduri", /puneCodurile/.test(warn.innerHTML), false);
}

