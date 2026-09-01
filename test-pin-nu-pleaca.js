/**
 * PIN-ul nu pleacă de pe telefon.
 *
 * Pleca în trei locuri, toate citite de oricine, fără nicio cheie:
 *   · starea camerei live — o citește oricine are codul camerei, adică toți cei cărora
 *     le-a trimis linkul pe grup;
 *   · arhiva de sezon — e publică, așa a fost cerută;
 *   · fișierul de backup, trimis pe WhatsApp.
 *
 * `pinHash` e urma unui PIN de 4–6 cifre, făcută fără sare. Din ea, cifrele se află în
 * mai puțin de o secundă: sunt cel mult 1.110.000 de variante.
 *
 * Aici nu se citește codul cu ochii — se RULEAZĂ cele trei plecări, cu fetch-ul și
 * salvarea împănate, și se caută PIN-ul în ce a plecat.
 *
 * Codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

/** o stare de concurs ca la baltă, cu PIN pus și aplicația blocată */
function stareCuPin() {
  return {
    name: "Cupa de probă", balta: "Remus Lake", sectors: ["A", "B"],
    manche: 1, numManse: 2, numStanduri: "11", startAt: 1785304800000,
    scalaSectoare: true, voiceOn: true, pushOn: true,
    sponsors: [{ id: "s1", nume: "Magazin Feeder", oferta: "10%" }],
    jurnal: [{ t: 1785304900000, ce: "cântar" }],
    participants: [
      { id: "p1", prenume: "Mihai", nume: "Ionescu", stand: "3", sector: "A",
        m: { 1: { catches: [9.5], catchTimes: [1785304900000], catchPhotos: ["data:image/jpeg;base64,AAAA"],
                  extras: [], extraPhotos: [], cmmc: "" } } }
    ],
    pinHash: "h576c85c584f60555c2a024cbb99dfbbdb5f58c3bdcf28dbc8ea315fd46a388f3",
    lock: true
  };
}
const URMA = stareCuPin().pinHash;

/** contextul aplicației, cu tot ce iese spre lume prins în cutii */
function aplicatia(stare) {
  const iesiri = { retea: [], fisiere: [], toasts: [] };
  const ctx = {
    console, JSON, Date, Math, Array, Object, String, Number, Promise, setTimeout, clearTimeout,
    state: stare,
    iesiri,
    API_BASE: "https://exemplu.workers.dev",
    syncRoom: "cupa", syncKey: "cheie-de-scriere", viewerMode: false,
    syncBusy: false, syncProblem: "", syncRetryT: 0, syncRetryDelay: 3000, syncLastOk: "",
    lastRev: 0, currentArchiveId: "",
    localStorage: { setItem() {}, getItem() { return null; }, removeItem() {} },
    document: { getElementById: () => null },
    navigator: {},                       // fără canShare → merge pe downloadJson
    fetch(u, o) {
      iesiri.retea.push({ url: u, method: (o && o.method) || "GET", body: (o && o.body) || "" });
      return Promise.resolve({ json: () => Promise.resolve({ ok: true, rev: 1, id: "arh-1" }), headers: { get: () => null } });
    },
    toast(m) { iesiri.toasts.push(m); },
    setSyncStatus() {}, updateUploadBar() {}, updateRoomInfo() {}, adoptServerClock() {},
    nowHM: () => "12:00",
    saveArchiveId(id) { ctx.currentArchiveId = id || ""; },
    ceriBalta: () => true, improspateazaBalta() {},
    downloadJson(json, nume) { iesiri.fisiere.push({ nume, json }); },
    stergeArhiva: () => Promise.resolve(true),
    puneDeoParte() {}, normalize() {}, save() {},
    window: { addEventListener() {} }
  };
  ctx.window.state = stare;
  vm.createContext(ctx);
  vm.runInContext(
    ["faraSecrete", "stareFaraPoze", "pushState", "archiveToSeason", "exportData"]
      .map(n => H.grabFunction(src, n)).join("\n"), ctx);
  return ctx;
}

/* ================================================================
   1. Funcția în sine
   ================================================================ */
console.log("\n=== 1. Ce scoate și ce lasă ===");
{
  const c = aplicatia(stareCuPin());
  const rezultat = vm.runInContext("faraSecrete(state)", c);
  t("scoate urma PIN-ului", "pinHash" in rezultat, false);
  t("scoate și lacătul", "lock" in rezultat, false);
  t("lasă numele concursului", rezultat.name, "Cupa de probă");
  t("lasă pescarii, toți", rezultat.participants.length, 1);
  t("lasă și cântărirea lui", rezultat.participants[0].m[1].catches, [9.5]);
  t("lasă balta, ora de start, felul punctajului",
    [rezultat.balta, rezultat.startAt, rezultat.scalaSectoare],
    ["Remus Lake", 1785304800000, true]);
  t("lasă sponsorii și jurnalul", [rezultat.sponsors.length, rezultat.jurnal.length], [1, 1]);
  /* copie, nu tăiere: telefonul rămâne blocat după ce trimite */
  t("nu umblă la starea telefonului",
    [c.state.pinHash, c.state.lock], [URMA, true]);
  t("scoate exact două câmpuri, nu mai multe",
    Object.keys(c.state).length - Object.keys(rezultat).length, 2);
}

/* ================================================================
   2. Camera live — cea mai largă scurgere: codul camerei îl are tot grupul
   ================================================================ */
