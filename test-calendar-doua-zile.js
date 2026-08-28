/**
 * Concursuri de două zile în calendar.
 *
 * Unele etape țin două zile, dar câmpul Data ținea o singură zi. Serverul păstrează
 * `event_date` ca TEXT și îl folosește doar în comparații de text:
 *
 *     WHERE event_date >= ?      (ascunde concursurile trecute; prag = azi − o zi)
 *     ORDER BY event_date ASC    (ordinea din calendar)
 *
 * Deci un „2026-09-12/13" care începe cu data de start se poartă exact ca înainte pentru
 * server — se așază la locul lui și rămâne vizibil în amândouă zilele — fără să se atingă
 * worker-ul sau baza de date.
 *
 * Aici se verifică AMÂNDOUĂ părțile: ce scrie aplicația, și cum se poartă serverul cu ce
 * a scris ea. Comparațiile serverului sunt refăcute în test, fiindcă de ele atârnă tot.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

/* ---------- codul adevărat, rulat ---------- */
const ctx = { console };
vm.createContext(ctx);
/** ceas fals: „azi" se mută din test, ca să se poată verifica ziua 1, 2, 3 și după */
let AZI = "2026-09-12";
class CeasFals extends Date {
  constructor(...a) { if (a.length) super(...a); else super(AZI + "T12:00:00Z"); }
  static now() { return new Date(AZI + "T12:00:00Z").getTime(); }
}
ctx.Date = CeasFals;
vm.runInContext(
  ["despartData", "legData", "dateLabelCal", "doarViitoare"].map(n => H.grabFunction(src, n)).join("\n"),
  ctx);
const leg = (a, b) => vm.runInContext("legData(" + JSON.stringify(a) + "," + JSON.stringify(b) + ")", ctx);
const desp = v => vm.runInContext("despartData(" + JSON.stringify(v) + ")", ctx);
const eticheta = v => vm.runInContext("dateLabelCal(" + JSON.stringify(v) + ")", ctx);

/* ================================================================
   1. Ce se scrie în server
   ================================================================ */
console.log("\n=== 1. Cele două date se leagă într-un singur text ===");
t("fără „până la\", rămâne exact ca azi", leg("2026-09-12", ""), "2026-09-12");
t("sfârșit egal cu începutul e tot o zi", leg("2026-09-12", "2026-09-12"), "2026-09-12");
t("două zile în aceeași lună", leg("2026-09-12", "2026-09-13"), "2026-09-12/13");
t("două zile peste graniță de lună", leg("2026-08-31", "2026-09-01"), "2026-08-31/09-01");
t("două zile peste graniță de an", leg("2026-12-31", "2027-01-01"), "2026-12-31/01-01");
// serverul taie la 20 de caractere; dacă textul ar fi mai lung, data s-ar ciunti pe tăcute
t("încape în cele 20 de caractere ale serverului",
  Math.max(leg("2026-09-12", "2026-09-13").length, leg("2026-08-31", "2026-09-01").length) <= 20, true);

/* ================================================================
   2. Cum se poartă SERVERUL cu ce am scris
   Comparațiile de mai jos sunt exact cele din worker/index.js.
   ================================================================ */
console.log("\n=== 2. Filtrul serverului: se vede în amândouă zilele, dispare a treia ===");
/** pragul serverului: ziua de azi minus 24 de ore, tăiat la AAAA-LL-ZZ */
function prag(azi) {
  const d = new Date(azi + "T12:00:00Z");
  return new Date(d.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);
}
/** „WHERE event_date >= prag" — comparație de text, ca în SQLite */
const seVede = (valoare, azi) => valoare >= prag(azi);

{
  const v = leg("2026-09-12", "2026-09-13");
  t("cu o zi înainte, se vede", seVede(v, "2026-09-11"), true);
  t("în ziua 1, se vede", seVede(v, "2026-09-12"), true);
  t("în ziua 2, se vede", seVede(v, "2026-09-13"), true);
  t("a treia zi, dispare", seVede(v, "2026-09-14"), false);
}
{
  // graniță de lună: aici s-ar rupe cel mai ușor comparația de text
  const v = leg("2026-08-31", "2026-09-01");
  t("peste lună — în ziua 1, se vede", seVede(v, "2026-08-31"), true);
  t("peste lună — în ziua 2, se vede", seVede(v, "2026-09-01"), true);
  t("peste lună — a treia zi, dispare", seVede(v, "2026-09-02"), false);
}
{
  // concursul de o zi trebuie să se poarte exact ca înainte de schimbarea asta
  const v = leg("2026-09-12", "");
  t("o zi — în ziua concursului, se vede", seVede(v, "2026-09-12"), true);
  t("o zi — a doua zi, încă se vede (ca azi)", seVede(v, "2026-09-13"), true);
  t("o zi — a treia zi, dispare (ca azi)", seVede(v, "2026-09-14"), false);
}

