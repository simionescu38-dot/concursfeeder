/**
 * Linkul de vizualizare ținut minte de aplicația instalată.
 *
 * Aplicația instalată pornește de la `start_url` din manifest, adică „./" —
 * fără „?room=". Pescarul care își punea linkul live pe ecranul telefonului
 * ateriza a doua zi în aplicația goală și credea că s-a stricat clasamentul.
 *
 * Aici se verifică cele două capcane ale soluției:
 *   1. să NU fure cântarul organizatorului care a deschis o dată un link live;
 *   2. să existe o cale înapoi — altfel telefonul rămâne prins în cameră,
 *      pentru că nici adresa curată nu-l mai scoate.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));

/** un telefon de probă: memoria lui locală + ce are pe el */
function telefon(cfg) {
  const memorie = Object.assign({}, cfg.memorie || {});
  const ctx = {
    syncKey: cfg.syncKey || "",
    viewerMode: false, viewerRoom: "",
    localStorage: {
      getItem: k => (k in memorie ? memorie[k] : null),
      setItem: (k, v) => { memorie[k] = String(v); },
      removeItem: k => { delete memorie[k]; }
    },
    console
  };
  vm.createContext(ctx);
  vm.runInContext(
    src.slice(src.indexOf("var VIEWER_ROOM_KEY = ")).split(";")[0] + ";\n" +
    ["saveViewerRoom", "loadViewerRoom", "forgetViewerRoom", "shouldResumeViewer"]
      .map(n => grabFunction(src, n)).join("\n"),
    ctx);
  return { memorie, ruleaza: cod => vm.runInContext(cod, ctx) };
}

const CHEIE = "concurs-viewer-room";

/* ---------- 1. ținerea minte ---------- */
console.log("\n=== 1. Camera se ține minte ===");
{
  const f = telefon({});
  f.ruleaza('saveViewerRoom("feedermoldova")');
  t("camera se scrie în memoria telefonului", f.memorie[CHEIE], "feedermoldova");
  t("și se poate citi înapoi", f.ruleaza("loadViewerRoom()"), "feedermoldova");
  f.ruleaza("forgetViewerRoom()");
  t("uitarea o șterge de tot", f.ruleaza("loadViewerRoom()"), "");
}

/* ---------- 2. cine reintră singur în cameră ---------- */
console.log("\n=== 2. Cine reintră singur în cameră ===");
{
  const pescar = telefon({ memorie: { [CHEIE]: "feedermoldova" } });
  t("pescarul care doar privește: da", pescar.ruleaza("shouldResumeViewer()"), true);
}
{
  const gol = telefon({});
  t("telefon fără nicio cameră ținută minte: nu", gol.ruleaza("shouldResumeViewer()"), false);
}
{
  // capcana principală: organizatorul deschide o dată linkul live de pe telefonul
  // lui de cântărit. Dacă l-am băga în vizualizare, ar rămâne fără cântar la baltă.
  const organizator = telefon({ memorie: { [CHEIE]: "feedermoldova" }, syncKey: "cheia-lui" });
  t("organizatorul cu cheie de scriere: NU e băgat în vizualizare",
    organizator.ruleaza("shouldResumeViewer()"), false);
}

/* ---------- 3. bara de ieșire ---------- */
console.log("\n=== 3. Bara de ieșire din antet ===");
{
  const bara = { style: {}, textContent: "" };
  const ctx = {
    viewerMode: true, viewerRoom: "feedermoldova",
    document: { getElementById: id => (id === "viewerBar" ? bara : null) },
    console
  };
  vm.createContext(ctx);
  vm.runInContext(grabFunction(src, "updateViewerBar") + "\nupdateViewerBar();", ctx);
  t("în vizualizare bara se vede", bara.style.display, "block");
  t("scrie în ce cameră ești", /feedermoldova/.test(bara.textContent), true);
  t("spune pe față că atingerea te scoate", /atinge ca să ieși/.test(bara.textContent), true);

  ctx.viewerMode = false;
  vm.runInContext("updateViewerBar();", ctx);
  t("în afara vizualizării bara dispare", bara.style.display, "none");
}
{
  t("bara din antet chiar cheamă ieșirea",
    /id="viewerBar"[^>]*onclick="exitViewerMode\(\)"/.test(src), true);

  const iesire = grabFunction(src, "exitViewerMode");
  t("ieșirea cere confirmare (nu se declanșează din greșeală)", /confirm\(/.test(iesire), true);
  t("ieșirea uită camera", /forgetViewerRoom\(\)/.test(iesire), true);
  t("ieșirea duce la adresa curată, fără ?room=", /location\.pathname/.test(iesire), true);

  const start = grabFunction(src, "startViewerMode");
  t("intrarea în cameră o și ține minte", /saveViewerRoom\(/.test(start), true);
  t("intrarea aprinde și bara de ieșire", /updateViewerBar\(\)/.test(start), true);
}

/* ---------- 4. ordinea la pornire ---------- */
console.log("\n=== 4. Ordinea la pornire ===");
{
  // „?room=" din adresă bate camera ținută minte: dacă cineva primește linkul
  // altui concurs, trebuie să ajungă acolo, nu în camera de ieri
  const init = src.slice(src.indexOf("var roomParam="), src.indexOf("var roomParam=") + 400);
  t("întâi se citește ?room= din adresă", init.indexOf("if(roomParam) startViewerMode") >= 0, true);
  t("abia apoi camera ținută minte",
    init.indexOf("shouldResumeViewer()") > init.indexOf("if(roomParam) startViewerMode"), true);
  t("iar dacă nu e niciuna, aplicația pornește normal",
    init.indexOf("else loadAcasaRegional()") > init.indexOf("shouldResumeViewer()"), true);
}

t.raport();
