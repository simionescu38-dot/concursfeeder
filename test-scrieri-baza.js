/**
 * Scrierile vechi ale numelor, purtate de omul din bază.
 *
 * Cele 6 concursuri arhivate nu se mai pot atinge: serverul știe doar să creeze și să
 * șteargă o arhivă, iar arhivele nu se șterg. Deci codul nu se scrie ÎN ele — se AFLĂ
 * din bază. Pentru asta, un om din bază trebuie să-și poarte toate felurile în care i
 * s-a scris numele pe foile vechi: „Ciufi Man" și „Ciufy Man" duc la Dragoș Carâmb,
 * adică la codul lui.
 *
 * Lucrul de care atârnă tot: cunoștința asta pleacă din fișierul scris de mână din
 * depozit (arhiva/acelasi-om.json) și se așază pe OM, în bază — de unde se poate drege
 * de pe telefon, fără să umble nimeni prin depozit.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = ["uid", "esc", "faraSemne", "nameOf", "splitName", "numePescar",
  "cheiePescar", "scrierileLui", "pescarCauta", "tineMinteScrierea",
  "pescarCodNou", "pescarNou", "pescariSalveaza", "pescariIncarca",
  "numeleDinSezon", "cheiaSezon", "pescariDinArhive",
  "codParticipant", "potrivesteCodurile"];

/** o lume cu bază, cu fișierul scris de mână și cu un concurs pe telefon */
function lume(optiuni) {
  const o = optiuni || {};
  const memorie = Object.assign({}, o.memorie || {});
  const elemente = {};
  const ctx = {
    console, JSON, Date, Math, parseInt, isNaN, Array, String, Object, Promise,
    blocat: !!o.blocat, toasturi: [], desenat: 0,
    guard() { return ctx.blocat; },
    toast(m) { ctx.toasturi.push(m); },
    renderPescari() { ctx.desenat++; },
    localStorage: {
      getItem: k => (k in memorie ? memorie[k] : null),
      setItem: (k, v) => { memorie[k] = v; }
    },
    memorie,
    document: { getElementById: id => (elemente[id] = elemente[id] || { textContent: "", innerHTML: "", style: {} }) },
    __el: elemente,
    state: { participants: (o.concurs || []).map((x, i) => {
      const nm = typeof x === "string" ? x : x.nume;
      const sp = nm.indexOf(" ");
      return { id: "c" + i, cod: (typeof x === "string" ? "" : x.cod) || "",
               prenume: sp < 0 ? nm : nm.slice(0, sp), nume: sp < 0 ? "" : nm.slice(sp + 1) };
    }) },
    fetch() {
      if (o.fisierCade) return Promise.reject(new Error("fără net"));
      return Promise.resolve({ json: () => Promise.resolve({ acelasi: o.acelasi || [] }) });
    }
  };
  vm.createContext(ctx);
  vm.runInContext('var PESCARI_KEY="concurs-pescari-v1"; var pescari=[]; var pescariUltimCod=0;' +
                  " var acelasiOm=null; var sezonGasit=null;", ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  vm.runInContext(H.grabFunction(src, "incarcaAcelasiOm"), ctx);
  /* baza: nume simple, sau {nume, scrieri} */
  (o.baza || []).forEach(x => {
    const nm = typeof x === "string" ? x : x.nume;
    const b = vm.runInContext("splitName(" + JSON.stringify(nm) + ")", ctx);
    vm.runInContext("pescari.push(pescarNou(" + JSON.stringify(b.prenume) + "," +
                    JSON.stringify(b.nume) + "))", ctx);
    if (typeof x !== "string" && x.scrieri) {
      vm.runInContext("pescari[pescari.length-1].scrieri=" + JSON.stringify(x.scrieri), ctx);
    }
  });
  return ctx;
}

/** o arhivă cu numele date, în forma în care vine de pe server */
const arhiva = (nume) => ({ data: { participants: nume.map((n, i) => {
  const sp = n.indexOf(" ");
  return { id: "a" + i, prenume: sp < 0 ? n : n.slice(0, sp), nume: sp < 0 ? "" : n.slice(sp + 1) };
}) } });

const scrierile = (ctx, cod) => vm.runInContext(
  "(pescari.filter(function(p){return p.cod===" + cod + ";})[0]||{}).scrieri||[]", ctx);
const gaseste = (ctx, nume) => vm.runInContext(
  "(function(){var b=splitName(" + JSON.stringify(nume) + ");" +
  "var p=pescarCauta(b.prenume,b.nume); return p?p.cod:null;})()", ctx);
/** lasă promisiunile din cod să se scurgă */
const linisteste = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

(async () => {

/* ================================================================
   1. Toate felurile în care i se scrie numele unui om
   ================================================================ */
console.log("\n=== 1. Scrierile unui om ===");
{
  const c = lume({ baza: [{ nume: "Dragoș Carâmb", scrieri: ["Ciufi Man", "Ciufy Man"] }] });
  t("numele de acum e mereu printre ele",
    vm.runInContext("scrierileLui(pescari[0])", c),
    ["dragos caramb", "ciufi man", "ciufy man"]);
  t("scrierile se pliază la fel ca numele",
    vm.runInContext("scrierileLui({prenume:'Ion',nume:'Popa',scrieri:['  IOAN   POPĂ ']})", c),
    ["ion popa", "ioan popa"]);
  t("aceeași scriere de două ori nu se numără de două ori",
    vm.runInContext("scrierileLui({prenume:'Ion',nume:'Popa',scrieri:['Ioan Popa','IOAN POPĂ']})", c),
    ["ion popa", "ioan popa"]);
  t("un om fără scrieri are doar numele lui",
    vm.runInContext("scrierileLui({prenume:'Ion',nume:'Popa'})", c), ["ion popa"]);
  t("scrierea goală nu intră",
    vm.runInContext("scrierileLui({prenume:'Ion',nume:'Popa',scrieri:['','  ']})", c), ["ion popa"]);
}

/* ================================================================
   2. Căutarea în bază merge după oricare dintre scrieri
   ------------------------------------------------------------------
   Asta e tot rostul: rândul din foaia veche scrie „Ciufi Man", iar aplicația trebuie
   să iasă cu codul lui Dragoș Carâmb.
   ================================================================ */
console.log("\n=== 2. Se găsește după oricare scriere ===");
{
  const c = lume({ baza: ["Mihai Ionescu", { nume: "Dragoș Carâmb", scrieri: ["Ciufi Man"] }] });
  t("după numele lui de acum", gaseste(c, "Dragoș Carâmb"), 2);
  t("după scrierea veche", gaseste(c, "Ciufi Man"), 2);
  t("scrierea veche fără diacritice, tot el", gaseste(c, "CIUFI MAN"), 2);
  t("cine n-are nimic de-a face rămâne negăsit", gaseste(c, "Vasile Popescu"), null);
  t("scrierea unuia nu se lipește de altul", gaseste(c, "Mihai Ionescu"), 1);
  t("numele gol nu găsește pe nimeni", gaseste(c, ""), null);
}

/* ================================================================
   3. Ținutul minte al unei scrieri
   ================================================================ */
console.log("\n=== 3. O scriere nouă se ține minte ===");
{
  const c = lume({ baza: ["Dragoș Carâmb"] });
  t("prima scriere intră", vm.runInContext("tineMinteScrierea(pescari[0],'Ciufi Man')", c), true);
  t("…și se vede pe om", scrierile(c, 1), ["Ciufi Man"]);
  t("aceeași scriere nu intră a doua oară",
    vm.runInContext("tineMinteScrierea(pescari[0],'CIUFI  MAN')", c), false);
  t("…deci lista rămâne cum era", scrierile(c, 1), ["Ciufi Man"]);
  t("numele lui de acum nu se trece ca scriere",
    vm.runInContext("tineMinteScrierea(pescari[0],'Dragos Caramb')", c), false);
  t("nici scrierea goală", vm.runInContext("tineMinteScrierea(pescari[0],'   ')", c), false);
  t("a doua scriere, alta, intră",
    vm.runInContext("tineMinteScrierea(pescari[0],' Ciufy Man ')", c), true);
  t("…tunsă de spații", scrierile(c, 1), ["Ciufi Man", "Ciufy Man"]);
}

console.log("\n=== 3b. Scrierile rămân pe telefon ===");
{
  const c = lume({ baza: [{ nume: "Dragoș Carâmb", scrieri: ["Ciufi Man"] }] });
  vm.runInContext("pescariSalveaza();", c);
  const c2 = lume({ memorie: c.memorie });
  vm.runInContext("pescariIncarca();", c2);
  t("scrierile se scriu și se citesc înapoi", scrierile(c2, 1), ["Ciufi Man"]);
  t("…și tot ele găsesc omul", gaseste(c2, "Ciufi Man"), 1);
}

/* ================================================================
   4. Scrierile se strâng singure din concursurile sezonului
   ================================================================ */
console.log("\n=== 4. Strânse din arhive ===");
{
  const c = lume({
    baza: ["Dragoș Carâmb"],
    acelasi: [["Dragoș Carâmb", "Ciufi Man", "Ciufy Man"]]
  });
  vm.runInContext("incarcaAcelasiOm();", c);
  await linisteste();
  const g = vm.runInContext("pescariDinArhive(" + JSON.stringify([
    arhiva(["Ciufi Man", "Mihai Ionescu"]),
    arhiva(["Ciufy Man"])
  ]) + ")", c);
  t("două scrieri noi s-au ținut minte", g.scrieriNoi, 2);
  t("…pe omul lor", scrierile(c, 1), ["Ciufi Man", "Ciufy Man"]);
  t("cel care nu-i în bază nu capătă scrieri", g.noi.length, 1);
  t("…și rămâne de adăugat cu numele lui",
    g.noi.map(x => (x.prenume + " " + x.nume).trim()), ["Mihai Ionescu"]);
  t("de aici înainte, foaia veche duce la codul lui", gaseste(c, "Ciufy Man"), 1);
}

console.log("\n=== 4b. A doua oară nu se mai strânge nimic ===");
{
  const c = lume({
    baza: [{ nume: "Dragoș Carâmb", scrieri: ["Ciufi Man"] }],
    acelasi: [["Dragoș Carâmb", "Ciufi Man"]]
  });
  vm.runInContext("incarcaAcelasiOm();", c);
  await linisteste();
  const arh = JSON.stringify([arhiva(["Ciufi Man"])]);
  t("scrierea știută nu se numără", vm.runInContext("pescariDinArhive(" + arh + ")", c).scrieriNoi, 0);
  t("…nici la a doua apăsare", vm.runInContext("pescariDinArhive(" + arh + ")", c).scrieriNoi, 0);
  t("lista nu crește", scrierile(c, 1), ["Ciufi Man"]);
}

console.log("\n=== 4c. Fără lista de perechi nu se ghicește nimic ===");
{
  /* „Ciufi Man" și „Dragoș Carâmb" nu seamănă. Fără linia scrisă de mână, rămân doi
     oameni — ca până acum. Aplicația nu inventează legături. */
  const c = lume({ baza: ["Dragoș Carâmb"] });
  vm.runInContext("incarcaAcelasiOm();", c);
  await linisteste();
  const g = vm.runInContext("pescariDinArhive(" + JSON.stringify([arhiva(["Ciufi Man"])]) + ")", c);
  t("nicio scriere strânsă", g.scrieriNoi, 0);
  t("«Ciufi Man» rămâne om aparte", g.noi.length, 1);
}

/* ================================================================
   5. Fișierul scris de mână intră în bază fără niciun buton nou
   ------------------------------------------------------------------
   Fiecare scriere din arhiva/acelasi-om.json e pe câte o foaie arhivată — de acolo a
   fost culeasă, de mână. Deci căutarea în sezon le întâlnește pe toate și le așază pe
   oameni singură. Un buton de „mută-le acum" ar fi fost al patrulea pe ecranul ăsta,
   pentru o treabă pe care butonul de alături o face oricum.
   ================================================================ */
console.log("\n=== 5. Fără buton nou ===");
{
  const perechi = JSON.parse(H.citeste("arhiva/acelasi-om.json")).acelasi;
  const c = lume({ baza: perechi.map(g => g[0]), acelasi: perechi });
  vm.runInContext("incarcaAcelasiOm();", c);
  await linisteste();
  /* foile arhivate adevărate, exact cum stau în depozit */
  const arh = require("fs").readdirSync("arhiva")
    .filter(f => f.endsWith(".json") && f !== "acelasi-om.json")
    .map(f => JSON.parse(H.citeste("arhiva/" + f)));
  const g = vm.runInContext("pescariDinArhive(" + JSON.stringify(arh) + ")", c);
  const puse = perechi.reduce((n, gr) => n + gr.length - 1, 0);
  t("toate scrierile din fișier s-au strâns de pe foile adevărate", g.scrieriNoi, puse);
  perechi.forEach(gr => gr.slice(1).forEach(scriere => {
    t("«" + scriere + "» duce la codul lui " + gr[0], gaseste(c, scriere), gaseste(c, gr[0]));
  }));
  t("nu s-a lăsat niciun buton de mutat lista de mână",
    /aduScrierileVechi/.test(src), false);
}

/* ================================================================
   5b. Scrierile călătoresc cu omul
   ------------------------------------------------------------------
   Baza pleacă în fișier și pe server, și se întoarce pe alt telefon. Dacă scrierile ar
   rămâne pe drum, organizatorul celălalt ar fi nevoit să le strângă din nou — și, mai
   rău, un om adus sub o scriere ar intra a doua oară, cu al doilea cod.
   ================================================================ */
console.log("\n=== 5b. Scrierile călătoresc cu omul ===");
{
  const c = lume({ baza: ["Mihai Ionescu"] });
  vm.runInContext(H.grabFunction(src, "potrivesteBaza"), c);
  const g = vm.runInContext("potrivesteBaza([{id:'x',cod:7,prenume:'Dragoș',nume:'Carâmb'," +
    "scrieri:['Ciufi Man','Ciufy Man']}])", c);
  t("omul intră cu codul lui", g.noi.map(x => x.cod), [7]);
  t("…și cu scrierile lui", g.noi[0].scrieri, ["Ciufi Man", "Ciufy Man"]);
  t("nicio ciocnire", g.ciocniri.length, 0);
}

console.log("\n=== 5c. Un om adus sub o scriere nu intră a doua oară ===");
{
  /* Pe telefonul ăsta e Dragoș Carâmb, codul 1, cu scrierea „Ciufi Man". Fișierul îl
     aduce fix sub scrierea aia, cu codul 9. E tot el — și a avea doi oameni cu același
     nume și coduri diferite ar strica exact clasamentul de sezon. */
  const c = lume({ baza: [{ nume: "Dragoș Carâmb", scrieri: ["Ciufi Man"] }] });
  vm.runInContext(H.grabFunction(src, "potrivesteBaza"), c);
  const g = vm.runInContext("potrivesteBaza([{id:'x',cod:9,prenume:'Ciufi',nume:'Man'}])", c);
  t("nu intră al doilea rând", g.noi.length, 0);
  t("…ci se numără drept știut", g.erau, 1);
  t("codul lui de aici rămâne al lui", vm.runInContext("pescari[0].cod", c), 1);
}

/* ================================================================
   6. Plata: codul se lipește de rândul scris altfel
   ------------------------------------------------------------------
   Aici se vede de ce s-a făcut tot. Pe foaia de acum omul e trecut „Ciufi Man";
   butonul „Pune codurile" trebuie să-i dea codul lui Dragoș Carâmb.
   ================================================================ */
console.log("\n=== 6. Codul ajunge pe rândul scris altfel ===");
{
  const c = lume({
    baza: ["Mihai Ionescu", { nume: "Dragoș Carâmb", scrieri: ["Ciufi Man"] }],
    concurs: ["Ciufi Man", "Mihai Ionescu", "Vasile Popescu"]
  });
  const g = vm.runInContext("potrivesteCodurile()", c);
  t("amândoi capătă cod", g.gasiti.map(x => x.cod), [1, 2]);
  t("«Ciufi Man» capătă codul lui Dragoș Carâmb",
    g.gasiti.filter(x => x.p.prenume === "Ciufi")[0].cod, 2);
  t("cine nu-i în bază rămâne fără", g.fara.map(x => x.prenume), ["Vasile"]);
  t("nimic încurcat", g.incurcate.length, 0);
}

console.log("\n=== 6b. Doi oameni care duc la același cod nu-l primesc ===");
{
  /* „Dragoș Carâmb" și „Ciufi Man" pe aceeași foaie: sau e o greșeală de scriere, sau
     scrierea s-a lipit de omul greșit. Două coduri la fel ar strica exact clasamentul
     de sezon pe care baza vine să-l repare. Nu primește niciunul. */
  const c = lume({
    baza: [{ nume: "Dragoș Carâmb", scrieri: ["Ciufi Man"] }],
    concurs: ["Dragoș Carâmb", "Ciufi Man"]
  });
  const g = vm.runInContext("potrivesteCodurile()", c);
  t("niciunul nu capătă cod", g.gasiti.length, 0);
  t("…și se spune că-s încurcați", g.incurcate.map(x => x.cod), [1]);
  t("amândoi sunt arătați", g.incurcate[0].oameni.length, 2);
}

/* ================================================================
   7. Ecranul
   ================================================================ */
console.log("\n=== 7. Ecranul e legat cum trebuie ===");
{
  const ecran = src.slice(src.indexOf('id="view-pescari"'), src.indexOf('id="view-spons"'));
  /* patru butoane la vedere; restul stau strânse în pliantul cu copia de siguranță */
  const laVedere = ecran.slice(0, ecran.indexOf("pliant-copie"));
  t("niciun buton în plus la vedere", (laVedere.match(/<button/g) || []).length, 4);
  t("nu s-a adăugat un card în plus", (ecran.match(/class="card/g) || []).length, 3);
  t("un singur buton scos în față", (ecran.match(/btn-primary/g) || []).length, 1);
  t("se spune, acolo unde se întâmplă, că scrierile se țin minte",
    /duc amândouă la Dragoș Carâmb/.test(ecran), true);

  /* scrierile se văd sub nume, la rândul omului */
  const rand = H.grabFunction(src, "renderPescari");
  t("scrierile se arată sub nume", /i se mai scrie: /.test(rand), true);
  t("…doar dacă are", /alte\?/.test(rand), true);
  t("rândul crește cu ele, nu le taie", /\.pesc \.nm div\{white-space:normal;\}/.test(src), true);
}

console.log("\n=== 7b. Ce s-a strâns la căutare se și păstrează ===");
{
  /* Fără asta, scrierile strânse din arhive ar trăi doar până la următoarea deschidere
     a aplicației — iar munca asta se face o dată. */
  const cauta = H.grabFunction(src, "pescariCautaSezonul");
  t("se salvează pe loc", /if\(g\.scrieriNoi\)\{ pescariSalveaza\(\); renderPescari\(\); \}/.test(cauta), true);
  t("…și se spune omului", /fel nou de a scrie un nume s-a ținut minte/.test(cauta), true);
  t("se spune și când n-are pe cine adăuga",
    cauta.indexOf('sunt toți în bază."+scr') > 0, true);
}

t.raport();

})();
