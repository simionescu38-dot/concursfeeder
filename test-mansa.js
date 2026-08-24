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
  const sem = grabFunction(src, "semnaturaStatus");
  t("semnătura prinde starea, manșa, oamenii, lacătul, capturile, kilogramele și liderul",
    /stareaMansei\(\)/.test(sem) && /state\.manche/.test(sem) && /participants\.length/.test(sem) &&
    /isLocked\(\)/.test(sem) && /cateCapturi/.test(sem) && /leaderId/.test(sem) &&
    /fmt\(kg\)/.test(sem), true);
  t("…iar improspateazaStatus o cere de acolo", /semnaturaStatus\(\)/.test(impr), true);
}

/* ---------- 10. Butonul de manșă nu arhivează ---------- */
console.log("\n=== 10. „Gata, s-a terminat manșa\" nu e „Am terminat concursul\" ===");
{
  const opr = grabFunction(src, "opresteMansa");
  t("nu salvează în sezon", /archiveToSeason/.test(opr), false);
  t("nu golește lista", /participants\s*=\s*\[\]/.test(opr), false);
  t("scrie negru pe alb că rămâne cântarul deschis", /Cântarul rămâne deschis/.test(opr), true);
}

/* ═══════════ REZUMATUL DE FINAL DE MANȘĂ ═══════════
   Când s-a strigat stop, organizatorul citește cu voce tare cine a câștigat FIECARE
   sector. Până acum trebuia să deschidă Clasamentul și să pună „Pe sectoare"; acum
   scrie în panou. Ce se citește la premiere n-are voie să fie altceva decât ce scrie
   în clasament — de-aia rezumatul folosește exact aceeași funcție de clasare. */

/** o baltă cu tot lanțul de socoteli al aplicației, rulat pe bune */
function concurs(oameni, o) {
  o = o || {};
  const ctx = {
    console,
    state: Object.assign({ manche: 1, numManse: 2, durataMin: 0, startAt: 1000, endAt: 2000,
                           nadireMin: 10, lock: false, pinHash: "" }, o.state || {}),
    nowSync: () => o.acum || 9e12,      // mult după endAt: manșa e încheiată
    isLocked: () => !!o.blocat
  };
  vm.createContext(ctx);
  vm.runInContext([
    "var viewerMode=false;",
    grabFunction(src, "num"), grabFunction(src, "fmt"), grabFunction(src, "esc"),
    grabFunction(src, "numManse"), grabFunction(src, "manseRange"),
    grabFunction(src, "emptyManche"), grabFunction(src, "ensureManche"), grabFunction(src, "mOf"),
    grabFunction(src, "mancheDisputata"), grabFunction(src, "mancheDeAfisat"),
    grabFunction(src, "sectorOfM"), grabFunction(src, "standOfM"),
    grabFunction(src, "cantOfM"), grabFunction(src, "extraOfM"), grabFunction(src, "totalOfM"),
    grabFunction(src, "cmmcOfM"), grabFunction(src, "cmmcAward"),
    grabFunction(src, "nameOf"), grabFunction(src, "nameKey"),
    grabFunction(src, "standKey"), grabFunction(src, "byStand"), grabFunction(src, "sortRankS"),
    grabFunction(src, "absentLaMansa"), grabFunction(src, "totalOf"),
    grabFunction(src, "cateCapturi"), grabFunction(src, "stareaMansei"), grabFunction(src, "leaderId"),
    grabFunction(src, "castigatoriPeSectoare"), grabFunction(src, "celMaiMarePeste"),
    grabFunction(src, "rezumatMansei"), grabFunction(src, "semnaturaStatus")
  ].join("\n"), ctx);
  // [nume, sector, stand, kg, pesteExtra?]
  ctx.state.participants = oameni.map(function (om, i) {
    return { id: "p" + i, prenume: om[0], nume: "", stand: om[2], sector: om[1],
             m: { 1: { catches: om[3] === null ? [] : [om[3]], catchTimes: [], catchPhotos: [],
                       extras: om[4] ? (Array.isArray(om[4]) ? om[4].slice() : [om[4]]) : [],
                       stand: om[2], sector: om[1] } } };
  });
  return { ctx, ruleaza: c => vm.runInContext(c, ctx) };
}
const sectoare = b => b.ruleaza("castigatoriPeSectoare(1)")
  .map(s => s.sector + ":" + (s.castigator ? s.castigator.prenume : "—") + ":" + b.ruleaza("fmt")(s.kg));

