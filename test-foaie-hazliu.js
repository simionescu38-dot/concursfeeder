/**
 * Foaia cu trei coloane de cifre.
 *
 * „Antrenamentul lu' Hazliu", 4 septembrie 2026, Balta din Oraș. A fotografiat foaia,
 * aplicația n-a scos nimic din ea, și le-a trecut pe toate 24 de mână.
 *
 * De ce n-a mers: întrebarea pusă modelului descria ALTĂ foaie — cea de la Rediu, unde
 * prima coloană are litera sectorului lipită de numărul standului („A 2"). Foaia asta
 * n-are sectoare deloc. Are, în schimb, TREI coloane cu cifre:
 *
 *     Nr. crt. | Nume concurent | (250 = taxa) | Ordine | Stand | CMMC | Cantitate
 *        1     | Muscalu Andrei |     250      |   18   |  13   |  ✓   |    ✓
 *
 * „Ordine" și „Stand" sunt AMÂNDOUĂ permutări ale lui 1…24. Nicio socoteală nu le
 * deosebește — nici aici, nici în aplicație. Singurul lucru care spune care e care e
 * scrisul din capul coloanei. De-aia întrebarea nouă pornește de la capul de tabel.
 *
 * Ce se verifică aici:
 *  1. întrebarea de pe server numește coloana „Stand" și fiecare capcană pe nume;
 *  2. întrebarea veche, cu sector, n-a fost pierdută — foaia de la Rediu merge mai departe;
 *  3. răspunsul modelului, trecut prin randuriDinText-ul ADEVĂRAT din worker;
 *  4. tot drumul prin aplicație: cele 24 de rânduri ajung fiecare pe omul lui.
 *
 * Codul e scos VERBATIM din index.html și worker/index.js.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const wkSrc = H.citeste("worker/index.js");
const t = H.creeazaVerificator();

/* ================================================================
   Foaia adevărată, citită de pe poză.
   Standurile sunt coloana care contează. „Ordine" e pusă aici ca să se vadă negru pe
   alb că e la fel de verosimilă — de-aia nu se poate ghici, ci trebuie citit capul.
   ================================================================ */
const FOAIA = [
  { nr:  1, nume: "Muscalu Andrei",          ordine: 18, stand: 13 },
  { nr:  2, nume: "Pescaru Hazliu",          ordine: 16, stand:  1 },
  { nr:  3, nume: "Darie Vasile",            ordine: 12, stand: 18 },
  { nr:  4, nume: "Daniel Puschiu",          ordine: 11, stand:  6 },
  { nr:  5, nume: "Ilie Daniel",             ordine: 20, stand:  5 },
  { nr:  6, nume: "Ciufy Man",               ordine: 14, stand:  9 },
  { nr:  7, nume: "Gemanar Bogdan Halandu",  ordine:  3, stand: 21 },
  { nr:  8, nume: "Iacob Ciprian",           ordine:  4, stand: 12 },
  { nr:  9, nume: "Dragoș Gido",             ordine:  9, stand:  7 },
  { nr: 10, nume: "Cristian Epure",          ordine:  5, stand: 22 },
  { nr: 11, nume: "Cătălin Pavel",           ordine: 22, stand:  3 },
  { nr: 12, nume: "Nicu Roman",              ordine: 24, stand: 14 },
  { nr: 13, nume: "Lucăcel Vlad",            ordine:  8, stand: 19 },
  { nr: 14, nume: "Lucăcel Eduard",          ordine: 21, stand: 11 },
  { nr: 15, nume: "Gabriel Melinte",         ordine:  2, stand: 15 },
  { nr: 16, nume: "Săndel Hirtopeanu",       ordine: 19, stand:  4 },
  { nr: 17, nume: "Florin Dospinescu",       ordine:  6, stand:  8 },
  { nr: 18, nume: "Alexandru Damian",        ordine: 15, stand: 17 },
  { nr: 19, nume: "Blanariu Bogdan",         ordine:  1, stand:  2 },
  { nr: 20, nume: "Ștefan Cantemir",         ordine: 13, stand: 24 },
  { nr: 21, nume: "Horodinca Matei",         ordine:  7, stand: 20 },
  { nr: 22, nume: "Ștefan Streangă",         ordine: 17, stand: 16 },
  { nr: 23, nume: "David Nepotu",            ordine: 10, stand: 10 },
  { nr: 24, nume: "Cozorici Ovidiu",         ordine: 23, stand: 23 }
];

