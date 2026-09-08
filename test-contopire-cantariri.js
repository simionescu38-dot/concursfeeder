/**
 * Contopirea cântăririlor, când două telefoane scriu în aceeași cameră.
 *
 * Până acum telefonul trimitea TOATĂ starea concursului și serverul o scria peste ce era.
 * Doi arbitri care cântăreau în același minut se ștergeau unul pe altul: al doilea care
 * salva îl acoperea pe primul, iar peștele primului dispărea din clasament. Se putea reface
 * din istoric, dar numai dacă observa cineva.
 *
 * Fiecare captură și fiecare pește extra are acum identitate proprie. Serverul pune înapoi
 * ce lipsește din ce vine, dar NU și ce a fost șters intenționat.
 *
 * Funcția verificată e cea ADEVĂRATĂ, scoasă din worker/index.js — nu o copie care poate
 * diverge de codul pus pe server de mână.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const t = H.creeazaVerificator();
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(H.grabFunction(H.citeste("worker/index.js"), "contopesteCantariri"), sandbox);

/** un pescar cu o manșă: kg cu identitățile lor */
function pescar(id, capturi, extra) {
  const m = { catches: [], catchTimes: [], catchPhotos: [], catchIds: [],
              extras: [], extraTimes: [], extraPhotos: [], extraIds: [] };
  (capturi || []).forEach(([kg, cid]) => {
    m.catches.push(kg); m.catchIds.push(cid); m.catchTimes.push(1000); m.catchPhotos.push(null);
  });
  (extra || []).forEach(([kg, cid]) => {
    m.extras.push(kg); m.extraIds.push(cid); m.extraTimes.push(2000); m.extraPhotos.push(null);
  });
  return { id, nume: id, m: { 1: m } };
}
const stare = (...p) => ({ participants: p });
const contopeste = (dinBaza, venit, sterse) =>
  vm.runInContext(
    `contopesteCantariri(${JSON.stringify(dinBaza)}, ${JSON.stringify(venit)}, ${JSON.stringify(sterse || [])})`,
    sandbox);
/** kg-urile unui pescar din rezultat, sortate, ca ordinea să nu conteze */
const kg = (rez, id) => rez.participants.find(p => p.id === id).m[1].catches.slice().sort((a, b) => a - b);
const kgExtra = (rez, id) => rez.participants.find(p => p.id === id).m[1].extras.slice().sort((a, b) => a - b);

/* ================================================================
   1. Cazul care a motivat schimbarea.
   ================================================================ */
console.log("\n=== 1. Doi arbitri cântăresc în același minut ===");
{
  // pe server e deja peștele cântărit de arbitrul B
  const dinBaza = stare(pescar("ana", [[3, "c1"], [5, "c2"]]));
  // telefonul lui A n-a apucat să-l vadă; el a adăugat altul
  const venit = stare(pescar("ana", [[3, "c1"], [7, "c3"]]));
  const rez = contopeste(dinBaza, venit, []);
  t("peștele celuilalt arbitru NU se pierde", kg(rez, "ana"), [3, 5, 7]);
  t("identitățile rămân câte una de fiecare",
    rez.participants[0].m[1].catchIds.slice().sort(), ["c1", "c2", "c3"]);
  t("orele vin odată cu peștele pus la loc",
    rez.participants[0].m[1].catchTimes.length, 3);
}

/* ================================================================
   2. O ștergere adevărată rămâne ștearsă.
   ================================================================ */
console.log("\n=== 2. Ștergerile intenționate nu învie ===");
{
  const dinBaza = stare(pescar("ana", [[3, "c1"], [5, "c2"]]));
  const venit = stare(pescar("ana", [[3, "c1"]]));           // a șters c2
  t("fără lista de ștergeri, peștele s-ar întoarce (de-aia există lista)",
    kg(contopeste(dinBaza, venit, []), "ana"), [3, 5]);
  t("cu ștergerea anunțată, rămâne șters",
    kg(contopeste(dinBaza, stare(pescar("ana", [[3, "c1"]])), ["c2"]), "ana"), [3]);
}

/* ================================================================
   3. Peștii extra trec prin aceeași regulă.
   ================================================================ */
console.log("\n=== 3. Peștii extra ===");
{
  const dinBaza = stare(pescar("ana", [], [[1.2, "e1"], [0.9, "e2"]]));
  const venit = stare(pescar("ana", [], [[1.2, "e1"], [2.4, "e3"]]));
  t("extra adăugat de celălalt telefon supraviețuiește",
    kgExtra(contopeste(dinBaza, venit, []), "ana"), [0.9, 1.2, 2.4]);
  t("extra șters intenționat rămâne șters",
    kgExtra(contopeste(dinBaza, stare(pescar("ana", [], [[1.2, "e1"]])), ["e2"]), "ana"), [1.2]);
}

/* ================================================================
   4. Ce NU trebuie să schimbe.
   ================================================================ */
console.log("\n=== 4. Fără efecte nedorite ===");
{
  const la_fel = stare(pescar("ana", [[3, "c1"]]));
  t("stări identice rămân neatinse", kg(contopeste(la_fel, stare(pescar("ana", [[3, "c1"]])), []), "ana"), [3]);

  // telefon vechi, dinaintea schimbării: fără identități nu se contopește nimic
  const vechi = { participants: [{ id: "ana", m: { 1: { catches: [3, 5], catchTimes: [1, 2] } } }] };
  const nouFaraId = { participants: [{ id: "ana", m: { 1: { catches: [3], catchTimes: [1] } } }] };
  t("telefon vechi fără identități: se scrie ce vine, ca înainte",
    contopeste(vechi, nouFaraId, []).participants[0].m[1].catches, [3]);

  // pescar care există doar în baza de date
  const doarInBaza = stare(pescar("ana", [[3, "c1"]]), pescar("bogdan", [[9, "c9"]]));
  const doarUnul = stare(pescar("ana", [[3, "c1"]]));
  t("un pescar lipsă din ce vine nu crapă contopirea",
    contopeste(doarInBaza, doarUnul, []).participants.length, 1);

  t("stare goală nu crapă", contopeste({ participants: [] }, { participants: [] }, []).participants.length, 0);
  t("stare fără participanți se întoarce neatinsă",
    JSON.stringify(contopeste(null, { participants: [] }, [])), JSON.stringify({ participants: [] }));
}

/* ================================================================
   5. Trei telefoane, una după alta.
   ================================================================ */
console.log("\n=== 5. Trei telefoane pe rând ===");
{
  let peServer = stare(pescar("ana", [[3, "c1"]]));
  // B adaugă, fără să-l fi văzut pe C
  peServer = contopeste(peServer, stare(pescar("ana", [[3, "c1"], [5, "cB"]])), []);
  // C adaugă, plecând tot de la starea veche cu un singur pește
  peServer = contopeste(peServer, stare(pescar("ana", [[3, "c1"], [7, "cC"]])), []);
  t("toate trei capturile sunt pe server", kg(peServer, "ana"), [3, 5, 7]);
  t("nicio identitate dublată",
    new Set(peServer.participants[0].m[1].catchIds).size, 3);
}

t.raport();
