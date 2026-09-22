/**
 * Lista de participanți, lipită de pe WhatsApp.
 *
 * Organizatorul nu stă la baltă cu telefonul: ia mesajul de pe grup și trece lista de
 * acasă. Mesajul vine întreg — titlu cu dată, orele programului, taxele, un „Lista
 * înscrieri:" — iar importul lua totul drept oameni: „200 de lei" intra ca standul 200
 * al pescarului „de lei". În plus, numele numerotate fără spațiu („1.Remus Catalin")
 * își pierdeau standul și rămâneau cu cifra lipită de nume — de acolo veneau pescarii
 * numiți „6.Cristi Enache" din concursurile trecute.
 *
 * Din 14 pescari ieșeau 24 de participanți, așa că lista se trecea de mână, unul câte
 * unul, la fiecare etapă.
 *
 * Testul rulează codul REAL din index.html, pe un mesaj adevărat de pe grup.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(grabFunction(src, "parseImport"), ctx);

function citesteLista(text) {
  ctx.__t = text;
  const r = vm.runInContext("parseImport(__t)", ctx);
  return { lista: r.map(x => ({ stand: x.stand, name: x.name, sector: x.sector })), ignorate: r.ignorate || [] };
}

/* ================================================================
   1. Mesajul adevărat de pe grup
   ================================================================ */
console.log("\n=== 1. Un mesaj întreg de pe WhatsApp ===");
{
  const r = citesteLista(citeste(path.join(RADACINA, "test-fixtures/lista-whatsapp.txt")));

  t("iese exact lista de înscriși, nu și mesajul din jur", r.lista.length, 14);
  t("primul e al standului 1, cu numele curat",
    [r.lista[0].stand, r.lista[0].name], ["1", "Remus Catalin"]);
  t("numerotarea fără spațiu nu mai rămâne lipită de nume",
    r.lista.some(x => /^\d/.test(x.name)), false);
  t("standurile ies 1…14, în ordine",
    r.lista.map(x => x.stand), ["1","2","3","4","5","6","7","8","9","10","11","12","13","14"]);
  t("merge și când numerotarea are spațiu (10. Cristi Radovici)",
    r.lista[9], { stand: "10", name: "Cristi Radovici", sector: "" });
  t("un nume scurt, tot majuscule, rămâne cum e", r.lista[12].name, "TOX");

  t("taxele nu mai devin pescari",
    r.lista.some(x => /lei|balta|castigator/i.test(x.name)), false);
  t("orele programului nu mai devin pescari",
    r.lista.some(x => /intalnirea|tragerea|nadirea|start|stop/i.test(x.name)), false);
  t("nici titlul, nici antetul listei",
    r.lista.some(x => /Caciula|Lista inscrieri/i.test(x.name)), false);

  // ce a fost sărit se spune pe nume: dacă printre rânduri e un pescar, se vede
  t("rândurile sărite se raportează", r.ignorate.length, 10);
  t("…iar printre ele e chiar titlul", r.ignorate[0], "Caciula de sambata 22.08.2026");
  t("…și taxa care înainte devenea stand", r.ignorate.indexOf("200 de lei") >= 0, true);
}

/* ================================================================
   2. Formele vechi merg mai departe
   ================================================================ */
console.log("\n=== 2. Ce mergea înainte merge la fel ===");
{
  const virgule = citesteLista("1, Ion Popescu, A\n2, Vasile Ionescu, A\nGheorghe Marin, B");
  t("stand, nume, sector — formatul scris în aplicație",
    virgule.lista, [{stand:"1",name:"Ion Popescu",sector:"A"},
                    {stand:"2",name:"Vasile Ionescu",sector:"A"},
                    {stand:"",name:"Gheorghe Marin",sector:"B"}]);

  const simple = citesteLista("Ion Popescu\nVasile Ionescu\nGheorghe Marin");
  t("o listă de nume, fără numere", simple.lista.map(x => x.name),
    ["Ion Popescu","Vasile Ionescu","Gheorghe Marin"]);
  t("…și nimic sărit din ea", simple.ignorate.length, 0);

  const spatiu = citesteLista("1 Ion Popescu\n2 Vasile Ionescu");
  t("număr și nume, fără separator", spatiu.lista.map(x => x.stand+":"+x.name),
    ["1:Ion Popescu","2:Vasile Ionescu"]);

  const liniuta = citesteLista("1 - Ion Popescu\n2 - Vasile Ionescu");
  t("cu liniuță", liniuta.lista.map(x => x.stand), ["1","2"]);

  const paranteza = citesteLista("1)Ion Popescu\n2)Vasile Ionescu");
  t("cu paranteză, fără spațiu", paranteza.lista.map(x => x.stand+":"+x.name),
    ["1:Ion Popescu","2:Vasile Ionescu"]);
}

/* ================================================================
   3. Ce NU are voie să treacă drept pescar
   ================================================================ */