const permutare = v => {
  const s = v.slice().sort((a, b) => a - b);
  return s.length === 24 && s.every((x, i) => x === i + 1);
};

/* ================================================================
   1. Întrebarea pusă modelului
   ================================================================ */
console.log("\n=== 1. Întrebarea de pe server ===");
{
  /* Worker-ul are DOUĂ întrebări: una pentru afișajul cântarului, alta pentru foaie.
     Se pornește de la drumul foii, altfel testul cade pe cea a cântarului. */
  const drum = wkSrc.indexOf('url.pathname === "/api/citeste-tragerea"');
  if (drum < 0) { console.log("  ❌ nu găsesc drumul /api/citeste-tragerea"); process.exit(1); }
  const i = wkSrc.indexOf("const INTREBARE =", drum);
  if (i < 0) { console.log("  ❌ nu găsesc INTREBARE pe drumul foii"); process.exit(1); }

  /* Întrebarea se RULEAZĂ, nu se caută cu regex prin sursă. E singura cale de a ști ce
     primește modelul: un ghilimet neescapat în mijlocul unui șir lasă fișierul să treacă
     de `node --check`, dar leagă bucățile altfel decât scrie pe ecran — și întrebarea
     ajunge la model ciuntită, fără ca nimic să pârască. */
  const sfarsit = wkSrc.indexOf("\n", wkSrc.indexOf("COSTEL TATIANA", i));
  const w1 = { console };
  vm.createContext(w1);
  let q = "";
  try {
    vm.runInContext(wkSrc.slice(i, sfarsit) + "\nglobalThis.OUT = INTREBARE;", w1);
    q = w1.OUT;
  } catch (e) {
    console.log("  ❌ întrebarea nu se leagă: " + e.message); process.exit(1);
  }
  t("întrebarea chiar se leagă într-un șir", typeof q === "string" && q.length > 800, true);
  t("întrebarea foii e alta decât a cântarului", /cântar/.test(q), false);

  t("pornește de la capul de tabel", /capul de tabel/.test(q), true);
  t("caută coloana scrisă „Stand”", /„Stand”/.test(q), true);
  /* fiecare capcană numită pe nume: modelul nu poate să le ocolească pe cele pe care
     nu i le-am arătat */
  t("spune că „Nr. crt.” nu e standul", /„Nr\. crt\.”[^\n]{0,160}NU e standul/.test(q), true);
  t("spune că „Ordine” nu e standul", /„Ordine”[^\n]{0,200}NU e standul/.test(q), true);
  t("spune că taxa de 250 nu e standul", /„250”[^\n]{0,90}NU e standul/.test(q), true);
  t("spune că hotărăște capul, nu poziția coloanei", /nu poziția coloanei/.test(q), true);
  t("cere numele din coloana „Nume concurent”", /„Nume concurent”/.test(q), true);
  t("cere cuvintele în ordinea de pe foaie", /nu le muta între ele/.test(q), true);

  console.log("\n=== 1b. Foaia veche, cu sector, n-a fost pierdută ===");
  t("mai descrie coloana „A 2”", /„A 2”/.test(q), true);
  t("…și numele pe două rânduri", /pe un rând sau pe două/.test(q), true);
  t("…și grila goală de cantități", /grila goală de cantități/.test(q), true);
  /* pildele de răspuns trebuie să fie JSON ADEVĂRAT, altfel modelul învață din ele o
     formă stricată */
  const pilde = q.match(/\{"randuri":[\s\S]*?\}\]\}/g) || [];
  t("sunt două pilde de răspuns", pilde.length, 2);
  t("amândouă sunt JSON bun", pilde.every(p => { try { JSON.parse(p); return true; } catch (e) { return false; } }), true);
  t("prima, foaia lui: stand și nume, fără sector",
    JSON.parse(pilde[0]).randuri[0], { stand: "13", nume: "Muscalu Andrei" });
  t("a doua, foaia veche: cu sector",
    JSON.parse(pilde[1]).randuri[0], { sector: "A", stand: "2", nume: "NICU ROMAN" });
  t("spune limpede că sectorul e numai când e scris pe foaie",
    /sector se pune NUMAI dacă/.test(q), true);
}

