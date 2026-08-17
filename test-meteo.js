/**
 * Test pentru partea de meteo din index.html.
 *
 * Funcțiile sunt luate VERBATIM din index.html și rulate pe un răspuns REAL
 * de la Open-Meteo, salvat în test-fixtures/meteo-raspuns.json. Testul nu are
 * nevoie de internet: fixture-ul e răspunsul înregistrat.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const raspuns = JSON.parse(H.citeste("test-fixtures/meteo-raspuns.json"));

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(
  ["esc", "unaZec", "p2", "hhmm", "busola", "wxCod", "wxUrl", "wxTrend", "wxCell"]
    .map(n => H.grabFunction(src, n)).join("\n"), sandbox);
const run = expr => vm.runInContext(expr, sandbox);

const t = H.creeazaVerificator();

/* ---------- 1. adresa cerută ---------- */
console.log("\n=== 1. Adresa cerută de la Open-Meteo ===");
const url = run("wxUrl(47.1585, 27.6014)");
t("merge pe HTTPS", /^https:\/\//.test(url), true);
t("nu conține nicio cheie sau token", /key|token|apikey|appid/i.test(url), false);
t("cere tendința presiunii pe ore", url.indexOf("hourly=surface_pressure") > 0, true);
t("cere și ziua trecută (ca să existe 3 ore în urmă la 01:00)", url.indexOf("past_days=1") > 0, true);
t("cere fusul orar local", url.indexOf("timezone=auto") > 0, true);
t("coordonatele sunt rotunjite la 4 zecimale (nu trimite poziția exactă)",
  /latitude=47\.1585&longitude=27\.6014/.test(url), true);

/* ---------- 2. tendința presiunii pe date reale ---------- */
console.log("\n=== 2. Tendința presiunii, pe răspunsul real ===");
sandbox.__j = raspuns;
const trend = run("wxTrend(__j)");
t("se calculează o tendință", typeof trend === "number", true);
// verific independent: diferența dintre ora curentă și cea de acum 3 ore
{
  const ht = raspuns.hourly.time, hp = raspuns.hourly.surface_pressure;
  const acum = raspuns.current.time.slice(0, 13);
  const i = ht.findIndex(x => x.slice(0, 13) === acum);
  t("ora curentă e găsită în șirul orar", i > 0, true);
  t("tendința = presiunea acum − presiunea de acum 3 ore", trend, hp[i] - hp[i - 3], 1e-9);
  t("tendința e o valoare plauzibilă (sub 15 hPa/3h)", Math.abs(trend) < 15, true);
}
// dacă ora curentă nu se găsește, trebuie să întoarcă null, nu un număr greșit
t("răspuns fără potrivire => null, nu o valoare inventată",
  run("wxTrend({current:{time:'1999-01-01T00:00'}, hourly:{time:['2026-01-01T00:00'], surface_pressure:[1000]}})"), null);
t("răspuns gol => null", run("wxTrend({})"), null);
t("prea puține ore în urmă => null",
  run("wxTrend({current:{time:'2026-01-01T02:00'}, hourly:{time:['2026-01-01T00:00','2026-01-01T01:00','2026-01-01T02:00'], surface_pressure:[1000,1001,1002]}})"), null);

/* ---------- 3. traducerea codurilor meteo ---------- */
console.log("\n=== 3. Codurile meteo WMO ===");
t("0 = senin", run("wxCod(0).text"), "senin");
t("3 = acoperit", run("wxCod(3).text"), "acoperit");
t("61 = ploaie slabă", run("wxCod(61).text"), "ploaie slabă");
t("95 = furtună", run("wxCod(95).text"), "furtună");
t("cod necunoscut => text neutru, nu „undefined”", run("wxCod(123).text"), "vreme");
t("codul din răspunsul real e recunoscut",
  run("wxCod(" + raspuns.current.weather_code + ").text") !== "vreme", true);

/* ---------- 4. busola în română ---------- */
console.log("\n=== 4. Direcția vântului ===");
t("0° = N", run("busola(0)"), "N");
t("90° = E", run("busola(90)"), "E");
t("180° = S", run("busola(180)"), "S");
t("270° = V (vest, nu W)", run("busola(270)"), "V");
t("225° = SV", run("busola(225)"), "SV");
t("359° se rotunjește la N", run("busola(359)"), "N");
t("valoare negativă nu strică busola", run("busola(-90)"), "V");
t("peste 360° se normalizează", run("busola(450)"), "E");

/* ---------- 5. formatări ---------- */
console.log("\n=== 5. Formatări românești ===");
t("zecimala se scrie cu virgulă", run("unaZec(1.25)"), "1,3");
t("valoare lipsă => 0", run("unaZec(null)"), "0");
t("ora are două cifre", run("hhmm(new Date(2026,7,7,5,3))"), "05:03");

t.raport();
