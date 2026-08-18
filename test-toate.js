/**
 * Rulează toate testele aplicației. `node test-toate.js` înainte de fiecare deploy.
 */
const { execFileSync } = require("child_process");

const TESTE = [
  ["Sintaxa scripturilor", "test-sintaxa.js"],
  ["Punctaj la egalitate", "test-punctaj-egalitate.js"],
  ["Camera ținută minte", "test-viewer-room.js"],
  ["Sector pe manșă", "test-sector-mansa.js"],
  ["Coduri QR", "test-qr.js"],
  ["Soare / lună (solunar)", "test-astro.js"],
  ["Meteo", "test-meteo.js"],
  ["Adrese date mai departe", "test-adrese.js"],
  ["Cronometru sincronizat", "test-cronometru.js"]
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