/* ================================================================
   2. Răspunsul modelului, prin parserul adevărat din worker
   ================================================================ */
console.log("\n=== 2. Răspunsul, prin randuriDinText din worker ===");
{
  const w = { console, JSON };
  vm.createContext(w);
  vm.runInContext(H.grabFunction(wkSrc, "randuriDinText"), w);
  const prin = text => vm.runInContext("randuriDinText(" + JSON.stringify(text) + ")", w);

  /* aşa arată răspunsul bun: standul din coloana „Stand", fără sector */
  const bun = JSON.stringify({ randuri: FOAIA.map(x => ({ stand: String(x.stand), nume: x.nume })) });
  const r = prin(bun);
  t("intră toate cele 24 de rânduri", r.length, 24);
  t("foaia fără sectoare nu pierde niciun rând pe lipsa lor",
    r.every(x => x.sector === undefined), true);
  t("standurile ajung întregi", r.map(x => Number(x.stand)), FOAIA.map(x => x.stand));
  t("numele ajung întregi", r.map(x => x.nume), FOAIA.map(x => x.nume));
  t("diacriticele trec nevătămate", r[8].nume, "Dragoș Gido");

  /* modelul mai vorbește pe lângă JSON; parserul scoate acolada dintre vorbe */
  t("JSON-ul se scoate și dintre vorbe",
    prin("Sigur, iată tabelul:\n```json\n" + bun + "\n```\nSper că ajută.").length, 24);

  /* foaia veche, cu sector, prin acelaşi parser */
  const cuSector = prin(JSON.stringify({ randuri: [
    { sector: "A", stand: "2", nume: "NICU ROMAN" },
    { sector: "B", stand: "8", nume: "COSTEL TATIANA" }] }));
  t("foaia cu sector merge mai departe", cuSector, [
    { stand: "2", nume: "NICU ROMAN", sector: "A" },
    { stand: "8", nume: "COSTEL TATIANA", sector: "B" }]);

  console.log("\n=== 2b. Ce refuză parserul ===");
  t("rând fără nume: sărit", prin(JSON.stringify({ randuri: [{ stand: "5", nume: "" }] })).length, 0);
  t("rând fără stand: sărit", prin(JSON.stringify({ randuri: [{ nume: "Ion Popa" }] })).length, 0);
  t("stand 0 nu există pe baltă", prin(JSON.stringify({ randuri: [{ stand: "0", nume: "Ion Popa" }] })).length, 0);
  /* modelul alunecă uneori pe rânduri și dă același stand de două ori; rămâne primul */
  t("același stand de două ori: rămâne primul",
    prin(JSON.stringify({ randuri: [{ stand: "5", nume: "Ion Popa" }, { stand: "5", nume: "Vasile Ene" }] }))
      .map(x => x.nume), ["Ion Popa"]);
}

/* ================================================================
   3. De ce hotărăşte capul de tabel şi nu socoteala
   ================================================================ */
