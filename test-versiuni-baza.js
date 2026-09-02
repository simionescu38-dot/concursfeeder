/**
 * Versiunile bazei de pescari, de pe server, și întoarcerea la una din ele.
 *
 * Serverul păstrează ultimele 40 de variante ale oricărei camere — deci și ale bazei,
 * fiindcă baza stă tot într-o cameră. Nu s-a lipit nimic în worker pentru asta.
 *
 * Câți pescari are o versiune se citește din NUMELE ei („Baza de pescari · 98"): lista de
 * versiuni de pe server dă numele, nu și cuprinsul. De-aia numele se scrie cu numărul în
 * el la fiecare trimitere.
 *
 * Întoarcerea ÎNLOCUIEȘTE baza, nu o adună — altfel n-ar fi o întoarcere. Ca să nu se
 * piardă nimic, baza de acum se urcă întâi pe server, iar serverul o pune în istoric
 * înainte de a restaura.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = ["uid", "esc", "faraSemne", "cheiePescar", "numePescar", "pescarCodNou",
  "pescarNou", "timeAgoCal", "bazaDinFisier", "potrivesteBaza", "cameraBazei",
  "bazaPoateLaServer", "bazaIncarcaRev", "bazaSalveazaRev", "bazaStare",
  "improspateazaStareaBazei", "bazaScrieLocal", "bazaAdunaDe", "trimiteBaza",
  "catiDinNume", "candBaza", "vediVersiunileBazei", "restaureazaBaza"];

function lume(optiuni) {
  const o = optiuni || {};
  const memorie = {};
  const elemente = {};
  const ctx = {
    console, JSON, Date, Math, parseInt, isNaN, Array, String, Object, Promise,
    encodeURIComponent,
    API_BASE: "https://api.test",
    syncRoom: o.camera === undefined ? "feedermoldova" : o.camera,
    syncKey: o.cheie === undefined ? "cheia-mea" : o.cheie,
    blocat: !!o.blocat, intrebat: [], raspuns: o.confirma !== false,
    toasturi: [], desenat: 0, cereri: [],
    guard() { return ctx.blocat; },
    isLocked() { return ctx.blocat; },
    confirm(q) { ctx.intrebat.push(q); return ctx.raspuns; },
    toast(m) { ctx.toasturi.push(m); },
    renderPescari() { ctx.desenat++; },
    setTimeout(fn) { fn(); return 1; },
    clearTimeout() {},
    localStorage: { getItem: k => (k in memorie ? memorie[k] : null), setItem: (k, v) => { memorie[k] = v; } },
    memorie,
    document: { getElementById: id => (elemente[id] = elemente[id] || { textContent: "", innerHTML: "", style: {} }) },
    __el: elemente,
    fetch(url, opt) {
      ctx.cereri.push({ url, metoda: (opt && opt.method) || "GET",
                        cheie: opt && opt.headers && opt.headers["x-write-key"] });
      const r = ctx.raspunsuri.shift();
      if (r === "cade") return Promise.reject(new Error("fără net"));
      return Promise.resolve({ json: () => Promise.resolve(r) });
    },
    raspunsuri: (o.raspunsuri || []).slice()
  };
  vm.createContext(ctx);
  vm.runInContext('var PESCARI_KEY="concurs-pescari-v1"; var pescari=[]; var pescariUltimCod=0;', ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  vm.runInContext('var BAZA_PREFIX="baza:"; var BAZA_REV_KEY="concurs-baza-rev";' +
                  " var bazaRevCunoscut=0; var bazaT=null;", ctx);
  (o.baza || []).forEach(nm => {
    const sp = nm.indexOf(" ");
    vm.runInContext("pescari.push(pescarNou(" + JSON.stringify(nm.slice(0, sp)) + "," +
                    JSON.stringify(nm.slice(sp + 1)) + "))", ctx);
  });
  return ctx;
}

const baza = ctx => vm.runInContext("pescari.map(function(p){ return p.cod+':'+numePescar(p); })", ctx);
const cutie = ctx => ctx.__el["baza-versiuni"].innerHTML;
const stareV = ctx => ctx.__el["baza-versiuni-stare"].textContent;
const text = h => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
/* lasă lanțul de promisiuni să se scurgă până la capăt: fiecare cerere adaugă
   încă vreo două trepte, iar întoarcerea are patru cereri una după alta */
