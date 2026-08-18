/**
 * Ce înseamnă „concurs live acum".
 *
 * Pagina de Acasă număra camerele scrise în ultimele două ore, iar Calendarul le
 * arăta pe TOATE, fără nicio condiție. Pe 18 august scria „3 LIVE ACUM" pentru trei
 * camere goale — două rămase de la probe și una pregătită pentru a doua zi. Cine
 * deschidea aplicația credea că se pescuiește în trei locuri.
 *
 * Un concurs în desfășurare are oameni în el ȘI a fost scris de curând.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));

/** rulează loadCalendarLive cu un server inventat */
function calendar(camere, stari) {
  const el = { innerHTML: "" };
  const ctx = {
    API_BASE: "http://x",
    document: { getElementById: id => (id === "cal-live-list" ? el : null) },
    esc: s => s || "",
    timeAgoCal: () => "acum",
    encodeURIComponent,
    Date, Promise, console,
    fetch: url => {
      if (url.indexOf("/api/rooms") >= 0) return Promise.resolve({ json: () => Promise.resolve({ ok: true, rooms: camere }) });
      const cod = decodeURIComponent(url.split("room=")[1] || "");
      return Promise.resolve({ json: () => Promise.resolve(stari[cod] || { ok: true, data: null }) });
    }
  };
  vm.createContext(ctx);
  vm.runInContext(grabFunction(src, "loadCalendarLive") + "\nloadCalendarLive();", ctx);
  return new Promise(res => setTimeout(() => res(el.innerHTML), 30));
}

const acum = new Date().toISOString();
const acumTreiOre = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
const cuOameni = { ok: true, data: { participants: [{ id: 1 }, { id: 2 }] } };
const goala = { ok: true, data: { participants: [] } };

(async () => {
  console.log("\n=== 1. Camera goală nu e un concurs ===");
  {
    const h = await calendar(
      [{ code: "feedermoldova", name: "Pregatit", updated_at: acum }],
      { feedermoldova: goala });
    t("o cameră proaspătă dar goală nu apare", /Niciun concurs live/.test(h), true);
  }

  console.log("\n=== 2. Camera cu oameni apare ===");
  {
    const h = await calendar(
      [{ code: "feedermoldova", name: "Cupa de Vara", updated_at: acum }],
      { feedermoldova: cuOameni });
    t("apare în listă", /Cupa de Vara/.test(h), true);
    t("cu bulină de live", /🔴 live/.test(h), true);
    t("și cu link spre camera ei", /index\.html\?room=feedermoldova/.test(h), true);
  }

  console.log("\n=== 3. Camera veche nu mai e live ===");
  {
    const h = await calendar(
      [{ code: "deieri", name: "De ieri", updated_at: acumTreiOre }],
      { deieri: cuOameni });
    t("chiar cu oameni în ea, după trei ore nu mai e live", /Niciun concurs live/.test(h), true);
  }

  console.log("\n=== 4. Amestecat: doar cele adevărate ===");
  {
    const h = await calendar([
      { code: "bun", name: "Concurs adevarat", updated_at: acum },
      { code: "gol", name: "Camera goala", updated_at: acum },
      { code: "vechi", name: "De alaltaieri", updated_at: acumTreiOre },
      { code: "proba", name: "Test rapid", updated_at: acum }
    ], { bun: cuOameni, gol: goala, vechi: cuOameni, proba: cuOameni });
    t("rămâne doar concursul adevărat", /Concurs adevarat/.test(h), true);
    t("camera goală e lăsată afară", /Camera goala/.test(h), false);
    t("cea veche la fel", /De alaltaieri/.test(h), false);
    t("iar proba se filtrează după nume", /Test rapid/.test(h), false);
  }

  console.log("\n=== 5. Numărul de pe Acasă ===");
  {
    const acasa = grabFunction(src, "loadAcasaRegional");
    // prima chemare e cazul „nicio cameră proaspătă", care răspunde 0 pe loc;
    // cea care contează e a doua, de după ce s-au citit stările camerelor
    t("numărul de live se dă după ce se știe ce e în camere",
      acasa.lastIndexOf("renderHeroStats") > acasa.indexOf("Promise.all(activeRooms.map"), true);
    t("și numără doar camerele cu participanți",
      /if\(res && res\.ok && res\.data && \(res\.data\.participants\|\|\[\]\)\.length\) live\+\+;/.test(acasa), true);
  }

  t.raport();
})();
