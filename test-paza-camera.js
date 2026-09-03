/**
 * Paza împotriva a două telefoane care își șterg cântăririle unul altuia.
 *
 * Telefonul nu trimite ce s-a schimbat, ci TOT concursul. Deci dacă între două salvări
 * ale lui a scris altcineva în cameră — laptopul lăsat deschis acasă, telefonul celui
 * care ține cântarul la ponton — scrierea noastră se pune peste, iar cântăririle
 * celuilalt se duc. Tăcut, în manșă.
 *
 * Trei lucruri de care atârnă tot:
 *  - paza NU are voie să oprească cântărirea. Fără semnal, sau la orice îndoială, se
 *    scrie. La baltă, o aplicație care refuză să salveze e mai rea decât una care
 *    suprascrie.
 *  - paza NU are voie să întrebe degeaba. O alarmă falsă îl învață pe om să apese OK
 *    fără să citească, și atunci alarma adevărată nu mai are cui vorbi.
 *  - paza NU are voie să încetinească cântărirea. În toi, salvările vin la câteva
 *    secunde; un drum în plus la server la fiecare ar târî aplicația pe semnalul de la
 *    baltă. Se verifică doar la prima salvare după o pauză.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = ["syncRevIncarca", "syncRevSalveaza", "cateIntrari",
  "cantaririInPlus", "pazaCamerei", "pushState"];

/** o lume cu un server prefăcut și un om care apasă OK sau Anulează */
function lume(optiuni) {
  const o = optiuni || {};
  const memorie = Object.assign({}, o.memorie || {});
  const ctx = {
    console, JSON, Date, Math, parseInt, isNaN, Array, String, Object, Promise,
    encodeURIComponent, setTimeout, clearTimeout,
    API_BASE: "https://api.test",
    syncRoom: o.camera === undefined ? "feedermoldova" : o.camera,
    syncKey: o.cheie === undefined ? "cheia-mea" : o.cheie,
    syncPaused: false, syncRetryT: null,
    intrebat: [], raspuns: o.confirma !== false,
    stari: [], scrieri: 0, cereri: [],
    state: { participants: o.aiciMei || [] },
    confirm(q) { ctx.intrebat.push(q); return ctx.raspuns; },
    setSyncStatus(m) { ctx.stari.push(m); },
    updateUploadBar() {},
    /* scrieStarea e înlocuită: proba e despre PAZĂ, nu despre trimiterea propriu-zisă */
    scrieStarea() { ctx.scrieri++; },
    localStorage: {
      getItem: k => (k in memorie ? memorie[k] : null),
      setItem: (k, v) => { memorie[k] = v; }
    },
    memorie,
    fetch(url) {
      ctx.cereri.push(url);
      if (o.cade) return Promise.reject(new Error("fără net"));
      return Promise.resolve({ json: () => Promise.resolve(o.raspuns || { ok: true, rev: 0, data: null }) });
    }
  };
  vm.createContext(ctx);
  vm.runInContext("var SYNC_REV_KEY='concurs-sync-rev'; var syncRevCunoscut=0;" +
                  " var syncUltimaScriere=0; var PAUZA_PAZA=30000;", ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  if (o.revStiut !== undefined) vm.runInContext("syncRevSalveaza(" + o.revStiut + ");", ctx);
  if (o.ultimaScriere !== undefined) vm.runInContext("syncUltimaScriere=" + o.ultimaScriere + ";", ctx);
  return ctx;
}

/** un pescar cu atâtea capturi și pești extra pe manșă */
const om = (id, manse) => ({ id: id, prenume: id, nume: "Om",
  m: Object.keys(manse).reduce((acc, mi) => {
    acc[mi] = { catches: new Array(manse[mi][0]).fill(1), extras: new Array(manse[mi][1] || 0).fill(2) };
    return acc;
  }, {}) });

const paza = c => new Promise(res => { c.gata = res;
  vm.runInContext("pazaCamerei().then(function(x){ gata(x); })", c); });
const impinge = async (c) => { vm.runInContext("pushState();", c);
  for (let i = 0; i < 8; i++) await Promise.resolve(); };

(async () => {

/* ================================================================
   1. Câte cântăriri are camera și noi nu
   ================================================================ */
console.log("\n=== 1. Numărătoarea cântăririlor în plus ===");
{
  const c = lume({ aiciMei: [om("a", { 1: [2, 0] }), om("b", { 1: [1, 1] })] });
  const nr = d => vm.runInContext("cantaririInPlus(" + JSON.stringify(d) + ")", c);
  t("camera are exact ce avem noi",
    nr({ participants: [om("a", { 1: [2, 0] }), om("b", { 1: [1, 1] })] }), 0);
  t("trei capturi în plus la un om",
    nr({ participants: [om("a", { 1: [5, 0] }), om("b", { 1: [1, 1] })] }), 3);
  t("un pește extra în plus",
    nr({ participants: [om("a", { 1: [2, 1] }), om("b", { 1: [1, 1] })] }), 1);
  t("cântăriri într-o manșă în care noi n-avem nimic",
    nr({ participants: [om("a", { 1: [2, 0], 2: [4, 0] })] }), 4);
  t("un om pe care noi nu-l avem deloc",
    nr({ participants: [om("a", { 1: [2, 0] }), om("c", { 1: [3, 0] })] }), 3);
  /* Ce am șters NOI nu se numără: paza se uită doar la ce e în plus acolo. */
  t("noi avem mai mult decât camera — nimic de pierdut",
    nr({ participants: [om("a", { 1: [0, 0] })] }), 0);
  t("cameră goală", nr({ participants: [] }), 0);
  t("cameră stricată", nr({}), 0);
  t("formatul vechi, fără manșe",
    vm.runInContext("cantaririInPlus({participants:[{id:'a',catches:[1,2,3],extras:[]}]})", c), 1);
}

/* ================================================================
   2. Când întreabă și când nu
   ================================================================ */
console.log("\n=== 2. Paza întreabă doar când e ceva de pierdut ===");
{
  /* revizia n-a mers mai departe de a noastră: n-a scris nimeni după noi */
  const linistit = lume({ revStiut: 5,
    raspuns: { ok: true, rev: 5, data: { participants: [om("a", { 1: [9, 0] })] } } });
  t("revizia e tot a noastră — se scrie fără vorbă", await paza(linistit), true);
  t("…și nu s-a întrebat nimic", linistit.intrebat.length, 0);

  /* revizia a mers mai departe, dar fără nicio cântărire în plus */
  const alta = lume({ revStiut: 5, aiciMei: [om("a", { 1: [3, 0] })],
    raspuns: { ok: true, rev: 7, data: { participants: [om("a", { 1: [3, 0] })] } } });
  t("revizie nouă fără cântăriri noi — se scrie", await paza(alta), true);
  t("…tot fără să întrebe", alta.intrebat.length, 0);
  t("…iar revizia lor devine a noastră", vm.runInContext("syncRevCunoscut", alta), 7);

  /* aici chiar e ceva de pierdut */
  const primejdie = lume({ revStiut: 5, aiciMei: [om("a", { 1: [1, 0] })],
    raspuns: { ok: true, rev: 6, data: { participants: [om("a", { 1: [4, 0] })] } } });
  t("cu cântăriri de pierdut, se întreabă", await paza(primejdie), true);
  t("…o singură dată", primejdie.intrebat.length, 1);
  t("se spune câte sunt", /sunt 3 cântăriri puse de pe alt telefon/.test(primejdie.intrebat[0]), true);
  t("…și ce se întâmplă dacă apasă OK", /Dacă salvezi acum, se pierd\./.test(primejdie.intrebat[0]), true);
  t("…și ce face fiecare buton",
    /OK = salvez oricum[\s\S]*Anulează = opresc sincronizarea/.test(primejdie.intrebat[0]), true);
}

console.log("\n=== 2b. Când omul spune «nu» ===");
{
  const c = lume({ revStiut: 5, confirma: false, aiciMei: [om("a", { 1: [1, 0] })],
    raspuns: { ok: true, rev: 6, data: { participants: [om("a", { 1: [4, 0] })] } } });
  t("nu se scrie peste", await paza(c), false);
  t("sincronizarea se oprește", vm.runInContext("syncPaused", c), true);
  t("i se spune de ce", /în cameră sunt cântăriri de pe alt telefon/.test(c.stari[0]), true);
  t("…și cum iese din asta", /atinge banda de sus/.test(c.stari[0]), true);
  t("revizia lor NU devine a noastră", vm.runInContext("syncRevCunoscut", c), 5);
}

console.log("\n=== 2c. Paza nu are voie să oprească cântărirea ===");
{
  const fara = lume({ revStiut: 5, cade: true });
  t("fără semnal, se scrie", await paza(fara), true);

  const gol = lume({ revStiut: 5, raspuns: { ok: true, rev: 9, data: null } });
  t("cameră fără date, se scrie", await paza(gol), true);

  const stricat = lume({ revStiut: 5, raspuns: { ok: false, error: "forbidden" } });
  t("server care se plânge, se scrie", await paza(stricat), true);

  const faraCamera = lume({ camera: "" });
  t("fără cameră n-are ce păzi", await paza(faraCamera), true);
  t("…și nici nu întreabă serverul", faraCamera.cereri.length, 0);
}

/* ================================================================
   3. Când se face verificarea
   ================================================================ */
console.log("\n=== 3. Se verifică la prima salvare după o pauză ===");
{
  const intai = lume({});
  await impinge(intai);
  t("prima salvare a sesiunii verifică întâi camera", intai.cereri.length, 1);
  t("…și abia apoi scrie", intai.scrieri, 1);

  /* în toiul cântăririi salvările vin una după alta: n-are voie să bată drumul de
     fiecare dată, altfel pe semnalul de la baltă aplicația se târăște */
  const inToi = lume({ ultimaScriere: Date.now() - 2000 });
  await impinge(inToi);
  t("în toi, nu se mai umblă la server", inToi.cereri.length, 0);
  t("…dar se scrie pe loc", inToi.scrieri, 1);

  const dupaPauza = lume({ ultimaScriere: Date.now() - 60000 });
  await impinge(dupaPauza);
  t("după un minut de liniște, se verifică din nou", dupaPauza.cereri.length, 1);
  t("…și tot se scrie", dupaPauza.scrieri, 1);

  const oprit = lume({ ultimaScriere: 0, revStiut: 5, confirma: false,
    aiciMei: [om("a", { 1: [1, 0] })],
    raspuns: { ok: true, rev: 6, data: { participants: [om("a", { 1: [4, 0] })] } } });
  await impinge(oprit);
  t("dacă omul a zis «nu», nu se scrie nimic", oprit.scrieri, 0);
}

/* ================================================================
   4. Revizia ținută minte
   ================================================================ */
console.log("\n=== 4. Revizia se ține minte, pe cameră ===");
{
  const c = lume({});
  vm.runInContext("syncRevSalveaza(12);", c);
  t("se scrie pe telefon", JSON.parse(c.memorie["concurs-sync-rev"]).feedermoldova, 12);

  /* o altă deschidere a aplicației, aceeași cameră: paza nu pornește oarbă */
  const c2 = lume({ memorie: c.memorie });
  vm.runInContext("syncRevIncarca();", c2);
  t("se citește înapoi la pornire", vm.runInContext("syncRevCunoscut", c2), 12);

  /* altă cameră, altă numărătoare */
  const c3 = lume({ memorie: c.memorie, camera: "altceva" });
  vm.runInContext("syncRevIncarca();", c3);
  t("revizia e a camerei, nu a telefonului", vm.runInContext("syncRevCunoscut", c3), 0);

  const gol = lume({});
  vm.runInContext("syncRevIncarca();", gol);
  t("fără nimic scris, pornește de la zero", vm.runInContext("syncRevCunoscut", gol), 0);
}

/* ================================================================
   5. Legăturile din fișierul livrat
   ================================================================ */
console.log("\n=== 5. Legat cum trebuie în aplicație ===");
{
  const push = H.grabFunction(src, "pushState");
  t("pushState verifică întâi, apoi scrie",
    /pazaCamerei\(\)\.then\(function\(sePoate\)\{ if\(sePoate\) scrieStarea\(\); \}\)/.test(push), true);
  t("…doar după o pauză", /Date\.now\(\) - syncUltimaScriere > PAUZA_PAZA/.test(push), true);

  const scrie = H.grabFunction(src, "scrieStarea");
  t("ce am scris devine revizia noastră", /syncRevSalveaza\(j\.rev\); syncUltimaScriere=Date\.now\(\);/.test(scrie), true);
  t("scrierea propriu-zisă trimite tot concursul, ca înainte",
    /body: JSON\.stringify\(\{data: faraSecrete\(stareFaraPoze\(state\)\)\}\)/.test(scrie), true);

  t("revizia se încarcă odată cu setările camerei",
    /syncRevIncarca\(\);/.test(H.grabFunction(src, "loadSyncCfg")), true);
  t("la schimbarea camerei se ia revizia ei",
    /syncRevIncarca\(\); syncUltimaScriere=0;/.test(H.grabFunction(src, "saveSyncRoom")), true);

  /* paza veche rămâne: ea prinde alt caz — camera are mai MULȚI oameni decât telefonul */
  t("paza dinainte n-a fost scoasă", /function checkRoomMismatch\(\)/.test(src), true);
  t("vizualizarea tot nu scrie", /if\(viewerMode \|\| syncPaused \|\| !syncRoom \|\| !syncKey\) return;/.test(H.grabFunction(src, "queueSync")), true);
}

t.raport();

})();
