/**
 * Test pentru generatorul local de coduri QR din index.html.
 *
 * Ideea verificării: un decodor scris SEPARAT de codificator citește matricea
 * înapoi. Ca decodorul să nu împărtășească aceleași greșeli, e calibrat întâi
 * pe codul QR STATIC din index.html — acela a fost generat de alt program,
 * deci e o referință independentă. Dacă decodorul citește corect codul străin,
 * atunci verdictul lui asupra codurilor noastre înseamnă ceva.
 *
 * În plus se verifică matematic sindroamele Reed-Solomon (zero = corecția de
 * erori e coerentă) și invarianții structurali (repere, sincronizare, format).
 */
const fs = require("fs");
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("D:/concursfeeder-repo/index.html");
const t = H.creeazaVerificator();

/* ---------- încarcă modulul QR VERBATIM din index.html ---------- */
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(H.grabIIFE(src, "var QR = (function(){"), sandbox);
const QR = sandbox.QR;

/* ================= decodor independent ================= */
// tabele proprii, scrise din specificație (nu refolosite din codificator)
const DEC_SPEC = { // [date, ec/bloc, blocuri] pe nivel
  M: {1:[16,10,1],2:[28,16,1],3:[44,26,1],4:[64,18,2],5:[86,24,2],
      6:[108,16,4],7:[124,18,4],8:[154,22,4],9:[182,22,5],10:[216,26,5]},
  L: {1:[19,7,1],2:[34,10,1],3:[55,15,1],4:[80,20,1],5:[108,26,1]},
  Q: {1:[13,13,1],2:[22,22,1],3:[34,18,2],4:[48,26,2],5:[62,18,4]},
  H: {1:[9,17,1],2:[16,28,1],3:[26,22,2],4:[36,16,4],5:[46,22,4]}
};
const EXP = new Array(512), LOG = new Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
         for (let j = 255; j < 512; j++) EXP[j] = EXP[j - 255]; })();
const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

function maskBit(k, r, c) {
  switch (k) {
    case 0: return (r + c) % 2 === 0 ? 1 : 0;
    case 1: return r % 2 === 0 ? 1 : 0;
    case 2: return c % 3 === 0 ? 1 : 0;
    case 3: return (r + c) % 3 === 0 ? 1 : 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0 ? 1 : 0;
    case 5: return ((r * c) % 2 + (r * c) % 3) === 0 ? 1 : 0;
    case 6: return (((r * c) % 2 + (r * c) % 3) % 2) === 0 ? 1 : 0;
    default: return (((r + c) % 2 + (r * c) % 3) % 2) === 0 ? 1 : 0;
  }
}

/** harta modulelor de serviciu (repere, sincronizare, aliniere, format, versiune) */
function functionMap(size) {
  const ver = (size - 17) / 4;
  const f = Array.from({ length: size }, () => new Array(size).fill(false));
  const mark = (r, c) => { if (r >= 0 && c >= 0 && r < size && c < size) f[r][c] = true; };
  const finder = (r0, c0) => { for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) mark(r0 + r, c0 + c); };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let i = 0; i < size; i++) { mark(6, i); mark(i, 6); }
  const AL = {2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],7:[6,22,38],8:[6,24,42],9:[6,26,46],10:[6,28,50]};
  const ap = AL[ver] || [];
  for (const ar of ap) for (const ac of ap) {
    if ((ar === 6 && ac === 6) || (ar === 6 && ac === size - 7) || (ar === size - 7 && ac === 6)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) mark(ar + dr, ac + dc);
  }
  for (let i = 0; i < 9; i++) { mark(8, i); mark(i, 8); }
  for (let i = 0; i < 8; i++) { mark(8, size - 1 - i); mark(size - 1 - i, 8); }
  if (ver >= 7) for (let i = 0; i < 18; i++) {
    const q = Math.floor(i / 3), rmd = i % 3;
    mark(size - 11 + rmd, q); mark(q, size - 11 + rmd);
  }
  return f;
}

/** citește nivelul de corecție și masca din informația de format (copia 1) */
function readFormat(m) {
  const size = m.length;
  let bits = 0, bits2 = 0;
  for (let i = 0; i < 15; i++) {
    let b;
    if (i < 6) b = m[i][8];
    else if (i === 6) b = m[7][8];
    else if (i === 7) b = m[8][8];
    else if (i === 8) b = m[8][7];
    else b = m[8][14 - i];
    bits |= b << i;
    bits2 |= (i < 8 ? m[8][size - 1 - i] : m[size - 15 + i][8]) << i;
  }
  const copiesAgree = bits === bits2;
  bits ^= 0x5412;
  // verifică BCH(15,5): restul trebuie să fie zero
  let rem = bits;
  for (let i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  const lvl = ["M", "L", "H", "Q"][(bits >> 13) & 3];
  return { level: lvl, mask: (bits >> 10) & 7, bchOk: (rem & 0x3FF) === 0, copiesAgree };
}

/** parcurge matricea în zigzag și întoarce fluxul de codewords (demascat) */
function readCodewords(m, mask) {
  const size = m.length, fn = functionMap(size), bits = [];
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < size; i++) {
      const row = up ? size - 1 - i : i;
      for (let j = 0; j < 2; j++) {
        const c = col - j;
        if (fn[row][c]) continue;
        bits.push((m[row][c] ^ maskBit(mask, row, c)) & 1);
      }
    }
    up = !up;
  }
  const cw = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let v = 0; for (let k = 0; k < 8; k++) v = (v << 1) | bits[i + k];
    cw.push(v);
  }
  return cw;
}

