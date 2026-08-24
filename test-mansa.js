/**
 * ▶️ Pornește manșa / 🏁 Gata, s-a terminat manșa.
 *
 * Concursul începe rar la ora scrisă în regulament: se întârzie cu tragerea la sorți,
 * sau se pornește mai devreme fiindcă a venit ploaia. Până acum, ca să mute ceasul,
 * organizatorul trebuia să rescrie amândouă orele în Cronometru — cu telefonul într-o
 * mână și cântarul în cealaltă. Butonul mută ceasul pe „acum + durata", dintr-o apăsare.
 *
 * Se rulează codul ADEVĂRAT, scos din index.html.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));
const ORA = 3600000;

/** o baltă de probă: starea concursului plus tot ce apasă sau întreabă aplicația */
function balta(o) {
  o = o || {};
  const acum = o.acum || Date.parse("2026-08-27T09:07:00");
  const carnet = { intrebari: [], salvari: 0, ceasuri: 0 };
  const ctx = {
    console,
    state: Object.assign({ manche: 1, durataMin: 0, startAt: null, endAt: null, nadireMin: 10,
                           participants: [{ id: "p1", m: { 1: { catches: [4.2] } } }] }, o.state || {}),
    nowSync: () => acum,
    toast: m => carnet.intrebari.push(["toast", m]),
    confirm: m => { carnet.intrebari.push(["confirm", m]); return o.confirma !== false; },
    prompt: (m, d) => { carnet.intrebari.push(["prompt", m]); return "raspuns" in o ? o.raspuns : d; },
    guard: () => !!o.blocat,
    queueSave: () => carnet.salvari++,
    resetWarnings: () => {},
    startTimerLoop: () => carnet.ceasuri++,
    improspateazaStatus: () => {}
  };
  vm.createContext(ctx);
  vm.runInContext([
    "var timerWasRunning=true, nadireAlerted=false, startAlerted=false;",
    grabFunction(src, "fmtDur"),
    // index.html are DOUĂ funcții „hhmm" în același domeniu (liniile 1944 și 3597).
    // La rulare câștigă a doua — cea care primește milisecunde — deci pe ea o luăm și aici.
    grabFunction(src.slice(src.indexOf("function hhmm", src.indexOf("function hhmm") + 1)), "hhmm"),
    grabFunction(src, "textCeas"),
    grabFunction(src, "durataMansei"),
    grabFunction(src, "pornesteMansa"),
    grabFunction(src, "opresteMansa")
  ].join("\n"), ctx);
  return { ctx, carnet, acum, ruleaza: c => vm.runInContext(c, ctx) };
}
const feluri = c => c.intrebari.map(x => x[0]);

/* ---------- 1. Cât ține manșa ---------- */
console.log("\n=== 1. De unde se știe cât ține manșa ===");
{
  const b = balta({ state: { durataMin: 300, startAt: 1000, endAt: 1000 + 4 * ORA } });
  t("cât s-a pus ultima oară bate ceasul din Cronometru", b.ruleaza("durataMansei()"), 300);
}
{
  const b = balta({ state: { durataMin: 0, startAt: 1000, endAt: 1000 + 4 * ORA } });
  t("fără o durată ținută minte, se ia lungimea de pe ceas", b.ruleaza("durataMansei()"), 240);
}
{
  const b = balta();
  t("fără nimic pus, nu se inventează nicio durată", b.ruleaza("durataMansei()"), 0);
}