console.log("\n=== 3. Ordinea din calendar nu se strică ===");
{
  // cele cinci concursuri adevărate ale lui, cu Hammer făcut de două zile
  const lista = ["2026-10-03", "2026-09-04", leg("2026-09-12", "2026-09-13"), "2026-08-27", "2026-09-19"];
  t("se așază exact între 4 și 19 septembrie", lista.slice().sort(),
    ["2026-08-27", "2026-09-04", "2026-09-12/13", "2026-09-19", "2026-10-03"]);
}
{
  // un concurs de o zi în aceeași zi cu unul de două: cel de o zi vine primul
  t("de o zi înaintea celui de două zile, în aceeași zi",
    ["2026-09-12/13", "2026-09-12"].sort(), ["2026-09-12", "2026-09-12/13"]);
}

/* ================================================================
   4. Ce se vede pe card
   ================================================================ */
console.log("\n=== 4. Ce scrie pe cardul din calendar ===");
t("o zi, exact ca azi", eticheta("2026-09-12"), "12.09.2026");
t("două zile în aceeași lună", eticheta("2026-09-12/13"), "12–13.09.2026");
t("două zile peste lună", eticheta("2026-08-31/09-01"), "31.08 – 01.09.2026");
t("liniuță de dialog, nu cratimă", /–/.test(eticheta("2026-09-12/13")), true);

console.log("\n=== 4b. Nu crapă pe nimic ===");
t("gol", eticheta(""), "fără dată");
t("null", eticheta(null), "fără dată");
t("text fără noimă se dă înapoi cum a venit", eticheta("aiurea"), "aiurea");
t("dată strâmbă nu produce o etichetă strâmbă", eticheta("2026-09"), "2026-09");

/* ================================================================
   5. Dus-întors: ce se scrie se citește la fel
   Fără asta, deschiderea la editat ar goli data — input type=date refuză „2026-09-12/13".
   ================================================================ */
console.log("\n=== 5. Editarea desparte înapoi, fără pierdere ===");
[["2026-09-12", ""], ["2026-09-12", "2026-09-13"], ["2026-08-31", "2026-09-01"],
 ["2026-12-31", "2027-01-01"]].forEach(function (p) {
  const scris = leg(p[0], p[1]);
  const citit = desp(scris);
  t("„" + (p[1] || "o zi") + "\" → " + scris + " → înapoi",
    [citit.start, citit.sfarsit], [p[0], p[1] === p[0] ? "" : p[1]]);
  t("…iar relegat dă exact același text", leg(citit.start, citit.sfarsit), scris);
});
t("cele două câmpuri se umplu amândouă la editare",
  desp("2026-09-12/13"), { start: "2026-09-12", sfarsit: "2026-09-13" });
t("la un concurs de o zi, „Până la\" rămâne gol",
  desp("2026-09-12"), { start: "2026-09-12", sfarsit: "" });
/* Anul nu încape în cele 20 de caractere, deci se deduce din calendar: dacă ziua de
   sfârșit cade înaintea celei de început, concursul trece în anul următor. Fără regula
   asta, Revelionul se citea înapoi ca 1 ianuarie 2026 — cu un an în urmă. */
t("31 decembrie → 1 ianuarie ia anul următor",
  desp("2026-12-31/01-01"), { start: "2026-12-31", sfarsit: "2027-01-01" });
t("…dar în cursul anului, anul rămâne cel de început",
  desp("2026-08-31/09-01"), { start: "2026-08-31", sfarsit: "2026-09-01" });

/* ================================================================
   6. Formularul, citit din sursă
   ================================================================ */