const linisteste = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };
/* o versiune așa cum o dă /api/history */
const versiune = (id, cati, cuAtataTimpInUrma) => ({
  id, rev: 1, name: "Baza de pescari · " + cati, participants: 0,
  saved_at: new Date(Date.now() - cuAtataTimpInUrma).toISOString()
});
const peServer = (oameni, ultimulCod) => ({
  baza: true, name: "Baza de pescari · " + oameni.length,
  ultimulCod: ultimulCod === undefined ? oameni.length : ultimulCod,
  pescari: oameni.map(x => {
    const sp = x.nume.indexOf(" ");
    return { id: "s" + x.cod, cod: x.cod, prenume: x.nume.slice(0, sp), nume: x.nume.slice(sp + 1) };
  })
});

(async () => {

/* ================================================================
   1. Câți pescari are o versiune
   ================================================================ */
console.log("\n=== 1. Numărul se citește din numele versiunii ===");
{
  const c = lume({});
  const cati = x => vm.runInContext("catiDinNume(" + JSON.stringify(x) + ")", c);
  t("din numele scris de aplicație", cati("Baza de pescari · 98"), 98);
  t("un singur pescar", cati("Baza de pescari · 1"), 1);
  t("baza goală", cati("Baza de pescari · 0"), 0);
  t("un nume fără număr nu minte cu zero", cati("Concursul de duminică"), null);
  t("…nici numele lipsă", cati(""), null);
  t("…nici lipsa cu totul", cati(undefined), null);

  /* Numărul chiar pleacă în nume la fiecare trimitere — altfel lista de versiuni n-ar
     avea de unde ști câți sunt. */
  t("trimiterea scrie numărul în nume",
    /name:"Baza de pescari · "\+pescari\.length/.test(H.grabFunction(src, "trimiteBaza")), true);
}

/* ================================================================
   2. Lista
   ================================================================ */
console.log("\n=== 2. Ce se vede în listă ===");
{
  const c = lume({
    baza: ["Mihai Ionescu"],
    raspunsuri: [{ ok: true, versions: [versiune("v3", 101, 3600e3), versiune("v2", 98, 26 * 3600e3),
                                        versiune("v1", 44, 3 * 24 * 3600e3)] }]
  });
  vm.runInContext("vediVersiunileBazei();", c);
  await linisteste();

  t("s-a cerut istoricul camerei bazei", c.cereri[0].url,
    "https://api.test/api/history?room=baza%3Afeedermoldova");
  t("se spune câte sunt", stareV(c), "3 versiuni păstrate · serverul le ține pe ultimele 40.");
  t("fiecare versiune are numărul ei de pescari",
    (cutie(c).match(/class="cod">(\d+)</g) || []).map(x => x.replace(/\D/g, "")), ["101", "98", "44"]);
  t("…și de când e", /acum 1 oră/.test(text(cutie(c))), true);
  t("…și cea de acum trei zile", /acum 3 zile/.test(text(cutie(c))), true);
  t("fiecare are butonul ei", (cutie(c).match(/restaureazaBaza\(/g) || []).length, 3);
  t("butonul spune ce face", /Adu-o<\/button>/.test(cutie(c)), true);
  t("butoanele nu-s scoase în față", /btn-primary/.test(cutie(c)), false);
}

console.log("\n=== 2b. Când n-are ce arăta ===");
{
  const goala = lume({ raspunsuri: [{ ok: true, versions: [] }] });
  vm.runInContext("vediVersiunileBazei();", goala);
  await linisteste();
  t("se spune de ce e goală",
    /Nicio versiune mai veche pe server încă\. Se strâng singure/.test(stareV(goala)), true);
  t("…și nu se desenează niciun rând", cutie(goala), "");

  const cade = lume({ raspunsuri: ["cade"] });
  vm.runInContext("vediVersiunileBazei();", cade);
  await linisteste();
  t("fără net, se spune", stareV(cade), "N-am putut citi versiunile de pe server.");

  const faraCamera = lume({ camera: "" });
  vm.runInContext("vediVersiunileBazei();", faraCamera);
  await linisteste();
  t("fără cameră, nu se cere nimic", faraCamera.cereri.length, 0);
  t("…și se spune ce lipsește", faraCamera.toasturi[0], "Îți trebuie codul de cameră și cheia de scriere");
}

console.log("\n=== 2c. Cu lacătul pus, versiunile se văd dar nu se aduc ===");
{
  const c = lume({ blocat: true, raspunsuri: [{ ok: true, versions: [versiune("v1", 44, 3600e3)] }] });
  vm.runInContext("vediVersiunileBazei();", c);
  await linisteste();
  t("rândul se vede", /class="cod">44</.test(cutie(c)), true);
  t("…dar fără buton", /restaureazaBaza/.test(cutie(c)), false);
}

/* ================================================================
   3. Întoarcerea
   ================================================================ */
console.log("\n=== 3. Ce se întreabă înainte ===");
{
  const c = lume({ baza: ["Unu Om", "Doi Om", "Trei Om"], confirma: false });
  vm.runInContext("restaureazaBaza('v2',1,'2 sept., 17:42');", c);
  await linisteste();
  t("s-a întrebat", c.intrebat.length, 1);
  t("…cu ziua versiunii", /Te întorci la versiunea din 2 sept\., 17:42\?/.test(c.intrebat[0]), true);
  t("…cu câți ai acum și câți are ea", /Acum ai 3 pescari, versiunea aia are 1\./.test(c.intrebat[0]), true);
  t("…și câți dispar", /După întoarcere rămân 1 — 2 dispar\./.test(c.intrebat[0]), true);
  t("…și că te poți întoarce și de acolo",
    /Baza de acum se pune întâi deoparte pe server/.test(c.intrebat[0]), true);
  t("cu «nu», nu pleacă nicio cerere", c.cereri.length, 0);
  t("…și baza rămâne cum era", baza(c).length, 3);
}

console.log("\n=== 3b. Când versiunea are mai mulți, nu se spune că dispar ===");
{
  const c = lume({ baza: ["Unu Om"], confirma: false });
  vm.runInContext("restaureazaBaza('v2',5,'2 sept., 17:42');", c);
  await linisteste();
  t("se spun numerele", /Acum ai 1 pescar, versiunea aia are 5\./.test(c.intrebat[0]), true);
  t("…dar nu se pomenește de dispărut", /dispar/.test(c.intrebat[0]), false);
}

console.log("\n=== 3c. Întoarcerea propriu-zisă ===");
{
  const c = lume({
    baza: ["Unu Om", "Doi Om", "Trei Om"],
    raspunsuri: [
      { ok: true, rev: 7, data: null },        // trimiteBaza: citește
      { ok: true, rev: 8 },                    // trimiteBaza: scrie baza de acum
      { ok: true, rev: 9 },                    // restaurarea
      { ok: true, rev: 9, data: peServer([{ cod: 1, nume: "Unu Om" }], 3) }  // ce a ieșit
    ]
  });
  vm.runInContext("restaureazaBaza('v2',1,'2 sept., 17:42');", c);
  await linisteste();

  t("întâi se urcă baza de acum, ca să intre în istoric",
    c.cereri.slice(0, 2).map(x => x.metoda), ["GET", "PUT"]);
  t("apoi se cere restaurarea", c.cereri[2].metoda, "POST");
  t("…de pe versiunea aleasă", c.cereri[2].url,
    "https://api.test/api/restore?room=baza%3Afeedermoldova&id=v2");
  t("…cu cheia de scriere", c.cereri[2].cheie, "cheia-mea");
  t("apoi se citește ce a ieșit", c.cereri[3].metoda, "GET");

  t("baza s-a ÎNLOCUIT, nu s-a adunat", baza(c), ["1:Unu Om"]);
  /* Numărătoarea NU dă înapoi, oricât de veche ar fi versiunea adusă: un cod dat cândva
     nu se mai dă altcuiva. Aici baza de acum ajunsese la 3, versiunea adusă are un
     singur om — dar următorul venit tot 4 ia, nu 2. */
  t("numărătoarea codurilor nu dă înapoi", vm.runInContext("pescarCodNou()", c), 4);
  t("…nici când versiunea adusă are numărătoarea mai mică",
    vm.runInContext("bazaRevCunoscut && pescariUltimCod", c), 3);
  t("s-a scris pe telefon", JSON.parse(c.memorie["concurs-pescari-v1"]).lista.length, 1);
  t("revizia nouă se ține minte", vm.runInContext("bazaRevCunoscut", c), 9);
  t("i se spune omului", c.toasturi[c.toasturi.length - 1], "Baza s-a întors la 1 pescar");
  /* Mesajul de gata nu se pierde: intră în capul listei împrospătate, nu într-un rând
     scris înainte și șters de împrospătare. */
  t("…iar mesajul de gata trece prin lista împrospătată",
    /vediVersiunileBazei\("Gata — baza e cea din "\+cand\)/.test(H.grabFunction(src, "restaureazaBaza")), true);
  t("s-a redesenat", c.desenat > 0, true);
}

console.log("\n=== 3d. Când nu merge, telefonul nu se atinge ===");
{
  const c = lume({
    baza: ["Unu Om", "Doi Om"],
    raspunsuri: [{ ok: true, rev: 1, data: null }, { ok: true, rev: 2 },
                 { ok: false, error: "not found" }]
  });
  vm.runInContext("restaureazaBaza('vX',1,'2 sept., 17:42');", c);
  await linisteste();
  t("se spune că n-a mers", stareV(c), "N-am putut întoarce baza. Nu s-a schimbat nimic pe telefon.");
  t("…iar baza a rămas întreagă", baza(c).length, 2);

  const faraNet = lume({ baza: ["Unu Om"], raspunsuri: ["cade"] });
  vm.runInContext("restaureazaBaza('v2',0,'2 sept., 17:42');", faraNet);
  await linisteste();
  t("nici fără net nu se pierde nimic", baza(faraNet).length, 1);
  t("…și se spune", /Nu s-a schimbat nimic pe telefon/.test(stareV(faraNet)), true);
}

console.log("\n=== 3e. Cu lacătul pus nu se întoarce ===");
{
  const c = lume({ baza: ["Unu Om"], blocat: true });
  vm.runInContext("restaureazaBaza('v2',0,'2 sept., 17:42');", c);
  await linisteste();
  t("nu s-a întrebat", c.intrebat, []);
  t("nu pleacă nicio cerere", c.cereri.length, 0);
  t("baza rămâne cum era", baza(c).length, 1);
}

/* ================================================================
   4. Ecranul
   ================================================================ */
console.log("\n=== 4. Ecranul e legat cum trebuie ===");
{
  const ecran = src.slice(src.indexOf('id="view-pescari"'), src.indexOf('id="view-spons"'));
  t("butonul e pe ecran", /onclick="vediVersiunileBazei\(\)"/.test(ecran), true);
  t("butonul spune ce face", /Vezi versiunile de pe server<\/button>/.test(ecran), true);
  t("stă în bucata ascunsă la lacăt",
    ecran.indexOf('id="baza-server"') < ecran.indexOf("vediVersiunileBazei"), true);
  t("…și înainte de bucata cu fișierul",
    ecran.indexOf("vediVersiunileBazei") < ecran.indexOf("salveazaBaza"), true);
  t("ecranul rămâne cu trei carduri", (ecran.match(/class="card/g) || []).length, 3);
  t("un singur buton scos în față", (ecran.match(/btn-primary/g) || []).length, 1);

  const rb = H.grabFunction(src, "restaureazaBaza");
  t("cu lacătul pus nu se întoarce", /^\s*function restaureazaBaza\([^)]*\)\{\s*\r?\n\s*if\(guard\(\)\) return;/.test(rb), true);
  t("se întreabă înainte", /if\(!confirm\(q\)\) return;/.test(rb), true);
  t("baza de acum se urcă înainte de restaurare",
    rb.indexOf("trimiteBaza()") < rb.indexOf("/api/restore"), true);
  t("…și se citește ce a ieșit, după", rb.indexOf("/api/restore") < rb.indexOf("/api/state"), true);
  t("scrie pe telefon fără să pornească o nouă trimitere",
    /bazaScrieLocal\(\);/.test(rb) && !/pescariSalveaza\(\)/.test(rb), true);
}

t.raport();

})();
