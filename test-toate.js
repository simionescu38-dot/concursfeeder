/**
 * Rulează toate testele aplicației. `node test-toate.js` înainte de fiecare deploy.
 */
const { execFileSync } = require("child_process");

const TESTE = [
  ["Sintaxa scripturilor", "test-sintaxa.js"],
  ["Punctaj la egalitate", "test-punctaj-egalitate.js"],
  ["Concursuri întregi (scenarii)", "test-scenarii.js"],
  ["Ieșirile spun același lucru", "test-export.js"],
  ["Scenariile speciale, prin toate ieșirile", "test-iesiri-scenarii.js"],
  ["Scala sectoarelor", "test-scala-sectoare.js"],
  ["Camera ținută minte", "test-viewer-room.js"],
  ["Sector pe manșă", "test-sector-mansa.js"],
  ["Reparații drum de concurs", "test-reparatii.js"],
  ["Banda de sincronizare", "test-banda-sync.js"],
  ["Concursuri live acum", "test-live-acum.js"],
  ["Calendar: concursuri de două zile", "test-calendar-doua-zile.js"],
  ["Calendar: editare cu cheia de scriere", "test-calendar-cheie.js"],
  ["Butonul Statistici din meniu", "test-statistici-meniu.js"],
  ["Detaliile din Statistici", "test-statistici.js"],
  ["Instalarea de pe linkul primit", "test-instalare-link.js"],
  ["Poza și ora la peștele extra", "test-peste-extra-poza.js"],
  ["Pozele nu pleacă la sincronizare", "test-poze-sincronizare.js"],
  ["Cardul cu versiunea aplicației", "test-versiune-card.js"],
  ["Cântarele lipite de pe WhatsApp", "test-cantare-whatsapp.js"],
  ["Tragerea la sorți lipită sau din poză", "test-tragere.js"],
  ["Tragerea cu cod și nume", "test-tragere-cod.js"],
  ["Cântare de pe poza foii", "test-poza-foaie.js"],
  ["Tastatura de PIN", "test-pin.js"],
  ["PIN-ul nu pleacă de pe telefon", "test-pin-nu-pleaca.js"],
  ["Coduri QR", "test-qr.js"],
  ["Codul QR la Sponsori", "test-qr-sponsori.js"],
  ["Soare / lună (solunar)", "test-astro.js"],
  ["Meteo", "test-meteo.js"],
  ["Adrese date mai departe", "test-adrese.js"],
  ["Cronometru sincronizat", "test-cronometru.js"],
  ["Ceasul concursului", "test-ceas.js"],
  ["Pornirea și oprirea manșei", "test-mansa.js"],
  ["Sector automat din stand", "test-sector-automat.js"],
  ["Nume fără numerotare de mână", "test-nume-curat.js"],
  ["Lista lipită de pe WhatsApp", "test-import.js"],
  ["Aducerea variantei noi", "test-actualizare.js"],
  ["Poza pentru WhatsApp", "test-imagine.js"],
  ["Arhivarea în sezon", "test-arhivare.js"],
  ["Același om, scris în două feluri", "test-acelasi-om.js"],
  ["Baza de pescari, cu codul fiecăruia", "test-pescari.js"]
  ,["Pagina publică a concursului", "test-rezultat-public.js"]
];

let picate = [];
for (const [nume, fisier] of TESTE) {
  console.log("\n════════ " + nume + " ════════");
  try {
    console.log(execFileSync(process.execPath, [__dirname + "/" + fisier], { encoding: "utf8" }));
  } catch (e) {
    console.log(e.stdout || "");
    console.log(e.stderr || "");
    picate.push(nume);
  }
}

console.log("\n══════════════════════════════");
if (picate.length) { console.log("PICATE: " + picate.join(", ")); process.exit(1); }
console.log("Toate suitele au trecut.");
