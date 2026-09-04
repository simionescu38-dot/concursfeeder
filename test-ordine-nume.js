/**
 * Aceleași cuvinte, altă ordine.
 *
 * Pe foaia de la baltă numele se scriu adesea cu numele de familie primul —
 * „Muscalu Andrei" — iar în bază omul a intrat din arhivele sezonului, unde e scris
 * invers, „Andrei Muscalu". Din 24 de pescari se găseau 10, iar restul rămâneau fără
 * cod: adică fix munca pe care baza vine s-o scutească.
 *
 * Nu e o ghicire, ca la „Paul Selig" și „Paul Pelin", care diferă cu două litere și
 * sunt doi oameni. Aici sunt EXACT aceleași cuvinte, întoarse.
 *
 * Trei lucruri de care atârnă tot:
 *  - potrivirea întocmai rămâne prima. Dacă baza îi are pe amândoi, scriși în cele două
 *    feluri, fiecare rămâne al lui.
 *  - doi din bază cu aceleași cuvinte = nu se poate ști care e. Rămâne fără cod, se
 *    vede pe ecran, și se pune de mână. Un cod pe cine nu trebuie strică sezonul.
 *  - un nume dintr-un singur cuvânt nu se întoarce nicicum.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = ["uid", "faraSemne", "splitName", "numePescar", "cheiePescar",
  "cheieCuvinte", "scrierileLui", "pescarCauta", "pescarCodNou", "pescarNou",
  "codParticipant", "potrivesteCodurile"];

function lume(baza, concurs) {
  const ctx = {
    console, JSON, Date, Math, parseInt, isNaN, Array, String, Object,
    state: { participants: (concurs || []).map((nm, i) => {
      const sp = nm.indexOf(" ");
      return { id: "c" + i, cod: "", stand: String(i + 1),
               prenume: sp < 0 ? nm : nm.slice(0, sp), nume: sp < 0 ? "" : nm.slice(sp + 1) };
    }) }
  };
  vm.createContext(ctx);
  vm.runInContext("var pescari=[]; var pescariUltimCod=0;", ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  (baza || []).forEach(x => {
    const nm = typeof x === "string" ? x : x.nume;
    const b = vm.runInContext("splitName(" + JSON.stringify(nm) + ")", ctx);
    vm.runInContext("pescari.push(pescarNou(" + JSON.stringify(b.prenume) + "," +
                    JSON.stringify(b.nume) + "))", ctx);
    if (typeof x !== "string" && x.scrieri) {
      vm.runInContext("pescari[pescari.length-1].scrieri=" + JSON.stringify(x.scrieri), ctx);
    }
  });
  return ctx;
}
const gaseste = (c, nume) => vm.runInContext(
  "(function(){var b=splitName(" + JSON.stringify(nume) + ");" +
  "var p=pescarCauta(b.prenume,b.nume); return p?p.cod:null;})()", c);
const cuvinte = (c, nm) => vm.runInContext("cheieCuvinte(" + JSON.stringify(nm) + ")", c);

/* ================================================================
   1. Cheia cuvintelor
   ================================================================ */
console.log("\n=== 1. Cuvintele, puse în ordine ===");
{
  const c = lume([]);
  t("două cuvinte întoarse dau aceeași cheie",
    cuvinte(c, "Muscalu Andrei"), cuvinte(c, "Andrei Muscalu"));
  t("…și e cea alfabetică", cuvinte(c, "Muscalu Andrei"), "andrei muscalu");
  t("diacriticele se pliază la fel", cuvinte(c, "Carâmb Dragoș"), cuvinte(c, "Dragoș Carâmb"));
  t("trei cuvinte merg la fel", cuvinte(c, "Popa Vasile Ion"), cuvinte(c, "Ion Popa Vasile"));
  t("spațiile în plus nu contează", cuvinte(c, "  Muscalu   Andrei "), "andrei muscalu");
  t("un singur cuvânt n-are ce întoarce", cuvinte(c, "Muscalu"), "");
  t("numele gol, la fel", cuvinte(c, ""), "");
  /* cuvinte diferite = oameni diferiți; asta e tot temeiul */
  t("«Paul Selig» și «Paul Pelin» rămân deosebiți",
    cuvinte(c, "Paul Selig") === cuvinte(c, "Paul Pelin"), false);
}

/* ================================================================
   2. Căutarea în bază
   ================================================================ */
console.log("\n=== 2. Foaia scrisă invers găsește omul ===");
{
  const c = lume(["Andrei Muscalu", "Mihai Ionescu", "Vasile Popescu"]);
  t("cum e scris în bază", gaseste(c, "Andrei Muscalu"), 1);
  t("scris invers pe foaie", gaseste(c, "Muscalu Andrei"), 1);
  t("invers și fără diacritice", gaseste(c, "IONESCU MIHAI"), 2);
  t("cine nu-i în bază rămâne negăsit", gaseste(c, "Ion Țăranu"), null);
  t("nici întors", gaseste(c, "Țăranu Ion"), null);
  /* cuvinte care nu-s aceleași nu se potrivesc, oricum ar fi puse */
  t("un cuvânt în plus nu e același om", gaseste(c, "Andrei Muscalu Ion"), null);
  t("un cuvânt în minus, la fel", gaseste(c, "Muscalu"), null);
}

