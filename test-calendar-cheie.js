/**
 * Editează / Șterge în calendar, și cu cheia de scriere.
 *
 * „Cupa Sf Dumitru nu mai pot edita in ea." Concursul fusese publicat de pe alt telefon,
 * deci jetonul lui nu era în telefonul ăsta — iar butoanele apăreau doar cu jetonul.
 * Serverul primea însă cheia de scriere demult (`worker/index.js`, `isAdmin`), la fel de
 * bine ca jetonul: avea dreptul, dar nu avea butonul.
 *
 * Aici se rulează codul ADEVĂRAT din index.html — `renderEventsList` cu un DOM minim, iar
 * `submitEvent` / `deleteEvent` cu un `fetch` fals care prinde antetele trimise. Ce se
 * verifică nu e că butoanele apar, ci că apar EXACT când telefonul are cu ce să scrie, și
 * că pleacă antetul potrivit.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const CONCURSURI = [
  { id: "e1", name: "Cupa Sf Dumitru", location: "Remus Lake", event_date: "2026-10-25",
    type: "Feeder", organizer: "Feeder Moldova Iași" },
  { id: "e2", name: "Cupa Toamnei", location: "Bazinul Trofee", event_date: "2026-11-08" }
];

/**
 * pornește aplicația într-un telefon fals: `jetoane` = ce e salvat în telefon,
 * `cheie` = cheia de scriere din Setări. Întoarce ce s-a desenat și ce a plecat.
 */
function telefon(cfg) {
  const lista = { innerHTML: "" };
  const cereri = [];
  const toasturi = [];
  const intrebari = [];
  const ctx = {
    console, encodeURIComponent, JSON,
    API_BASE: "https://exemplu",
    eventsCache: (cfg.concursuri || CONCURSURI).slice(),
    eventTypeFilter: "",
    syncKey: cfg.cheie || "",
    localStorage: {
      getItem: () => JSON.stringify(cfg.jetoane || {}),
      setItem: () => {},
      removeItem: () => {}
    },
    EVENT_TOKENS_KEY: "jetoane",
    toast: m => toasturi.push(m),
    confirm: m => { intrebari.push(m); return cfg.raspundeNu ? false : true; },
    loadEvents: () => {},
    toggleEventForm: () => {},
    document: {
      getElementById: id => id === "cal-events-list" ? lista : campuri[id] || null
    }
  };
  // formularul de editare, doar cât îi trebuie lui submitEvent
  const campuri = {
    "ev-edit-id": { value: cfg.editId || "" },
    "ev-name": { value: "Cupa Sf Dumitru" },
    "ev-location": { value: "Remus Lake" },
    "ev-date": { value: "2026-10-25" },
    "ev-date-end": { value: "" },
    "ev-type": { value: "Feeder" },
    "ev-fee": { value: "150 lei" },
    "ev-slots": { value: "30" },
    "ev-taken": { value: "12" },
    "ev-organizer": { value: "Feeder Moldova Iași" },
    "ev-contact": { value: "0740 000 000" }
  };
  ctx.fetch = function (url, o) {
    cereri.push({ url: url, metoda: (o && o.method) || "GET", antete: (o && o.headers) || {} });
    return Promise.resolve({ json: () => Promise.resolve({ ok: true }) });
  };
  vm.createContext(ctx);
  vm.runInContext(
    ["esc", "despartData", "legData", "dateLabelCal", "eventTokens", "saveEventToken",
     "removeEventToken", "renderTypeFilterChips", "renderEventsList", "submitEvent",
     "deleteEvent"].map(n => H.grabFunction(src, n)).join("\n"), ctx);
  /** ultima cerere plecată; dacă n-a plecat niciuna, un gol care se poate citi fără să
      crape testul — altfel o pază stricată ar arunca o eroare în loc să pice curat */
  const ultima = () => cereri[cereri.length - 1] || { url: null, metoda: null, antete: {} };
  return {
    deseneaza() { vm.runInContext("renderEventsList();", ctx); return lista.innerHTML; },
    editeaza() { vm.runInContext("submitEvent();", ctx); return ultima(); },
    sterge(id) { vm.runInContext("deleteEvent(" + JSON.stringify(id) + ");", ctx); return ultima(); },
    cereri, toasturi, intrebari
  };
}

const areButoane = html => /editEvent\('e1'\)/.test(html) && /deleteEvent\('e1'\)/.test(html);

/* ================================================================
   1. Butoanele: când apar și când nu
   ================================================================ */
console.log("\n=== 1. Cine vede Editează / Șterge ===");
t("telefonul care a publicat concursul le vede (ca până acum)",
  areButoane(telefon({ jetoane: { e1: "jeton-1" } }).deseneaza()), true);
t("cu cheia de scriere, fără jeton, le vede și el ← schimbarea",
  areButoane(telefon({ cheie: "cheia-mea" }).deseneaza()), true);
