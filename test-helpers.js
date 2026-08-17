/**
 * Ajutoare comune pentru teste: extrag cod REAL din index.html / sezon.html,
 * ca testele să verifice fișierul livrat, nu o copie care poate diverge.
 *
 * Echilibrarea delimitatorilor sare peste comentarii, șiruri și expresii
 * regulate — altfel o paranteză dintr-un comentariu („ziua locală [00:00, 24:00)")
 * rupe extragerea și testul pică din motive care n-au legătură cu codul.
 */
const fs = require("fs");
const path = require("path");

/** rădăcina depozitului: fișierele de test stau lângă cele livrate */
const RADACINA = __dirname;

/** întoarce indicele delimitatorului de închidere care echilibrează pe cel de la `from` */
function balance(src, from, open, close) {
  let d = 0, started = false, i = from;
  let prevSemnificativ = "";
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === "/" && n === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; }
      i++; prevSemnificativ = q; continue;
    }
    // expresie regulată: un „/" care nu poate fi împărțire, judecând după ce îl precedă
    if (c === "/" && "(,=:[!&|?{};+-*%~^<>".indexOf(prevSemnificativ) >= 0) {
      i++;
      let inClasa = false;
      while (i < src.length) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === "[") inClasa = true;
        else if (src[i] === "]") inClasa = false;
        else if (src[i] === "/" && !inClasa) break;
        else if (src[i] === "\n") break; // n-a fost regex
        i++;
      }
      i++; prevSemnificativ = "/"; continue;
    }
    if (c === open) { d++; started = true; }
    else if (c === close) { d--; if (started && d === 0) return i; }
    if (!/\s/.test(c)) prevSemnificativ = c;
    i++;
  }
  throw new Error("delimitatori neechilibrați de la poziția " + from);
}

/** extrage `function nume(...){...}` întreg */
function grabFunction(src, name) {
  const i = src.indexOf("function " + name + "(");
  if (i < 0) throw new Error("nu găsesc funcția " + name);
  const brace = src.indexOf("{", src.indexOf(")", i));
  return src.slice(i, balance(src, brace, "{", "}") + 1);
}

/** extrage `var X = (function(){ ... })();` întreg, gata de rulat */
function grabIIFE(src, marker) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("nu găsesc " + marker);
  const paren = src.indexOf("(", start);
  return src.slice(start, balance(src, paren, "(", ")") + 1) + "();";
}

/** extrage o expresie de forma `var nume = ceva(...);` (folosit pentru blocuri inline) */
function grabAssignment(src, marker) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("nu găsesc " + marker);
  const paren = src.indexOf("(", start);
  return src.slice(start, balance(src, paren, "(", ")") + 1) + ";";
}

/** citește un fișier livrat; căile relative se socotesc de la rădăcina depozitului,
    ca testele să ruleze de oriunde și pe orice sistem */
const citeste = p => fs.readFileSync(path.resolve(RADACINA, p), "utf8");

/** mic ajutor de asertare, comun tuturor testelor */
function creeazaVerificator() {
  const stare = { ok: 0, fail: 0 };
  function t(nume, real, asteptat, tol) {
    let bun;
    if (tol === undefined) bun = JSON.stringify(real) === JSON.stringify(asteptat);
    else bun = Math.abs(real - asteptat) <= tol;
    const afis = v => typeof v === "number" ? Math.round(v * 1000) / 1000 : JSON.stringify(v);
    if (bun) { stare.ok++; console.log("  ✅ " + nume + (tol !== undefined ? "  (" + afis(real) + ")" : "")); }
    else {
      stare.fail++;
      console.log("  ❌ " + nume + "\n       primit:   " + afis(real) +
                  "\n       așteptat: " + afis(asteptat) + (tol ? " ±" + tol : ""));
    }
  }
  t.raport = function () {
    console.log("\n──────────────────────────────");
    console.log(stare.ok + " trecute, " + stare.fail + " picate");
    process.exit(stare.fail ? 1 : 0);
  };
  return t;
}

module.exports = { RADACINA, balance, grabFunction, grabIIFE, grabAssignment, citeste, creeazaVerificator };