console.log("\n=== 2b. Potrivirea întocmai rămâne prima ===");
{
  /* Baza îi are pe amândoi, scriși în cele două feluri: fiecare rămâne al lui. */
  const c = lume(["Andrei Muscalu", "Muscalu Andrei"]);
  t("primul, după numele lui", gaseste(c, "Andrei Muscalu"), 1);
  t("al doilea, după al lui", gaseste(c, "Muscalu Andrei"), 2);
}

console.log("\n=== 2c. Când nu se poate ști, nu se ghicește ===");
{
  /* Doi oameni din bază duc la aceleași cuvinte, dar niciunul nu e scris ca pe foaie.
     Un cod pus pe cine nu trebuie ar strica tocmai clasamentul de sezon. */
  const c = lume([{ nume: "Andrei Muscalu" }, { nume: "Ion Popa", scrieri: ["Muscalu Andrei"] }]);
  t("scrierea îl găsește pe al doilea, întocmai", gaseste(c, "Muscalu Andrei"), 2);
  const doi = lume([{ nume: "Andrei Muscalu" }, { nume: "Ion Popa", scrieri: ["Andrei Muscalu"] }]);
  t("doi cu aceleași cuvinte: nu se alege niciunul", gaseste(doi, "Muscalu Andrei"), null);
}

console.log("\n=== 2d. Scrierile vechi se întorc și ele ===");
{
  const c = lume([{ nume: "Dragoș Carâmb", scrieri: ["Ciufi Man"] }]);
  t("scrierea, cum a fost strânsă", gaseste(c, "Ciufi Man"), 1);
  t("…și ea, întoarsă", gaseste(c, "Man Ciufi"), 1);
}

/* ================================================================
   3. Plata: codurile se pun pe foaia scrisă invers
   ================================================================ */
console.log("\n=== 3. «Pune codurile», pe o foaie scrisă invers ===");
{
  /* Exact ce era pe telefon: baza scrisă „Prenume Nume", foaia „Nume Prenume". */
  const c = lume(
    ["Andrei Muscalu", "Mihai Ionescu", "Vasile Popescu", "Ion Țăranu"],
    ["Muscalu Andrei", "Ionescu Mihai", "Popescu Vasile", "Cineva Nou"]);
  const g = vm.runInContext("potrivesteCodurile()", c);
  t("trei din patru capătă cod", g.gasiti.map(x => x.cod), [1, 2, 3]);
  t("fiecare, al lui",
    g.gasiti.map(x => x.p.prenume + " " + x.p.nume + "=" + x.cod),
    ["Muscalu Andrei=1", "Ionescu Mihai=2", "Popescu Vasile=3"]);
  t("cel care nu-i în bază rămâne fără", g.fara.map(x => x.prenume + " " + x.nume), ["Cineva Nou"]);
  t("nimic încurcat", g.incurcate.length, 0);
}

console.log("\n=== 3b. Aceeași foaie, scrisă amestecat ===");
{
  /* La baltă lista vine cum vine: unii scriși într-un fel, alții în altul. */
  const c = lume(
    ["Andrei Muscalu", "Mihai Ionescu"],
    ["Andrei Muscalu", "Ionescu Mihai"]);
  const g = vm.runInContext("potrivesteCodurile()", c);
  t("amândoi capătă cod", g.gasiti.map(x => x.cod), [1, 2]);
}

console.log("\n=== 3c. Doi de pe aceeași foaie care duc la același om ===");
{
  /* „Andrei Muscalu" și „Muscalu Andrei" pe aceeași listă: ori s-a scris de două ori,
     ori sunt doi oameni. Nu se poate ști — nu primește niciunul. */
  const c = lume(["Andrei Muscalu"], ["Andrei Muscalu", "Muscalu Andrei"]);
  const g = vm.runInContext("potrivesteCodurile()", c);
  t("niciunul nu capătă cod", g.gasiti.length, 0);
  t("…și se spune că-s încurcați", g.incurcate.map(x => x.cod), [1]);
  t("amândoi sunt arătați", g.incurcate[0].oameni.length, 2);
}

/* ================================================================
   4. Cum e legat în fișierul livrat
   ================================================================ */
console.log("\n=== 4. Legat cum trebuie ===");
{
  const cauta = H.grabFunction(src, "pescarCauta");
  t("întâi se caută întocmai",
    cauta.indexOf("scrierileLui(pescari[i]).indexOf(k)") < cauta.indexOf("cheieCuvinte(k)"), true);
  t("la doi la fel, nu se alege niciunul",
    /if\(gasit && gasit!==pescari\[j\]\) return null;/.test(cauta), true);
  t("se spune de ce nu e o ghicire",
    /sunt EXACT aceleași cuvinte/.test(src), true);
}

t.raport();
