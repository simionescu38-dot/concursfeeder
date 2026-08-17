/**
 * Verificare de sintaxă pentru scripturile inline din paginile HTML.
 * Nu rulează codul — doar îl dă lui Node să-l parseze, ca o greșeală de scriere
 * (o paranteză lipsă, o virgulă în plus) să nu ajungă pe site.
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const FISIERE = ["index.html", "sezon.html", "concursuri.html"];
const FISIERE_JS = ["qr.js", "sw.js"];
const ROOT = __dirname;

let ok = 0, fail = 0;
for (const f of FISIERE_JS) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.log("  ⚠️  lipsește " + f); continue; }
  const src = fs.readFileSync(p, "utf8");
  try {
    new vm.Script(src, { filename: f });
    ok++;
    console.log("  ✅ " + f + " (fișier separat), " + src.split("\n").length + " linii");
  } catch (e) {
    fail++;
    console.log("  ❌ " + f + ": " + e.message);
  }
}
for (const f of FISIERE) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.log("  ⚠️  lipsește " + f); continue; }
  const src = fs.readFileSync(p, "utf8");
  const blocuri = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  if (!blocuri.length) { console.log("  ⚠️  " + f + ": niciun script inline"); continue; }
  blocuri.forEach((b, i) => {
    const linie = src.slice(0, b.index).split("\n").length;
    try {
      new vm.Script(b[1], { filename: f + " (script " + (i + 1) + ", de la linia " + linie + ")" });
      ok++;
      console.log("  ✅ " + f + " – script " + (i + 1) + " (linia " + linie + "), " +
                  b[1].split("\n").length + " linii");
    } catch (e) {
      fail++;
      console.log("  ❌ " + f + " – script " + (i + 1) + " (linia " + linie + "): " + e.message);
    }
  });
}

console.log("\n──────────────────────────────");
console.log(ok + " scripturi valide, " + fail + " cu erori");
process.exit(fail ? 1 : 0);
