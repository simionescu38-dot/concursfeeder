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
  "intervaleleTragerii", "verificaTragerea", "treceTragerea"];

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
    puneDeoParte(motiv) { ctx.copii.push(motiv); }
  };
  ctx.camp = camp; ctx.preview = preview;
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

    t.raport();
  })();
}
