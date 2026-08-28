/**
 * Pozele nu pleacă la fiecare cântărire.
 *
 * Starea concursului pleacă ÎNTREAGĂ spre cameră la fiecare apăsare pe „+". Când peștele
 * extra a primit poză, asta a devenit o problemă măsurabilă: o poză de cântar la 480px
 * iese între 8 și 48 KB, iar starea unui concurs fără poze e 15 KB. La 34 de poze,
 * fiecare pește cântărit ar fi urcat peste un megabyte, pe 4G, la baltă — iar camera
 * ține 40 de asemenea copii în istoricul ei.
 *
 * Pozele sunt dovada organizatorului pentru ziua aceea; pescarii care se uită la
 * clasamentul live n-au ce face cu poza cântarului. Deci nu pleacă la sincronizare.
 *
 * Aici se verifică pe cifre, nu pe vorbe: se construiește o stare cu poze adevărate ca
 * mărime și se măsoară ce iese din `stareFaraPoze`.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const ctx = { console, JSON };
vm.createContext(ctx);
vm.runInContext(H.grabFunction(src, "stareFaraPoze"), ctx);
const fara = s => vm.runInContext("stareFaraPoze(" + JSON.stringify(s) + ")", ctx);

/** o poză cât una adevărată de cântar, micșorată la 480px */
const POZA = "data:image/jpeg;base64," + "A".repeat(30 * 1024);

function concurs(pescari, extraDeFiecare, cuPoze) {
  const p = [];
  for (let i = 1; i <= pescari; i++) {
    const extras = [], extraTimes = [], extraPhotos = [];
    for (let k = 0; k < extraDeFiecare; k++) {
      extras.push(3.5); extraTimes.push(1787900000000 + k);
      extraPhotos.push(cuPoze ? POZA : null);
    }
    p.push({ id: "p" + i, prenume: "Pescar", nume: "" + i, stand: "" + i, sector: "A",
      m: { 1: { catches: [12.5, 8.3], catchTimes: [1, 2], catchPhotos: [null, null],
                extras: extras, extraTimes: extraTimes, extraPhotos: extraPhotos,
                stand: "" + i, sector: "A" },
           2: { catches: [], catchTimes: [], catchPhotos: [], extras: [], extraTimes: [], extraPhotos: [], stand: "", sector: "" } } });
  }
  return { name: "Concurs", sectors: ["A", "B", "C"], manche: 1, numManse: 2, participants: p };
}

const kb = o => Math.round(JSON.stringify(o).length / 1024);

/* ================================================================
   1. Cât pleacă, de fapt
   ================================================================ */
console.log("\n=== 1. Mărimea a ce urcă la fiecare cântărire ===");
{
  const s = concurs(17, 2, true);
  const cu = kb(s), curat = kb(fara(s));
  console.log("   17 pescari × 2 pești extra cu poze: starea " + cu + " KB → pleacă " + curat + " KB");
  t("cu poze, starea trece de un megabyte", cu > 1024, true);
  t("ce pleacă spre server rămâne sub 100 KB", curat < 100, true);
  // pragul care contează: pe 4G, la fiecare pește cântărit
  t("adică de peste zece ori mai puțin", cu / curat > 10, true);
}
{
  const s = concurs(30, 3, true);
  console.log("   30 pescari × 3 pești extra: starea " + kb(s) + " KB → pleacă " + kb(fara(s)) + " KB");
  t("nici la concurs mare nu crește ce pleacă", kb(fara(s)) < 200, true);
}
{
  // fără poze, nimic nu trebuie să se schimbe față de cum era
  const s = concurs(17, 2, false);
  t("fără poze, ce pleacă e cât starea", kb(fara(s)), kb(s));
}

/* ================================================================
   2. Nu se pierde nimic în afară de poze
   ================================================================ */
console.log("\n=== 2. Ce rămâne în ce pleacă ===");
{
  const s = concurs(3, 2, true);
  const c = fara(s);
  t("numele concursului rămâne", c.name, "Concurs");
  t("sectoarele rămân", c.sectors, ["A", "B", "C"]);
  t("manșa rămâne", [c.manche, c.numManse], [1, 2]);
  t("toți pescarii rămân", c.participants.length, 3);
  t("greutățile din juvelnic rămân", c.participants[0].m[1].catches, [12.5, 8.3]);
  t("peștii extra rămân", c.participants[0].m[1].extras, [3.5, 3.5]);
  t("ORELE peștilor extra rămân", c.participants[0].m[1].extraTimes.length, 2);
  t("standul și sectorul rămân", [c.participants[0].m[1].stand, c.participants[0].m[1].sector], ["1", "A"]);
  t("manșa a doua rămâne și ea", !!c.participants[0].m[2], true);
}
{
  const s = concurs(3, 2, true);
  const c = fara(s);
  t("pozele au plecat", c.participants[0].m[1].extraPhotos, [null, null]);
  /* Lungimea trebuie păstrată: normalizarea de pe telefonul care citește taie orele la
     lungimea pozelor și invers — un tablou mai scurt ar decala orele față de greutăți. */
  t("…dar tabloul are aceeași lungime ca peștii", c.participants[0].m[1].extraPhotos.length,
    c.participants[0].m[1].extras.length);
}

