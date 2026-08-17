/**
 * Adresele pe care aplicația le dă mai departe oamenilor.
 *
 * De două ori a apărut aceeași greșeală: o adresă scrisă de mână în cod, rămasă
 * la găzduirea veche (cantar-remuslake.netlify.app) — o dată în codul QR de
 * instalare, o dată tipărită pe imaginea de clasament trimisă pe WhatsApp.
 * Ambele trimiteau oamenii la aplicația abandonată, care nu are sincronizare live.
 *
 * Testul ăsta refuză orice gazdă scrisă de mână în fișierele livrate și verifică
 * faptul că adresele se iau din bara de sus a browserului.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const t = H.creeazaVerificator();
const FISIERE = ["index.html", "qr.js", "sezon.html", "concursuri.html", "sw.js"];

/** scoate comentariile: un comentariu care explică de ce s-a renunțat la o
    găzduire veche e documentație utilă, nu o scăpare */
function faraComentarii(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'])\/\/[^\n]*/g, "$1");
}

/* ---------- 1. nicio gazdă moartă scrisă de mână ---------- */
console.log("\n=== 1. Găzduiri vechi rămase în codul executabil ===");
const MOARTE = ["cantar-remuslake.netlify.app", "netlify.app",
                "wandering-shadow-e011", "concursremuslake.simionescu38.workers.dev",
                "concursiasi.simionescu38.workers.dev", "api.qrserver.com"];
for (const f of FISIERE) {
  const cod = faraComentarii(H.citeste(f));
  for (const gazda of MOARTE) {
    const i = cod.indexOf(gazda);
    const unde = i >= 0 ? " (linia " + cod.slice(0, i).split("\n").length + ")" : "";
    t(f + " nu conține „" + gazda + "”" + unde, i >= 0, false);
  }
}

/* ---------- 2. adresele se derivă din location ---------- */
console.log("\n=== 2. Adresele se iau din bara browserului ===");
const src = H.citeste("index.html");
const sandbox = { console, location: {} };
vm.createContext(sandbox);
vm.runInContext(["installLink", "adresaAfisata", "liveLink"].map(n => H.grabFunction(src, n)).join("\n"), sandbox);
vm.runInContext("var syncRoom='abc12'; var encodeURIComponent=globalThis.encodeURIComponent;", sandbox);

function cu(host, pathname, origin) {
  sandbox.location.host = host; sandbox.location.pathname = pathname; sandbox.location.origin = origin;
}

cu("simionescu38-dot.github.io", "/concursfeeder/", "https://simionescu38-dot.github.io");
t("linkul de instalare pe GitHub Pages",
  vm.runInContext("installLink()", sandbox), "https://simionescu38-dot.github.io/concursfeeder/");
t("adresa afișată pe imagine, fără protocol și fără slash final",
  vm.runInContext("adresaAfisata()", sandbox), "simionescu38-dot.github.io/concursfeeder");
t("linkul live poartă codul camerei",
  vm.runInContext("liveLink()", sandbox), "https://simionescu38-dot.github.io/concursfeeder/?room=abc12");

cu("simionescu38-dot.github.io", "/concursfeeder/index.html", "https://simionescu38-dot.github.io");
t("„/index.html” nu apare în adresa scrisă pe imagine",
  vm.runInContext("adresaAfisata()", sandbox), "simionescu38-dot.github.io/concursfeeder");

cu("exemplu.ro", "/", "https://exemplu.ro");
t("dacă site-ul se mută, adresa se mută cu el",
  vm.runInContext("adresaAfisata()", sandbox), "exemplu.ro");
t("…și linkul de instalare la fel",
  vm.runInContext("installLink()", sandbox), "https://exemplu.ro/");

/* ---------- 3. imaginea distribuită nu scrie adresa de mână ---------- */
console.log("\n=== 3. Imaginea de clasament ===");
const share = H.grabFunction(src, "drawShareImage");
t("imaginea folosește adresaAfisata(), nu un șir fix", share.indexOf("adresaAfisata()") > 0, true);
t("imaginea nu conține nicio gazdă scrisă de mână",
  /fillText\(\s*"[^"]*\.(app|io|ro|com)[^"]*"/.test(share), false);

t.raport();
