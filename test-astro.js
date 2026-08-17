/**
 * Test pentru calculele de soare/lună din index.html (modulul Astro).
 *
 * Nu există internet la baltă, deci solunarul se calculează local — și atunci
 * trebuie dovedit că e corect. Verificările sunt independente de implementare:
 *
 *  1. Declinația soarelui la solstiții/echinocții — valori din astronomie, nu din cod.
 *  2. Durata zilei: comparăm căutarea prin eșantionare (cum lucrează Astro) cu
 *     FORMULA ÎNCHISĂ a unghiului orar — două metode complet diferite.
 *  3. Simetria răsărit/apus față de amiaza solară.
 *  4. Luna: întârzierea zilnică a răsăritului, faza la lună nouă/plină cunoscute.
 *  5. Cazuri-limită: soare polar (nu crapă), latitudini extreme.
 *
 * Zilele de răsărit/apus se socotesc pe ziua LOCALĂ, deci verificările depind de
 * fusul orar: pe 7 aug 2026 luna răsare la 00:17 pe 8 august la Iași, dar pe un
 * calculator pus pe UTC aceeași clipă cade încă în ziua de 7. Fixăm fusul la cel
 * al bălții, ca testul să dea același verdict pe orice mașină.
 */
process.env.TZ = "Europe/Bucharest";
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(H.grabIIFE(src, "var Astro = (function(){"), sandbox);
const A = sandbox.Astro;

const t = H.creeazaVerificator();
const IASI = { lat: 47.1585, lon: 27.6014 };
const RAD = Math.PI / 180, DEG = 180 / Math.PI;

/* ---------- 1. declinația soarelui: valori cunoscute ---------- */
console.log("\n=== 1. Poziția soarelui față de valori astronomice cunoscute ===");
const decLa = iso => A.sunPos(A.dOf(A.dateToJd(new Date(iso)))).dec;
t("solstițiul de vară 2026: declinație ≈ +23,44°", decLa("2026-06-21T09:00:00Z"), 23.44, 0.05);
t("solstițiul de iarnă 2026: declinație ≈ −23,44°", decLa("2026-12-21T15:00:00Z"), -23.44, 0.05);
t("echinocțiul de primăvară 2026: declinație ≈ 0°", decLa("2026-03-20T14:46:00Z"), 0, 0.05);
t("echinocțiul de toamnă 2026: declinație ≈ 0°", decLa("2026-09-23T00:05:00Z"), 0, 0.05);
// la echinocțiu longitudinea ecliptică a soarelui trece prin 0
const lamEch = A.sunPos(A.dOf(A.dateToJd(new Date("2026-03-20T14:46:00Z")))).lam;
t("echinocțiu: longitudine ecliptică ≈ 0° (sau 360°)", Math.min(lamEch, 360 - lamEch), 0, 0.4);

/* ---------- 2. durata zilei: eșantionare vs formulă închisă ---------- */
console.log("\n=== 2. Durata zilei — eșantionare (Astro) vs formulă închisă ===");
/** unghiul orar al răsăritului, din geometrie pură: cos H = (sin h0 − sinφ sinδ)/(cosφ cosδ) */
function duramaTeoretica(lat, dec, h0) {
  const c = (Math.sin(h0 * RAD) - Math.sin(lat * RAD) * Math.sin(dec * RAD)) /
            (Math.cos(lat * RAD) * Math.cos(dec * RAD));
  if (c <= -1) return 24; if (c >= 1) return 0;
  return 2 * Math.acos(c) * DEG / 15;
}
const cazuri = [
  ["Iași, solstițiul de vară", "2026-06-21T12:00:00Z", IASI.lat, IASI.lon],
  ["Iași, solstițiul de iarnă", "2026-12-21T12:00:00Z", IASI.lat, IASI.lon],
  ["Iași, echinocțiu", "2026-03-20T12:00:00Z", IASI.lat, IASI.lon],
  ["Iași, azi (7 aug 2026)", "2026-08-07T12:00:00Z", IASI.lat, IASI.lon],
  ["ecuator, echinocțiu", "2026-03-20T12:00:00Z", 0.0, 0.0],
  ["Cape Town (sud), iulie", "2026-07-15T12:00:00Z", -33.92, 18.42]
];
for (const [nume, iso, lat, lon] of cazuri) {
  const dt = new Date(iso);
  const e = A.events(dt, lat, lon);
  if (e.rasaritSoare === null || e.apusSoare === null) { console.log("  ⚠️  " + nume + ": fără răsărit/apus"); continue; }
  const durataEsantionata = (e.apusSoare - e.rasaritSoare) * 24;
  const decAmiaza = A.sunPos(A.dOf((e.rasaritSoare + e.apusSoare) / 2)).dec;
  const durataTeoretica = duramaTeoretica(lat, decAmiaza, -0.833);
  t(nume + ": durata zilei (ore)", durataEsantionata, durataTeoretica, 0.05);
}