console.log("\n=== 3. Cele două coloane sunt la fel de verosimile ===");
{
  t("standurile sunt o permutare a lui 1…24", permutare(FOAIA.map(x => x.stand)), true);
  t("ordinea tragerii, la fel", permutare(FOAIA.map(x => x.ordine)), true);
  t("…și nu sunt aceeași coloană", FOAIA.some(x => x.ordine !== x.stand), true);
  /* „Nr. crt." se poate deosebi — e 1, 2, 3… la rând — dar celelalte două, nu.
     De-aia întrebarea trebuie să citească scrisul din capul coloanei. */
  t('„Nr. crt." se cunoaște după mers, fiind 1,2,3… la rând',
    FOAIA.every((x, i) => x.nr === i + 1), true);
}

/* ================================================================
   4. Drumul prin aplicație: rândurile citite ajung pe oamenii lor
   ================================================================ */
console.log("\n=== 4. Cele 24 de rânduri, prin aplicație ===");
{
  const FUNCTII = ["uid", "faraSemne", "nameOf", "splitName", "cheiePescar", "numePescar",
    "citesteTragerea", "pescarulTragerii", "randuriTragerii", "ordineaTragerii",
    "pescarDupaCod", "participantDupaCod"];

  const ctx = { console, JSON, Date, Math, parseInt, parseFloat, isNaN, pescari: [] };
  ctx.state = {
    name: "Antrenamentul lu' Hazliu", manche: 1, numManse: 1,
    sectors: [], numStanduri: "24",
    /* lista de concurenți, aşa cum a intrat în aplicație înainte de tragere */
    participants: FOAIA.map((x, i) => {
      const sp = x.nume.indexOf(" ");
      return { id: "p" + i, prenume: x.nume.slice(0, sp), nume: x.nume.slice(sp + 1),
               stand: "", sector: "" };
    })
  };
  vm.createContext(ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));

  /* exact ce scrie aplicația în căsuța de text după citirea pozei:
     „13 Muscalu Andrei", fără sector, fiindcă foaia n-are */
  const text = FOAIA.map(x => x.stand + " " + x.nume).join("\n");
  const r = vm.runInContext(
    "randuriTragerii(" + JSON.stringify(text) + ").map(function(x){" +
    "return {stand:x.stand, cine:x.p?nameOf(x.p):null, cum:x.cum," +
    " standDublu:x.standDublu, omDublu:x.omDublu};})", ctx);

  t("toate cele 24 de rânduri sunt înțelese", r.length, 24);
  t("fiecare rând a găsit omul lui", r.filter(x => !x.cine).length, 0);
  t("fiecare om a căpătat standul de pe foaie",
    r.map(x => x.cine + "=" + x.stand),
    FOAIA.map(x => x.nume + "=" + String(x.stand)));
  t("niciun stand dat de două ori", r.filter(x => x.standDublu).length, 0);
  t("niciun om trecut de două ori", r.filter(x => x.omDublu).length, 0);
  t("nimeni nu rămâne fără stand",
    vm.runInContext("randuriTragerii(" + JSON.stringify(text) + ").faraStand.length", ctx), 0);

  console.log("\n=== 4b. Taxa de 250, dacă scapă în text ===");
  /* Dacă modelul apucă totuși să scrie și taxa, rândul devine „13 250 Muscalu Andrei".
     Aplicația are de mult grijă de al doilea număr: îl ia drept cod, nu drept nume. */
  const cuTaxa = vm.runInContext(
    "citesteTragerea(\"13 250 Muscalu Andrei\")[0]", ctx);
  t("standul rămâne standul", cuTaxa.stand, "13");
  t("taxa nu se lipește de nume", cuTaxa.nume, "Muscalu Andrei");

  console.log("\n=== 4c. Numele scris invers rămâne al lui ===");
  /* Pe foaie unii sunt scriși „Muscalu Andrei", alții „Daniel Puschiu". Nu contează:
     căutarea la tragere se uită și întors, și pe cuvinte. */
  const invers = vm.runInContext(
    "(function(){var g=pescarulTragerii(\"Andrei Muscalu\"); return g.p?nameOf(g.p):null;})()", ctx);
  t('„Andrei Muscalu" duce la „Muscalu Andrei"', invers, "Muscalu Andrei");
}

t.raport();