/* ---------- 2. Prima pornire ---------- */
console.log("\n=== 2. Prima pornire: întreabă o dată, apoi ține minte ===");
{
  const b = balta({ raspuns: "4" });
  b.ruleaza("pornesteMansa()");
  t("a întrebat câte ore", feluri(b.carnet), ["prompt"]);
  t("startul e chiar acum", b.ctx.state.startAt, b.acum);
  t("finalul e la patru ore", b.ctx.state.endAt - b.ctx.state.startAt, 4 * ORA);
  t("durata rămâne ținută minte", b.ctx.state.durataMin, 240);
  t("ora pleacă spre camera live", b.carnet.salvari, 1);
  t("ceasul se ia de la capăt", b.carnet.ceasuri, 1);
  // fără asta, claxonul de nădire ar suna în urmă, la o manșă deja pornită
  t("nădirea nu mai claxonează retroactiv", b.ruleaza("nadireAlerted"), true);
  t("claxonul de start rămâne de sunat", b.ruleaza("startAlerted"), false);
}
{
  // la baltă se scrie cu virgulă, că așa arată tastatura românească
  const b = balta({ raspuns: "3,5" });
  b.ruleaza("pornesteMansa()");
  t("„3,5\" înseamnă trei ore și jumătate", b.ctx.state.durataMin, 210);
}
{
  const b = balta({ raspuns: "abc" });
  b.ruleaza("pornesteMansa()");
  t("un răspuns fără noimă nu pornește nimic", b.ctx.state.startAt, null);
  t("…și spune de ce", feluri(b.carnet), ["prompt", "toast"]);
}
{
  const b = balta({ raspuns: null });
  b.ruleaza("pornesteMansa()");
  t("dacă te răzgândești la întrebare, ceasul rămâne nepus", b.ctx.state.endAt, null);
  t("…și nu se salvează nimic", b.carnet.salvari, 0);
}

/* ---------- 3. A doua oară nu mai întreabă ---------- */
console.log("\n=== 3. A doua manșă: o apăsare, fără întrebări ===");
{
  const b = balta({ state: { manche: 2, durataMin: 240, startAt: 1000, endAt: 2000 } });
  b.ruleaza("pornesteMansa()");
  t("nu mai întreabă nimic", feluri(b.carnet), []);
  t("ceasul pornește acum", b.ctx.state.startAt, b.acum);
  t("…tot pe patru ore", b.ctx.state.endAt - b.acum, 4 * ORA);
}

/* ---------- 4. Ora pusă dinainte ---------- */
console.log("\n=== 4. Ora pusă dinainte nu se calcă dintr-o apăsare greșită ===");
{
  const start = Date.parse("2026-08-27T10:00:00");
  const b = balta({ acum: start - 45 * 60000, confirma: false,
                    state: { startAt: start, endAt: start + 4 * ORA } });
  b.ruleaza("pornesteMansa()");
  t("întreabă înainte să mute ora programată", feluri(b.carnet), ["confirm"]);
  t("scrie la ce oră era pusă", /pusă să înceapă la/.test(b.carnet.intrebari[0][1]), true);
  t("dacă spui nu, ora rămâne cum era", b.ctx.state.startAt, start);
  t("…și nu se salvează nimic", b.carnet.salvari, 0);
}
{
  const start = Date.parse("2026-08-27T10:00:00");
  const b = balta({ acum: start - 45 * 60000, confirma: true,
                    state: { startAt: start, endAt: start + 4 * ORA } });
  b.ruleaza("pornesteMansa()");
  t("dacă spui da, se pornește pe loc", b.ctx.state.startAt, b.acum);
  t("…și ține tot patru ore", b.ctx.state.endAt - b.ctx.state.startAt, 4 * ORA);
}
{
  // o manșă deja încheiată se repornește fără nicio întrebare: ora ei a trecut
  const b = balta({ state: { durataMin: 240, startAt: 1000, endAt: 2000 } });
  b.ruleaza("pornesteMansa()");
  t("o manșă încheiată se repornește direct", feluri(b.carnet), []);
}

/* ---------- 5. Oprirea ---------- */
console.log("\n=== 5. 🏁 oprește ceasul, nu concursul ===");
{
  const b = balta({ confirma: false, state: { startAt: 1000, endAt: Date.parse("2026-08-27T13:00:00") } });
  const inainte = b.ctx.state.endAt;
  b.ruleaza("opresteMansa()");
  t("întreabă înainte să oprească", feluri(b.carnet), ["confirm"]);
  t("dacă spui nu, ceasul merge mai departe", b.ctx.state.endAt, inainte);
}
{
  const b = balta({ confirma: true, state: { startAt: 1000, endAt: Date.parse("2026-08-27T13:00:00") } });
  b.ruleaza("opresteMansa()");
  t("finalul se mută pe acum", b.ctx.state.endAt, b.acum);
  t("startul rămâne neatins", b.ctx.state.startAt, 1000);
  t("oprirea pleacă spre camera live", b.carnet.salvari, 1);
  // pescarii vin cu juvelnicele DUPĂ ce s-a strigat stop
  t("cântarul nu se atinge", b.ctx.state.participants.map(p => p.m[1].catches), [[4.2]]);
}

