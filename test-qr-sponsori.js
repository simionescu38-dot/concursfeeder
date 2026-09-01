/**
 * Codul QR cu adresa aplicației, și pe ecranul Sponsori.
 *
 * „pune și codul QR în aplicație, la sponsori" — exista deja unul, în Setări, la
 * „Pune iconița pe ecran". Două coduri desenate din două locuri ar fi ajuns, într-o zi,
 * să ducă în două adrese diferite, iar nimeni n-ar fi observat până la baltă. De-aia
 * amândouă ies din aceeași funcție, și asta se verifică aici, nu se presupune.
 *
 * Paza care contează: renderSpons() rescrie TOT ce e în #spons-body. Dacă ar fi pus
 * cardul cu codul acolo, s-ar fi șters de fiecare dată când se deschide ecranul.
 *
 * Codul e scos VERBATIM din index.html și qr.js.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

/* ---------- generatorul adevărat, din qr.js ---------- */
const qrCtx = { console };
vm.createContext(qrCtx);
vm.runInContext(H.grabIIFE(H.citeste("qr.js"), "var QR = (function(){"), qrCtx);

/**
 * rulează deseneazaQrAplicatie adevărat, cu un DOM de carton.
 * `cutii`: id-urile care există în pagină (celelalte întorc null, ca în browser)
 */
function deseneaza(idCutie, idEticheta, cutii, adresa) {
  const el = {};
  (cutii || [idCutie, idEticheta]).forEach(id => { el[id] = { innerHTML: "", textContent: "" }; });
  const u = new URL(adresa || "https://simionescu38-dot.github.io/concursfeeder/index.html");
  const ctx = {
    console,
    QR: qrCtx.QR,
    location: { origin: u.origin, pathname: u.pathname, host: u.host },
    document: { getElementById: id => el[id] || null }
  };
  vm.createContext(ctx);
  vm.runInContext(["installLink", "deseneazaQrAplicatie"].map(n => H.grabFunction(src, n)).join("\n"), ctx);
  vm.runInContext("deseneazaQrAplicatie(" + JSON.stringify(idCutie) + "," + JSON.stringify(idEticheta) + ")", ctx);
  return el;
}

/* ================================================================
   1. Un singur cod, desenat dintr-un singur loc
   ================================================================ */
console.log("\n=== 1. Același cod pe amândouă ecranele ===");
{
  const set = deseneaza("install-qr", "install-qr-link");
  const spo = deseneaza("spons-qr", "spons-qr-link");

  t("în Setări se desenează un cod QR", /^<svg[\s\S]*<\/svg>$/.test(set["install-qr"].innerHTML), true);
  t("la Sponsori se desenează unul la fel", spo["spons-qr"].innerHTML, set["install-qr"].innerHTML);
  t("…și scrie sub el aceeași adresă",
    spo["spons-qr-link"].textContent, set["install-qr-link"].textContent);
  t("adresa e cea de unde s-a deschis aplicația",
    set["install-qr-link"].textContent, "https://simionescu38-dot.github.io/concursfeeder/index.html");
}
{
  /* mutată aplicația în altă parte, codul o urmează — nu are nicio adresă scrisă în el */
  const spo = deseneaza("spons-qr", "spons-qr-link", null, "https://exemplu.ro/pescuit/");
  t("pe altă adresă, codul arată spre ea", spo["spons-qr-link"].textContent, "https://exemplu.ro/pescuit/");
}

console.log("\n=== 2. O singură funcție care desenează ===");
{
  const u = H.grabFunction(src, "updateInstallQr");
  t("cea din Setări doar cheamă funcția comună",
    /deseneazaQrAplicatie\("install-qr","install-qr-link"\)/.test(u), true);
  t("…și nu-și mai desenează singură codul", /QR\.svg/.test(u), false);
  t("ecranul Sponsori o cheamă pe aceeași",
    /deseneazaQrAplicatie\("spons-qr","spons-qr-link"\)/.test(H.grabFunction(src, "renderSpons")), true);
  t("nu există decât un singur loc cu QR.svg pentru codul aplicației",
    (src.match(/QR\.svg\(installLink\(\)\)/g) || []).length, 1);
}

/* ================================================================
   3. Fără cutie, fără crăpătură
   ================================================================ */
console.log("\n=== 3. Când ecranul nu e de față ===");
{
  /* renderSpons se cheamă și din alte locuri decât apăsarea pe „Sponsori"; dacă un
     ecran vechi n-are cutia, funcția trebuie să tacă, nu să oprească tot codul de după. */
  let crapat = false;
  try { deseneaza("spons-qr", "spons-qr-link", []); } catch (e) { crapat = true; }
  t("fără cutie în pagină, nu crapă nimic", crapat, false);
}
{
  const el = deseneaza("spons-qr", "spons-qr-link", ["spons-qr"]);
  t("fără eticheta de sub cod, codul se desenează oricum",
    /^<svg/.test(el["spons-qr"].innerHTML), true);
}

/* ================================================================
   4. Cardul din pagină, unde trebuie
   ================================================================ */
console.log("\n=== 4. Locul cardului în ecranul Sponsori ===");
{
  const ecran = src.slice(src.indexOf('<section class="view" id="view-spons">'));
  const pana = ecran.slice(0, ecran.indexOf("</section>"));

  t("cardul cu codul e pe ecranul Sponsori", /id="spons-qr"/.test(pana), true);
  /* Paza: renderSpons() face box.innerHTML=…, deci tot ce e în #spons-body se șterge. */
  t("…și NU în #spons-body, care se rescrie la fiecare desenare",
    pana.indexOf('<div id="spons-body"></div>') < pana.indexOf('id="spons-qr"'), true);
  t("…ci deasupra formularului de adăugat sponsori",
    pana.indexOf('id="spons-qr"') < pana.indexOf("sponsAdd()"), true);

  t("are scris pentru cine nu vede imaginea", /aria-label="Cod QR cu adresa aplicației"/.test(pana), true);
  /* codul e negru pe alb: scanat de pe un ecran cu tema închisă, altfel nu se citește */
  t("fundal alb sub cod, ca să se poată scana", /id="spons-qr" style="[^"]*background:#fff/.test(pana), true);
  t("spune ce se întâmplă dacă îl scanezi", /scanează cu camera telefonului/.test(pana), true);

  /* Regula casei: un singur buton scos în față pe ecran. Cardul nou n-aduce niciunul. */
  t("cardul nou nu adaugă niciun buton",
    (pana.slice(pana.indexOf('id="spons-qr"'), pana.indexOf("</div>", pana.indexOf("spons-qr-link")))
      .match(/<button/g) || []).length, 0);
}

console.log("\n=== 5. Se desenează când se deschide ecranul ===");
{
  const sv = H.grabFunction(src, "showView");
  t("deschiderea ecranului Sponsori cheamă renderSpons",
    /v==="spons"\)\s*renderSpons\(\)/.test(sv), true);
  t("desenarea codului e prima, înainte de lista de sponsori",
    /function renderSpons\(\)\{\s*deseneazaQrAplicatie/.test(
      H.grabFunction(src, "renderSpons").replace(/\r?\n\s*/g, "")), true);
}

t.raport();
