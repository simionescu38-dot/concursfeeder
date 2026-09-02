/**
 * Cântarele citite de pe poza cântarului.
 *
 * „Eu vreau să pun poza de pe WhatsApp și cu un agent AI să fie trecut în aplicație la
 * socotit."
 *
 * Cum arată realitatea, din grupul lui: cine cântărește pune poza afișajului, iar dedesubt
 * scrie standul — „St 13", „St 5". Deci **greutatea e doar în imagine, standul e doar în
 * text**. Și nu se merge în ordinea standurilor: pe grup „St 13" vine înaintea lui „St 5".
 * Nici ordinea în care ajung pozele nu spune nimic — mi le-a trimis amestecate față de cum
 * au fost făcute („le-am trimis eu aleatoriu"). Singurul lucru de încredere e ora din
 * fișier: 16:55:11 · 16:57:19 · 16:58:50 · 17:01:03.
 *
 * Citirea propune, omul hotărăște: nimic nu intră în concurs fără confirmare, iar ce a
 * citit nesigur se vede.
 *
 * Codul e scos VERBATIM din index.html, sw.js și worker/index.js.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const swSrc = H.citeste("sw.js");
const wkSrc = H.citeste("worker/index.js");
const manifest = JSON.parse(H.citeste("manifest.json"));
const t = H.creeazaVerificator();

const FUNCTII = ["num", "fmt", "esc", "uid", "numManse", "manseRange", "emptyManche", "ensureManche",
  "mOf", "sectorOfM", "standOfM", "nameOf", "cantOfM", "extraOfM", "totalOfM", "scrieInJurnal",
  "oraPozei", "standDinLegenda", "standuriDinLegenda", "pescarulStandului", "randuriBune",
  "randeazaFoaia", "scrieKg", "scrieStandul", "improspateazaFoaieRezumat", "treceDeFoaie",
  "renuntaLaPoze", "inchidePozele", "citesteCantarul", "amprentaPozei",
  "deschidePoze", "citesteToatePozele", "oraDinNume"];

/** un JPEG minuscul, dar cu EXIF adevărat: așa se probează cititorul fără pozele lui */
function jpegCuOra(txt) {
  const sir = Buffer.from((txt || "2026:08:27 16:55:11") + "\0", "latin1"); // 20 octeți
  const tiff = Buffer.alloc(64);
  tiff.write("II", 0, "latin1"); tiff.writeUInt16LE(0x2A, 2); tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);                                    // IFD0: o intrare
  tiff.writeUInt16LE(0x8769, 10); tiff.writeUInt16LE(4, 12);   // ExifIFDPointer, LONG
  tiff.writeUInt32LE(1, 14); tiff.writeUInt32LE(26, 18);
  tiff.writeUInt32LE(0, 22);                                   // fără IFD1
  tiff.writeUInt16LE(1, 26);                                   // Exif IFD: o intrare
  tiff.writeUInt16LE(0x9003, 28); tiff.writeUInt16LE(2, 30);   // DateTimeOriginal, ASCII
  tiff.writeUInt32LE(20, 32); tiff.writeUInt32LE(44, 36);
  tiff.writeUInt32LE(0, 40);
  sir.copy(tiff, 44);
  const app1 = Buffer.concat([Buffer.from([0xFF, 0xE1]), Buffer.alloc(2),
    Buffer.from("Exif\0\0", "latin1"), tiff]);
  app1.writeUInt16BE(2 + 6 + tiff.length, 2);
  return Buffer.concat([Buffer.from([0xFF, 0xD8]), app1, Buffer.from([0xFF, 0xD9])]);
}
const blobDin = b => new Blob([b], { type: "image/jpeg" });

