/**
 * Cardul „Versiunea aplicației" nu mai minte.
 *
 * „Adu varianta nouă acum" — apăsat de mai multe ori, degeaba: cardul scria mai departe
 * „Încă nu s-a salvat nimic în telefon". Aplicația se salva de fiecare dată; cardul se
 * uita o singură dată, la pornire, ÎNAINTE ca service worker-ul să apuce să termine, și
 * rămânea așa cât ținea aplicația deschisă.
 *
 * Măsurat înainte de reparație, pe telefon curat: memoria `concurs-pescuit-v131` exista
 * deja la 500 ms, iar cardul scria „nu s-a salvat nimic" și la 6 secunde. Abia la a doua
 * deschidere spunea „Ai versiunea 131".
 *
 * Cel mai rău cădea exact după butonul de adus varianta nouă: ăla șterge memoria și
 * reîncarcă pagina, deci omul ateriza fix în clipa în care cardul se uită prea devreme.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

/** rulează updateVersiune adevărat, cu memoria telefonului inventată */
function card(numeMemorii) {
  const el = { textContent: "", innerHTML: "" };
  const ctx = {
    console,
    appVer: "",
    legaPaginileSurori() {},
    window: { caches: {} },
    caches: { keys: () => Promise.resolve(numeMemorii) },
    document: { getElementById: id => (id === "app-ver" ? el : null) }
  };
  ctx.window.caches = ctx.caches;
  vm.createContext(ctx);
  vm.runInContext(H.grabFunction(src, "updateVersiune") + "\nupdateVersiune();", ctx);
  return new Promise(res => setTimeout(() => res(el.innerHTML || el.textContent), 10));
}

(async () => {
  /* ================================================================
     1. Ce scrie, după ce e în memorie
     ================================================================ */
  console.log("\n=== 1. Ce scrie cardul ===");
  t("cu aplicația salvată, scrie versiunea",
    /Ai <b>versiunea 131<\/b>/.test(await card(["concurs-pescuit-v131"])), true);
  t("fără nimic salvat, o spune", /Încă nu s-a salvat nimic/.test(await card([])), true);
  // la o actualizare pot exista o clipă două memorii; se ia cea găsită, nu se încurcă
  t("cu două memorii, tot scrie o versiune",
    /Ai <b>versiunea \d+<\/b>/.test(await card(["concurs-pescuit-v130", "concurs-pescuit-v131"])), true);
  t("memoriile străine nu-l păcălesc",
    /Încă nu s-a salvat nimic/.test(await card(["altceva", "workbox-v3"])), true);

  /* ================================================================
     2. Se citește DIN NOU, nu o singură dată la pornire
     Aici era buba: aplicația era salvată, cardul rămânea pe minciună.
     ================================================================ */
  console.log("\n=== 2. Când se citește ===");
  {
    const sv = H.grabFunction(src, "showView");
    t("se recitește când deschizi „Contul meu\"",
      /if\(v==="set"\) updateVersiune\(\);/.test(sv), true);

    /* Fără asta, cardul rămâne pe „nu s-a salvat nimic" până la următoarea deschidere a
       aplicației — chiar dacă salvarea s-a terminat la o secundă după pornire. */
    t("se recitește și când salvarea chiar s-a terminat",
      /serviceWorker\.ready\.then\([\s\S]{0,160}updateVersiune\(\)/.test(src), true);

    const sync = H.grabFunction(src, "updateSyncUI");
    t("se citește mai departe și la pornire", /updateVersiune\(\)/.test(sync), true);
  }

  /* ================================================================
     3. Butonul care a scos buba la iveală
     ================================================================ */
  console.log("\n=== 3. „Adu varianta nouă acum\" ===");
  {
    const adu = H.grabFunction(src, "aduVariantaNoua");
    // el șterge memoria și reîncarcă: exact clipa în care cardul se uita prea devreme
    t("chiar șterge memoria", /caches\.(delete|keys)/.test(adu), true);
    t("…și reîncarcă pagina", /location\.(replace|reload|href)/.test(adu), true);
  }

  t.raport();
})();
