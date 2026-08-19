/**
 * „Cum scot lista de acolo?" — butonul care pune repartizarea în clipboard.
 *
 * Lista de pe ecran e a MANȘEI active (standOfM/sectorOfM), dar copierea citea
 * p.stand / p.sector, adică „unde stă omul acum". Cine trăgea manșa 2 și apoi se
 * întorcea pe manșa 1 să trimită lista pe WhatsApp copia standurile manșei 2 sub
 * titlul manșei 1 — o listă greșită, trimisă unor oameni care nu aveau cum să o
 * verifice.
 *
 * Testul rulează codul REAL din index.html.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));

function aplicatie() {
  const ctx = {
    state: { name: "Cupa Lacului", participants: [], manche: 1, numManse: 3 },
    copiat: null, mesaje: [], console
  };
  vm.createContext(ctx);
  vm.runInContext(
    ["emptyManche", "numManse", "manseRange", "ensureManche", "mOf",
     "sectorOfM", "standOfM", "mancheDeAfisat", "mancheDisputata", "setStandSector",
     "cantOfM", "extraOfM", "nameOf", "nameKey", "copyDraw"]
      .map(n => grabFunction(src, n)).join("\n") +
    // clipboard-ul și notificările nu există în afara browserului
    "\nfunction copyText(x){ copiat = x; }" +
    "\nfunction toast(x){ mesaje.push(x); }", ctx);
  return ctx;
}

/** rânduri: [nume, ordine, standM1, sectorM1, standM2, sectorM2] */
function pune(ctx, rows) {
  ctx.state.participants = rows.map(r => ({
    id: r[0], nume: r[0], prenume: "", ordine: r[1],
    stand: r[4] || r[2] || "", sector: r[5] || r[3] || "",   // „unde stă acum" = ultima tragere
    m: {
      1: { catches: [], extras: [], stand: r[2] || "", sector: r[3] || "" },
      2: { catches: [], extras: [], stand: r[4] || "", sector: r[5] || "" },
      3: { catches: [], extras: [], stand: "", sector: "" }
    }
  }));
}
const copiaza = ctx => { vm.runInContext("copyDraw()", ctx); return ctx.copiat; };

/* ================================================================
   1. Cazul care a pornit totul: lista manșei 1 după ce s-a tras manșa 2
   ================================================================ */
console.log("\n=== 1. Se copiază manșa de pe ecran, nu ultima trasă ===");
{
  const ctx = aplicatie();
  // manșa 1: Ion pe 12 (A), Vlad pe 40 (C). Manșa 2 i-a mutat: Ion pe 55 (D), Vlad pe 3 (A).
  pune(ctx, [["Ion", 1, "12", "A", "55", "D"], ["Vlad", 2, "40", "C", "3", "A"]]);
  ctx.state.manche = 1;
  const txt = copiaza(ctx);

  t("titlul spune ce manșă e", txt.split("\n")[0], "Cupa Lacului – tragere la sorți, manșa 1");
  t("Ion apare cu standul manșei 1", /Ion → Stand 12 \(A\)/.test(txt), true);
  t("Vlad apare cu standul manșei 1", /Vlad → Stand 40 \(C\)/.test(txt), true);
  t("standurile manșei 2 nu se strecoară în listă", /Stand 55|Stand 3 /.test(txt), false);

  ctx.state.manche = 2;
  const txt2 = copiaza(ctx);
  t("pe manșa 2, titlul se schimbă", txt2.split("\n")[0], "Cupa Lacului – tragere la sorți, manșa 2");
  t("…și standurile sunt ale manșei 2", /Ion → Stand 55 \(D\)/.test(txt2), true);
  t("…iar cele ale manșei 1 lipsesc", /Stand 12|Stand 40/.test(txt2), false);
}

/* ================================================================
   2. Cine n-a extras în manșa asta nu apare pe listă
   ================================================================ */
console.log("\n=== 2. Doar cei cu stand în manșa curentă ===");
{
  const ctx = aplicatie();
  pune(ctx, [["Ion", 1, "12", "A", "", ""], ["Vlad", 2, "", "", "", ""]]);
  ctx.state.manche = 1;
  const txt = copiaza(ctx);
  t("Ion, care are stand, e pe listă", /Ion/.test(txt), true);
  t("Vlad, fără stand, nu e", /Vlad/.test(txt), false);

  const gol = aplicatie();
  pune(gol, [["Ion", 1, "", "", "", ""]]);
  vm.runInContext("copyDraw()", gol);
  t("fără nicio repartizare, nu se copiază nimic", gol.copiat, null);
  t("…și organizatorul află de ce", gol.mesaje, ["Nicio repartizare de copiat"]);
}

/* ================================================================
   3. Ordinea trasă apare; ordinea netrasă nu lasă o coloană de liniuțe
   ================================================================ */
console.log("\n=== 3. Secțiunea ordinii apare doar dacă s-a tras ===");
{
  const cu = aplicatie();
  pune(cu, [["Ion", 2, "12", "A", "", ""], ["Vlad", 1, "40", "C", "", ""]]);
  const txtCu = copiaza(cu);
  t("cu ordine trasă, secțiunea există", /ORDINEA TRAGERII:/.test(txtCu), true);
  const ordine = txtCu.split("\n").filter(l => /^\d+\. /.test(l));
  t("…și e chiar în ordinea extragerii", ordine, ["1. Vlad → Stand 40 (C)", "2. Ion → Stand 12 (A)"]);

  const fara = aplicatie();
  pune(fara, [["Ion", undefined, "12", "A", "", ""], ["Vlad", undefined, "40", "C", "", ""]]);
  const txtFara = copiaza(fara);
  t("fără ordine trasă, secțiunea lipsește de tot", /ORDINEA TRAGERII/.test(txtFara), false);
  t("…dar standurile tot se copiază", /Stand 12 – Ion \(A\)/.test(txtFara), true);
  t("…fără nicio liniuță în locul ordinii", /^-\. /m.test(txtFara), false);
}

/* ================================================================
   4. „PE STANDURI" e sortată ca la baltă: 2 înaintea lui 10
   ================================================================ */
console.log("\n=== 4. Standurile se înșiră în ordine numerică ===");
{
  const ctx = aplicatie();
  pune(ctx, [["Ion", 1, "10", "A", "", ""], ["Vlad", 2, "2", "A", "", ""], ["Radu", 3, "9", "A", "", ""]]);
  const txt = copiaza(ctx);
  const standuri = txt.split("\n").filter(l => l.indexOf("Stand ") === 0);
  t("2, 9, 10 — nu 10, 2, 9",
    standuri, ["Stand 2 – Vlad (A)", "Stand 9 – Radu (A)", "Stand 10 – Ion (A)"]);
}

/* ================================================================
   5. Fără sector, lista rămâne curată (nu „Stand 5 – Ion ()")
   ================================================================ */
console.log("\n=== 5. Sectorul lipsă nu lasă paranteze goale ===");
{
  const ctx = aplicatie();
  pune(ctx, [["Ion", 1, "5", "", "", ""]]);
  const txt = copiaza(ctx);
  t("nicio paranteză goală", /\(\)/.test(txt), false);
  t("rândul arată doar standul", /Stand 5 – Ion$/m.test(txt), true);
}

t.raport();
