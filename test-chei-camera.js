/**
 * Ce are voie arbitrul să schimbe.
 *
 * Serverul avea o singură cheie de scriere, aceeași pentru toate camerele: cine o avea
 * putea scrie oriunde. Bun cât timp organizatorul era unul singur. Ca să poată ține
 * concurs și alt club — și ca arbitrii lui, 2, 3 sau 4, să cântărească de pe telefoanele
 * lor — fiecare cameră are acum cheile ei: una de organizator și una de arbitru.
 *
 * Scrierea unui arbitru NU se respinge niciodată. Respingerea ar însemna cântăriri
 * pierdute la baltă, ceea ce e mai rău decât orice greșeală de-a lui. În schimb se ia
 * din ea doar ce are voie să schimbe: se pleacă de la starea de pe server și se pun
 * peste ea cifrele lui. Ce a rămas vechi pe telefonul lui — numele concursului, tragerea
 * la sorți, lista de pescari — nu ajunge nicăieri.
 *
 * Se rulează funcția ADEVĂRATĂ din worker/index.js, nu o copie care poate diverge de
 * codul pus pe server de mână.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const t = H.creeazaVerificator();
const src = H.citeste("worker/index.js");

const sandbox = { console };
vm.createContext(sandbox);
/* CAMPURI_CANTAR e lista câmpurilor pe care le poate atinge arbitrul — se ia tot din
   fișierul livrat, ca proba să se strice dacă cineva mai adaugă unul pe furiș. */
const listaCampuri = /const CAMPURI_CANTAR = \[[\s\S]*?\];/.exec(src);
if (!listaCampuri) throw new Error("nu găsesc CAMPURI_CANTAR în worker/index.js");
vm.runInContext(listaCampuri[0], sandbox);
/* `const` nu se agață de obiectul contextului — se citește ca expresie. */
const CAMPURI = vm.runInContext("CAMPURI_CANTAR", sandbox);
vm.runInContext(H.grabFunction(src, "doarCantaririle"), sandbox);

/** o manșă cu standul și sectorul ei, plus cântăririle date */
function mansa(stand, sector, kg, ids) {
  return {
    catches: (kg || []).slice(), catchIds: (ids || []).slice(), catchTimes: (kg || []).map(() => 1000),
    extras: [], extraIds: [], extraTimes: [],
    stand: stand, sector: sector,
  };
}
const pescar = (id, nume, m) => ({ id: id, prenume: nume, nume: "Pescaru", m: { "1": m } });
const clona = (o) => JSON.parse(JSON.stringify(o));

/** starea de pe server: doi pescari trași la sorți, fără nicio cântărire */
function peServer() {
  return {
    name: "Cupa de toamnă",
    numManse: 2,
    scalaSectoare: true,
    participants: [
      pescar("p1", "Ion", mansa("7", "A")),
      pescar("p2", "Ana", mansa("12", "B")),
    ],
  };
}
const capturile = (st, id) => st.participants.find((p) => p.id === id).m["1"].catches;
const mansaLui = (st, id) => st.participants.find((p) => p.id === id).m["1"];

/* ================================================================
   1. Ce trece: cifrele de pe cântar.
   ================================================================ */
console.log("\n=== 1. Cifrele arbitrului ajung pe server ===");
{
  const server = peServer();
  const telefon = clona(server);
  mansaLui(telefon, "p1").catches.push(4.2);
  mansaLui(telefon, "p1").catchIds.push("c1");
  mansaLui(telefon, "p1").catchTimes.push(1111);

  const rez = sandbox.doarCantaririle(server, telefon);
  t("cântărirea intră", capturile(rez, "p1"), [4.2]);
  t("cu identitatea ei, ca să nu se piardă la contopire", mansaLui(rez, "p1").catchIds, ["c1"]);
  t("și cu ora la care s-a făcut", mansaLui(rez, "p1").catchTimes, [1111]);
  t("celălalt pescar rămâne cum era", capturile(rez, "p2"), []);
}

/* ================================================================
   2. Ce NU trece — miezul schimbării.
   ================================================================ */
console.log("\n=== 2. Restul telefonului lui nu ajunge nicăieri ===");
{
  const server = peServer();
  const telefon = clona(server);
  // arbitrul are pe telefon o stare veche, sau se joacă
  telefon.name = "Alt nume";
  telefon.numManse = 9;
  telefon.scalaSectoare = false;
  mansaLui(telefon, "p1").stand = "99";
  mansaLui(telefon, "p1").sector = "Z";
  mansaLui(telefon, "p1").catches.push(4.2);
  mansaLui(telefon, "p1").catchIds.push("c1");

  const rez = sandbox.doarCantaririle(server, telefon);
  t("numele concursului rămâne al organizatorului", rez.name, "Cupa de toamnă");
  t("numărul de manșe la fel", rez.numManse, 2);
  t("și felul în care se dau punctele", rez.scalaSectoare, true);
  t("standul din tragerea la sorți nu se clintește", mansaLui(rez, "p1").stand, "7");
  t("nici sectorul", mansaLui(rez, "p1").sector, "A");
  t("dar cântărirea lui tot a intrat", capturile(rez, "p1"), [4.2]);
}

