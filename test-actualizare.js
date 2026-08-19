/**
 * Aducerea variantei noi pe telefon.
 *
 * Butonul „Adu varianta nouă acum" ștergea cache-ul aplicației și service worker-ul,
 * apoi reîncărca ACEEAȘI adresă. Cache-ul propriu al browserului nu se șterge de
 * acolo, iar GitHub Pages trimite max-age=600: navigarea putea servi exact fișierul
 * vechi încă zece minute. Omul apăsa butonul, vedea tot varianta veche și n-avea de
 * unde ști de ce.
 *
 * A doua capcană era în service worker: `addAll` ia fișierele prin cache-ul
 * browserului, deci versiunea nouă putea salva în cache-ul ei exact index.html-ul
 * vechi — totul părea actualizat fără să fie.
 *
 * Testul rulează codul REAL din index.html și sw.js.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));
const sw = citeste(path.join(RADACINA, "sw.js"));

/* ================================================================
   1. Butonul cere o adresă pe care browserul n-a mai văzut-o
   ================================================================ */
console.log("\n=== 1. Reîncărcarea nu poate veni din cache ===");
{
  const ctx = {
    location: { origin: "https://exemplu.ro", pathname: "/concursfeeder/index.html", replace(u){ ctx.cerut = u; } },
    navigator: {}, caches: {}, toast(){}, cerut: null, console
  };
  vm.createContext(ctx);
  vm.runInContext(grabFunction(src, "aduVariantaNoua"), ctx);
  // fără serviceWorker în navigator, funcția merge direct la reîncărcare
  vm.runInContext("aduVariantaNoua()", ctx);

  const u = ctx.cerut;
  t("reîncarcă tot aplicația, de pe același drum",
    u.indexOf("https://exemplu.ro/concursfeeder/index.html") === 0, true);
  t("…dar cu o cheie în plus, ca să nu fie adresa din cache",
    /\?nou=\d+$/.test(u), true);
  t("adresa cerută chiar diferă de cea de acum",
    u !== ctx.location.origin + ctx.location.pathname, true);

  // două apăsări la distanță de o milisecundă nu au voie să ceară aceeași adresă
  const intai = ctx.cerut;
  const t0 = Date.now();
  while (Date.now() === t0) { /* așteptăm schimbarea milisecundei */ }
  vm.runInContext("aduVariantaNoua()", ctx);
  t("două apăsări cer două adrese diferite", ctx.cerut !== intai, true);
}

/* ================================================================
   2. Service worker-ul își umple cache-ul de pe server, nu din cache
   ================================================================ */
console.log("\n=== 2. Instalarea nu salvează fișierul vechi ===");
{
  t('addAll cere fișierele cu cache:"reload"',
    /addAll\(ASSETS\.map\([\s\S]*?new Request\(u, \{ cache: "reload" \}\)/.test(sw), true);
  t("…deci nu mai trece ASSETS direct prin addAll",
    /addAll\(ASSETS\)/.test(sw), false);
  t("versiunea cache-ului e trecută pe listă ca s-o poți urca",
    /var CACHE = "concurs-pescuit-v\d+";/.test(sw), true);
}

/* ================================================================
   3. Cheia de ocolire nu rămâne în adresa pe care o dă omul mai departe
   ================================================================ */
console.log("\n=== 3. Adresa se curăță după încărcare ===");
{
  t("pornirea scoate cheia din adresă", /qp\.delete\("nou"\)/.test(src), true);
  t("…prin replaceState, deci fără o navigare în plus",
    /history\.replaceState\(null, "", location\.pathname/.test(src), true);
  t("codul QR de instalare rămâne pe adresa curată",
    /function installLink\(\)\{ return location\.origin\+location\.pathname; \}/.test(src), true);
}

/* ================================================================
   4. Paginile surori nu rămân în urma aplicației
      „Adu varianta nouă" reîncarcă index.html, dar sezon.html și
      concursuri.html sunt pagini separate: browserul le poate servi din
      cache-ul lui încă zece minute. Omul vedea aplicația nouă și
      clasamentul de sezon vechi — cu „cel mai productiv stand (toate
      locațiile)", adică exact varianta pe care o schimbase.
   ================================================================ */
console.log("\n=== 4. Sezonul nu rămâne la varianta veche ===");
{
  const ctx = { document: { querySelectorAll: function(){ return []; } }, console };
  vm.createContext(ctx);
  vm.runInContext(["catrePagina", "legaPaginileSurori", "meniuLink"]
    .map(n => grabFunction(src, n)).join("\n") + "\nvar appVer='';", ctx);

  vm.runInContext("appVer='80'", ctx);
  t("legătura poartă versiunea aplicației",
    vm.runInContext("catrePagina('sezon.html')", ctx), "sezon.html?v=80");
  t("la fel și concursurile live",
    vm.runInContext("catrePagina('concursuri.html')", ctx), "concursuri.html?v=80");

  vm.runInContext("appVer='81'", ctx);
  t("o versiune nouă cere o adresă nouă",
    vm.runInContext("catrePagina('sezon.html')", ctx), "sezon.html?v=81");

  vm.runInContext("appVer=''", ctx);
  t("fără versiune citită încă, legătura rămâne curată",
    vm.runInContext("catrePagina('sezon.html')", ctx), "sezon.html");

  // legăturile din pagină se rescriu de la bază, deci a doua trecere nu adaugă a doua oară
  const scrise = [];
  ctx.document = { querySelectorAll: function(){
    return [{ getAttribute: function(){ return "sezon.html?v=79"; },
              setAttribute: function(_, v){ scrise.push(v); } }];
  } };
  vm.runInContext("appVer='80'; legaPaginileSurori();", ctx);
  t("o legătură deja versionată se rescrie, nu se lipește de două ori",
    scrise, ["sezon.html?v=80"]);

  // fără rețea, service worker-ul tot trebuie să găsească pagina, chiar dacă adresa diferă
  t("offline, se acceptă ultima copie a paginii, indiferent de adresă",
    /caches\.match\(e\.request, \{ ignoreSearch: true \}\)/.test(sw), true);
}

t.raport();
