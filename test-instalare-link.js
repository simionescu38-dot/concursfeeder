/**
 * Rândul de instalare, pentru cine deschide linkul primit pe WhatsApp.
 *
 * „Când trimit pe WhatsApp linkul cu live, aș vrea să se instaleze aplicația cu o
 * iconiță, nu să apară o pagină."
 *
 * Un link nu poate instala nimic, nicăieri — omul apasă o dată, așa e făcut telefonul.
 * Ce se putea repara e că apăsarea aia nu-i era pusă niciodată în față: butonul de
 * instalare stă în „Contul meu", iar cine intră de pe link aterizează pe clasament și
 * nu ajunge acolo niciodată.
 *
 * Apăsarea nu e însă aceeași peste tot, și asta se verifică aici: în browserul din
 * WhatsApp instalarea nici nu se oferă (trebuie deschis întâi în Chrome), pe iPhone se
 * face din Safari, iar pe Android în browser adevărat există buton adevărat.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

/**
 * rulează updateInstalBar adevărat.
 * `cfg`: viewer (venit de pe link), instalata, refuzat (a zis nu altă dată),
 *        prompt (Chrome a oferit instalarea), ua (ce browser e)
 */
function bara(cfg) {
  const el = { innerHTML: "", style: {} };
  const memorie = { "concurs-instal-nu": cfg.refuzat ? "1" : null };
  const ctx = {
    console,
    viewerMode: !!cfg.viewer,
    promptInstalare: cfg.prompt ? {} : null,
    navigator: { userAgent: cfg.ua || "Mozilla/5.0 (Linux; Android 13) Chrome/120" },
    window: { matchMedia: () => ({ matches: !!cfg.instalata }) },
    localStorage: {
      getItem: k => (k in memorie ? memorie[k] : null),
      setItem: (k, v) => { memorie[k] = v; }
    },
    document: { getElementById: id => (id === "instalBar" ? el : null) }
  };
  ctx.window.navigator = ctx.navigator;
  vm.createContext(ctx);
  vm.runInContext(
    ["esteInstalata", "esteIOS", "instalRefuzat", "nuVreauIconita", "browserInAplicatie",
     "updateInstalBar"].map(n => H.grabFunction(src, n)).join("\n") +
    '\nvar INSTAL_NU_KEY="concurs-instal-nu";\nupdateInstalBar();', ctx);
  return {
    seVede: el.style.display !== "none",
    html: el.innerHTML,
    text: el.innerHTML.replace(/<[^>]*>/g, ""),
    areButon: /class="ib-do"/.test(el.innerHTML),
    areInchidere: /class="ib-nu"/.test(el.innerHTML),
    apasaNu() {
      vm.runInContext("nuVreauIconita();", ctx);
      return { seVede: el.style.display !== "none", memorat: memorie["concurs-instal-nu"] };
    }
  };
}

const UA = {
  androidChrome: "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
  whatsapp: "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36 WhatsApp/2.24.9.78 A",
  facebook: "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0 [FBAN/EMA;FBAV/400.0]",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1"
};

/* ================================================================
   1. Cine vede rândul și cine nu
   ================================================================ */
console.log("\n=== 1. Cui i se arată ===");
t("cine vine de pe link îl vede", bara({ viewer: true }).seVede, true);
// organizatorul are butonul în Contul meu; lui nu i se pune nimic în față
t("organizatorului nu i se arată", bara({ viewer: false }).seVede, false);
t("dacă aplicația e deja pe ecran, nu se mai arată",
  bara({ viewer: true, instalata: true }).seVede, false);
t("dacă a zis «nu» altă dată, nu se mai arată",
  bara({ viewer: true, refuzat: true }).seVede, false);

/* ================================================================
   2. Fiecare telefon, cu apăsarea lui
   ================================================================ */
console.log("\n=== 2. Ce i se spune fiecăruia ===");
{
  // Android, browser adevărat, Chrome a oferit instalarea → buton adevărat
  const b = bara({ viewer: true, prompt: true, ua: UA.androidChrome });
  t("cu instalarea oferită de Chrome, apare butonul", b.areButon, true);
  t("…care chiar cheamă instalarea", /onclick="cereInstalarea\(\)"/.test(b.html), true);
  t("…și scrie ce face", /Pune-o pe ecran/.test(b.text), true);
}
{
  // browserul din WhatsApp: nu există prompt și nu există „adaugă pe ecran" în meniu
  const b = bara({ viewer: true, ua: UA.whatsapp });
  t("în WhatsApp nu se pune un buton care n-ar face nimic", b.areButon, false);
  t("…ci i se spune să deschidă întâi în browser", /Deschide în Chrome/.test(b.text), true);
}
{
  const b = bara({ viewer: true, ua: UA.facebook });
  t("la fel în browserul din Facebook", /Deschide în Chrome/.test(b.text), true);
}
{
  const b = bara({ viewer: true, ua: UA.iphone });
  t("pe iPhone nu se pune buton (nu există prompt acolo)", b.areButon, false);
  t("…ci calea din Safari", /Adaugă pe ecranul principal/.test(b.text), true);
  t("…și că merge numai din Safari", /numai din Safari/.test(b.text), true);
}
{
  // Android, browser adevărat, dar Chrome n-a oferit încă instalarea
  const b = bara({ viewer: true, ua: UA.androidChrome });
  t("fără prompt, pe Android: calea din meniul browserului",
    /Instalează aplicația/.test(b.text), true);
  t("…fără să-i spună să iasă din WhatsApp degeaba",
    /Deschide în Chrome/.test(b.text), false);
}

/* ================================================================
   3. „Nu, mulțumesc" ține minte
   ================================================================ */
console.log("\n=== 3. Dacă zice nu ===");
{
  const b = bara({ viewer: true, prompt: true });
  t("are cu ce să-l închidă", b.areInchidere, true);
  const dupa = b.apasaNu();
  t("apăsat, rândul dispare", dupa.seVede, false);
  t("…și se ține minte, ca să nu-l mai sâcâie", dupa.memorat, "1");
}

/* ================================================================
   4. Legat la locurile care contează
   ================================================================ */
console.log("\n=== 4. Când se împrospătează ===");
{
  const sv = H.grabFunction(src, "startViewerMode");
  t("se arată chiar când omul intră de pe link", /updateInstalBar\(\)/.test(sv), true);
  // Chrome dă evenimentul de instalare la câteva secunde după încărcare: dacă bara nu s-ar
  // redesena atunci, omul ar rămâne cu instrucțiunea scrisă în loc de butonul adevărat
  t("și când Chrome oferă instalarea, mai târziu",
    /beforeinstallprompt[\s\S]{0,220}updateInstalBar\(\)/.test(src), true);
  t("și după ce s-a instalat, ca să dispară",
    /appinstalled[\s\S]{0,220}updateInstalBar\(\)/.test(src), true);
}
{
  t("rândul există în pagină", /<div id="instalBar"/.test(src), true);
  t("…ascuns până e nevoie de el",
    /<div id="instalBar" style="display:none;"><\/div>/.test(src), true);
}

t.raport();
