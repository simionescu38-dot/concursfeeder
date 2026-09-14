/**
 * Scara concursului — cei șase pași, pe ecranul Acasă.
 *
 * „Un singur ecran de lucru pentru concurs, cu pașii în ordinea în care se întâmplă pe
 * baltă. Pasul curent rămâne deschis, cei terminați se restrâng într-un rezumat și pot fi
 * redeschiși pentru corecturi."
 *
 * Panoul de dinainte spunea doar ce urmează ACUM. Ziua întreagă — ce s-a făcut, unde ești,
 * ce mai e — nu se vedea nicăieri, iar omul trebuia s-o țină în cap.
 *
 * Aici se probează SOCOTEALA treptelor: care e gata, ce scrie în rezumatul ei, care e cea
 * deschisă. Cum arată pe ecran se probează în browser, la 412px.
 *
 * Codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

const FUNCTII = [
  "num", "fmt", "esc", "numManse", "manseRange", "emptyManche", "ensureManche",
  "mOf", "sectorOfM", "standOfM", "nameOf", "cantOfM", "extraOfM", "totalOfM",
  "stareaLaMansa", "arbGata", "nelamurit", "standuriNecantarite", "mancheDisputata",
  "mansaTrasa", "faraStandLaMansa", "verificaConcursul", "treptele",
];

function om(id, stand, sector, kg, stare) {
  const m = {};
  for (let i = 1; i <= 3; i++)
    m[i] = { catches: [], catchTimes: [], catchPhotos: [], catchIds: [],
             extras: [], extraTimes: [], extraPhotos: [], extraIds: [],
             stand: "", sector: "", stare: "" };
  [1, 2].forEach((mi) => {
    m[mi].stand = stand ? String(stand) : "";
    m[mi].sector = sector || "";
    if (stare) m[mi].stare = stare;
    if (kg !== undefined && kg !== null) { m[mi].catches = [kg]; m[mi].catchTimes = [1000]; }
  });
  return { id, prenume: "Ion", nume: id.toUpperCase(), stand: stand ? String(stand) : "",
           sector: sector || "", m };
}

function pornire(stare, optiuni) {
  const o = optiuni || {};
  const ctx = {
    console, Math, String, Number, Array, Object, JSON, parseInt, parseFloat, isNaN,
    PRAG_KG: +/var PRAG_KG=(\d+)/.exec(src)[1],
    arbitruMode: false, arbitruSector: "",
    syncRoom: "", syncKey: "", syncPaused: false, syncBusy: false,
    syncLastOk: "12:40", arbNetrimis: false,
    currentArchiveId: o.arhiva || "",
    statusLiveHtml: () => "<panoul manșei>",
    state: stare,
  };
  vm.createContext(ctx);
  vm.runInContext("var STARI_MANSA=" + /var STARI_MANSA\s*=\s*(\{[\s\S]*?\});/.exec(src)[1] + ";", ctx);
  FUNCTII.forEach((f) => vm.runInContext(H.grabFunction(src, f), ctx));
  return ctx;
}
const trepte = (c) => vm.runInContext("treptele()", c);
/** treapta de acum, după regula din deseneazaScara: prima care nu e gata */
const acum = (tr) => (tr.find((x) => !x.gata) || tr[tr.length - 1]).nr;
const rez = (tr) => tr.map((x) => x.rez);

const gol = () => ({ name: "", balta: "", numManse: 2, manche: 1, sectors: ["A", "B"], participants: [] });

/* ================================================================
   1. Telefon gol — scara se vede întreagă, de la primul pas
   ================================================================ */
console.log("\n=== 1. Un telefon gol ===");
{
  const tr = trepte(pornire(gol()));
  t("scara are șase trepte", tr.length, 6);
  t("…în ordinea de pe baltă", tr.map((x) => x.t),
    ["Concursul", "Pescarii", "Standurile · manșa 1", "Manșa 1 · cântărirea",
     "Verifici rezultatele", "Publici și arhivezi"]);
  t("…niciuna gata", tr.filter((x) => x.gata).length, 0);
  t("…iar cea de acum e prima", acum(tr), 1);
  /* Fără pescari, treptele de mai jos n-au ce număra — dar tot spun de ce, nu tac. */
  t("…și cele care depind de pescari o spun", rez(tr).slice(1),
    ["Niciunul încă", "Întâi pescarii", "Întâi pescarii", "Întâi pescarii", "Încă nepublicat"]);
}

/* ================================================================
   2. Fiecare treaptă se bifează singură, din starea concursului
   ================================================================ */