console.log("\n=== 6. Formularul și trimiterea ===");
{
  const trimite = H.grabFunction(src, "submitEvent");
  t("citește câmpul nou", /ev-date-end/.test(trimite), true);
  t("leagă datele înainte de trimitere", /legData\s*\(/.test(trimite), true);
  // o dată de sfârșit înaintea începutului ar da un text care se sortează aiurea
  t("refuză un sfârșit înaintea începutului",
    /dataSfarsit\s*&&\s*dataSfarsit\s*<\s*dataStart/.test(trimite), true);
  t("…cu un toast, nu cu o fereastră", /toast\([^)]*Până la/.test(trimite), true);

  /* Nu ajunge ca despartData să fie corectă: editarea trebuie s-o și cheme. Fără asta,
     deschiderea unui concurs de două zile i-ar goli data pe tăcute — input type=date
     refuză „2026-09-12/13" — iar la salvare concursul rămânea fără dată. */
  const editare = H.grabFunction(src, "editEvent");
  t("editarea desparte data înainte s-o pună în formular", /despartData\s*\(/.test(editare), true);
  t("…și umple câmpul de sfârșit", /ev-date-end"\)\.value\s*=/.test(editare), true);
  t("…nu mai pune data brută în câmpul de început",
    /"ev-date"\)\.value\s*=\s*ev\.event_date/.test(editare), false);

  const golire = H.grabFunction(src, "toggleEventForm");
  t("câmpul nou se golește odată cu formularul", /"ev-date-end"/.test(golire), true);

  t("există în pagină, cu eticheta lui",
    /<label class="f">Până la<\/label><input type="date" id="ev-date-end">/.test(src), true);
}

/* ================================================================
   7. Serverul rămâne neatins
   ================================================================ */
console.log("\n=== 7. Nimic nu s-a schimbat pe server ===");
{
  const w = H.citeste("worker/index.js");
  // dacă cineva ar fi trebuit să adauge o coloană, aici s-ar vedea
  t("worker-ul n-are nicio coloană de dată-sfârșit",
    /event_date_end|end_date|dataSfarsit/.test(w), false);
  t("worker-ul ține tot o singură coloană de dată", /event_date/.test(w), true);
  /* Fereastra serverului: opt zile, nu una. `event_date` ține data de ÎNCEPUT, deci cu o
     singură zi de răgaz un concurs de trei zile dispărea din calendar chiar în ultima lui
     zi. Se poate lărgi fiindcă aplicația taie ea ce s-a terminat — proba de mai jos. */
  t("serverul lasă opt zile de răgaz, nu una",
    /Date\.now\(\) - 8 \* 24 \* 3600 \* 1000/.test(w), true);
  t("…și taie tot la 20 de caractere", /eventDate[\s\S]{0,80}slice\(0,\s*20\)/.test(w), true);
}

/* ================================================================
   8. Selecția fină din aplicație
   Serverul întoarce o fereastră largă ca să încapă și concursurile de mai multe zile;
   aici se hotărăște ce chiar se mai vede. Fără partea asta, un concurs de o zi ar rămâne
   agățat în calendar cât ține fereastra serverului.
   ================================================================ */
console.log("\n=== 8. Ce rămâne în calendar, după data de SFÂRȘIT ===");
/** lista pe zile: numele concursurilor care se mai văd în ziua dată */
function inZiua(zi, lista) {
  AZI = zi;
  return vm.runInContext("doarViitoare(" + JSON.stringify(lista) + ").map(function(e){return e.name;})", ctx);
}
{
  const concursuri = [
    { name: "o zi", event_date: "2026-09-12" },
    { name: "două zile", event_date: "2026-09-12/13" },
    { name: "trei zile", event_date: "2026-09-12/14" }
  ];
  t("în ziua 1 se văd toate", inZiua("2026-09-12", concursuri), ["o zi", "două zile", "trei zile"]);
  t("în ziua 2 se văd toate", inZiua("2026-09-13", concursuri), ["o zi", "două zile", "trei zile"]);
  // cel de o zi dispare a treia zi, exact ca înainte de schimbarea asta
  t("în ziua 3 rămân doar cele care încă țin", inZiua("2026-09-14", concursuri), ["două zile", "trei zile"]);
  t("a patra zi rămâne doar cel de trei zile", inZiua("2026-09-15", concursuri), ["trei zile"]);
  t("a cincea zi nu mai rămâne niciunul", inZiua("2026-09-16", concursuri), []);
}
{
  // asta e greșeala pe care o repară: cu fereastra lărgită în worker și fără filtrul de
  // aici, un concurs terminat de o săptămână ar sta mai departe în calendar
  const vechi = [{ name: "terminat demult", event_date: "2026-08-27" }];
  t("un concurs vechi de o săptămână nu mai apare", inZiua("2026-09-04", vechi), []);
}
{
  const pesteLuna = [{ name: "peste lună", event_date: "2026-08-30/09-01" }];
  t("peste lună — în ultima zi, se vede", inZiua("2026-09-01", pesteLuna), ["peste lună"]);
  t("peste lună — a doua zi după, dispare", inZiua("2026-09-03", pesteLuna), []);
}
{
  // o dată stricată nu trebuie să arunce lista la gunoi, nici să crape
  const strambe = [{ name: "fără dată", event_date: "" }, { name: "aiurea", event_date: "aiurea" },
                   { name: "bun", event_date: "2026-09-12" }];
  AZI = "2026-09-12";
  const iesit = vm.runInContext("doarViitoare(" + JSON.stringify(strambe) + ").map(function(e){return e.name;})", ctx);
  t("cel bun trece", iesit.indexOf("bun") >= 0, true);
  t("cel fără dată nu trece", iesit.indexOf("fără dată") < 0, true);
  t("nimic nu crapă", Array.isArray(iesit), true);
}

console.log("\n=== 9. Toate cele trei liste trec prin aceeași selecție ===");
["loadEvents", "loadAcasaRegional", "loadModEvents"].forEach(function (n) {
  t(n + " filtrează lista", /doarViitoare\s*\(/.test(H.grabFunction(src, n)), true);
});
// dacă rămâne vreun „j.events||[]" nefiltrat, o listă scapă prin plasă
t("nicio listă nu mai trece nefiltrată",
  /=\s*j\.events\s*\|\|\s*\[\]/.test(src), false);

t.raport();