console.log("\n=== 3. Cifre care nu sunt standuri ===");
{
  const ore = citesteLista("1.Ion Popescu\n2.Vasile Ionescu\n08.50 nadirea\n22.08.2026");
  t("o oră scrisă cu punct nu e un stand",
    ore.lista.some(x => /nadirea/.test(x.name)), false);
  t("nici o dată", ore.lista.some(x => /2026/.test(x.name)), false);
  t("dar pescarii rămân", ore.lista.length, 2);

  // un singur rând numerotat printre nume nu transformă lista în listă numerotată,
  // altfel un „1. ceva" rătăcit ar arunca restul oamenilor la gunoi
  const unul = citesteLista("Ion Popescu\nVasile Ionescu\n1. ceva scris aiurea");
  t("un singur rând numerotat nu aruncă restul listei", unul.lista.length, 3);

  const gol = citesteLista("");
  t("text gol nu crapă", gol.lista.length, 0);
  t("…și n-are ce sări", gol.ignorate.length, 0);
}

/* ================================================================
   N. Ușa care ADAUGĂ spune ce ai și ce vei avea
   ================================================================

   Sâmbătă dimineață, cu 35 de oameni care așteptau, foaia de tragere a intrat pe ușa
   de alături — cea care adaugă, nu cea care mută. Din 35 de pescari s-au făcut 61, cu
   13 nume duble și 18 standuri date de două-trei ori. Nimic nu l-a oprit: mesajul
   „Am găsit 35 participanți" era adevărat și liniștitor.

   Acum ușa spune cifra pe care omul o face oricum în cap — și întreabă, dar NUMAI când
   lista aduce oameni care sunt deja înăuntru.
   ================================================================ */
console.log("\n=== Ușa care adaugă: ce ai, ce vei avea ===");
{
  /* numele lui adevărate, scrise pe listă altfel decât pe foaia de tragere */
  const om = (prenume, nume) => ({ id: "p" + prenume + nume, prenume, nume,
    stand: "", sector: "", m: {} });
  const lot = [om("Mahu", "George"), om("Năstase", "Adrian"), om("Lazar", "Adrian"),
               om("Vizitiu", "Dragoș"), om("Catalin", "Canuta")];

  const c = { console, state: { participants: JSON.parse(JSON.stringify(lot)) } };
  vm.createContext(c);
  ["faraSemne", "nameOf", "pescarulTragerii", "dejaInConcurs"]
    .forEach((n) => vm.runInContext(grabFunction(src, n), c));
  const deja = (nume) => vm.runInContext(
    "dejaInConcurs(" + JSON.stringify(nume.map((n) => ({ name: n }))) + ").length", c);

  /* Exact perechile de sâmbătă: foaia de tragere scria numele pe dos. */
  t("„George Mahu” e recunoscut ca „Mahu George”", deja(["George Mahu"]), 1);
  t("…și „Adrian Nastase” ca „Năstase Adrian”, fără diacritice", deja(["Adrian Nastase"]), 1);
  t("…și „Cătălin Cănuță” ca „Catalin Canuta”", deja(["Cătălin Cănuță"]), 1);
  t("toată foaia de tragere e recunoscută",
    deja(["George Mahu", "Adrian Nastase", "Adrian Lazăr", "Dragoș Vizitiu", "Cătălin Cănuță"]), 5);
  t("…iar un întârziat adevărat nu e", deja(["Ion Temciuc"]), 0);
  t("…și nici lista goală", deja([]), 0);

  /* Rândul de dinaintea apăsării */
  const f = grabFunction(src, "previewImport");
  t("rândul spune câți ai acum", /Ai <b>'\+acum\+'<\/b> în concurs/.test(f), true);
  t("…și câți vei avea după", /vei avea <b>'\+\s*\(acum\+arr\.length\)\+'<\/b>/.test(f), true);
  t("…și apare doar când chiar ai pe cineva", /var acum=\(state\.participants\|\|\[\]\)\.length;\s*if\(acum\)/.test(f), true);
  t("…iar când unii sunt deja înăuntru, arată ușa cealaltă",
    /Trec tragerea la sorți/.test(f), true);

  /* Oprirea de dinaintea adăugării — pentru cine nu apasă „Verifică" */
  const d = grabFunction(src, "doImport");
  t("ușa întreabă înainte să adauge oameni care-s deja înăuntru",
    /if\(deja\.length && !confirm\(/.test(d), true);
  t("…și spune în întrebare ce ai și ce vei avea",
    /Ai "\+acum\+", vei avea "\+\(acum\+arr\.length\)/.test(d), true);
  t("…și trimite spre ușa care MUTĂ", /Trec tragerea la sorți/.test(d), true);
  t("…dar tace când concursul e gol", /var acum=\(state\.participants\|\|\[\]\)\.length;\s*if\(acum\)\{/.test(d), true);
  t("…și tace și când niciun nume nu e deja înăuntru",
    /deja\.length && !confirm/.test(d), true);
}

{
  const m = citeste(path.join(RADACINA, "sw.js")).match(/concurs-pescuit-v(\d+)/);
  t("telefonul ia varianta nouă (v206 sau mai nouă)", m && parseInt(m[1], 10) >= 206, true);
}

t.raport();