/* ---------- 6. Lacătul ---------- */
console.log("\n=== 6. Pescarul care doar se uită nu pornește și nu oprește nimic ===");
{
  const b = balta({ blocat: true, raspuns: "4" });
  b.ruleaza("pornesteMansa()");
  b.ruleaza("opresteMansa()");
  t("nici nu întreabă", feluri(b.carnet), []);
  t("ceasul rămâne nepus", b.ctx.state.startAt, null);
}

/* ---------- 7. Textul ceasului ---------- */
console.log("\n=== 7. Ceasul spune aceeași vorbă peste tot ===");
{
  const acum = Date.parse("2026-08-27T09:07:00");
  const b1 = balta({ acum, state: { startAt: acum + 30 * 60000, endAt: acum + 4 * ORA } });
  t("înainte de start: câte mai sunt până începe", b1.ruleaza("textCeas()"), "Începe în 0:30:00");
  const b2 = balta({ acum, state: { startAt: acum - ORA, endAt: acum + 2 * ORA } });
  t("în timpul manșei: cât mai e", b2.ruleaza("textCeas()"), "Timp rămas: 2:00:00");
  const b3 = balta({ acum, state: { startAt: acum - 4 * ORA, endAt: acum - 60000 } });
  t("după final: s-a scurs", b3.ruleaza("textCeas()"), "Timpul s-a scurs");
}

/* ---------- 8. Panoul, citit din sursă ---------- */
console.log("\n=== 8. Panoul: un singur buton, și niciunul pentru privitori ===");
{
  const panou = grabFunction(src, "statusLiveHtml");
  t("butonul de oprire apare doar cât e manșa în desfășurare",
    /stare==="live"\s*\)?\s*\n?\s*\?\s*'<button[^']*opresteMansa/.test(panou), true);
  t("altfel apare cel de pornire", /:\s*'<button[^']*pornesteMansa/.test(panou), true);
  t("amândouă stau sub lacăt", /if\s*\(\s*!isLocked\(\)\s*\)/.test(panou), true);
  t("nu sunt două butoane deodată", (panou.match(/class="sl-act"/g) || []).length, 2);
}

/* ---------- 9. Regresia care ar rupe butonul ---------- */
console.log("\n=== 9. Butonul nu are voie să dispară de sub deget ===");
{
  // Panoul se împrospăta la fiecare secundă cu innerHTML. Apăsarea începe pe un buton
  // și se termină pe altul — iar telefonul n-o mai socotește apăsare. Dacă cineva scoate
  // paza asta, tocmai butoanele de start și de final se pierd, la baltă, în ploaie.
  const impr = grabFunction(src, "improspateazaStatus");
  t("panoul se redesenează doar când s-a schimbat ceva",
    /semn\s*===\s*statusSemn/.test(impr), true);
  t("…altfel doar secunda se rescrie", /\.sl-ceas[\s\S]*textContent\s*=/.test(impr), true);
  t("…și se iese fără să se atingă butonul",
    /if\s*\(\s*semn\s*===\s*statusSemn\s*\)\s*\{[\s\S]*?return;[\s\S]*?\}/.test(impr), true);
  t("semnătura prinde starea, manșa, oamenii, lacătul, capturile, kilogramele și liderul",
    /stareaMansei\(\)[\s\S]*state\.manche|semn=\[stareaMansei\(\)/.test(impr) &&
    /isLocked\(\)/.test(impr) && /cateCapturi/.test(impr) && /leaderId/.test(impr) &&
    /fmt\(kg\)/.test(impr), true);
}

/* ---------- 10. Butonul de manșă nu arhivează ---------- */
console.log("\n=== 10. „Gata, s-a terminat manșa\" nu e „Am terminat concursul\" ===");
{
  const opr = grabFunction(src, "opresteMansa");
  t("nu salvează în sezon", /archiveToSeason/.test(opr), false);
  t("nu golește lista", /participants\s*=\s*\[\]/.test(opr), false);
  t("scrie negru pe alb că rămâne cântarul deschis", /Cântarul rămâne deschis/.test(opr), true);
}

t.raport();