function pornire(pescari, optiuni) {
  const o = optiuni || {};
  const el = {};
  /* Rândurile au copii căutați pe clasă („.poza-stare", „.poza-nume"): fără ei, proba
     n-ar putea vedea că textul de sub nume se schimbă când scrie omul — exact scăparea
     care s-a văzut pe telefon. */
  const facEl = () => {
    const cls = new Set(), copii = {};
    return { innerHTML: "", textContent: "", value: "",
      classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), remove: c => cls.delete(c),
                   contains: c => cls.has(c) },
      querySelector: sel => (copii[sel] || (copii[sel] = { innerHTML: "", textContent: "" })),
      _copii: copii };
  };
  ["poza-foaie", "poza-rezumat", "st-total", "photoImg", "photoCap"].forEach(id => el[id] = facEl());
  const ctx = {
    console, JSON, Date, Math, parseInt, parseFloat, isNaN, Array, Object, Number, Promise,
    Uint8Array, DataView, String, Blob, URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
    blocat: !!o.blocat, intrebat: [], raspunsLaConfirm: o.confirma !== false,
    toasturi: [], salvat: 0, copii: [], ecrane: [], magaziaStearsa: 0, cereri: [],
    syncKey: o.cheie === undefined ? "cheia" : o.cheie,
    API_BASE: "https://api.test",
    PRAG_KG: +/var PRAG_KG=(\d+)/.exec(src)[1],
    STARI: {}, pozaDeschisa: null, pozePrimite: [],
    document: { getElementById: id => el[id] || (el[id] = facEl()) },
    guard() { return ctx.blocat; },
    confirm(q) { ctx.intrebat.push(q); return ctx.raspunsLaConfirm; },
    toast(m) { ctx.toasturi.push(m); },
    queueSave() { ctx.salvat++; },
    renderList() {}, improspateazaCantariti() {}, arataScoatePoza() {},
    puneDeoParte(m) { ctx.copii.push(m); },
    sumAll() { return 0; },
    showView(v) { ctx.ecrane.push(v); },
    stergePozelePrimite() { ctx.magaziaStearsa++; return Promise.resolve(); },
    pozaMicsorata() { return Promise.resolve(o.micsorata === null ? null : "data:image/jpeg;base64,AAA"); },
    fetch(u, cfg) {
      ctx.cereri.push({ u, cfg });
      if (o.raspuns instanceof Error) return Promise.reject(o.raspuns);
      return Promise.resolve({ json: () => Promise.resolve(o.raspuns || { ok: true, kg: 12.34, sigur: true }) });
    }
  };
  ctx.el = el;
  ctx.state = {
    name: "Probă", manche: o.mansa || 1, numManse: 2, sectors: ["A", "B"], jurnal: [],
    pozeTrecute: (o.pozeTrecute || []).slice(),
    participants: pescari.map((x, i) => ({
      id: "p" + i, prenume: x.prenume, nume: x.nume, stand: x.stand, sector: "A",
      m: { 1: { catches: (x.catches || []).slice(), catchTimes: [], catchPhotos: [], extras: [], extraTimes: [], extraPhotos: [], stand: x.stand, sector: "A" },
           2: { catches: [], catchTimes: [], catchPhotos: [], extras: [], extraTimes: [], extraPhotos: [], stand: x.stand, sector: "A" } } }))
  };
  vm.createContext(ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  vm.runInContext("var STARI=" + /var STARI=(\{[\s\S]*?\});/.exec(src)[1] + ";", ctx);
  return ctx;
}

/** cele 14 de la Rediu Galian; standurile NU sunt în ordinea cântăririi */
const LOT = [
  { stand: "5", prenume: "Vasile", nume: "Popescu" },
  { stand: "13", prenume: "Mihai", nume: "Ionescu" },
  { stand: "1", prenume: "Remus", nume: "Catalin" },
  { stand: "7", prenume: "Ion", nume: "Țăranu" }
];

/** pune poze gata făcute în context, sărind peste deschidePoze (care cere browser) */
function pune(c, randuri) {
  c.PUSE = randuri.map((r, i) => ({ url: "blob:" + i, blob: null, hash: r.hash || "h" + i,
    ora: r.ora || 0, stand: r.stand || "", kg: r.kg === undefined ? null : r.kg,
    stare: r.stare || "asteapta" }));
  vm.runInContext("pozePrimite = PUSE;", c);
}