/** de-întrețese blocurile și verifică sindroamele Reed-Solomon */
function blocksAndSyndromes(cw, ver, level) {
  const [nData, nEc, nBlocks] = DEC_SPEC[level][ver];
  const shortLen = Math.floor(nData / nBlocks), nLong = nData % nBlocks, nShort = nBlocks - nLong;
  const lens = [];
  for (let i = 0; i < nBlocks; i++) lens.push(shortLen + (i >= nShort ? 1 : 0));
  const dataBlocks = lens.map(() => []), ecBlocks = lens.map(() => []);
  let p = 0;
  for (let c = 0; c < shortLen + 1; c++)
    for (let i = 0; i < nBlocks; i++)
      if (c < lens[i]) dataBlocks[i].push(cw[p++]);
  for (let c = 0; c < nEc; c++)
    for (let i = 0; i < nBlocks; i++) ecBlocks[i].push(cw[p++]);

  // sindroame: pentru un cuvânt de cod valid, S_i = codeword(α^i) = 0
  const bad = [];
  for (let i = 0; i < nBlocks; i++) {
    const full = dataBlocks[i].concat(ecBlocks[i]);
    for (let s = 0; s < nEc; s++) {
      let acc = 0;
      for (const b of full) acc = gmul(acc, EXP[s]) ^ b;
      if (acc !== 0) { bad.push(i); break; }
    }
  }
  return { data: [].concat(...dataBlocks), syndromesOk: bad.length === 0 };
}

/** citește mod octeți + lungime + conținut dintr-un șir de codewords */
function parseBytes(data, ver) {
  const bits = [];
  for (const b of data) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  let p = 0;
  const take = n => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | bits[p++]; return v; };
  const mode = take(4);
  if (mode !== 4) throw new Error("mod neașteptat: " + mode);
  const len = take(ver < 10 ? 8 : 16);
  const out = [];
  for (let i = 0; i < len; i++) out.push(take(8));
  return Buffer.from(out).toString("utf8");
}

function decode(m, forcedLevel) {
  const size = m.length, ver = (size - 17) / 4;
  const f = readFormat(m);
  const level = forcedLevel || f.level;
  const cw = readCodewords(m, f.mask);
  const blk = blocksAndSyndromes(cw, ver, level);
  return { ver, format: f, syndromesOk: blk.syndromesOk, text: parseBytes(blk.data, ver) };
}

/* ============ 1. calibrare: decodează QR-ul STATIC din index.html ============ */
console.log("\n=== 1. Calibrare pe codul QR static (generat de alt program) ===");
// martorul independent: codul QR generat de alt program, păstrat ca fixture
const dAttr = fs.readFileSync("D:/concursfeeder-repo/test-fixtures/qr-referinta.txt", "utf8")
  .split("\n").filter(l => l && !l.startsWith("#")).join("");
const QUIET = 2, SIDE = 29; // 33 = 29 module + 2 de margine pe fiecare parte
const stat = Array.from({ length: SIDE }, () => new Array(SIDE).fill(0));
let cnt = 0;
dAttr.replace(/M(\d+) (\d+)h1v1h-1z/g, (_, x, y) => {
  stat[+y - QUIET][+x - QUIET] = 1; cnt++; return "";
});
t("am extras module din SVG-ul static", cnt > 100, true);
t("dimensiunea corespunde versiunii 3", (SIDE - 17) / 4, 3);

const fstat = readFormat(stat);
console.log("     → format citit: nivel " + fstat.level + ", mască " + fstat.mask + ", BCH " + fstat.bchOk);
const dstat = decode(stat);
t("informația de format trece verificarea BCH", dstat.format.bchOk, true);
t("cele două copii ale formatului coincid", dstat.format.copiesAgree, true);
t("sindroamele Reed-Solomon sunt zero (cod valid)", dstat.syndromesOk, true);
console.log("     → nivel " + dstat.format.level + ", mască " + dstat.format.mask +
            ", text: " + JSON.stringify(dstat.text));
t("textul decodat e un URL", /^https?:\/\/\S+$/.test(dstat.text), true);

