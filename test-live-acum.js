/**
 * Ce înseamnă „concurs live acum".
 *
 * Pagina de Acasă număra camerele scrise în ultimele două ore, iar Calendarul le
 * arăta pe TOATE, fără nicio condiție. Pe 18 august scria „3 LIVE ACUM" pentru trei
 * camere goale — două rămase de la probe și una pregătită pentru a doua zi. Cine
 * deschidea aplicația credea că se pescuiește în trei locuri.
 *
 * Un concurs în desfășurare are oameni în el ȘI a fost scris de curând.
 *
 * Mai târziu: „mai este live asta de astăzi..". Un concurs terminat la ora 16 rămânea
 * anunțat ca live încă două ore, cât se răcea camera — deși ceasul din aplicație scria
 * deja „Concurs încheiat". Ora de final e în datele camerei, deci se poate spune de la
 * prima secundă. Camerele fără oră de final rămân pe regula celor două ore.
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
  vm.runInContext([grabFunction(src, "concursTerminat"), grabFunction(src, "loadCalendarLive")].join("\n") +
                  "\nloadCalendarLive();", ctx);
  return new Promise(res => setTimeout(() => res(el.innerHTML), 30));
}

const acum = new Date().toISOString();
const acumTreiOre = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
const cuOameni = { ok: true, data: { participants: [{ id: 1 }, { id: 2 }] } };
const goala = { ok: true, data: { participants: [] } };
/** același concurs, dar cu ora de final trecută / încă în față */
const terminat = { ok: true, data: { participants: [{ id: 1 }, { id: 2 }], endAt: Date.now() - 60 * 1000 } };
const inCurs = { ok: true, data: { participants: [{ id: 1 }, { id: 2 }], endAt: Date.now() + 60 * 60 * 1000 } };

/** rulează loadAcasaRegional cu un server inventat; întoarce ce s-a desenat pe Acasă */
function acasa(camere, stari) {
  let stat = null, peste = null;
  const ctx = {
    API_BASE: "http://x",
    doarViitoare: l => l || [],
    renderHeroStats: s => { stat = s; },
    renderHeroSpotlight: p => { peste = p; },
    heroFish: null,
    encodeURIComponent, Date, Promise, console,
    fetch: url => {
      if (url.indexOf("/api/events") >= 0) return Promise.resolve({ json: () => Promise.resolve({ ok: true, events: [] }) });
      if (url.indexOf("/api/rooms") >= 0) return Promise.resolve({ json: () => Promise.resolve({ ok: true, rooms: camere }) });
      const cod = decodeURIComponent(url.split("room=")[1] || "");
      return Promise.resolve({ json: () => Promise.resolve(stari[cod] || { ok: true, data: null }) });
    }
  };
  vm.createContext(ctx);
  vm.runInContext([grabFunction(src, "concursTerminat"), grabFunction(src, "loadAcasaRegional")].join("\n") +
                  "\nloadAcasaRegional();", ctx);
  return new Promise(res => setTimeout(() => res({ stat, peste }), 40));
}

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

  console.log("\n=== 5. Numărul de pe Acasă, rulat ===");
  {
    const r = await acasa([{ code: "bun", name: "Concurs adevarat", updated_at: acum },
                           { code: "gol", name: "Camera goala", updated_at: acum }],
                          { bun: cuOameni, gol: goala });
    t("numără doar camerele cu oameni în ele", r.stat.live, 1);
  }
  {
    const r = await acasa([{ code: "vechi", name: "De ieri", updated_at: acumTreiOre }], { vechi: cuOameni });
    t("camera răcită nu se numără", r.stat.live, 0);
  }

  console.log("\n=== 6. Concursul terminat nu mai e „acum\" ===");
  {
    const h = await calendar([{ code: "gata", name: "Terminat la 16", updated_at: acum }], { gata: terminat });
    t("cu ora de final trecută, iese din lista de pe Calendar", /Niciun concurs live/.test(h), true);
  }
  {
    const h = await calendar([{ code: "curge", name: "Inca se pescuieste", updated_at: acum }], { curge: inCurs });
    t("cu ora de final în față, rămâne", /Inca se pescuieste/.test(h), true);
  }
  {
    const h = await calendar([{ code: "faraora", name: "Fara ora de final", updated_at: acum }], { faraora: cuOameni });
    // fără endAt n-avem de unde ști; rămâne regula celor două ore, ca până acum
    t("fără oră de final, rămâne pe regula celor două ore", /Fara ora de final/.test(h), true);
  }
  {
    /* `endAt: null` chiar apare în camerele lui — o cameră pregătită, cu ora de final
       nescrisă încă. `+null` e 0, iar 0 e „în trecut": fără paza care cere o oră
       adevărată, concursul ar fi ascuns înainte să înceapă. */
    const nul = { ok: true, data: { participants: [{ id: 1 }], endAt: null } };
    const zero = { ok: true, data: { participants: [{ id: 1 }], endAt: 0 } };
    let h = await calendar([{ code: "n", name: "Ora de final nescrisa", updated_at: acum }], { n: nul });
    t("endAt gol (null) nu înseamnă terminat", /Ora de final nescrisa/.test(h), true);
    h = await calendar([{ code: "z", name: "Ora de final zero", updated_at: acum }], { z: zero });
    t("nici endAt zero", /Ora de final zero/.test(h), true);
    const r = await acasa([{ code: "n", name: "N", updated_at: acum }], { n: nul });
    t("…și tot se numără pe Acasă", r.stat.live, 1);
  }
  {
    const r = await acasa([{ code: "gata", name: "Terminat", updated_at: acum }], { gata: terminat });
    t("nici numărul de pe Acasă nu-l mai numără", r.stat.live, 0);
  }
  {
    const r = await acasa([{ code: "curge", name: "In curs", updated_at: acum }], { curge: inCurs });
    t("dar pe cel în desfășurare, da", r.stat.live, 1);
  }

  console.log("\n=== 7. „Cel mai mare pește – ACUM\" ===");
  {
    const cuPeste = kg => ({ ok: true, data: { name: "Concurs", participants: [
      { prenume: "Mimi", nume: "Fedor", m: { 1: { extras: [kg] } } }] } });
    const dupaFinal = kg => ({ ok: true, data: { name: "Concurs", endAt: Date.now() - 60 * 1000, participants: [
      { prenume: "Mimi", nume: "Fedor", m: { 1: { extras: [kg] } } }] } });
    let r = await acasa([{ code: "c", name: "C", updated_at: acum }], { c: cuPeste(7.09) });
    t("în timpul concursului, peștele se arată", r.peste && r.peste.kg, 7.09);
    t("…cu numele pescarului", r.peste && r.peste.name, "Mimi Fedor");
    r = await acasa([{ code: "c", name: "C", updated_at: acum }], { c: dupaFinal(7.09) });
    // scrie „CEL MAI MARE PEȘTE – ACUM": după final nu mai e „acum"
    t("după ce s-a terminat, nu mai e „acum\"", r.peste, null);
  }

  t.raport();
})();