console.log("\n=== 2. Ce pleacă spre camera live ===");
{
  const c = aplicatia(stareCuPin());
  vm.runInContext("pushState()", c);
  const cerere = c.iesiri.retea[0];
  t("a plecat o singură cerere", c.iesiri.retea.length, 1);
  t("…spre camera live", /\/api\/state\?room=cupa/.test(cerere.url), true);
  t("…iar PIN-ul NU e în ea", cerere.body.indexOf(URMA) >= 0, false);
  t("…nici cuvântul pinHash", /pinHash/.test(cerere.body), false);
  t("…nici lacătul", /"lock"/.test(cerere.body), false);
  const trimis = JSON.parse(cerere.body).data;
  t("dar clasamentul pleacă întreg", trimis.participants[0].m[1].catches, [9.5]);
  t("…și numele concursului", trimis.name, "Cupa de probă");
  /* pozele erau scoase de dinainte — se verifică să fi rămas scoase */
  t("pozele tot nu pleacă la sincronizare", trimis.participants[0].m[1].catchPhotos, [null]);
  t("telefonul rămâne blocat după trimitere", [c.state.pinHash, c.state.lock], [URMA, true]);
}

/* ================================================================
   3. Arhiva de sezon — publică, așa a fost cerută
   ================================================================ */
console.log("\n=== 3. Ce pleacă în arhiva de sezon ===");
{
  const c = aplicatia(stareCuPin());
  vm.runInContext("archiveToSeason(null, true)", c);
  const cerere = c.iesiri.retea[0];
  t("…spre arhivă", /\/api\/archive/.test(cerere.url), true);
  t("PIN-ul NU pleacă în arhivă", cerere.body.indexOf(URMA) >= 0, false);
  t("…nici lacătul", /"lock"/.test(cerere.body), false);
  const trimis = JSON.parse(cerere.body).data;
  t("dar concursul pleacă întreg", trimis.participants.length, 1);
  /* arhiva ia și pozele: e dovada organizatorului, o dată, la final */
  t("pozele merg totuși în arhivă",
    trimis.participants[0].m[1].catchPhotos[0].slice(0, 10), "data:image");
}

/* ================================================================
   4. Fișierul de backup, trimis pe WhatsApp
   ================================================================ */
console.log("\n=== 4. Ce scrie în fișierul de backup ===");
{
  const c = aplicatia(stareCuPin());
  vm.runInContext("exportData()", c);
  const f = c.iesiri.fisiere[0];
  t("s-a scris un fișier", !!f, true);
  t("PIN-ul nu e în el", f.json.indexOf(URMA) >= 0, false);
  t("…nici lacătul", /"lock"/.test(f.json), false);
  const j = JSON.parse(f.json);
  t("dar concursul e întreg", j.data.participants.length, 1);
  t("…și se cunoaște că e al aplicației", j.app, "concurs-pescuit");
}
{
  /* Restaurarea lua oricum PIN-ul telefonului, nu pe cel din fișier — asta rămâne
     adevărat, deci un backup fără PIN se restaurează la fel de bine. */
  const sdf = H.grabFunction(src, "stareDinFisier");
  t("la restaurare, PIN-ul e tot al telefonului", /s\.pinHash\s*=\s*pinLocal/.test(sdf), true);
  t("…și lacătul la fel", /s\.lock\s*=\s*!!lacatLocal/.test(sdf), true);
}

/* ================================================================
   5. Nicio altă ieșire uitată
   ================================================================ */
console.log("\n=== 5. Toate cele trei plecări trec prin ea ===");
{
  t("camera live",
    /body: JSON\.stringify\(\{data: faraSecrete\(stareFaraPoze\(state\)\)\}\)/.test(src), true);
  t("arhiva de sezon",
    /var deTrimis = faraSecrete\(JSON\.parse\(JSON\.stringify\(state\)\)\)/.test(src), true);
  t("fișierul de backup", /data:faraSecrete\(state\)/.test(src), true);
  /* dacă mâine apare o a patra plecare cu starea întreagă, testul ăsta o arată */
  const plecari = (src.match(/JSON\.stringify\(\{data: [^)]*state[^)]*\)/g) || []);
  t("nicio trimitere a stării fără trecerea prin faraSecrete",
    plecari.filter(p => p.indexOf("faraSecrete") < 0), []);
}

/* ================================================================
   6. Arhivele deja păstrate în site
   ================================================================ */
console.log("\n=== 6. Arhivele din depozit ===");
{
  const dosar = path.join(H.RADACINA, "arhiva");
  const fisiere = fs.readdirSync(dosar).filter(f => /\.json$/.test(f)).sort();
  fisiere.forEach(f => {
    const brut = fs.readFileSync(path.join(dosar, f), "utf8");
    t(f + " — fără urma PIN-ului", /pinHash/.test(brut), false);
    t(f + " — fără lacăt", /"lock"/.test(brut), false);
  });
  /* concursurile n-au avut de suferit: se numără pescarii, ca ștergerea să nu fi luat
     altceva cu ea */
  const total = fisiere.filter(f => f !== "acelasi-om.json").reduce((s, f) => {
    const j = JSON.parse(fs.readFileSync(path.join(dosar, f), "utf8"));
    return s + ((j.data || j).participants || []).length;
  }, 0);
  t("cei 79 de pescari din cele 6 concursuri sunt toți acolo", total, 79);
}

t.raport();