t("fără nimic, pescarul care doar se uită nu vede niciun buton",
  areButoane(telefon({}).deseneaza()), false);
{
  // cheia deschide tot calendarul, nu doar concursul lui — asta a cerut, cu riscul spus
  const html = telefon({ cheie: "cheia-mea" }).deseneaza();
  t("…și le vede la TOATE concursurile, nu doar la ale lui",
    /deleteEvent\('e2'\)/.test(html), true);
}
{
  const html = telefon({ jetoane: { e1: "jeton-1" } }).deseneaza();
  t("cu jeton doar pentru unul, la celălalt tot nu apar",
    /editEvent\('e2'\)/.test(html), false);
}
t("restul cardului rămâne neatins: numele concursului se vede",
  /Cupa Sf Dumitru/.test(telefon({}).deseneaza()), true);

/* ================================================================
   2. Modificarea: ce antet pleacă spre server
   ================================================================ */
console.log("\n=== 2. Antetul la modificare ===");
{
  const c = telefon({ editId: "e1", jetoane: { e1: "jeton-1" } }).editeaza();
  t("cu jeton: metoda e PUT", c.metoda, "PUT");
  t("…și pleacă jetonul", c.antete["x-manage-token"], "jeton-1");
  t("…fără cheie în antet", c.antete["x-write-key"], undefined);
}
{
  const c = telefon({ editId: "e1", cheie: "cheia-mea" }).editeaza();
  t("fără jeton, dar cu cheie: pleacă cheia", c.antete["x-write-key"], "cheia-mea");
  t("…fără jeton gol lipit în antet", c.antete["x-manage-token"], undefined);
  t("…și rămâne PUT, cu tipul conținutului", [c.metoda, c.antete["Content-Type"]],
    ["PUT", "application/json"]);
}
{
  // jetonul e al telefonului care a publicat: nu se umblă cu cheia de stăpân degeaba
  const c = telefon({ editId: "e1", jetoane: { e1: "jeton-1" }, cheie: "cheia-mea" }).editeaza();
  t("cu amândouă, jetonul are întâietate", c.antete["x-manage-token"], "jeton-1");
  t("…iar cheia nu se mai trimite", c.antete["x-write-key"], undefined);
}
{
  const f = telefon({ editId: "e1" });
  f.editeaza();
  t("fără nimic: nu se trimite nimic la server", f.cereri.length, 0);
  t("…și i se spune de ce", /nu poți edita/i.test(f.toasturi.join(" ")), true);
}

/* ================================================================
   3. Ștergerea: antetul și cât de tare se întreabă
   ================================================================ */
console.log("\n=== 3. Antetul și întrebarea la ștergere ===");
{
  const f = telefon({ jetoane: { e1: "jeton-1" } });
  const c = f.sterge("e1");
  t("cu jeton: DELETE cu jetonul", [c.metoda, c.antete["x-manage-token"]], ["DELETE", "jeton-1"]);
  t("…întrebarea scurtă, e concursul lui", f.intrebari[0], "Ștergi acest concurs din calendar?");
}
{
  const f = telefon({ cheie: "cheia-mea" });
  const c = f.sterge("e1");
  t("fără jeton, cu cheie: DELETE cu cheia", [c.metoda, c.antete["x-write-key"]], ["DELETE", "cheia-mea"]);
  // o apăsare greșită umblă în anunțul altuia: întrebarea trebuie să se audă altfel
  t("…întrebarea spune că poate fi al altcuiva",
    /postat eventual de altcineva/.test(f.intrebari[0]), true);
  t("…și că nu se poate reveni", /nu se poate reveni/i.test(f.intrebari[0]), true);
}
{
  const f = telefon({ cheie: "cheia-mea", raspundeNu: true });
  f.sterge("e1");
  t("dacă răspunde „nu\", nu pleacă nicio ștergere", f.cereri.length, 0);
}
{
  const f = telefon({});
  f.sterge("e1");
  t("fără nimic: nu se trimite nimic", f.cereri.length, 0);
  t("…și i se spune de ce", /nu poți șterge/i.test(f.toasturi.join(" ")), true);
}

/* ================================================================
   4. Serverul rămâne neatins
   ================================================================ */
console.log("\n=== 4. Pe server nu s-a umblat ===");
{
  const w = H.citeste("worker/index.js");
  t("worker-ul primea deja cheia la /api/events/edit",
    /events\/edit[\s\S]{0,400}x-write-key/.test(w), true);
  t("…și o socotea drept drept de stăpân", /isAdmin\s*=\s*!!writeKey\s*&&\s*writeKey\s*===\s*env\.WRITE_KEY/.test(w), true);
  t("…iar fără ea și fără jeton, tot refuză",
    /if \(!isAdmin && \(!token \|\| token !== row\.manage_token\)\)/.test(w), true);
}

t.raport();