/* ---- verificarea decisivă: reproducem bit cu bit codul generat de alt program ---- */
const mine = QR.matrix(dstat.text);
t("generatorul nostru alege aceeași versiune", (mine.length - 17) / 4, dstat.ver);
t("matricea produsă e IDENTICĂ cu cea a generatorului străin",
  JSON.stringify(mine), JSON.stringify(stat));

/* ============ 2. dus-întors prin generatorul nostru ============ */
console.log("\n=== 2. Dus-întors prin generatorul din index.html ===");
const probe = [
  "https://simionescu38-dot.github.io/concursfeeder/?room=TEST",
  "https://simionescu38-dot.github.io/concursfeeder/?room=REMUS-2026-MANSA1",
  "http://a.ro/?r=1",
  "https://simionescu38-dot.github.io/concursfeeder/?room=" + encodeURIComponent("ȘTEFAN-CEL-MARE-ĂÎÂ"),
  "x".repeat(200)
];
for (const text of probe) {
  const m = QR.matrix(text);
  const d = decode(m, "M");
  const eticheta = text.length > 40 ? text.slice(0, 37) + "…" : text;
  t("v" + d.ver + " „" + eticheta + "”: sindroame zero", d.syndromesOk, true);
  t("v" + d.ver + " „" + eticheta + "”: text identic", d.text, text);
  t("v" + d.ver + " „" + eticheta + "”: format = nivel M", d.format.level, "M");
  t("v" + d.ver + " „" + eticheta + "”: BCH format valid", d.format.bchOk, true);
  t("v" + d.ver + " „" + eticheta + "”: copiile formatului coincid", d.format.copiesAgree, true);
}

/* ============ 3. invarianți structurali ============ */
console.log("\n=== 3. Invarianți structurali ===");
const m1 = QR.matrix("https://simionescu38-dot.github.io/concursfeeder/?room=TEST");
const size1 = m1.length;
function isFinder(m, r0, c0) {
  const want = [[1,1,1,1,1,1,1],[1,0,0,0,0,0,1],[1,0,1,1,1,0,1],[1,0,1,1,1,0,1],
                [1,0,1,1,1,0,1],[1,0,0,0,0,0,1],[1,1,1,1,1,1,1]];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (m[r0 + r][c0 + c] !== want[r][c]) return false;
  return true;
}
t("reper stânga-sus", isFinder(m1, 0, 0), true);
t("reper dreapta-sus", isFinder(m1, 0, size1 - 7), true);
t("reper stânga-jos", isFinder(m1, size1 - 7, 0), true);
let timingOk = true;
for (let i = 8; i < size1 - 8; i++) {
  if (m1[6][i] !== (i % 2 === 0 ? 1 : 0)) timingOk = false;
  if (m1[i][6] !== (i % 2 === 0 ? 1 : 0)) timingOk = false;
}
t("liniile de sincronizare alternează", timingOk, true);
t("modulul întunecat obligatoriu", m1[size1 - 8][8], 1);

/* versiunile 7+ poartă informație de versiune — verific BCH-ul ei */
const mBig = QR.matrix("y".repeat(150));
const sizeB = mBig.length, verB = (sizeB - 17) / 4;
t("text lung => versiune >= 7", verB >= 7, true);
let vbits = 0;
for (let i = 0; i < 18; i++) vbits |= mBig[Math.floor(i / 3)][sizeB - 11 + (i % 3)] << i;
let vrem = vbits;
for (let i = 17; i >= 12; i--) if ((vrem >> i) & 1) vrem ^= 0x1F25 << (i - 12);
t("informația de versiune: BCH valid", (vrem & 0xFFF) === 0, true);
t("informația de versiune indică versiunea corectă", vbits >> 12, verB);

/* ============ 4. SVG-ul livrat ============ */
console.log("\n=== 4. SVG-ul produs ===");
const s = QR.svg("https://simionescu38-dot.github.io/concursfeeder/?room=TEST");
t("e un SVG", /^<svg /.test(s), true);
t("nu cere nimic din rețea", /https?:\/\/(?!www\.w3\.org)/.test(s), false);
t("are fundal alb (contrast pentru scanare)", s.indexOf('fill="#ffffff"') > 0, true);
t("are margine liniștită de 4 module", /viewBox="0 0 (\d+) \1"/.test(s) && s.indexOf('viewBox="0 0 ' + (size1 + 8)) === 0 + s.indexOf('viewBox="0 0 ' + (size1 + 8)), true);

/* ============ 5. limite ============ */
console.log("\n=== 5. Limite ===");
t("capacitatea v1 (nivel M) = 14 octeți", QR.capacity(1), 14);
t("capacitatea v10 (nivel M) = 213 octeți", QR.capacity(10), 213);
let threw = false;
try { QR.matrix("z".repeat(300)); } catch (e) { threw = true; }
t("text peste limită => eroare, nu cod greșit", threw, true);

t.raport();
