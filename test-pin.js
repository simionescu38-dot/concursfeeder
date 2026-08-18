/**
 * Tastatura de PIN. Deblocarea e mecanismul de care depinde cântărirea:
 * dacă se strică, organizatorul rămâne blocat în modul vizualizare, la baltă.
 *
 * Rulează funcțiile REALE din index.html peste un DOM de carton.
 */
const { grabFunction, citeste, creeazaVerificator } = require("./test-helpers");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(__dirname + "/index.html");
const declaratii = (src.match(/var pinValue=[^;]*;/) || [])[0];
if (!declaratii) { console.log("  ❌ nu găsesc variabilele tastaturii de PIN"); process.exit(1); }

/** DOM minim: doar elementele pe care le atinge tastatura */
function mediu(opt) {
  opt = opt || {};
  const el = {};
  const face = () => ({ className: "", innerHTML: "", textContent: "", disabled: false, classList: {
    _s: new Set(),
    add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }
  } });
  ["pinPad", "pin-dots", "pin-grid", "pin-title", "pin-ok"].forEach(id => { el[id] = face(); });
  if (opt.faraEcran) delete el.pinPad;
  const promptCereri = [];
  const ctx = {
    document: {
      getElementById: id => el[id] || null,
      addEventListener: () => {}, removeEventListener: () => {}
    },
    navigator: {},
    toast: () => {},
    prompt: msg => { promptCereri.push(msg); return opt.promptRaspunde === undefined ? null : opt.promptRaspunde; },
    setTimeout, Promise, console
  };
  vm.createContext(ctx);
  vm.runInContext([
    declaratii,
    grabFunction(src, "pinRender"), grabFunction(src, "pinTap"), grabFunction(src, "pinBack"),
    grabFunction(src, "pinCancel"), grabFunction(src, "pinOk"), grabFunction(src, "pinClose"),
    grabFunction(src, "pinKey"), grabFunction(src, "askPin"), grabFunction(src, "pinGresit")
  ].join("\n"), ctx);
  const ruleaza = cod => vm.runInContext(cod, ctx);
  return {
    el, promptCereri, ruleaza,
    deschisa: () => el.pinPad && el.pinPad.classList.contains("on"),
    cifre: () => (el["pin-dots"].innerHTML.match(/<i>/g) || []).length
  };
}

const asteapta = ms => new Promise(r => setTimeout(r, ms));

(async () => {

  // ---------- 1. tastele: cifre, nu litere. Ăsta e tot rostul schimbării ----------
  {
    const m = mediu();
    m.ruleaza("askPin('Introdu PIN-ul','Deblochează',null);");
    const html = m.el["pin-grid"].innerHTML;
    const scris = html.replace(/<[^>]*>/g, "");
    t("tastatura are toate cifrele 0-9", "0123456789".split("").every(c => scris.indexOf(c) >= 0), true);
    t("are tastă de ștergere", scris.indexOf("⌫") >= 0, true);
    t("nu are nicio literă pe taste", /[a-zA-Zăâîșț]/.test(scris), false);
    t("ecranul e deschis", m.deschisa(), true);
    t("titlul e cel cerut", m.el["pin-title"].textContent, "Introdu PIN-ul");
    t("butonul poartă numele acțiunii", m.el["pin-ok"].textContent, "Deblochează");
    t("butonul e blocat până la 4 cifre", m.el["pin-ok"].disabled, true);
  }

  // ---------- 2. introducerea cifrelor ----------
  {
    const m = mediu();
    m.ruleaza("askPin('PIN','OK',null);");
    m.ruleaza("pinTap('1'); pinTap('2'); pinTap('3');");
    t("3 cifre = 3 puncte", m.cifre(), 3);
    t("cu 3 cifre butonul e tot blocat", m.el["pin-ok"].disabled, true);
    m.ruleaza("pinTap('4');");
    t("la 4 cifre butonul se deblochează", m.el["pin-ok"].disabled, false);
    m.ruleaza("pinBack();");
    t("ștergerea scoate ultima cifră", m.cifre(), 3);
    m.ruleaza("pinTap('5'); pinTap('6'); pinTap('7'); pinTap('8'); pinTap('9');");
    t("nu se pot introduce mai mult de 6 cifre", m.cifre(), 6);
  }

  // ---------- 3. PIN greșit: ecranul NU se închide ----------
  {
    const m = mediu();
    m.ruleaza("var cerute=[], raspuns=null; askPin('PIN','OK', function(v){ cerute.push(v); return Promise.resolve(v==='2580'); }).then(function(v){ raspuns=v; });");
    m.ruleaza("pinTap('1'); pinTap('1'); pinTap('1'); pinTap('1'); pinOk();");
    await asteapta(30);
    t("PIN greșit: ecranul rămâne deschis", m.deschisa(), true);
    t("PIN greșit: punctele devin roșii", m.el["pin-dots"].className, "pin-dots err");
    await asteapta(800);
    t("după o clipă cifrele se șterg singure", m.cifre(), 0);
    t("și culoarea revine la normal", m.el["pin-dots"].className, "pin-dots");
    m.ruleaza("pinTap('2'); pinTap('5'); pinTap('8'); pinTap('0'); pinOk();");
    await asteapta(30);
    t("PIN corect: ecranul se închide", m.deschisa(), false);
    t("PIN corect: valoarea e întoarsă", m.ruleaza("raspuns"), "2580");
  }

  // ---------- 4. renunțare și taste fizice ----------
  {
    const m = mediu();
    m.ruleaza("var raspuns='neatins'; askPin('PIN','OK',null).then(function(v){ raspuns=v; });");
    m.ruleaza("pinCancel();");
    await asteapta(10);
    t("butonul Renunta inchide ecranul", m.deschisa(), false);
    t("Renunta nu intoarce niciun PIN", m.ruleaza("raspuns"), null);
  }
  {
    const m = mediu();
    m.ruleaza("askPin('PIN','OK',null);");
    m.ruleaza("var ev={key:'7', preventDefault:function(){}}; pinKey(ev); pinKey({key:'8', preventDefault:function(){}});");
    t("tastatura fizică scrie cifre", m.cifre(), 2);
    m.ruleaza("pinKey({key:'a', preventDefault:function(){}});");
    t("literele sunt ignorate", m.cifre(), 2);
    m.ruleaza("pinKey({key:'Backspace', preventDefault:function(){}});");
    t("Backspace șterge", m.cifre(), 1);
    m.ruleaza("pinKey({key:'Escape', preventDefault:function(){}});");
    await asteapta(10);
    t("Escape închide", m.deschisa(), false);
  }

  // ---------- 5. rezerva: fără ecran, tot se poate debloca ----------
  {
    const m = mediu({ faraEcran: true, promptRaspunde: "2580" });
    m.ruleaza("var raspuns=null; askPin('PIN-ul actual','OK',null).then(function(v){ raspuns=v; });");
    await asteapta(10);
    t("fără ecranul de PIN se cade pe dialogul vechi", m.promptCereri.length, 1);
    t("și valoarea tastată ajunge la verificare", m.ruleaza("raspuns"), "2580");
  }

  t.raport();
})();