/* ================================================================
   3. Starea de pe telefon rămâne neatinsă
   ================================================================ */
console.log("\n=== 3. Telefonul își păstrează pozele ===");
{
  /* Verificarea trebuie făcută ÎNĂUNTRUL vm-ului: dacă starea e trecută prin JSON,
     obiectul dinăuntru e altul decât cel de aici, iar o umblătură n-ar avea cum să se
     vadă. (Prima variantă a probei ăsteia trecea degeaba, exact din motivul ăsta.) */
  ctx.PROBA = concurs(2, 1, true);
  const r = vm.runInContext(
    "var inainte=JSON.stringify(PROBA);" +
    "var iesit=stareFaraPoze(PROBA);" +
    "({ neatinsa: JSON.stringify(PROBA)===inainte," +
    "   pozaAcolo: !!(PROBA.participants[0].m[1].extraPhotos[0]||'').length," +
    "   iesitFaraPoza: iesit.participants[0].m[1].extraPhotos[0]===null })", ctx);
  t("stareFaraPoze nu umblă în starea telefonului", r.neatinsa, true);
  t("…poza e tot acolo", r.pozaAcolo, true);
  t("…iar copia trimisă chiar e fără ea", r.iesitFaraPoza, true);
}

/* ================================================================
   4. Legat unde trebuie
   ================================================================ */
console.log("\n=== 4. Cine o folosește ===");
{
  const push = H.grabFunction(src, "pushState");
  t("sincronizarea trimite starea curățată", /JSON\.stringify\(\{data: stareFaraPoze\(state\)\}\)/.test(push), true);
  t("…și nu mai trimite starea întreagă", /JSON\.stringify\(\{data: state\}\)/.test(push), false);

  /* Arhiva e o singură urcare, la finalul concursului: acolo pozele TREBUIE să meargă,
     ele sunt dovada care rămâne. Dacă cineva ar curăța și arhiva, dovada s-ar pierde. */
  const arh = H.grabFunction(src, "archiveToSeason");
  t("arhiva pleacă cu poze cu tot", /stareFaraPoze/.test(arh), false);
}

/* ================================================================
   5. Poza se poate scoate fără să piară peștele
   ================================================================ */
console.log("\n=== 5. „Scoate poza\" ===");
{
  const cod = H.grabFunction(src, "scoatePoza");
  t("întreabă înainte", /confirm\(/.test(cod), true);
  t("…și spune ce rămâne", /Pe[sș]tele [șs]i greutatea r[ăa]m[âa]n/.test(cod), true);
  t("șterge doar poza, pune null", /tab\[pozaDeschisa\.idx\]=null/.test(cod), true);
  t("nu atinge greutatea", /extras\.splice|catches\.splice/.test(cod), false);
  t("nu lucrează pe telefonul blocat", /if\(guard\(\)\) return;/.test(cod), true);
  t("salvează după", /queueSave\(\)/.test(cod), true);

  const arata = H.grabFunction(src, "arataScoatePoza");
  t("butonul se ascunde în vizualizare", /isLocked\(\)[\s\S]{0,30}\? "none"/.test(arata), true);
  /* Aceeași fereastră mărește și foaia de import, unde nu există „poza unei capturi" de
     scos. Un buton care nu face nimic e mai rău decât unul lipsă. */
  t("…și când nu e deschisă poza unei capturi", /!pozaDeschisa[\s\S]{0,20}\? "none"/.test(arata), true);

  t("butonul e în fereastra pozei", /class="photo-jos"[^>]*scoatePoza\(\)/.test(src), true);
  // fereastra se închide la clic pe fundal: fără oprirea propagării, butonul s-ar închide
  // singur înainte să apuce să întrebe
  t("apăsarea lui nu închide fereastra din greșeală",
    /photo-jos" onclick="event\.stopPropagation\(\);scoatePoza\(\)"/.test(src), true);
}

t.raport();