console.log("\n=== 11. Cine a câștigat fiecare sector ===");
{
  // Uriaș are cele mai multe kilograme din tot concursul, dar stă în A; B are alt câștigător
  const b = concurs([["Urias", "A", "1", 31.0], ["Greu", "A", "2", 28.0], ["Mic", "A", "3", 4.0],
                     ["Micu", "B", "6", 9.0], ["Sub", "B", "7", 7.0]]);
  t("fiecare sector are câștigătorul lui", sectoare(b), ["A:Urias:31,000", "B:Micu:9,000"]);
  t("sectoarele vin în ordine", b.ruleaza("castigatoriPeSectoare(1).map(function(s){return s.sector;})"), ["A", "B"]);
}
{
  // ordinea din listă e dinadins pe dos: câștigă cine are kilogramele, nu cine e primul
  const b = concurs([["Ultim", "A", "1", 2.0], ["Mijloc", "A", "2", 14.0], ["Cel mai greu", "A", "3", 20.0]]);
  t("câștigă kilogramele, nu ordinea din listă", sectoare(b), ["A:Cel mai greu:20,000"]);
}
{
  const b = concurs([["Ana", "A", "1", 5.0], ["Bogdan", "B", "2", null]]);
  t("sectorul în care n-a cântărit nimeni n-are câștigător", sectoare(b), ["A:Ana:5,000", "B:—:0"]);
}
{
  // egalitate perfectă pe kilograme: hotărăște standul, prin sortRankS — nu întâmplarea
  const b = concurs([["StandMare", "A", "9", 6.0], ["StandMic", "A", "2", 6.0]]);
  t("la kilograme egale hotărăște standul mai mic", sectoare(b), ["A:StandMic:6,000"]);
}
{
  const b = concurs([["Unu", "", "1", 5.0], ["Doi", "", "2", 3.0]]);
  t("fără sectoare, un singur rând", sectoare(b), [":Unu:5,000"]);
}

console.log("\n=== 12. Cine n-a fost la manșă nu câștigă sectorul ei ===");
{
  // fără stand și fără cântar la manșa asta = absent (absentLaMansa)
  const b = concurs([["Prezent", "A", "1", 3.0], ["Absent", "", null, null]]);
  t("absentul nu apare nicăieri", sectoare(b), ["A:Prezent:3,000"]);
}

console.log("\n=== 13. Cel mai mare pește ===");
{
  const b = concurs([["Ana", "A", "1", 10.0, 2.1], ["Bogdan", "B", "2", 20.0, 1.4]]);
  const mare = b.ruleaza("celMaiMarePeste(1)");
  t("îl ia pe cel cu peștele mai mare, nu pe cel cu kilogramele", mare.p.prenume, "Ana");
  t("…cu greutatea peștelui", mare.kg, 2.1, 0.001);
}
{
  const b = concurs([["Ana", "A", "1", 10.0], ["Bogdan", "B", "2", 20.0]]);
  t("fără pești extra, niciun cel-mai-mare-pește", b.ruleaza("celMaiMarePeste(1)"), null);
  t("…și rândul lipsește din rezumat", /Cel mai mare pește/.test(b.ruleaza("rezumatMansei(1)")), false);
}

console.log("\n=== 14. Ce scrie în panou ===");
{
  const b = concurs([["Urias", "A", "1", 31.0], ["Micu", "B", "6", 9.0, 2.1], ["Gol", "C", "9", null]]);
  const h = b.ruleaza("rezumatMansei(1)");
  t("scrie câștigătorul sectorului A", /Sector A: <b>Urias<\/b> — 31,000 kg/.test(h), true);
  // Micu are 9,0 în juvelnic ȘI un pește extra de 2,1: Total = Cantitate + Pești extra
  t("scrie câștigătorul sectorului B", /Sector B: <b>Micu<\/b> — 11,100 kg/.test(h), true);
  t("sectorul netrecut spune că mai e de cântărit", /Sector C: încă nimeni cântărit/.test(h), true);
  t("scrie cel mai mare pește", /Cel mai mare pește: <b>Micu<\/b> — 2,100 kg/.test(h), true);
  t("duce la clasamentul manșei", /veziClasamentulMansei\(1\)/.test(h), true);
}
{
  const b = concurs([["Unu", "A", "1", null], ["Doi", "B", "2", null]]);
  const h = b.ruleaza("rezumatMansei(1)");
  t("fără niciun cântar, o spune pe șleau", /Nu s-a trecut încă niciun cântar/.test(h), true);
  t("…și nu inventează câștigători", /🥇/.test(h), false);
}