console.log("\n=== 2. Cum se bifează ===");
{
  /* Numele SINGUR nu e de ajuns: fără baltă, același lac iese în două clasamente de
     sezon diferite — de-aia treapta cere amândouă. */
  const s = gol(); s.name = "Cupa";
  t("doar cu numele, treapta 1 nu e gata", trepte(pornire(s))[0].gata, false);
  s.balta = "Remus Lake";
  const tr = trepte(pornire(s));
  t("cu numele ȘI balta, e gata", tr[0].gata, true);
  t("…iar rezumatul spune ce s-a pus", tr[0].rez, "Remus Lake · 2 manșe · 2 sectoare");
  t("…și acum sunt pescarii", acum(tr), 2);
}
{
  const s = gol(); s.name = "Cupa"; s.balta = "Remus";
  s.participants = [om("a", 0, ""), om("b", 0, "")];
  const tr = trepte(pornire(s));
  t("cu pescari înscriși, treapta 2 e gata", tr[1].gata, true);
  t("…și spune câți", tr[1].rez, "2 înscriși");
  t("…dar standurile nu sunt trase", [tr[2].gata, tr[2].rez], [false, "trase · 0 din 2"]);
  t("…deci acum sunt standurile", acum(tr), 3);
}
{
  const s = gol(); s.name = "Cupa"; s.balta = "Remus";
  s.participants = [om("a", 1, "A"), om("b", 2, "A")];
  const tr = trepte(pornire(s));
  t("cu standurile trase, treapta 3 e gata", [tr[2].gata, tr[2].rez], [true, "trase · 2 din 2"]);
  t("…iar acum e manșa", acum(tr), 4);
  t("…care poartă panoul viu, nu un buton al ei", typeof tr[3].corp, "function");
}
{
  /* Cel trecut absent n-are nevoie de stand: altfel fiecare concurs cu un absent ar
     rămâne blocat pe treapta standurilor, la nesfârșit. */
  const s = gol(); s.name = "Cupa"; s.balta = "Remus";
  s.participants = [om("a", 1, "A"), om("b", 0, "", null, "absent")];
  const tr = trepte(pornire(s));
  t("absentul nu se cere la standuri", [tr[2].gata, tr[2].rez], [true, "trase · 1 din 1"]);
  t("…și e numărat ca absent la pescari", tr[1].rez, "2 înscriși · 1 absent");
}

/* ================================================================
   3. Manșa: nu e gata până nu s-a pescuit ULTIMA
   ================================================================ */
console.log("\n=== 3. Manșa ===");
{
  const s = gol(); s.name = "Cupa"; s.balta = "Remus"; s.manche = 1;
  s.participants = [om("a", 1, "A", 3), om("b", 2, "A", 4)];
  const tr = trepte(pornire(s));
  t("toți cântăriți în manșa 1, dar mai e una", tr[3].gata, false);
  t("…iar rezumatul spune cât s-a strâns", tr[3].rez, "2 din 2 · 7,000 kg");
  t("…și scara rămâne pe manșă", acum(tr), 4);

  s.manche = 2;
  const tr2 = trepte(pornire(s));
  t("pe ultima manșă cântărită, treapta e gata", tr2[3].gata, true);
  t("…iar titlurile s-au mutat pe manșa 2",
    [tr2[2].t, tr2[3].t], ["Standurile · manșa 2", "Manșa 2 · cântărirea"]);
}

/* ================================================================
   4. Verificarea e chiar semaforul
   ================================================================ */
console.log("\n=== 4. Treapta verificării ===");
{
  const s = gol(); s.name = "Cupa"; s.balta = "Remus"; s.manche = 2;
  s.participants = [om("a", 1, "A", 3), om("b", 2, "A", 4)];
  const tr = trepte(pornire(s));
  t("concurs curat → verificarea e gata", [tr[4].gata, tr[4].rez], [true, "Totul e în regulă"]);
  /* Verde peste tot: scara sare la publicare, fiindcă acolo e singurul lucru rămas. */
  t("…iar acum e publicarea", acum(tr), 6);

  s.participants[0].m[1].stand = ""; s.participants[0].m[2].stand = "";
  const tr2 = trepte(pornire(s));
  t("stric un stand → verificarea nu mai e gata", tr2[4].gata, false);
  /* Standul lipsește din AMÂNDOUĂ manșele, iar amândouă sunt pescuite: două lucruri, nu
     unul. Semaforul le numără pe manșe, fiindcă pe manșe se face clasamentul. */
  t("…și spune ce strică rezultatul", tr2[4].rez, "2 lucruri strică rezultatul");

  s.participants[0].m[1].stand = "1"; s.participants[0].m[2].stand = "1";
  s.participants[0].m[2].catches = [99];          // peste pragul de 50 kg
  const tr3 = trepte(pornire(s));
  t("o cifră ciudată → de lămurit, nu de reparat", tr3[4].rez, "1 lucru de lămurit");
  /* Portocaliul NU blochează: treapta rămâne negata ca să se uite omul, dar publicarea
     e tot acolo, la un pas. */
  t("…iar scara se oprește acolo, să te uiți", acum(tr3), 5);
}

