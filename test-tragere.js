/**
 * Tragerea la sorți, lipită de pe WhatsApp sau citită de pe poza foii.
 *
 * Tragerea se face la bilă, la baltă. Până acum urma partea proastă: standurile trecute
 * de mână, unul câte unul, pe telefon — iar la un concurs de două manșe, încă o dată
 * duminică dimineața. La 44 de pescari sunt 88 de treceri într-un weekend.
 *
 * Aici se verifică lucrul de care atârnă tot: lista MUTĂ oameni, nu adaugă. Dacă ar
 * adăuga, o listă lipită de două ori ar dubla concursul; iar dacă tragerea de duminică
 * ar atinge manșa de sâmbătă, ar rescrie un clasament deja încheiat.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = ["uid", "esc", "numManse", "manseRange", "emptyManche", "ensureManche", "mOf",
  "sectorOfM", "standOfM", "setStandSector", "nameOf", "faraSemne",
  "cantOfM", "extraOfM", "totalOfM", "scrieInJurnal", "sectorRanges", "sectorForStand",
  "citesteTragerea", "pescarulTragerii", "randuriTragerii", "sectorulTragerii",
  "ordineaTragerii", "pescarDupaCod", "participantDupaCod", "cheiePescar", "numePescar",
  "intervaleleTragerii", "verificaTragerea", "treceTragerea", "adaugaDinTragere",
  "splitName", "curataNumarul"];

/** un concurs adevărat, cu DOM-ul strict cât îi trebuie */
function pornire(pescari, optiuni) {
  const o = optiuni || {};
  const camp = { value: o.text || "" };
  const preview = { innerHTML: "" };
  const ctx = {
    console, JSON, Date, Math, parseInt, parseFloat, isNaN,
    blocat: !!o.blocat,
    intrebat: [], raspunsLaConfirm: o.confirma !== false,
    toasturi: [], salvat: 0, desenat: 0, copii: [],
    document: {
      getElementById(id) {
        if (id === "trg-text") return camp;
        if (id === "trg-preview") return preview;
        return null;
      }
    },
    guard() { return ctx.blocat; },
    confirm(q) { ctx.intrebat.push(q); return ctx.raspunsLaConfirm; },
    toast(m) { ctx.toasturi.push(m); },
    queueSave() { ctx.salvat++; },
    renderList() { ctx.desenat++; },
    renderSectors() { ctx.sectoareDesenate = (ctx.sectoareDesenate || 0) + 1; },
    isLocked() { return ctx.blocat; },
    puneDeoParte(motiv) { ctx.copii.push(motiv); }
  };
  ctx.camp = camp; ctx.preview = preview;
  /* baza de pescari: goală, dacă testul nu cere altfel — foile fără coduri merg ca înainte */
  ctx.pescari = o.pescari || [];
  ctx.state = {
    name: "Probă", manche: o.mansa || 1, numManse: 2,
    sectors: o.sectors || ["A", "B", "C", "D"],
    numStanduri: o.numStanduri === undefined ? "44" : o.numStanduri,
    jurnal: [],
    participants: pescari.map((x, i) => ({
      id: "p" + i, prenume: x.prenume, nume: x.nume,
      stand: x.stand || "", sector: x.sector || "",
      m: {
        1: { catches: (x.catches || []).slice(), catchTimes: [], catchPhotos: [], extras: [], extraTimes: [], extraPhotos: [], stand: x.stand || "", sector: x.sector || "" },
        2: { catches: [], catchTimes: [], catchPhotos: [], extras: [], extraTimes: [], extraPhotos: [], stand: x.standM2 || "", sector: x.sectorM2 || "" }
      }
    }))
  };
  vm.createContext(ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  return ctx;
}

/** lotul de probă, cu diacritice cu tot */
const LOT = [
  { stand: "1", prenume: "Mihai", nume: "Ionescu", sector: "A" },
  { stand: "2", prenume: "Vasile", nume: "Popescu", sector: "A" },
  { stand: "3", prenume: "Ștefan", nume: "Bălan", sector: "A" },
  { stand: "4", prenume: "Ion", nume: "Țăranu", sector: "A" },
  { stand: "5", prenume: "Cristi", nume: "Enache", sector: "A" },
  { stand: "6", prenume: "Radu", nume: "Mărgineanu", sector: "A" }
];

const citit = (ctx, text) => vm.runInContext("citesteTragerea(" + JSON.stringify(text) + ")", ctx);
const randuri = (ctx, text) => vm.runInContext(
  "randuriTragerii(" + JSON.stringify(text) + ").map(function(x){" +
  "return {stand:x.stand, nume:x.nume, sector:x.sector, cine:x.p?nameOf(x.p):null," +
  " cum:x.cum, standDublu:x.standDublu, omDublu:x.omDublu};})", ctx);

/* ================================================================
   1. Formele în care vine lista pe grup
   ================================================================ */
console.log("\n=== 1. Ce se citește dintr-un rând ===");
{
  const c = pornire(LOT);
  const unul = txt => {
    const r = citit(c, txt);
    return r.length ? { stand: r[0].stand, nume: r[0].nume, sector: r[0].sector } : null;
  };

  t("stand și nume", unul("1 Mihai Ionescu"), { stand: "1", nume: "Mihai Ionescu", sector: "" });
  t("numerotat cu punct", unul("1. Mihai Ionescu"), { stand: "1", nume: "Mihai Ionescu", sector: "" });
  t("numerotat lipit", unul("1.Mihai Ionescu"), { stand: "1", nume: "Mihai Ionescu", sector: "" });
  t("cu liniuță între", unul("1 - Mihai Ionescu"), { stand: "1", nume: "Mihai Ionescu", sector: "" });
  t("cu virgulă între", unul("1, Mihai Ionescu"), { stand: "1", nume: "Mihai Ionescu", sector: "" });
  t("cu Stand în față", unul("Stand 1 Mihai Ionescu"), { stand: "1", nume: "Mihai Ionescu", sector: "" });
  t("cu St. în față", unul("St. 1 Mihai Ionescu"), { stand: "1", nume: "Mihai Ionescu", sector: "" });
  t("cu Nr. în față", unul("Nr. 1 Mihai Ionescu"), { stand: "1", nume: "Mihai Ionescu", sector: "" });
  t("cu sectorul scris la coadă", unul("1, Mihai Ionescu, B"), { stand: "1", nume: "Mihai Ionescu", sector: "B" });
  t("copiat din WhatsApp, cu ora și cine a scris",
    unul("[10:32, 06.09.2026] Cristi: 12 Mihai Ionescu"), { stand: "12", nume: "Mihai Ionescu", sector: "" });
  t("stand din două cifre", unul("44 Mihai Ionescu"), { stand: "44", nume: "Mihai Ionescu", sector: "" });
}

console.log("\n=== 2. Ce NU se citește ===");
{
  const c = pornire(LOT);
  const sarite = txt => vm.runInContext("citesteTragerea(" + JSON.stringify(txt) + ").sarite", c);

  t("titlul cu dată nu dă standul 6",
    citit(c, "Tragerea la sorți 06.09.2026").length, 0);
  t("…și e trecut la sărite", sarite("Tragerea la sorți 06.09.2026").length, 1);
  t("ora nu dă standul 8", citit(c, "Ne vedem la 08:30 la baltă").length, 0);
  t("un rând cu număr, fără nume, nu mută pe nimeni", citit(c, "12").length, 0);
  t("rândul gol e ignorat de tot", citit(c, "\n   \n").length, 0);
  t("un rând fără niciun număr e sărit", citit(c, "gata tragerea, mult succes").length, 0);
}

console.log("\n=== 2b. Foaia adevărată: sectorul stă înaintea standului ===");
{
  /* Pe foaia de la Rediu Galian, sectorul și standul sunt într-o singură coloană: „A 2".
     Iar sectoarele de acolo NU se potrivesc cu cele socotite din stand — A ține 2…7, deci
     standul 7 ar cădea în B dacă am împărți 1…N în patru. Un sector greșit schimbă
     punctele, așa că ce scrie pe foaie bate socoteala. */
  const c = pornire(LOT);
  const unul = txt => {
    const r = citit(c, txt);
    return r.length ? { stand: r[0].stand, nume: r[0].nume, sector: r[0].sector } : null;
  };

  t("„A 2 NICU ROMAN\" — sectorul din față e citit",
    unul("A 2 NICU ROMAN"), { stand: "2", nume: "NICU ROMAN", sector: "A" });
  t("lipit, fără spațiu", unul("C14 PETRISOR VULPE"),
    { stand: "14", nume: "PETRISOR VULPE", sector: "C" });
  t("cu litere mici", unul("b 8 COSTEL TATIANA"),
    { stand: "8", nume: "COSTEL TATIANA", sector: "B" });
  t("o literă care nu e sector nu e luată drept sector",
    unul("Z 5 Cineva Oarecare").sector, "");
  t("…iar standul e tot 5", unul("Z 5 Cineva Oarecare").stand, "5");

  /* Pe foaia lui: 24 de standuri, patru sectoare, dar A ține 2…7 fiindcă standul 1 nu se
     folosește. Socoteala împarte 1…24 în patru și-l pune pe 7 în B — adică exact greșeala
     pe care o repară sectorul scris pe foaie. */
  const c24 = pornire(LOT, { numStanduri: "24" });
  const sec = (stand, scris) => vm.runInContext(
    "sectorulTragerii(" + JSON.stringify(String(stand)) + "," + JSON.stringify(scris || "") +
    ", intervaleleTragerii())", c24);
  t("socoteala din stand l-ar pune pe 7 în B, nu în A", sec(7), "B");
  t("dar sectorul scris pe foaie câștigă", sec(7, "A"), "A");
}

console.log("\n=== 3. Pe cine găsește ===");
{
  const c = pornire(LOT);
  const unul = txt => randuri(c, txt)[0];

  t("nume întreg", unul("1 Mihai Ionescu").cine, "Mihai Ionescu");
  t("fără diacritice", unul("1 Stefan Balan").cine, "Ștefan Bălan");
  t("cu litere mici", unul("1 mihai ionescu").cine, "Mihai Ionescu");
  t("numai numele de familie", unul("1 Mărgineanu").cine, "Radu Mărgineanu");
  t("în ordinea inversă a numelui", unul("1 Ionescu Mihai").cine, "Mihai Ionescu");
  t("un nume care nu e în listă nu intră pe nimeni", unul("1 Gigel Necunoscutu").cine, null);
  t("…și e marcat negăsit", unul("1 Gigel Necunoscutu").cum, "negasit");
}
{
  // doi cu același nume de familie
  const c = pornire(LOT.concat([{ stand: "7", prenume: "Andrei", nume: "Ionescu", sector: "B" }]));
  const r = randuri(c, "1 Ionescu")[0];
  t("nume ambiguu nu intră pe niciunul", r.cine, null);
  t("…și spune de ce: sunt doi", r.cum, "doi");
}

console.log("\n=== 4. Dublurile, care strică tăcut ===");
{
  const c = pornire(LOT);
  const r = randuri(c, "1 Mihai Ionescu\n1 Vasile Popescu");
  t("primul rând pe standul 1 trece", r[0].standDublu, false);
  t("al doilea rând pe același stand e oprit", r[1].standDublu, true);
}
{
  const c = pornire(LOT);
  const r = randuri(c, "1 Mihai Ionescu\n2 Mihai Ionescu");
  t("același pescar scris de două ori: al doilea e oprit", r[1].omDublu, true);
  t("…dar primul rămâne bun", r[0].omDublu, false);
}

console.log("\n=== 5. Cine rămâne pe dinafară ===");
{
  const c = pornire(LOT);
  const cati = vm.runInContext(
    "randuriTragerii('1 Mihai Ionescu\\n2 Vasile Popescu').faraStand.length", c);
  t("din 6 pescari, 2 în listă, 4 rămân fără stand", cati, 4);
}

console.log("\n=== 6. Sectorul ===");
{
  const c = pornire(LOT);
  const sec = (stand, scris) => vm.runInContext(
    "sectorulTragerii(" + JSON.stringify(String(stand)) + "," + JSON.stringify(scris || "") +
    ", intervaleleTragerii())", c);

  t("standul 1 cade în sectorul A", sec(1), "A");
  t("standul 11 tot în A", sec(11), "A");
  t("standul 12 trece în B", sec(12), "B");
  t("standul 23 în C", sec(23), "C");
  t("standul 44 în D", sec(44), "D");
  t("sectorul scris pe rând bate socoteala din stand", sec(1, "D"), "D");
  t("o literă care nu e sector al concursului e ignorată", sec(1, "Z"), "A");
}
{
  // „Ionescu M" nu trebuie să-și piardă inițiala doar fiindcă M seamănă a sector
  const c = pornire(LOT, { sectors: ["A", "B"] });
  t("inițiala din nume nu e luată drept sector",
    citit(c, "1 Ionescu M")[0].nume, "Ionescu M");
}

/* ================================================================
   7. Mutarea propriu-zisă
   ================================================================ */
console.log("\n=== 7. Ce se întâmplă când apeși „Mută pe standuri\" ===");
{
  const c = pornire(LOT, { mansa: 2 });
  c.camp.value = "12 Mihai Ionescu\n23 Vasile Popescu\n34 Ștefan Bălan";
  vm.runInContext("treceTragerea()", c);

  const st = i => c.state.participants[i].m[2].stand;
  const se = i => c.state.participants[i].m[2].sector;
  t("Ionescu a fost mutat pe 12", st(0), "12");
  t("…și a intrat în sectorul B", se(0), "B");
  t("Popescu pe 23, sectorul C", [st(1), se(1)], ["23", "C"]);
  t("Bălan pe 34, sectorul D", [st(2), se(2)], ["34", "D"]);
  t("cine nu era în listă a rămas fără stand în manșa 2", st(3), "");

  t("NU s-a adăugat nimeni", c.state.participants.length, 6);
  t("s-a cerut confirmarea", c.intrebat.length, 1);
  t("s-a pus deoparte o copie înainte", c.copii.length, 1);
  t("s-a salvat", c.salvat > 0, true);
  t("căsuța s-a golit după trecere", c.camp.value, "");
  t("jurnalul are cele 3 mutări", c.state.jurnal.length, 3);
  t("jurnalul spune de unde a venit", c.state.jurnal[0].cine, "tragerea de pe WhatsApp");
  t("jurnalul ține minte standul dinainte", c.state.jurnal[0].inainte, "");
}

console.log("\n=== 8. Manșa încheiată nu se clintește ===");
{
  const c = pornire(LOT, { mansa: 2 });
  const standuriM1 = c.state.participants.map(p => p.m[1].stand).join(",");
  const sectoareM1 = c.state.participants.map(p => p.m[1].sector).join(",");

  c.camp.value = LOT.map((x, i) => (44 - i) + " " + x.prenume + " " + x.nume).join("\n");
  vm.runInContext("treceTragerea()", c);

  t("STANDURILE DE SÂMBĂTĂ AU RĂMAS NEATINSE",
    c.state.participants.map(p => p.m[1].stand).join(","), standuriM1);
  t("și sectoarele de sâmbătă la fel",
    c.state.participants.map(p => p.m[1].sector).join(","), sectoareM1);
  t("dar în manșa 2 toți s-au mutat",
    c.state.participants.map(p => p.m[2].stand).join(","), "44,43,42,41,40,39");
}

console.log("\n=== 9. Când nu se mișcă nimic ===");
{
  const c = pornire(LOT, { mansa: 2, confirma: false });
  c.camp.value = "12 Mihai Ionescu";
  vm.runInContext("treceTragerea()", c);
  t("dacă răspunzi „nu\" la întrebare, nu se mută nimeni",
    c.state.participants[0].m[2].stand, "");
  t("…și nu se pune nicio copie deoparte", c.copii.length, 0);
}
{
  const c = pornire(LOT, { mansa: 2, blocat: true });
  c.camp.value = "12 Mihai Ionescu";
  vm.runInContext("treceTragerea()", c);
  t("cu concursul blocat nu se mută nimic", c.state.participants[0].m[2].stand, "");
  t("…și nici nu se întreabă", c.intrebat.length, 0);
}
{
  const c = pornire(LOT, { mansa: 2 });
  c.camp.value = "gata tragerea";
  vm.runInContext("treceTragerea()", c);
  t("un text fără standuri nu cere confirmare", c.intrebat.length, 0);
  t("…și spune că n-are ce muta", c.toasturi[0], "Niciun stand de mutat");
}
{
  const c = pornire(LOT, { mansa: 2 });
  c.camp.value = "12 Gigel Necunoscutu";
  vm.runInContext("treceTragerea()", c);
  t("un nume negăsit singur pe listă nu mută pe nimeni",
    c.state.participants.every(p => p.m[2].stand === ""), true);
}

console.log("\n=== 10. Ce scrie pe ecran la „Verifică\" ===");
{
  const c = pornire(LOT, { mansa: 2 });
  c.camp.value = "12 Mihai Ionescu\n12 Vasile Popescu\n13 Gigel Necunoscutu";
  vm.runInContext("verificaTragerea()", c);
  const h = c.preview.innerHTML;
  t("spune câți se mută", h.indexOf("1</b> pescar se mută") >= 0, true);
  t("spune că unul e dublu", h.indexOf("apar de două ori") >= 0, true);
  t("spune că unul e necunoscut", h.indexOf("nu știu cine sunt") >= 0, true);
  t("spune și cine rămâne fără stand", h.indexOf("nu apar în listă") >= 0, true);
  t("arată numele pescarului mutat", h.indexOf("Mihai Ionescu") >= 0, true);
  t("nimic nu s-a mutat doar din „Verifică\"",
    c.state.participants[0].m[2].stand, "");
}

/* ================================================================
   10b. Foaia aduce și oamenii, la primul concurs
   ================================================================ */
console.log("\n=== 10b. Când nu e nimeni de mutat, foaia îi poate aduce ===");
{
  /* Prima dată a ieșit „15 nu știu cine sunt": foaia citită bine, dar concursul gol.
     Tragerea mută, nu adaugă — așa trebuie, ca o listă lipită de două ori să nu dubleze
     concursul. Dar la primul concurs foaia E lista de participanți. */
  const c = pornire([], { mansa: 1 });
  c.camp.value = "A 2 NICU ROMAN\nA 3 CIPRIAN IACOB\nB 8 COSTEL TATIANA";
  vm.runInContext("verificaTragerea()", c);

  t("previzualizarea spune că nu-i știe", /3<\/b> nu știu cine sunt/.test(c.preview.innerHTML), true);
  t("…și oferă butonul de adăugare", /adaugaDinTragere\(\)/.test(c.preview.innerHTML), true);
  t("butonul spune pe câți îi adaugă", /pe cei 3 în concurs/.test(c.preview.innerHTML), true);

  vm.runInContext("adaugaDinTragere()", c);
  t("s-a cerut confirmarea", c.intrebat.length, 1);
  t("s-a pus o copie deoparte înainte", c.copii.length, 1);
  t("cei 3 au intrat în concurs", c.state.participants.length, 3);

  const p = c.state.participants;
  t("numele s-a împărțit în prenume și nume",
    [p[0].prenume, p[0].nume], ["NICU", "ROMAN"]);
  t("standul de pe foaie e al manșei", p[0].m[1].stand, "2");
  t("sectorul de pe foaie e păstrat, nu socotit din stand",
    [p[0].m[1].sector, p[2].m[1].sector], ["A", "B"]);
  t("jurnalul ține minte de unde au venit", c.state.jurnal[0].cine, "tragerea de pe WhatsApp");

  /* După adăugare sunt găsiți, deci butonul dispare de la sine. */
  vm.runInContext("verificaTragerea()", c);
  t("butonul nu mai apare după ce au intrat",
    /adaugaDinTragere\(\)/.test(c.preview.innerHTML), false);
  t("…iar acum se văd ca mutați", /3<\/b> pescari se mută/.test(c.preview.innerHTML), true);
}
{
  /* Cel ambiguu nu se adaugă: încă un Popa n-ar lămuri nimic. */
  const c = pornire([
    { stand: "1", prenume: "Ion", nume: "Popa", sector: "A" },
    { stand: "2", prenume: "Vasile", nume: "Popa", sector: "A" }
  ], { mansa: 1 });
  c.camp.value = "A 3 Popa\nA 4 NICU ROMAN";
  vm.runInContext("adaugaDinTragere()", c);
  t("doar cel negăsit a intrat, nu și ambiguul", c.state.participants.length, 3);
  t("…iar cel intrat e cel cu numele limpede",
    c.state.participants[2].nume, "ROMAN");
}
{
  const c = pornire([], { mansa: 1, confirma: false });
  c.camp.value = "A 2 NICU ROMAN";
  vm.runInContext("adaugaDinTragere()", c);
  t("dacă răspunzi „nu\", nu intră nimeni", c.state.participants.length, 0);
}
{
  const c = pornire([], { mansa: 1, blocat: true });
  c.camp.value = "A 2 NICU ROMAN";
  vm.runInContext("verificaTragerea()", c);
  t("cu concursul blocat butonul nici nu apare",
    /adaugaDinTragere\(\)/.test(c.preview.innerHTML), false);
  vm.runInContext("adaugaDinTragere()", c);
  t("…iar dacă tot se cheamă, nu adaugă nimic", c.state.participants.length, 0);
}
{
  /* O literă care nu e sector al concursului NU e luată drept sector — paza asta e mai
     de preț decât un sector nou: fără ea, „Ionescu M" și-ar pierde inițiala și pescarul
     n-ar mai fi găsit. Omul intră oricum, cu sectorul socotit din stand. */
  const c = pornire([], { mansa: 1, sectors: ["A", "B"] });
  c.camp.value = "A 2 NICU ROMAN\nE 30 CINEVA NOU";
  vm.runInContext("adaugaDinTragere()", c);
  t("amândoi au intrat în concurs", c.state.participants.length, 2);
  t("cel cu sector cunoscut îl păstrează", c.state.participants[0].m[1].sector, "A");
  t("cel cu literă necunoscută primește sectorul din stand",
    c.state.participants[1].m[1].sector, "B");
  t("iar lista de sectoare a rămas neatinsă", c.state.sectors, ["A", "B"]);
}

/* ================================================================
   11. Weekendul întreg: 44 de pescari, două trageri
   ================================================================ */
console.log("\n=== 11. Un weekend întreg, 44 de pescari ===");
{
  const lot = [];
  for (let i = 1; i <= 44; i++) {
    lot.push({ stand: String(i), prenume: "Pescar", nume: "Nr" + i, sector: ["A","B","C","D"][Math.floor((i-1)/11)] });
  }
  const c = pornire(lot, { mansa: 2 });

  // tragerea de duminică: fiecare pe alt stand
  const nou = i => ((i * 7) % 44) + 1;
  c.camp.value = lot.map((x, i) => nou(i) + " " + x.prenume + " " + x.nume).join("\n");
  vm.runInContext("treceTragerea()", c);

  t("toți cei 44 au primit stand în manșa 2",
    c.state.participants.filter(p => p.m[2].stand).length, 44);
  t("niciun stand dat de două ori",
    new Set(c.state.participants.map(p => p.m[2].stand)).size, 44);
  t("standurile de sâmbătă au rămas ale lor",
    c.state.participants.map(p => p.m[1].stand).join(","),
    lot.map(x => x.stand).join(","));

  const peSector = {};
  c.state.participants.forEach(p => { peSector[p.m[2].sector] = (peSector[p.m[2].sector] || 0) + 1; });
  t("sectoarele au ieșit tot 11 de fiecare",
    [peSector.A, peSector.B, peSector.C, peSector.D], [11, 11, 11, 11]);
  t("jurnalul are toate cele 44 de mutări", c.state.jurnal.length, 44);
  t("nu s-a adăugat niciun pescar", c.state.participants.length, 44);
}

/* ================================================================
   12. Lista lipită de două ori nu strică nimic
   ================================================================ */
console.log("\n=== 12. Lipită de două ori ===");
{
  const c = pornire(LOT, { mansa: 2 });
  const lista = "12 Mihai Ionescu\n23 Vasile Popescu";
  c.camp.value = lista;
  vm.runInContext("treceTragerea()", c);
  c.camp.value = lista;
  vm.runInContext("treceTragerea()", c);

  t("tot 6 pescari, nu 8", c.state.participants.length, 6);
  t("standurile sunt aceleași", c.state.participants[0].m[2].stand, "12");
  t("jurnalul arată că s-a trecut de două ori", c.state.jurnal.length, 4);
}

/* ================================================================
   13. Cât de mare pleacă poza foii
   ================================================================ */
console.log("\n=== 13. Poza foii pleacă mai mare decât cea a cântarului ===");
{
  /* Foaia strânsă la 1000 de puncte a pierdut o bandă din mijloc (standurile 31…55):
     modelul a citit capetele și a sărit restul. Aici se verifică treptele. */
  const trepteSrc = src.match(/var TREPTE_FOAIE\s*=\s*\[[^;]*\];/);
  const ctx = {
    console, Math, Promise,
    cerute: [],
    lungimeIntoarsa: 100,
    URL: { createObjectURL() { return "blob:x"; }, revokeObjectURL() {} },
    Image: function () {
      const self = this;
      self.naturalWidth = 4000; self.naturalHeight = 3000;
      Object.defineProperty(self, "src", { set() { setTimeout(() => self.onload(), 0); } });
    },
    document: {
      createElement() {
        return {
          width: 0, height: 0,
          getContext() { return { drawImage() {} }; },
          toDataURL(tip, calitate) {
            ctx.cerute.push({ w: this.width, calitate });
            return "data:image/jpeg;base64," + "x".repeat(ctx.lungimeIntoarsa);
          }
        };
      }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(H.grabFunction(src, "pozaMicsorata"), ctx);
  vm.runInContext(trepteSrc[0], ctx);
  vm.runInContext(H.grabFunction(src, "pozaFoiiMicsorata"), ctx);

  t("treptele foii pornesc de la 1800 de puncte",
    vm.runInContext("TREPTE_FOAIE[0]", ctx), [1800, 0.82]);
  t("…și coboară până la 1000, cât e cântarul",
    vm.runInContext("TREPTE_FOAIE[TREPTE_FOAIE.length-1][0]", ctx), 1000);

  const asteapta = cod => new Promise(res => {
    ctx.gata = res;
    vm.runInContext(cod + ".then(function(d){ gata(d ? d.length : null); })", ctx);
    setTimeout(() => {}, 0);
  });

  (async () => {
    ctx.cerute = []; ctx.lungimeIntoarsa = 100;
    await asteapta("pozaMicsorata({})");
    t("cântarul rămâne la 1000 de puncte și calitate 0,75",
      ctx.cerute.map(x => [x.w, x.calitate]), [[1000, 0.75]]);

    ctx.cerute = []; ctx.lungimeIntoarsa = 100;
    await asteapta("pozaFoiiMicsorata({})");
    t("foaia pleacă de la 1800, dintr-o singură încercare",
      ctx.cerute.map(x => x.w), [1800]);

    /* Serverul refuză peste 1,4 milioane de semne: dacă poza mare iese prea grea,
       se încearcă mai mic în loc să se întoarcă degeaba cu „poza prea mare". */
    ctx.cerute = []; ctx.lungimeIntoarsa = 1400000;
    await asteapta("pozaFoiiMicsorata({})");
    t("dacă iese prea grea, coboară treaptă cu treaptă",
      ctx.cerute.map(x => x.w), [1800, 1400, 1000]);
    t("…dar nu la nesfârșit: se oprește la ultima treaptă",
      ctx.cerute.length, 3);

    await test14();
    t.raport();
  })();
}

/* ================================================================
   14. Foaia citită pe bucăți
   ================================================================ */
async function test14() {
  console.log("\n=== 14. Foaia lungă se citește în două bucăți ===");

  /* Foaia întreagă, dintr-o privire, a sărit de la standul 31 la 55. Două priviri scurte
     au fiecare mai puține rânduri de ținut minte și de două ori mai multe puncte pe rând. */
  function ctxFoaie(optiuni) {
    const o = optiuni || {};
    const el = { innerHTML: "", value: "" };
    const ctx = {
      console, Math, Promise, JSON, parseInt, String, Array, setTimeout,
      taieturi: [], cereri: 0, toasturi: [], verificat: 0,
      syncKey: o.cheie === undefined ? "cheia" : o.cheie,
      API_BASE: "https://api.test",
      raspunsuri: (o.raspunsuri || []).slice(),
      URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
      Image: function () {
        const self = this;
        self.naturalWidth = 2400; self.naturalHeight = 3200;
        Object.defineProperty(self, "src", { set() { setTimeout(() => self.onload(), 0); } });
      },
      document: {
        getElementById: () => el,
        createElement() {
          return {
            width: 0, height: 0,
            getContext() {
              const c = this;
              return { drawImage(img, sx, sy, sw, sh) { ctx.taieturi.push({ sy, sh, w: c.width, h: c.height }); } };
            },
            toDataURL() { return "data:image/jpeg;base64,AAA"; }
          };
        }
      },
      fetch() {
        ctx.cereri++;
        const r = ctx.raspunsuri.shift() || { ok: false };
        return Promise.resolve({ json: () => Promise.resolve(r) });
      },
      toast(m) { ctx.toasturi.push(m); },
      verificaTragerea() { ctx.verificat++; }
    };
    ctx.el = el;
    ctx.state = { participants: new Array(o.pescari === undefined ? 44 : o.pescari).fill(0).map((_, i) => ({ id: "p" + i })) };
    vm.createContext(ctx);
    ["pozaMicsorata", "pozaFoiiMicsorata", "pozaBucata", "bucataMicsorata", "trimiteFoaia",
     "lipesteRanduri", "cateRanduriAsteptam", "tragereaDinPozaPeBucati", "tragereaDinPoza",
     "pozaTragerii"].forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
    vm.runInContext(src.match(/var TREPTE_FOAIE\s*=\s*\[[^;]*\];/)[0], ctx);
    vm.runInContext(src.match(/var SUPRAPUNERE\s*=\s*[\d.]+;/)[0], ctx);
    return ctx;
  }

  const ruleaza = ctx => new Promise(res => {
    ctx.gata = res;
    const vechi = ctx.toast;
    ctx.toast = m => { vechi(m); setTimeout(() => ctx.gata(), 0); };
    vm.runInContext("pozaTragerii({files:[{}]})", ctx);
    setTimeout(() => res(), 300);
  });

  const rand = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push({ stand: String(i), nume: "Pescar" + i }); return o; };

  /* citire întreagă, cât trebuie: nu se mai citește a doua oară */
  {
    const c = ctxFoaie({ pescari: 10, raspunsuri: [{ ok: true, randuri: rand(1, 10) }] });
    await ruleaza(c);
    t("o citire întreagă nu mai cere a doua", c.cereri, 1);
    t("lista ajunge în căsuță", c.el.value.split("\n").length, 10);
    t("s-a verificat singură", c.verificat, 1);
  }

  /* citire ciuntită: se reia pe bucăți și se lipesc */
  {
    const c = ctxFoaie({
      pescari: 44,
      raspunsuri: [
        { ok: true, randuri: rand(1, 31).concat(rand(55, 55)) },  // ce a pățit pe foaia adevărată
        { ok: true, randuri: rand(1, 28) },                        // jumătatea de sus
        { ok: true, randuri: rand(25, 55) }                        // jumătatea de jos
      ]
    });
    await ruleaza(c);
    t("citirea ciuntită duce la încă două citiri", c.cereri, 3);

    const standuri = c.el.value.split("\n").map(l => parseInt(l, 10));
    t("banda pierdută (31…55) a fost recuperată", standuri.length, 55);
    t("standurile ies în ordine, de la 1 la 55", [standuri[0], standuri[54]], [1, 55]);
    t("niciun stand nu apare de două ori", new Set(standuri).size, 55);
  }

  /* sectorul citit de pe foaie ajunge în căsuță, în fața standului */
  {
    const c = ctxFoaie({
      pescari: 3,
      raspunsuri: [{ ok: true, randuri: [
        { sector: "A", stand: "2", nume: "NICU ROMAN" },
        { sector: "B", stand: "8", nume: "COSTEL TATIANA" },
        { stand: "14", nume: "PETRISOR VULPE" }
      ] }]
    });
    await ruleaza(c);
    const linii = c.el.value.split("\n");
    t("sectorul se scrie în față, ca pe foaie", linii[0], "A 2 NICU ROMAN");
    t("…și pe rândul următor", linii[1], "B 8 COSTEL TATIANA");
    t("un rând fără sector rămâne doar cu standul", linii[2], "14 PETRISOR VULPE");
  }

  /* tăieturile chiar se suprapun, ca rândul de la mijloc să nu cadă între ele */
  {
    const c = ctxFoaie({
      pescari: 44,
      raspunsuri: [{ ok: true, randuri: rand(1, 5) }, { ok: true, randuri: rand(1, 3) }, { ok: true, randuri: rand(3, 8) }]
    });
    await ruleaza(c);
    const bucati = c.taieturi.slice(1);   // prima tăietură e foaia întreagă
    t("s-au tăiat două bucăți", bucati.length, 2);
    t("prima pornește de sus", bucati[0].sy, 0);
    t("a doua se termină jos", bucati[1].sy + bucati[1].sh, 3200);
    t("bucățile se suprapun, nu se ating doar",
      bucati[0].sy + bucati[0].sh > bucati[1].sy, true);
  }

  /* fără cheie nu se încearcă de două ori degeaba */
  {
    const c = ctxFoaie({ cheie: "", pescari: 44 });
    await ruleaza(c);
    t("fără cheie nu se trimite nimic", c.cereri, 0);
    t("…și se spune o singură dată ce lipsește",
      /cheia de scriere/i.test(c.el.innerHTML), true);
  }

  /* tot ciuntită după bucăți: se spune cifra, nu se pretinde că foaia a intrat întreagă */
  {
    const c = ctxFoaie({
      pescari: 44,
      raspunsuri: [{ ok: true, randuri: rand(1, 20) }, { ok: true, randuri: rand(1, 20) }, { ok: true, randuri: rand(1, 20) }]
    });
    await ruleaza(c);
    t("spune câte a citit din câte", /Am citit 20 din 44/.test(c.toasturi.join(" ")), true);
  }
}