/* ---------- 3. simetria față de amiaza solară ---------- */
console.log("\n=== 3. Simetria răsărit/apus față de amiaza solară ===");
{
  const dt = new Date("2026-08-07T12:00:00Z");
  const e = A.events(dt, IASI.lat, IASI.lon);
  const mijloc = (e.rasaritSoare + e.apusSoare) / 2;
  // la mijlocul intervalului soarele trebuie să fie la unghi orar ~0 (deci la maxim)
  const altMijloc = A.altOf(A.sunPos(A.dOf(mijloc)), A.dOf(mijloc), IASI.lat, IASI.lon);
  const altInainte = A.altOf(A.sunPos(A.dOf(mijloc - 20 / 1440)), A.dOf(mijloc - 20 / 1440), IASI.lat, IASI.lon);
  const altDupa = A.altOf(A.sunPos(A.dOf(mijloc + 20 / 1440)), A.dOf(mijloc + 20 / 1440), IASI.lat, IASI.lon);
  t("la mijloc soarele e mai sus decât cu 20 min înainte", altMijloc > altInainte, true);
  t("la mijloc soarele e mai sus decât cu 20 min după", altMijloc > altDupa, true);
  // înălțimea la răsărit trebuie să fie exact pragul folosit
  const altRasarit = A.altOf(A.sunPos(A.dOf(e.rasaritSoare)), A.dOf(e.rasaritSoare), IASI.lat, IASI.lon);
  t("la momentul răsăritului, înălțimea soarelui = −0,833°", altRasarit, -0.833, 0.01);
}

