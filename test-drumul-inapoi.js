/**
 * Drumul înapoi, la fel de pe toate ecranele.
 *
 * „Mie mi se pare neorganizată." Măsurat: aplicația are unsprezece ecrane și trei uși
 * în bara de jos — dar are deja un arbore, scris în `TAB_PARINTE`: opt ecrane atârnă de
 * Acasă, unul de Contul meu, iar Calendarul e singur.
 *
 * Strâmb era drumul ÎNAPOI. Cinci ecrane aveau „‹ Înapoi la Acasă"; Clasamentul n-avea
 * nimic (ieșeai doar pe bara de jos), iar „Verifică și publică" scria „‹ Înapoi la
 * Cântar" — un ecran pe care organizatorul nu-l vede niciodată, de când cântarul a
 * intrat în scară ca treapta a patra. Cinci frați cu ușă, unul fără și unul cu ușa
 * scrisă greșit: exact ce se simte drept „neorganizată".
 *
 * Proba ține regula pe loc pentru ecranele care vor mai fi adăugate.
 *
 * Codul e scos VERBATIM din index.html.
 */
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

/* ================================================================
   1. Ecranele și ce-i în ele
   ================================================================ */
const ecrane = {};
{
  const poz = [];
  const rx = /<section class="view[^"]*"[^>]*id="view-([^"]+)"/g;
  let m;
  while ((m = rx.exec(src)) !== null) poz.push([m.index, m[1]]);
  poz.forEach(function (p, i) {
    const pana = i + 1 < poz.length ? poz[i + 1][0] : src.length;
    let b = src.slice(p[0], pana);
    const inch = b.indexOf("</section>");
    if (inch >= 0) b = b.slice(0, inch);
    ecrane[p[1]] = b;
  });
}

/** ușile din bara de jos: ele nu au nevoie de drum înapoi, sunt capătul drumului */
const USI = ["part", "cal", "set"];
/* Ecranul arbitrului: el n-are alte ecrane, deci n-are de unde se întoarce.
   „Cântare de pe poză" are ieșirea lui, jos — „Renunț" — și un al doilea buton de
   ieșire ar fi unul în plus fără rost. */
const SCUTITE = { cantar: "e ecranul arbitrului", poze: "are „Renunț” jos" };

const inapoiul = (b) => {
  const m = b.match(/<button class="btn-link"[^>]*onclick="showView\('([a-z]+)'\)"[^>]*>\s*([^<]*)/);
  return m ? { catre: m[1], text: m[2].trim() } : null;
};

console.log("\n=== 1. Toate ecranele au fost găsite ===");
t("sunt douăsprezece secțiuni (unsprezece ecrane + depozitul arbitrului)",
  Object.keys(ecrane).length, 12);
["part", "cantar", "poze", "cal", "rank", "nou", "verific", "set", "strat", "reg", "pescari", "spons"]
  .forEach((e) => t("există ecranul „" + e + "”", !!ecrane[e], true));

/* ================================================================
   2. Fiecare ecran care nu e ușă are drum înapoi
   ================================================================ */
console.log("\n=== 2. Drumul înapoi ===");
Object.keys(ecrane).forEach(function (e) {
  if (USI.indexOf(e) >= 0) return;
  if (SCUTITE[e]) {
    t("„" + e + "” e scutit — " + SCUTITE[e], true, true);
    return;
  }
  const i = inapoiul(ecrane[e]);
  t("„" + e + "” are drum înapoi", !!i, true);
  if (i) t("…iar butonul spune unde duce", /^‹ Înapoi la .+/.test(i.text), true);
});

/* Cel scutit chiar are ieșirea despre care vorbim — altfel scutirea ar fi o scuză. */
t("„Cântare de pe poză” chiar are „Renunț” jos",
  /onclick="renuntaLaPoze\(\)"[^>]*>\s*Renunț/.test(ecrane.poze), true);

/* ================================================================
   3. Niciun drum înapoi nu duce la un ecran care nu se vede
   ================================================================ */
console.log("\n=== 3. Unde duc ===");
{
  /* Cântarul nu mai e ecran al organizatorului: `showView("cantar")` îl trimite în
     scară, la treapta a patra. Un buton care-i scrie numele îi spune omului despre un
     loc pe care nu l-a văzut niciodată. */
  const gresite = Object.keys(ecrane).filter(function (e) {
    const i = inapoiul(ecrane[e]);
    return i && i.catre === "cantar";
  });
  t("niciun buton nu trimite la „Cântar”, ecranul arbitrului", gresite, []);

  t("Clasamentul se întoarce Acasă",
    inapoiul(ecrane.rank), { catre: "part", text: "‹ Înapoi la Acasă" });
  t("…și verificarea la fel",
    inapoiul(ecrane.verific), { catre: "part", text: "‹ Înapoi la Acasă" });
  t("…iar baza de pescari la Contul meu, că de-acolo se intră",
    inapoiul(ecrane.pescari).catre, "set");

  /* Fiecare drum înapoi duce chiar la ușa sub care stă ecranul, după arborele din cod. */
  const tab = src.match(/var TAB_PARINTE=\{([\s\S]*?)\};/)[1];
  const harta = {};
  tab.replace(/([a-z]+):"([a-z]+)"/g, function (_, copil, p) { harta[copil] = p; return _; });
  Object.keys(ecrane).forEach(function (e) {
    if (USI.indexOf(e) >= 0 || SCUTITE[e]) return;
    const i = inapoiul(ecrane[e]);
    if (!i || !harta[e]) return;
    t("„" + e + "” se întoarce la ușa lui (" + harta[e] + ")", i.catre, harta[e]);
  });
}

/* ================================================================
   4. Varianta nouă ajunge pe telefon
   ================================================================ */
console.log("\n=== 4. Telefonul ===");
{
  const m = H.citeste("sw.js").match(/concurs-pescuit-v(\d+)/);
  t("sw.js e urcat cel puțin la 208", m && parseInt(m[1], 10) >= 208, true);
}

t.raport();