/* ================================================================
   5. Publicarea
   ================================================================ */
console.log("\n=== 5. Treapta publicării ===");
{
  const s = gol(); s.name = "Cupa"; s.balta = "Remus"; s.manche = 2;
  s.participants = [om("a", 1, "A", 3), om("b", 2, "A", 4)];
  t("nepublicat → nu e gata", trepte(pornire(s))[5].gata, false);
  const tr = trepte(pornire(s, { arhiva: "abc-123" }));
  t("arhivat → e gata", [tr[5].gata, tr[5].rez], [true, "Salvat în Clasamentul de sezon"]);
  /* Toate șase bifate: scara se oprește pe ultima, nu sare în gol. */
  t("…și toate șase sunt bifate", tr.filter((x) => x.gata).length, 6);
  t("…iar cea deschisă rămâne ultima", acum(tr), 6);
}

/* ================================================================
   6. Ce s-a scos, și cine n-o vede
   ================================================================ */
console.log("\n=== 6. Unde stă și cine o vede ===");
{
  /* Scara ia LOCUL panoului „ce urmează": nu se adaugă lângă el. Cifrele vii n-au
     dispărut — au intrat în treapta a patra, prin statusLiveHtml. */
  t("panoul vechi nu mai e în pagină", /id="status-live"/.test(src), false);
  t("…iar scara stă în locul lui, pe Acasă",
    src.indexOf('id="scara"') > src.indexOf('id="view-part"') &&
    src.indexOf('id="scara"') < src.indexOf('id="view-cantar"'), true);
  t("…și cifrele vii au intrat în treapta manșei",
    /corp: statusLiveHtml/.test(src), true);

  /* Cine doar privește clasamentul n-are ce face cu pașii organizatorului. */
  t("cu lacătul pus, scara nu se desenează",
    /function deseneazaScara[\s\S]{0,300}isLocked\(\) \|\| viewerMode/.test(src), true);

  /* Una singură deschisă — asta ține ecranul scurt. */
  t("o singură treaptă e deschisă odată",
    /var deschis = x\.nr === acum;/.test(src), true);
  t("…iar un pas terminat se poate redeschide",
    /function scaraDeschide\(n, tine\)\{[\s\S]{0,200}scaraDeschisa === n/.test(src), true);
  /* Drumurile venite din cod cer treapta lor și o ȚIN deschisă: un comutator ar
     închide-o tocmai când omul a cerut-o. */
  t("…dar drumurile din cod o țin deschisă, nu o comută",
    /scaraDeschide\(4, true\)/.test(src) && /scaraDeschide\(3, true\)/.test(src), true);

  /* Butonul pasului e sub mâna omului, în treapta manșei: trebuie să se schimbe ODATĂ cu
     cântărirea, nu la următoarea bătaie de ceas. Prins la probă: cântăream ultimul pescar
     și butonul mai zicea o secundă „Pornește manșa 2". */
  t("scara se împrospătează la fiecare cântărire",
    /function refreshCard[\s\S]{0,1200}improspateazaStatus\(\);/.test(src), true);
  /* Cojile se fac o singură dată: dacă s-ar reface, nodurile mutate în ele ar fi șterse
     odată cu ele — iar lista de pescari ar dispărea la fiecare cântărire. */
  t("cojile treptelor se fac o singură dată",
    /if\(!box \|\| box\.children\.length === 6\) return;/.test(src), true);
  t("…iar nodurile se mută doar când se schimbă treapta",
    /if\(scaraPozitia === nr\) return;/.test(src), true);

  /* Fără astea în semnătură, scara ar rămâne desenată cum era acum un sfert de oră. */
  ["scaraDeschisa", "state.balta", "currentArchiveId"].forEach((x) =>
    t("semnătura ține minte „" + x + "”",
      new RegExp("function semnaturaStatus[\\s\\S]{0,900}" + x.replace(".", "\\.")).test(src), true));
  /* Pasul rămâne ultimul în semnătură: așa se poate citi înapoi din ea. */
  t("…iar pasul următor rămâne ultimul",
    /pasulUrmator\(\)\.t\];/.test(src), true);
}

t.raport();