/* ---------- 4. luna ---------- */
console.log("\n=== 4. Luna ===");
{
  // luna răsare în medie cu ~50 min mai târziu în fiecare zi (între ~20 și ~80)
  let intarzieri = [];
  for (let i = 0; i < 20; i++) {
    const d1 = new Date(2026, 7, 1 + i, 12), d2 = new Date(2026, 7, 2 + i, 12);
    const r1 = A.events(d1, IASI.lat, IASI.lon).rasaritLuna;
    const r2 = A.events(d2, IASI.lat, IASI.lon).rasaritLuna;
    if (r1 && r2) intarzieri.push((r2 - r1) * 1440 - 1440);
  }
  const medie = intarzieri.reduce((a, b) => a + b, 0) / intarzieri.length;
  t("întârzierea zilnică medie a răsăritului lunar ≈ 50 min", medie, 50, 12);
  // la 47°N întârzierea variază real între ~15 și ~90 min de-a lungul lunii
  t("toate întârzierile sunt în intervalul plauzibil 10–95 min",
    intarzieri.every(v => v > 10 && v < 95), true);

  // zilele fără răsărit/apus lunar sunt reale, nu erori — pe 7 aug 2026 luna
  // răsare abia la 00:17 pe 8, deci ziua de 7 nu are răsărit deloc
  const fara = A.events(new Date(2026, 7, 7, 12), IASI.lat, IASI.lon);
  t("7 aug 2026 la Iași: nicio răsărire de lună (corect, nu bug)", fara.rasaritLuna, null);
  t("dar apusul lunar există în aceeași zi", fara.apusLuna !== null, true);
  t("perioadele acelei zile sar peste evenimentul lipsă",
    A.perioade(new Date(2026, 7, 7, 12), IASI.lat, IASI.lon)
      .filter(p => p.eticheta === "răsărit de lună").length, 0);

  // faza la lună nouă/plină, din perioada sinodică (constantă astronomică independentă)
  const NOUA_REF = Date.UTC(2000, 0, 6, 18, 14) / 86400000 + 2440587.5; // lună nouă cunoscută
  const SINODIC = 29.530588853;
  const nou = A.jdToDate(NOUA_REF + SINODIC * 327);   // o lună nouă din 2026
  const plin = A.jdToDate(NOUA_REF + SINODIC * 327.5); // luna plină imediat următoare
  const fNou = A.faza(nou), fPlin = A.faza(plin);
  t("la lună nouă iluminarea e aproape 0", fNou.iluminat, 0, 0.06);
  t("la lună plină iluminarea e aproape 1", fPlin.iluminat, 1, 0.06);
  t("numele fazei la lună nouă", fNou.nume, "Lună nouă");
  t("numele fazei la lună plină", fPlin.nume, "Lună plină");

  // luna sus (meridian) trebuie să fie momentul de altitudine maximă din zi
  const dt = new Date(2026, 7, 7, 12);
  const e = A.events(dt, IASI.lat, IASI.lon);
  if (e.lunaSus) {
    const alt = x => A.altOf(A.moonPos(A.dOf(x)), A.dOf(x), IASI.lat, IASI.lon);
    t("la trecerea la meridian luna e mai sus decât cu o oră înainte", alt(e.lunaSus) > alt(e.lunaSus - 1 / 24), true);
    t("la trecerea la meridian luna e mai sus decât cu o oră după", alt(e.lunaSus) > alt(e.lunaSus + 1 / 24), true);
  }
}

/* ---------- 5. perioadele solunare ---------- */
console.log("\n=== 5. Perioadele solunare ===");
{
  const p = A.perioade(new Date(2026, 7, 8, 12), IASI.lat, IASI.lon);
  t("se generează cel puțin 2 perioade", p.length >= 2, true);
  t("sunt sortate cronologic", p.every((x, i) => i === 0 || x.start >= p[i - 1].start), true);
  const maj = p.filter(x => x.tip === "major"), min = p.filter(x => x.tip === "minor");
  t("perioadele majore durează 2 ore",
    maj.every(x => Math.abs((x.sfarsit - x.start) / 60000 - 120) < 0.001), true);
  t("perioadele minore durează 1 oră",
    min.every(x => Math.abs((x.sfarsit - x.start) / 60000 - 60) < 0.001), true);
  t("fiecare perioadă e centrată pe evenimentul ei",
    p.every(x => Math.abs((x.centru - x.start) - (x.sfarsit - x.centru)) < 1000), true);
}

/* ---------- 6. cazuri-limită ---------- */
console.log("\n=== 6. Cazuri-limită (nu trebuie să crape) ===");
{
  let crapat = false, rez = null;
  try { rez = A.events(new Date("2026-06-21T12:00:00Z"), 78.2, 15.6); } // Svalbard, soare polar
  catch (e) { crapat = true; }
  t("soare polar (Svalbard, iunie): nu aruncă eroare", crapat, false);
  t("soare polar: nu raportează răsărit fals", rez && rez.rasaritSoare, null);
  let crapat2 = false;
  try { A.events(new Date("2026-12-21T12:00:00Z"), -89, 0); A.faza(new Date("2026-12-21T12:00:00Z")); }
  catch (e) { crapat2 = true; }
  t("aproape de Polul Sud, în decembrie: nu aruncă eroare", crapat2, false);
}

t.raport();