console.log("\n=== 15. Semnătura prinde și rezumatul ===");
{
  /* Contraexemplul care a cerut lărgirea semnăturii: în sectorul B, Mimi scade de la
     4,800 la 3,500 și Sorin urcă de la 3,000 la 4,300. Suma sectorului rămâne 7,800,
     deci totalul concursului e ACELAȘI, capturile sunt aceleași, liderul (Harry) e
     același — dar câștigătorul sectorului B s-a schimbat. Fără el în semnătură, pe ecran
     rămânea numele greșit, exact ăla care se citește cu voce tare. */
  const inainte = concurs([["Harry", "A", "1", 7.2], ["Mimi", "B", "2", 4.8], ["Sorin", "B", "3", 3.0]]);
  const dupa    = concurs([["Harry", "A", "1", 7.2], ["Mimi", "B", "2", 3.5], ["Sorin", "B", "3", 4.3]]);
  const s1 = inainte.ruleaza("semnaturaStatus()"), s2 = dupa.ruleaza("semnaturaStatus()");
  t("totalul e chiar același", inainte.ruleaza("state.participants.reduce(function(s,p){return s+totalOfM(p,1);},0)"),
    dupa.ruleaza("state.participants.reduce(function(s,p){return s+totalOfM(p,1);},0)"), 0.0001);
  t("liderul e chiar același", inainte.ruleaza("leaderId()"), dupa.ruleaza("leaderId()"));
  t("câștigătorul sectorului B chiar s-a schimbat",
    [sectoare(inainte)[1], sectoare(dupa)[1]], ["B:Mimi:4,800", "B:Sorin:4,300"]);
  t("…deci semnătura TREBUIE să fie alta", s1 !== s2, true);
}
{
  /* Și peștele cel mare intră în semnătură. Cazul trebuie ales cu grijă: peștii extra
     se adună la TOTAL, deci dacă doi oameni fac schimb de câte un pește li se schimbă și
     kilogramele — iar semnătura ar ieși alta oricum, din sectoare, și testul ar trece
     degeaba. Aici fiecare are 4,0 kg de pești extra în amândouă stările; se mută doar
     felul în care sunt împărțiți, deci se schimbă NUMAI cine ține peștele cel mare. */
  const a = concurs([["Ana", "A", "1", 10.0, [2.0, 2.0]], ["Bob", "A", "2", 3.0, [3.0, 1.0]]]);
  const c = concurs([["Ana", "A", "1", 10.0, [3.0, 1.0]], ["Bob", "A", "2", 3.0, [2.0, 2.0]]]);
  t("kilogramele fiecăruia sunt neatinse",
    [a.ruleaza("state.participants.map(function(p){return fmt(totalOfM(p,1));})"),
     c.ruleaza("state.participants.map(function(p){return fmt(totalOfM(p,1));})")],
    [["14,000", "7,000"], ["14,000", "7,000"]]);
  t("capturile sunt tot atâtea", [a.ruleaza("cateCapturi(1)"), c.ruleaza("cateCapturi(1)")], [6, 6]);
  t("câștigătorul sectorului e același", [sectoare(a), sectoare(c)], [["A:Ana:14,000"], ["A:Ana:14,000"]]);
  t("dar peștele cel mare e la altcineva",
    [a.ruleaza("celMaiMarePeste(1).p.prenume"), c.ruleaza("celMaiMarePeste(1).p.prenume")], ["Bob", "Ana"]);
  t("…deci semnătura TREBUIE să fie alta",
    a.ruleaza("semnaturaStatus()") !== c.ruleaza("semnaturaStatus()"), true);
}
{
  // cât manșa e în desfășurare, semnătura n-are de ce să care sectoarele
  const viu = concurs([["Ana", "A", "1", 5.0]], { acum: 1500 });   // între startAt și endAt
  t("manșa e în desfășurare", viu.ruleaza("stareaMansei()"), "live");
  t("…iar semnătura rămâne scurtă", viu.ruleaza("semnaturaStatus()").split("|").length, 7);
}

console.log("\n=== 16. Rezumatul folosește aceeași clasare ca ecranul și PDF-ul ===");
{
  const cps = grabFunction(src, "castigatoriPeSectoare");
  // dacă cineva sortează aici altfel, panoul poate striga alt câștigător decât clasamentul
  t("clasează cu sortRankS, ca peste tot", /sortRankS\s*\(/.test(cps), true);
  t("grupează pe sectorul MANȘEI, nu pe cel de acum", /sectorOfM\s*\(\s*p\s*,\s*mi\s*\)/.test(cps), true);
  t("scoate absenții", /absentLaMansa\s*\(\s*p\s*,\s*mi\s*\)/.test(cps), true);
  const panou = grabFunction(src, "statusLiveHtml");
  t("rezumatul apare doar pe manșa încheiată", /stare===\"incheiata\"/.test(panou), true);
  t("…și ia locul rândului cu liderul", /else if\s*\(\s*lider/.test(panou), true);
}

t.raport();