/* ================================================================
   3. Lista de pescari e a organizatorului.
   ================================================================ */
console.log("\n=== 3. Nu poate umbla la lista de pescari ===");
{
  const server = peServer();
  const telefon = clona(server);
  telefon.participants.push(pescar("p9", "Intrus", mansa("3", "A", [10], ["x"])));
  t("nu poate băga un pescar în plus",
    sandbox.doarCantaririle(server, telefon).participants.map((p) => p.id), ["p1", "p2"]);

  const fara = clona(server);
  fara.participants = [fara.participants[0]];
  t("nici să scoată unul",
    sandbox.doarCantaririle(server, fara).participants.map((p) => p.id), ["p1", "p2"]);

  const redenumit = clona(server);
  redenumit.participants[1].prenume = "Altcineva";
  t("nici să schimbe numele cuiva",
    sandbox.doarCantaririle(server, redenumit).participants[1].prenume, "Ana");
}

/* ================================================================
   4. Ștergerea unei cântăriri greșite — Lulu a cerut-o explicit.
   ================================================================ */
console.log("\n=== 4. Poate șterge ce a greșit ===");
{
  const server = peServer();
  mansaLui(server, "p1").catches = [4.2, 9.9];
  mansaLui(server, "p1").catchIds = ["c1", "gresita"];
  mansaLui(server, "p1").catchTimes = [1111, 2222];

  const telefon = clona(server);
  mansaLui(telefon, "p1").catches = [4.2];
  mansaLui(telefon, "p1").catchIds = ["c1"];
  mansaLui(telefon, "p1").catchTimes = [1111];

  const rez = sandbox.doarCantaririle(server, telefon);
  t("cântărirea greșită dispare", capturile(rez, "p1"), [4.2]);
  t("…cu tot cu identitatea ei", mansaLui(rez, "p1").catchIds, ["c1"]);
}

/* ================================================================
   5. Lampă, absent, cel mai mare pește — tot treabă de cântar.
   ================================================================ */
console.log("\n=== 5. Ce se hotărăște la cântar ===");
{
  const server = peServer();
  const telefon = clona(server);
  mansaLui(telefon, "p2").stare = "zero";      // lampă
  mansaLui(telefon, "p1").cmmc = "3.400";      // cel mai mare pește

  const rez = sandbox.doarCantaririle(server, telefon);
  t("„lampă" + '"' + " e hotărâre de cântar, deci trece", mansaLui(rez, "p2").stare, "zero");
  t("cel mai mare pește la fel", mansaLui(rez, "p1").cmmc, "3.400");
}

/* ================================================================
   6. Cazuri-limită. Nimic nu are voie să crape la baltă.
   ================================================================ */
console.log("\n=== 6. Cazuri-limită ===");
{
  const server = peServer();

  t("o stare fără pescari nu crapă",
    sandbox.doarCantaririle(server, { participants: [] }).participants.map((p) => p.id), ["p1", "p2"]);
  t("nici una fără câmpul participants",
    sandbox.doarCantaririle(server, { name: "x" }).participants.map((p) => p.id), ["p1", "p2"]);

  const fantoma = clona(server);
  fantoma.participants[0].m = null;
  t("un pescar fără manșe nu strică nimic",
    capturile(sandbox.doarCantaririle(server, fantoma), "p2"), []);

  const altaMansa = clona(server);
  altaMansa.participants[0].m["3"] = mansa("7", "A", [8], ["m3"]);
  t("o manșă care nu există pe server e ignorată",
    Object.keys(sandbox.doarCantaririle(server, altaMansa).participants[0].m), ["1"]);

  /* Starea de pe server e sfântă: funcția n-are voie s-o schimbe sub mâna
     apelantului, fiindcă din ea se socotește liderul pentru notificări. */
  const inainte = JSON.stringify(server);
  const telefon = clona(server);
  mansaLui(telefon, "p1").catches.push(4.2);
  mansaLui(telefon, "p1").catchIds.push("c1");
  sandbox.doarCantaririle(server, telefon);
  t("starea de pe server nu e atinsă", JSON.stringify(server), inainte);
}

/* ================================================================
   7. Lista câmpurilor: nu se lărgește pe furiș.
   ================================================================ */
console.log("\n=== 7. Ce are voie să atingă, scris o singură dată ===");
{
  t("câmpurile de cântar sunt exact astea", CAMPURI.slice().sort(), [
    "catchIds", "catchPhotos", "catchTimes", "catches", "cmmc",
    "extraIds", "extraPhotos", "extraTimes", "extras", "stare",
  ]);
  t("standul nu e printre ele", CAMPURI.indexOf("stand"), -1);
  t("nici sectorul", CAMPURI.indexOf("sector"), -1);
}

t.raport();
