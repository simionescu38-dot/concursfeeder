/**
 * Baza de pescari umplută din TOATE concursurile sezonului.
 *
 * Concursul de pe telefon are 44 de oameni; sezonul are 79. Cine a pescuit la etapa a
 * doua și n-a mai venit la ultima nu e nicăieri pe telefon — doar în arhivele de pe
 * server. Fără asta, baza rămâne cu jumătate din sezon.
 *
 * Lucrul de care atârnă tot: numele se pliază EXACT ca în clasamentul de sezon,
 * inclusiv perechile scrise de mână în arhiva/acelasi-om.json. Altfel „Ciufi Man" și
 * „Ciufy Man" ar lua două coduri — adică fix greșeala pe care baza vine s-o repare.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = ["uid", "esc", "faraSemne", "nameOf", "splitName", "numePescar",
  "cheiePescar", "pescarCauta", "pescarCodNou", "pescarNou", "pescariSalveaza",
  "numeleDinSezon", "cheiaSezon", "pescariDinArhive"];

/** o lume în care baza există și arhivele se pot inventa */
function lume(optiuni) {
  const o = optiuni || {};
  const memorie = {};
  const ctx = {
    console, JSON, Date, Math, parseInt, Array, String,
    toast: m => ctx.toasturi.push(m),
    toasturi: [],
    localStorage: { getItem: () => null, setItem: (k, v) => { memorie[k] = v; } },
    state: { participants: [] }
  };
  vm.createContext(ctx);
  vm.runInContext('var PESCARI_KEY="concurs-pescari-v1"; var pescari=[]; var pescariUltimCod=0;', ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  /* harta „același om", exact în forma în care o construiește aplicația din fișier */
  ctx.acelasiOm = {};
  ((o.acelasi) || []).forEach(g => g.forEach(nm => {
    ctx.acelasiOm[vm.runInContext("faraSemne(" + JSON.stringify(nm) + ")", ctx)] = g[0];
  }));
  (o.baza || []).forEach(nm => {
    const b = vm.runInContext("splitName(" + JSON.stringify(nm) + ")", ctx);
    vm.runInContext("pescari.push(pescarNou(" + JSON.stringify(b.prenume) + "," + JSON.stringify(b.nume) + "))", ctx);
  });
  return ctx;
}

/** o arhivă cu numele date, în forma în care vine de pe server */
const arhiva = (nume) => ({ data: { participants: nume.map((n, i) => {
  const sp = n.indexOf(" ");
  return { id: "a" + i, prenume: sp < 0 ? n : n.slice(0, sp), nume: sp < 0 ? "" : n.slice(sp + 1) };
}) } });

const cauta = (ctx, arhive) => vm.runInContext(
  "(function(){var g=pescariDinArhive(" + JSON.stringify(arhive) + ");" +
  "return {noi:g.noi.map(function(x){return (x.prenume+' '+x.nume).trim();})," +
  " erau:g.erau, concursuri:g.concursuri, oameni:g.oameni};})()", ctx);

/* ================================================================
   1. Ce iese din arhive
   ================================================================ */
console.log("\n=== 1. Toți oamenii din toate concursurile ===");
{
  const c = lume();
  const g = cauta(c, [
    arhiva(["Mihai Ionescu", "Vasile Popescu", "Ștefan Bălan"]),
    arhiva(["Mihai Ionescu", "Ion Țăranu"]),
    arhiva(["Radu Georgescu"])
  ]);
  t("trei concursuri", g.concursuri, 3);
  t("cinci oameni, nu șase", g.oameni, 5);
  t("cine a fost la două etape apare o dată", g.noi,
    ["Mihai Ionescu", "Vasile Popescu", "Ștefan Bălan", "Ion Țăranu", "Radu Georgescu"]);
  t("niciunul nu era în bază", g.erau, 0);
}

console.log("\n=== 1b. Cine e deja în bază nu se pune iar ===");
{
  const c = lume({ baza: ["Mihai Ionescu", "Ion Țăranu"] });
  const g = cauta(c, [arhiva(["Mihai Ionescu", "Vasile Popescu", "Ion Țăranu"])]);
  t("intră doar cel nou", g.noi, ["Vasile Popescu"]);
  t("ceilalți doi erau deja", g.erau, 2);

  /* scris fără diacritice în arhivă, cu diacritice în bază: tot el e */
  const c2 = lume({ baza: ["Petrică Cazacu"] });
  t("fără diacritice, tot el e", cauta(c2, [arhiva(["Petrica Cazacu"])]).noi, []);
}

console.log("\n=== 1c. Rândurile goale și concursurile goale ===");
{
  const c = lume();
  const g = cauta(c, [arhiva(["Mihai Ionescu", "", " "]), { data: { participants: [] } }, {}]);
  t("rândurile fără nume nu devin pescari", g.noi, ["Mihai Ionescu"]);
  t("concursul gol nu se numără", g.concursuri, 1);
  t("nici arhiva stricată nu crapă nimic", g.oameni, 1);
}

/* ================================================================
   2. Același om, scris în două feluri
   ------------------------------------------------------------------
   Asta e partea de care atârnă tot. „Ciufi Man" și „Ciufy Man" sunt Dragoș Carâmb,
   scris de mână pe foi diferite. Unirea NU se ghicește — se ia din lista scrisă de
   mână în arhiva/acelasi-om.json, aceeași pe care o folosește clasamentul de sezon.
   ================================================================ */
console.log("\n=== 2. Perechile din acelasi-om.json se pliază ===");
{
  const c = lume({ acelasi: [["Dragoș Carâmb", "Ciufi Man", "Ciufy Man"]] });
  const g = cauta(c, [
    arhiva(["Ciufi Man", "Mihai Ionescu"]),
    arhiva(["Ciufy Man", "Vasile Popescu"]),
    arhiva(["Dragoș Carâmb"])
  ]);
  t("trei scrieri, un singur om", g.oameni, 3);
  t("…și intră cu numele adevărat", g.noi, ["Dragoș Carâmb", "Mihai Ionescu", "Vasile Popescu"]);
  t("nu se face «Ciufi Man» pescar aparte", g.noi.indexOf("Ciufi Man"), -1);

  /* și dacă e deja în bază sub numele adevărat, scrierile lui nu mai intră */
  const c2 = lume({ acelasi: [["Dragoș Carâmb", "Ciufi Man"]], baza: ["Dragoș Carâmb"] });
  t("scrierea lui nu intră a doua oară", cauta(c2, [arhiva(["Ciufi Man"])]).noi, []);
  t("…și se spune că era deja", cauta(c2, [arhiva(["Ciufi Man"])]).erau, 1);

  /* invers: în bază e scrierea, în arhivă numele adevărat */
  const c3 = lume({ acelasi: [["Dragoș Carâmb", "Ciufi Man"]], baza: ["Ciufi Man"] });
  t("și invers, tot un singur om", cauta(c3, [arhiva(["Dragoș Carâmb"])]).noi, []);
}

console.log("\n=== 2b. Ce NU se pliază ===");
{
  /* „Paul Selig" și „Paul Pelin" diferă tot cu două litere și sunt doi pescari,
     amândoi pe aceeași foaie. Fără o linie scrisă de mână, rămân doi. */
  const c = lume();
  t("două nume asemănătoare rămân doi oameni",
    cauta(c, [arhiva(["Paul Selig", "Paul Pelin"])]).noi, ["Paul Selig", "Paul Pelin"]);

  /* fără lista de perechi, fiecare scriere rămâne un om — ca până acum */
  const fara = lume();
  t("fără lista de perechi, «Ciufi Man» e om aparte",
    cauta(fara, [arhiva(["Ciufi Man", "Dragoș Carâmb"])]).oameni, 2);
}

/* ================================================================
   3. Codurile
   ================================================================ */
console.log("\n=== 3. Fiecare intră cu codul lui ===");
{
  const c = lume({ baza: ["Mihai Ionescu"] });
  const g = cauta(c, [arhiva(["Mihai Ionescu", "Vasile Popescu", "Ștefan Bălan"])]);
  /* adăugarea propriu-zisă, exact cum o face butonul */
  vm.runInContext("(" + JSON.stringify(g.noi) + ").forEach(function(nm){" +
    "var b=splitName(nm); pescari.push(pescarNou(b.prenume,b.nume)); });", c);
  t("codurile merg mai departe de unde erau",
    vm.runInContext("pescari.map(function(p){ return p.cod+':'+numePescar(p); })", c),
    ["1:Mihai Ionescu", "2:Vasile Popescu", "3:Ștefan Bălan"]);
  t("nimeni nu s-a dublat", vm.runInContext("pescari.length", c), 3);
}

/* ================================================================
   4. Lista scrisă de mână, cea adevărată din depozit
   ================================================================ */
console.log("\n=== 4. Fișierul adevărat din arhiva/ ===");
{
  const lista = JSON.parse(H.citeste("arhiva/acelasi-om.json"));
  t("are grupuri de perechi", Array.isArray(lista.acelasi), true);
  const c = lume({ acelasi: lista.acelasi });
  const scrieri = [];
  lista.acelasi.forEach(g => g.forEach(nm => scrieri.push(nm)));
  const g = cauta(c, [arhiva(scrieri)]);
  t("toate scrierile din fișier se strâng în câți oameni sunt grupuri",
    g.oameni, lista.acelasi.length);
  t("…și intră sub primul nume din fiecare grup",
    g.noi, lista.acelasi.map(x => x[0]));
}

/* ================================================================
   5. Ecranul e legat cum trebuie
   ================================================================ */
console.log("\n=== 5. Ecranul e legat cum trebuie ===");
{
  const ecran = src.slice(src.indexOf('id="view-pescari"'), src.indexOf('id="view-spons"'));
  t("butonul de căutat e pe ecran", /onclick="pescariCautaSezonul\(\)"/.test(ecran), true);
  t("butonul spune ce face", /Caută în concursurile din sezon<\/button>/.test(ecran), true);
  t("stă în același card cu «din concursul de acum»",
    (ecran.match(/sec-title">Ia-i de-a gata/g) || []).length, 1);
  t("nu s-a adăugat un card în plus", (ecran.match(/class="card/g) || []).length, 3);
  t("un singur btn-primary scris în ecran", (ecran.match(/btn-primary/g) || []).length, 1);

  /* Butonul de adăugat se naște abia după căutare, sub numele găsite — ca la tragere:
     nimic nu se mișcă până omul nu vede ce a înțeles aplicația. */
  t("adăugarea apare doar după căutare",
    /pescariAdaugaSezonul/.test(ecran), false);
  t("…și e scrisă în răspunsul căutării",
    /onclick="pescariAdaugaSezonul\(\)"/.test(H.grabFunction(src, "pescariCautaSezonul")), true);

  const cauta = H.grabFunction(src, "pescariCautaSezonul");
  t("se citește lista de perechi înainte de arhive",
    cauta.indexOf("incarcaAcelasiOm()") < cauta.indexOf("/api/archive"), true);
  t("fără semnal, se spune ce e de făcut",
    /Se face o dată, de acasă, cu internet/.test(cauta), true);
  t("cu lacătul pus nu se caută", /^\s*function pescariCautaSezonul\(\)\{\s*\r?\n\s*if\(guard\(\)\) return;/.test(cauta), true);
  t("nici nu se adaugă",
    /^\s*function pescariAdaugaSezonul\(\)\{\s*\r?\n\s*if\(guard\(\)\) return;/.test(H.grabFunction(src, "pescariAdaugaSezonul")), true);
  t("se întreabă înainte de a adăuga",
    /confirm\("Adaugi "\+n\+/.test(H.grabFunction(src, "pescariAdaugaSezonul")), true);
}

t.raport();