(async () => {
  /* ================================================================
     1. Ora din poză — singurul lucru de încredere
     ================================================================ */
  console.log("\n=== 1. Ora din fișier ===");
  {
    const c = pornire(LOT);
    const ora = async b => { c.__b = blobDin(b); return vm.runInContext("oraPozei(__b)", c); };

    t("scoate ora dintr-un JPEG cu EXIF",
      new Date(await ora(jpegCuOra("2026:08:27 16:55:11"))).toISOString(), "2026-08-27T16:55:11.000Z");
    t("și o altă oră", new Date(await ora(jpegCuOra("2026:08:27 17:01:03"))).toISOString(),
      "2026-08-27T17:01:03.000Z");
    /* Fără oră nu se crapă: rândul rămâne în ordinea în care a venit, nu dispare. */
    t("un JPEG fără EXIF dă 0, nu crapă", await ora(Buffer.from([0xFF, 0xD8, 0xFF, 0xD9])), 0);
    t("un fișier care nu e JPEG dă 0", await ora(Buffer.from("nu sunt poza")), 0);
    t("citește doar începutul fișierului, nu tot", /blob\.slice\(0, 131072\)/.test(H.grabFunction(src, "oraPozei")), true);
  }
  /* ---- ora capturii, în patru trepte ----
     La prima trimitere adevărată din WhatsApp, eticheta capturii scria ora importului
     (12:40), nu 16:55 când se cântărise: WhatsApp taie ora din poză când o trimite mai
     departe. Deci treapta întâi lipsește tocmai pe drumul obișnuit. */
  {
    const c = pornire(LOT);
    const nume = x => vm.runInContext("oraDinNume(" + JSON.stringify(x) + ")", c);
    const iso = t0 => new Date(t0).toISOString().slice(0, 19);

    /* Numele e SINGURUL loc de unde se mai poate afla ziua pe drumul din „Distribuie":
       ora din poză o taie WhatsApp, iar ora fișierului nu trece printr-un POST multipart
       (măsurat în browser — ajungea tot „acum"). */
    t("numele de la WhatsApp dă ziua", iso(nume("IMG-20260827-WA0012.jpg")), "2026-08-27T12:00:00");
    t("numele de la cameră dă ziua și ora", iso(nume("IMG_20260827_165511.jpg")), "2026-08-27T16:55:11");
    t("și cel de Pixel", iso(nume("PXL_20260827_135511123.jpg")), "2026-08-27T13:55:11");
    t("și unul fără prefix", iso(nume("20260827_165511.jpg")), "2026-08-27T16:55:11");
    /* Fără oră se ia mijlocul zilei: la miezul nopții, fusul orar ar muta ziua. */
    t("fără oră se ia mijlocul zilei, nu miezul nopții", new Date(nume("IMG-20260827-WA0012.jpg")).getUTCHours(), 12);
    t("un nume fără dată nu inventează una", nume("poza.jpg"), 0);
    t("nici un număr care nu e dată", nume("IMG-20269932-WA0012.jpg"), 0);
    t("nici numele gol", nume(""), 0);
  }
  {
    const c = pornire(LOT);
    const deschide = async (buf, oraFisier, numeFisier) => {
      c.__in = [{ blob: blobDin(buf), ora: oraFisier, nume: numeFisier || "" }];
      await vm.runInContext("deschidePoze(__in, '')", c);
      return vm.runInContext("pozePrimite[0].ora", c);
    };
    const GOL = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]);

    t("1. ora din poză, când există, bate tot",
      await deschide(jpegCuOra("2026:08:27 16:55:11"), 1700000000000, "IMG-20200101-WA0001.jpg"),
      Date.UTC(2026, 7, 27, 16, 55, 11));
    t("2. fără ea, data din numele fișierului",
      await deschide(GOL, 1700000000000, "IMG-20260827-WA0012.jpg"), Date.UTC(2026, 7, 27, 12, 0, 0));
    t("3. fără nume bun, ora fișierului (merge doar din galerie)",
      await deschide(GOL, 1787000000000, "poza.jpg"), 1787000000000);
    {
      const inainte = Date.now();
      const o = await deschide(GOL, 0, "");
      t("4. fără niciuna, „acum\" — dar niciodată zero", o >= inainte && o <= Date.now(), true);
    }
    t("o poză dată de-a dreptul, fără plic, nu crapă",
      (await (async () => { c.__in = [blobDin(jpegCuOra("2026:08:27 17:01:03"))];
        await vm.runInContext("deschidePoze(__in, '')", c);
        return vm.runInContext("pozePrimite[0].ora", c); })()),
      Date.UTC(2026, 7, 27, 17, 1, 3));
    t("standul din legendă se pune și pe drumul ăsta",
      (await (async () => { c.__in = [{ blob: blobDin(jpegCuOra("2026:08:27 16:55:11")), ora: 0 }];
        await vm.runInContext("deschidePoze(__in, 'St 13')", c);
        return vm.runInContext("pozePrimite[0].stand", c); })()), "13");
  }
  {
    /* Numele trece prin trimitere, ora nu — de-aia el e cel care contează aici. */
    t("service worker-ul duce mai departe numele fișierului",
      /"X-Poza-Nume": encodeURIComponent\(poze\[i\]\.name \|\| ""\)/.test(swSrc), true);
    t("…și ora lui, bună când poza vine din galerie",
      /"X-Poza-Ora": String\(poze\[i\]\.lastModified \|\| 0\)/.test(swSrc), true);
    const ia = H.grabFunction(src, "iaPozelePrimite");
    t("aplicația citește numele de acolo", /r\.headers\.get\("X-Poza-Nume"\)/.test(ia), true);
    t("…și ora", /r\.headers\.get\("X-Poza-Ora"\)/.test(ia), true);
    t("pozele alese din galerie își aduc numele și ora",
      /ora:x\.lastModified\|\|0, nume:x\.name\|\|""/.test(H.grabFunction(src, "pozeDinTelefon")), true);
  }

  /* ================================================================
     2. Standul din legenda de sub poză
     ================================================================ */
  console.log("\n=== 2. Standul din „St 13\" ===");
  {
    const c = pornire(LOT);
    const st = x => vm.runInContext("standDinLegenda(" + JSON.stringify(x) + ")", c);
    t("„St 13\" — exact cum scrie pe grup", st("St 13"), "13");
    t("„St 5\"", st("St 5"), "5");
    t("cu punct: „St. 5\"", st("St. 5"), "5");
    t("lipit: „st5\"", st("st5"), "5");
    t("întreg: „Stand 7\"", st("Stand 7"), "7");
    t("într-o propoziție", st("gata, St 12 cântărit"), "12");
    t("fără stand, nimic", st("frumos peste"), "");
    t("text gol", st(""), "");
    /* Fără cuvântul întreg, orice cuvânt terminat în „st" urmat de o cifră ar da un stand:
       „malul de est 12" ar deveni standul 12. Un cântar pus pe cine nu trebuie e mai rău
       decât unul netrecut — ăla măcar se vede. */
    t("nu ia un cuvânt care se termină în „st\"", st("malul de est 12"), "");
    t("nici în mijlocul unui cuvânt", st("Constanta 12"), "");

    const mai = (x, n) => vm.runInContext("standuriDinLegenda(" + JSON.stringify(x) + "," + n + ")", c);
    t("mai multe standuri, în ordine", mai("St 13\nSt 5\nSt 1", 3), ["13", "5", "1"]);
    /* Dacă numărul standurilor nu se potrivește cu al pozelor, nu se ghicește DELOC:
       o împerechere greșită ar pune cântarele pe alți oameni, tăcut. */
    t("mai puține standuri decât poze — nu se ghicește", mai("St 13", 3), []);
    t("mai multe standuri decât poze — nici atât", mai("St 1\nSt 2\nSt 3", 2), []);
  }

  /* ================================================================
     3. Cine e pe standul scris
     ================================================================ */
  console.log("\n=== 3. Standul → pescarul ===");
  {
    const c = pornire(LOT);
    const cine = x => vm.runInContext("(function(){var p=pescarulStandului(" + JSON.stringify(x) + "); return p?nameOf(p):null;})()", c);
    t("standul 13", cine("13"), "Mihai Ionescu");
    t("standul 5", cine("5"), "Vasile Popescu");
    t("un stand care nu există", cine("99"), null);
    t("fără stand", cine(""), null);
  }

  /* ================================================================
     4. Ce rând e gata de trecut
     ================================================================ */
  console.log("\n=== 4. Rândurile gata ===");
  {
    const c = pornire([{ stand: "5", prenume: "Vasile", nume: "Popescu" },
                       { stand: "13", prenume: "Mihai", nume: "Ionescu", catches: [10.5] }]);
    pune(c, [
      { stand: "5", kg: 9.48 },      // bun
      { stand: "13", kg: 12.3 },     // are deja cântar
      { stand: "99", kg: 8.1 },      // nimeni pe standul ăla
      { stand: "5" },                // fără cifră
      { kg: 7.2 }                    // fără stand
    ]);
    const bune = vm.runInContext("randuriBune().map(function(p){return p.stand+':'+p.kg;})", c);
    t("intră doar rândul întreg", bune, ["5:9.48"]);
    /* Cel cu cântar deja pus NU intră: a doua trecere de pe aceeași foaie i-ar aduna încă
       o dată juvelnicul, iar în clasament n-ar arăta nimic ciudat. */
    t("cel cu cântar deja pus e sărit", bune.join().indexOf("13:") < 0, true);
  }

  /* ================================================================
     5. Ce se scrie în căsuțe
     ================================================================ */
  console.log("\n=== 5. Scrisul de mână peste citire ===");
  {
    const c = pornire(LOT);
    pune(c, [{ stand: "", kg: null, stare: "nesigur" }]);
    /* Rândul se pregătește cu textul pus de citire DEJA pe el, ca proba să vadă că se
       șterge. Altfel, scoaterea pazei ar crăpa proba (copil inexistent) în loc s-o pice —
       iar o probă care crapă nu păzește nimic. */
    c.document.getElementById("pr-0").querySelector(".poza-stare").textContent = "citit nesigur — uită-te";
    vm.runInContext("scrieStandul(0,'13'); scrieKg(0,'12,340')", c);
    t("standul scris se ține minte", vm.runInContext("pozePrimite[0].stand", c), "13");
    t("virgula se citește ca zecimală", vm.runInContext("pozePrimite[0].kg", c), 12.34);
    /* După ce omul a scris cifra cu mâna lui, semnul pus de citire n-are ce căuta acolo:
       răspunde el de ea acum, nu modelul. Pe telefon s-a văzut invers — omul scrisese
       11,29, iar rândul îi spunea mai departe „n-am putut citi — scrie tu". */
    t("semnul de nesigur pică după ce scrie omul", vm.runInContext("pozePrimite[0].stare", c), "asteapta");
    t("…și textul de pe rând se schimbă pe loc, nu la următoarea redesenare",
      c.el["pr-0"]._copii[".poza-stare"].textContent, "");
    t("…iar citirea care vine după nu-i mai calcă cifra",
      vm.runInContext("pozePrimite[0].scrisDeMana", c), true);
    t("standul ia doar cifre", (vm.runInContext("scrieStandul(0,'St 7'); pozePrimite[0].stand", c)), "7");
    vm.runInContext("scrieKg(0,'')", c);
    t("căsuța golită scoate cifra", vm.runInContext("pozePrimite[0].kg", c), null);
  }

  /* ================================================================
     6. Citirea de pe worker
     ================================================================ */
  console.log("\n=== 6. Cererea de citire ===");
  {
    const c = pornire(LOT);
    const r = await vm.runInContext("citesteCantarul(null)", c);
    t("întoarce cifra citită", [r.kg, r.sigur, r.stare], [12.34, true, "citit"]);
    t("pleacă spre worker-ul lui", /\/api\/citeste-cantar$/.test(c.cereri[0].u), true);
    t("cu cheia de scriere în antet", c.cereri[0].cfg.headers["x-write-key"], "cheia");
    /* Poza de telefon are 3-12 MB. Pe 4G, la baltă, nu se urcă așa ceva de 17 ori. */
    t("poza pleacă micșorată", /pozaMicsorata\(blob\)/.test(H.grabFunction(src, "citesteCantarul")), true);
  }
  {
    const c = pornire(LOT, { cheie: "" });
    const r = await vm.runInContext("citesteCantarul(null)", c);
    t("fără cheie nu pleacă nicio cerere", c.cereri.length, 0);
    t("…și se spune de ce", r.stare, "fara-cheie");
  }
  {
    const c = pornire(LOT, { raspuns: new Error("fără semnal") });
    /* La baltă cade semnalul. Aplicația NU se blochează pe citire: căsuța rămâne goală și
       omul scrie de mână, exact ca înainte de schimbarea asta.
       Prins cu `.catch` aici anume: fără el, scoaterea pazei ar CRĂPA proba în loc s-o
       pice, iar o probă care crapă nu păzește nimic — se citește ca eroare de test. */
    const r = await vm.runInContext("citesteCantarul(null)", c)
      .catch(function (e) { return { crapat: String(e) }; });
    t("fără semnal nu se crapă", [r.kg, r.stare], [null, "necitit"]);
  }
  {
    const c = pornire(LOT, { raspuns: { ok: true, kg: null, sigur: false } });
    const r = await vm.runInContext("citesteCantarul(null)", c);
    t("când modelul n-a putut citi, căsuța rămâne goală", [r.kg, r.stare], [null, "necitit"]);
  }
  {
    const c = pornire(LOT, { raspuns: { ok: true, kg: 9.48, sigur: false } });
    const r = await vm.runInContext("citesteCantarul(null)", c);
    t("citirea nesigură se însemnează, nu se aruncă", [r.kg, r.stare], [9.48, "nesigur"]);
  }
  {
    /* „N-am putut citi" spunea același lucru pentru trei defecte cu trei reparații
       diferite. Pe telefon s-a văzut exact așa: omul n-avea de unde să știe dacă e de
       vină cheia, serverul, sau poza. Fiecare își spune acum numele. */
    const c = pornire(LOT, { raspuns: { ok: false, error: "fara-ai" } });
    const r = await vm.runInContext("citesteCantarul(null)", c);
    t("modelul nepornit pe server își spune numele", r.stare, "fara-ai");
    t("…și scrie unde să se uite", /modelul nu e pornit pe server/.test(c.STARI[r.stare]), true);
  }
  {
    const c = pornire(LOT, { raspuns: { ok: false, error: "forbidden" } });
    const r = await vm.runInContext("citesteCantarul(null)", c);
    t("cheia greșită își spune numele", r.stare, "cheie-rea");
    t("…și nu se confundă cu cheia lipsă", c.STARI["cheie-rea"] !== c.STARI["fara-cheie"], true);
  }

  /* ================================================================
     7. Trecerea în concurs
     ================================================================ */
  console.log("\n=== 7. „Trece cântarele\" ===");
  {
    const c = pornire(LOT);
    pune(c, [{ stand: "13", kg: 12.34, stare: "citit", ora: 1787000000000 },
             { stand: "5", kg: 9.48, stare: "asteapta" }]);
    vm.runInContext("treceDeFoaie()", c);

    t("cântarul a intrat la standul 13", vm.runInContext("state.participants[1].m[1].catches", c), [12.34]);
    t("…și la standul 5", vm.runInContext("state.participants[0].m[1].catches", c), [9.48]);
    t("ceilalți au rămas goi", vm.runInContext("state.participants[2].m[1].catches", c), []);
    t("s-a întrebat o dată", c.intrebat.length, 1);
    t("…cu numărul și manșa", /Treci 2 cântare în manșa 1\?/.test(c.intrebat[0]), true);
    t("s-a pus o copie deoparte", c.copii, ["înainte de cântarele de pe poză"]);
    t("s-a salvat", c.salvat > 0, true);
    /* Peste o lună, la o contestație, trebuie să se vadă dacă a citit mașina sau omul —
       aia e diferența dintre „a greșit modelul" și „a greșit cineva". */
    t("jurnalul deosebește citirea de scrisul de mână",
      vm.runInContext("state.jurnal.map(function(x){return x.cine;})", c).sort(),
      ["citit de pe poză", "de pe poză"]);
    t("ora capturii e ora din poză, nu a importului",
      vm.runInContext("state.participants[1].m[1].catchTimes[0]", c), 1787000000000);
    t("amprentele s-au ținut minte", vm.runInContext("state.pozeTrecute.length", c), 2);
    t("magazia s-a golit", c.magaziaStearsa > 0, true);
    t("se întoarce la Cântar", c.ecrane[c.ecrane.length - 1], "cantar");
  }

  /* ================================================================
     8. Paze
     ================================================================ */
  console.log("\n=== 8. Paze ===");
  {
    const c = pornire(LOT, { blocat: true });
    pune(c, [{ stand: "13", kg: 12.34 }]);
    vm.runInContext("treceDeFoaie()", c);
    t("pe telefonul blocat nu intră nimic", vm.runInContext("state.jurnal.length", c), 0);
    t("…și nici nu se întreabă", c.intrebat.length, 0);
  }
  {
    const c = pornire(LOT, { confirma: false });
    pune(c, [{ stand: "13", kg: 12.34 }]);
    vm.runInContext("treceDeFoaie()", c);
    t("dacă răspunde „nu\", nu intră nimic", vm.runInContext("state.jurnal.length", c), 0);
    t("…și copia nu se pune degeaba", c.copii, []);
  }
  {
    const c = pornire(LOT);
    pune(c, [{ stand: "99", kg: 12.34 }]);
    vm.runInContext("treceDeFoaie()", c);
    t("un stand fără pescar nu se întreabă degeaba", c.intrebat.length, 0);
    t("…și se spune de ce", /Niciun cântar gata/.test(c.toasturi.join(" ")), true);
  }
  {
    const c = pornire(LOT, { pozeTrecute: ["h0"] });
    pune(c, [{ stand: "13", kg: 12.34, hash: "h0" }]);
    vm.runInContext("treceDeFoaie()", c);
    t("poza deja trecută e strigată în întrebare", /a mai fost trecută/.test(c.intrebat[0]), true);
    t("…și se spune ce s-ar întâmpla", /s-ar dubla/.test(c.intrebat[0]), true);
    t("amprenta nu se scrie de două ori", vm.runInContext("state.pozeTrecute", c), ["h0"]);
  }
  {
    const c = pornire(LOT);
    pune(c, [{ stand: "13", kg: 600 }]);
    vm.runInContext("treceDeFoaie()", c);
    t("greutatea prea mare e strigată în întrebare", /peste 50 kg — uită-te încă o dată/.test(c.intrebat[0]), true);
  }
  {
    const c = pornire(LOT);
    pune(c, [{ stand: "13", kg: 12.34, stare: "nesigur" }]);
    vm.runInContext("treceDeFoaie()", c);
    /* Ce a citit nesigur nu se strecoară în clasament fără ca omul să fie avertizat. */
    t("citirea nesigură e strigată în întrebare", /citit nesigur — uită-te încă o dată/.test(c.intrebat[0]), true);
  }
  {
    const c = pornire(LOT, { mansa: 2 });
    pune(c, [{ stand: "13", kg: 12.34 }]);
    vm.runInContext("treceDeFoaie()", c);
    t("intră în manșa deschisă", vm.runInContext("state.participants[1].m[2].catches", c), [12.34]);
    t("…iar manșa 1 rămâne goală", vm.runInContext("state.participants[1].m[1].catches", c), []);
  }
  {
    const c = pornire(LOT, { confirma: false });
    pune(c, [{ stand: "13", kg: 12.34 }]);
    vm.runInContext("renuntaLaPoze()", c);
    t("„Renunț\" întreabă înainte să piardă ce e scris", /Renunți\?/.test(c.intrebat[0] || ""), true);
    t("…și nu scrie nimic", vm.runInContext("state.jurnal.length", c), 0);
  }

  /* ================================================================
     9. Ce vede omul pe rând
     ================================================================ */
  console.log("\n=== 9. Rândul de pe ecran ===");
  {
    const c = pornire(LOT);
    pune(c, [{ stand: "13", kg: 12.34, stare: "citit" },
             { stand: "5", kg: 9.48, stare: "nesigur" },
             { stand: "", kg: null, stare: "necitit" }]);
    vm.runInContext("randeazaFoaia()", c);
    const h = c.el["poza-foaie"].innerHTML;
    t("un rând pe poză", (h.match(/class="poza-r/g) || []).length, 3);
    t("scrie cine e pe standul ăla", /Mihai Ionescu/.test(h), true);
    t("citirea nesigură se vede pe rând", /poza-r nesigur/.test(h), true);
    t("…și scrie ce s-a întâmplat", /citit nesigur/.test(h), true);
    t("când n-a putut citi, spune să scrie omul", /scrie tu/.test(h), true);
    t("fără stand, îl cere", /scrie standul/.test(h), true);
    t("poza se poate mări", /onclick="maresteFoaia\(0\)"/.test(h), true);

    const rez = c.el["poza-rezumat"].innerHTML;
    t("rezumatul numără câte sunt gata", /2 din 3 gata/.test(rez), true);
    t("…adună kilogramele", /21,820 kg/.test(rez), true);
    t("…și strigă câte trebuie verificate", /1 de verificat/.test(rez), true);
  }

  /* ================================================================
     10. Worker: citirea propriu-zisă
     ================================================================ */
  console.log("\n=== 10. Drumul de pe worker ===");
  {
    const w = { console, JSON, Math, parseFloat, isNaN };
    vm.createContext(w);
    ["numOf", "textDinRaspuns", "kgDinText"].forEach(f => vm.runInContext(H.grabFunction(wkSrc, f), w));
    const kg = x => vm.runInContext("kgDinText(" + JSON.stringify(x) + ")", w);

    t("JSON curat", kg('{"kg": 11.29, "sigur": true}'), { kg: 11.29, sigur: true });
    t("JSON cu vorbe în jur", kg('Sigur! Iată: {"kg": 25.74, "sigur": true} Sper că ajută.'),
      { kg: 25.74, sigur: true });
    t("nesigur rămâne nesigur", kg('{"kg": 19.82, "sigur": false}'), { kg: 19.82, sigur: false });
    /* Când modelul uită JSON-ul, se ia numărul — dar NICIODATĂ ca sigur. */
    t("fără JSON, ia numărul dar nu-l dă ca sigur", kg("Pe afișaj scrie 23.41 kg"),
      { kg: 23.41, sigur: false });
    t("virgula merge și ea", kg("scrie 23,41"), { kg: 23.41, sigur: false });
    /* Un juvelnic nu are 0 kg, iar cântarul lui nu trece de 50: ce iese în afară e o
       citire greșită, nu o greutate. Mai bine căsuță goală decât cifră inventată. */
    t("peste 50 kg nu e o citire, e o greșeală", kg('{"kg": 900, "sigur": true}'), { kg: null, sigur: false });
    t("zero nu e o greutate", kg('{"kg": 0, "sigur": true}'), { kg: null, sigur: false });
    t("text fără nicio cifră", kg("Nu pot citi afișajul."), { kg: null, sigur: false });

    const txt = x => vm.runInContext("textDinRaspuns(" + JSON.stringify(x) + ")", w);
    t("forma Workers AI {response}", txt({ response: "merge" }), "merge");
    t("forma OpenAI {choices}", txt({ choices: [{ message: { content: "merge" } }] }), "merge");
    t("un răspuns gol nu crapă", txt(null), "");
  }
  {
    t("drumul există pe worker", /url\.pathname === "\/api\/citeste-cantar" && req\.method === "POST"/.test(wkSrc), true);
    /* Cheia modelului stă pe worker; drumul se deschide doar cu cheia de scriere, ca restul
       scrierilor — telefonul ăla mai ajunge în mâna altcuiva. */
    const drum = wkSrc.slice(wkSrc.indexOf('/api/citeste-cantar'), wkSrc.indexOf('url.pathname === "/api/state"'));
    t("cere cheia de scriere", /x-write-key[\s\S]{0,60}env\.WRITE_KEY/.test(drum), true);
    t("fără binding AI o spune, nu crapă", /if \(!env\.AI\) return json/.test(drum), true);
    t("primește doar poze", /data:image\\\/\(jpeg\|jpg\|png\|webp\);base64,/.test(drum), true);
    t("refuză pozele uriașe", /poza\.length > 1400000/.test(drum), true);
    t("îi spune modelului să ignore scrisul de pe carcasă", /50kg\/110lb[\s\S]{0,60}HOLD/.test(drum), true);
    t("…și să spună când nu e sigur", /pune \\"sigur\\": false/.test(drum), true);
    t("întoarce și ce a spus modelul, pentru când greșește", /brut: text\.slice/.test(drum), true);
  }

  /* ================================================================
     11. Drumul poza → aplicație
     ================================================================ */
  console.log("\n=== 11. De la „Distribuie\" la ecran ===");
  {
    const st = manifest.share_target;
    t("manifestul cere poze", st.params.files[0].accept, ["image/jpeg", "image/png", "image/webp"]);
    /* Standul e DOAR în legendă — fără câmpurile astea, aplicația n-ar ști al cui e cântarul. */
    t("…și textul de sub ele", [st.params.text, st.params.title], ["text", "titlu"]);

    t("service worker-ul păstrează legenda", /form\.get\("title"\)[\s\S]{0,40}form\.get\("text"\)/.test(swSrc), true);
    t("…sub o adresă recunoscută de aplicație", /legenda-primita/.test(swSrc), true);
    t("aplicația o caută acolo", /indexOf\("legenda"\)/.test(src), true);
    t("versiunea a fost urcată", /concurs-pescuit-v157/.test(swSrc), true);
    /* „Nu-mi apare aplicația la Distribuie." Nu e lămurit dacă Androidul duce mai departe
       interogarea din „action"; dacă n-o duce, POST-ul vine curat pe „./index.html". Se
       prinde orice POST către aplicație — altfel ar pleca spre GitHub Pages, care nu
       primește POST-uri, și s-ar vedea o pagină de eroare în loc de foaie. */
    t("orice POST către aplicație e recunoscut, nu doar cel cu „?poze=1\"",
      /e\.request\.method === "POST" && url\.origin === self\.location\.origin/.test(swSrc), true);
    t("…dar nu se fură cererile către server", /url\.pathname\.indexOf\("\/api\/"\) < 0/.test(swSrc), true);
    t("actualizarea nu șterge pozele primite", /k !== CACHE && k !== POZE/.test(swSrc), true);

    const desc = H.grabFunction(src, "deschidePoze");
    /* Ordinea sosirii nu înseamnă nimic — „le-am trimis eu aleatoriu". */
    t("pozele se așază după ora din fișier", /sort\(function\(a,b\)\{ return \(a\.ora\|\|0\)-\(b\.ora\|\|0\); \}\)/.test(desc), true);
    t("…iar standurile din legendă se pun pe ele", /standuriDinLegenda\(legenda, list\.length\)/.test(desc), true);
    t("citirea pornește singură", /citesteToatePozele\(\)/.test(desc), true);

    /* 17 cereri deodată pe 4G se calcă în picioare. */
    t("pozele se citesc una câte una", /i\+\+; urmatoarea\(\);/.test(H.grabFunction(src, "citesteToatePozele")), true);
    t("ce a scris omul nu se calcă de citire", /if\(!p\.scrisDeMana\)\{ p\.kg=r\.kg; p\.stare=r\.stare; \}/.test(H.grabFunction(src, "citesteToatePozele")), true);

    const s0 = src.indexOf('id="view-poze"');
    t("un singur buton albastru pe ecranul lui",
      (src.slice(s0, src.indexOf('<section class="view"', s0 + 10)).match(/btn-primary/g) || []).length, 1);
    t("se poate alege o poză din telefon", /id="poza-fis"[^>]*multiple/.test(src), true);
    t("se poate fotografia pe loc", /id="poza-cam"[^>]*capture="environment"/.test(src), true);

    const tr = H.grabFunction(src, "treceDeFoaie");
    t("poza nu se scrie în starea concursului", /catchPhotos\.push\(null\)/.test(tr), true);
  }

  t.raport();
})();
