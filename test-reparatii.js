/**
 * Capcanele găsite la o verificare a drumului real de concurs, după ce standul a
 * devenit al manșei. Niciuna nu dădea eroare — toate schimbau tăcut repartizarea.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));

function aplicatie(numManse, manche) {
  const ctx = {
    state: { participants: [], manche: manche || 1, numManse: numManse || 2,
             sectors: ["A", "B"], sponsors: [], rules: "" },
    console, num: x => parseFloat(x) || 0, save(){}
  };
  vm.createContext(ctx);
  vm.runInContext(
    ["emptyManche", "numManse", "scalaSectoare", "manseRange", "ensureManche", "mOf", "sectorOfM", "standOfM",
     "mancheDeAfisat", "setStandSector", "cantOfM", "extraOfM", "cmmcOfM", "totalOfM",
     "cmmcAward", "absentLaMansa", "pointsMapS", "mancheDisputata", "pointsCombo", "normalize", "curataNumarul",
     "nameOf", "updateWarnStand"]
      .map(n => grabFunction(src, n)).join("\n"), ctx);
  return ctx;
}

/** doi pescari cu manșa 1 și manșa 2 trase deja, pe standuri diferite */
function douaManseTrase(ctx) {
  ctx.state.participants = [
    { id: "a", stand: "1", sector: "A", nume: "a", prenume: "", msv: 1,
      m: { 1: { catches: [5], extras: [], stand: "1", sector: "A" },
           2: { catches: [], extras: [], stand: "4", sector: "B" } } },
    { id: "b", stand: "2", sector: "A", nume: "b", prenume: "", msv: 1,
      m: { 1: { catches: [3], extras: [], stand: "2", sector: "A" },
           2: { catches: [], extras: [], stand: "3", sector: "B" } } }
  ];
}

/* ================================================================
   1. Trecerea de la 2 la 3 manșe
   ================================================================ */
console.log("\n=== 1. Manșa deschisă acum începe goală ===");
{
  const ctx = aplicatie(2);
  douaManseTrase(ctx);
  ctx.state.numManse = 3;
  vm.runInContext("state.participants.forEach(ensureManche);", ctx);
  t("imediat după comutare, manșa 3 n-are stand",
    vm.runInContext("standOfM(state.participants[0],3)", ctx), "");
  t("…nici sector", vm.runInContext("sectorOfM(state.participants[0],3)", ctx), "");

  // capcana: normalize (adică o redeschidere a aplicației) îngheța standul curent
  // în manșa 3, care părea astfel deja trasă
  vm.runInContext("normalize();", ctx);
  t("nici după o redeschidere a aplicației",
    vm.runInContext("standOfM(state.participants[0],3)", ctx), "");
  t("…și tot fără sector", vm.runInContext("sectorOfM(state.participants[0],3)", ctx), "");
  t("dar manșele trase își păstrează standurile",
    vm.runInContext("standOfM(state.participants[0],1)+'/'+standOfM(state.participants[0],2)", ctx), "1/4");
}

/* ================================================================
   2. Redeschiderea aplicației pe altă manșă decât prima
   ================================================================ */
console.log("\n=== 2. „Unde stă acum\" după o redeschidere ===");
{
  const ctx = aplicatie(2, 2); // aplicația pornește cu manșa 2 activă
  douaManseTrase(ctx);
  vm.runInContext("normalize();", ctx);
  t("p.stand e al manșei active, nu al manșei 1",
    ctx.state.participants[0].stand, "4");
  t("la fel și sectorul", ctx.state.participants[0].sector, "B");
  t("celălalt pescar la fel", ctx.state.participants[1].stand, "3");
  // formularul de editare se preumple din p.stand: dacă rămânea al manșei 1,
  // prima salvare scria peste tragerea manșei 2
  t("deci formularul de editare nu mai poate strica tragerea manșei active",
    ctx.state.participants[0].stand, vm.runInContext("standOfM(state.participants[0],2)", ctx));
}

/* ================================================================
   3. Migrarea datelor vechi se face o singură dată
   ================================================================ */
console.log("\n=== 3. Migrarea datelor vechi ===");
{
  const ctx = aplicatie(2);
  // participant scris înainte de schimbare: stand doar pe pescar
  ctx.state.participants = [
    { id: "x", stand: "7", sector: "B", nume: "x", prenume: "",
      m: { 1: { catches: [5], extras: [] }, 2: { catches: [], extras: [] } } }
  ];
  vm.runInContext("normalize();", ctx);
  t("manșele existente preiau standul de atunci",
    vm.runInContext("standOfM(state.participants[0],1)+'/'+standOfM(state.participants[0],2)", ctx), "7/7");
  t("și sunt marcate ca migrate", ctx.state.participants[0].msv, 1);

  // acum se deschide manșa 3: nu mai are voie să moștenească nimic
  ctx.state.numManse = 3;
  vm.runInContext("normalize();", ctx);
  t("manșa deschisă după migrare rămâne goală",
    vm.runInContext("standOfM(state.participants[0],3)", ctx), "");
}

/* ================================================================
   4. Nimic nu mai rescrie o manșă întreagă dintr-o apăsare
      Tragerea din aplicație și lista de standuri au fost scoase: la
      baltă se trage la bilă. Amândouă puteau rescrie dintr-un gest
      ordinea, standul și sectorul tuturor — inclusiv ale unei manșe
      deja cântărite. A rămas formularul fiecărui participant, care
      atinge un singur om.
   ================================================================ */
console.log("\n=== 4. Nicio rescriere în masă ===");
{
  t("nu mai există tragere automată", /function\s+drawLots\s*\(/.test(src), false);
  t("nici tragere de ordine", /function\s+drawOrder\s*\(/.test(src), false);
  t("nici lista de standuri", /function\s+renderStandEntry\s*\(/.test(src), false);
  t("și niciun buton nu le mai cheamă",
    /drawLots\(\)|drawOrder\(\)|renderStandEntry\(\)|setStandManual\(/.test(src), false);

  // singurul drum rămas scrie un singur participant, în manșa activă
  const ed = grabFunction(src, "saveEdit");
  t("formularul caută un singur participant, după id",
    /state\.participants\.find\(/.test(ed), true);
  t("…și nu trece prin toți", /state\.participants\.forEach/.test(ed), false);
  t("iar standul scris merge în manșa activă",
    /mOf\(p, state\.manche\|\|1\)\.stand\s*=/.test(ed), true);
}

/* ================================================================
   5. Două bilete cu același număr
      Se văd altfel abia la baltă, când doi oameni ajung pe același stand —
      sau, mai rău, abia la cântar, unde captura se poate trece pe cine nu
      trebuie. Avertismentul stătea în lista de standuri; lista a plecat,
      greșeala nu.
   ================================================================ */
console.log("\n=== 5. Standuri duble ===");
{
  const ctx = aplicatie(2);
  let cutie = { style: {}, textContent: "" };
  ctx.document = { getElementById: function(id){ return id === "warn-stand" ? cutie : null; } };
  const arata = () => { vm.runInContext("updateWarnStand()", ctx); return cutie; };
  const pune = rows => {
    ctx.state.participants = rows.map((r,i) => ({
      id:"p"+i, nume:r[0], prenume:"",
      m:{ 1:{catches:[],extras:[],stand:r[1],sector:"A"},
          2:{catches:[],extras:[],stand:r[2]||"",sector:"A"} }
    }));
  };

  pune([["Ion","5"], ["Vlad","7"], ["Radu","9"]]);
  t("cu standuri diferite, nu apare nimic", arata().style.display, "none");

  pune([["Ion","5"], ["Vlad","5"], ["Radu","9"]]);
  const w = arata();
  t("cu două bilete la fel, avertismentul apare", w.style.display, "block");
  t("spune care stand", /standul 5 e dat de 2 ori/.test(w.textContent), true);
  t("spune pe cine", /\(Ion, Vlad\)/.test(w.textContent), true);
  t("spune în ce manșă", /manșa 1/.test(w.textContent), true);
  t("spune și de ce contează", /captura se poate trece pe cine nu trebuie/.test(w.textContent), true);
  t("nu pomenește standul curat", /standul 9/.test(w.textContent), false);

  // avertismentul e al manșei active: manșa 2 are altă repartizare
  pune([["Ion","5","1"], ["Vlad","5","2"], ["Radu","9","3"]]);
  ctx.state.manche = 2;
  t("pe manșa 2, curată, nu mai apare", arata().style.display, "none");
  ctx.state.manche = 1;
  t("iar pe manșa 1 e tot acolo", arata().style.display, "block");

  // cine n-a primit încă standul nu e „dublură" cu ceilalți care n-au primit
  pune([["Ion",""], ["Vlad",""], ["Radu","9"]]);
  t("doi fără stand nu sunt un stand dublu", arata().style.display, "none");

  // trei pe același stand, și un al doilea stand dublu
  pune([["Ion","5"], ["Vlad","5"], ["Radu","5"], ["Dan","12"], ["Emil","12"]]);
  const w2 = arata();
  t("numără corect când sunt trei pe același stand",
    /standul 5 e dat de 3 ori/.test(w2.textContent), true);
  t("le arată pe amândouă", /standul 12 e dat de 2 ori/.test(w2.textContent), true);
  t("iar standurile ies în ordine numerică",
    w2.textContent.indexOf("standul 5") < w2.textContent.indexOf("standul 12"), true);
}

/* ================================================================
   6. Pescarul adăugat acum nu intră în manșele încheiate
      Standul e al MANȘEI, nu al pescarului. Cât timp aplicația trăgea
      singură la sorți, scrierea în toate manșele avea un rost — tragerea
      următoare le rescria oricum. Acum se trage la bilă, deci scrierea
      rămânea pe loc: un întârziat adăugat în manșa 2 apărea, pe hârtie,
      și pe un stand din manșa 1, la care nu pescuise. De acolo, trei
      urmări: alarmă falsă de stand dublu, un om în plus într-un sector
      încheiat, și — pe „aceeași scală" — punctele acelei manșe schimbate
      retroactiv pentru toți ceilalți.
   ================================================================ */
console.log("\n=== 6. Un întârziat nu atinge manșa încheiată ===");
{
  const ctx = aplicatie(2, 1);
  ctx.state.sectors = ["A", "B"];
  ctx.state.scalaSectoare = true;   // varianta în care mărimea sectorului intră în formulă
  ctx.guard = () => false;
  ctx.queueSave = () => {}; ctx.renderList = () => {}; ctx.uid = () => "nou";
  ctx.curataNumarul = () => false;
  ctx.sectorDinStand = () => {};
  const camp = { "in-stand": "3", "in-prenume": "Radu", "in-nume": "", "in-sector": "A" };
  ctx.document = { getElementById: id => (id in camp) ? { value: camp[id], dataset: {}, focus(){} } : null };
  vm.runInContext(grabFunction(src, "addParticipant"), ctx);

  // manșa 1 s-a pescuit: patru oameni, doi pe sector
  ctx.state.participants = [
    ["Ion", "1", "A", 9], ["Vlad", "2", "A", 4], ["Radu2", "3", "B", 8], ["Mihai", "4", "B", 2]
  ].map(r => ({
    id: r[0], nume: r[0], prenume: "", stand: r[1], sector: r[2], msv: 1,
    m: { 1: { catches: [r[3]], extras: [], stand: r[1], sector: r[2] },
         2: { catches: [], extras: [], stand: "", sector: "" } }
  }));
  const inainte = JSON.parse(vm.runInContext("JSON.stringify(pointsMapS(1))", ctx));

  // organizatorul trece pe manșa 2 și adaugă un întârziat, pe standul 3 din sectorul A
  ctx.state.manche = 2;
  camp["in-stand"] = "3"; camp["in-sector"] = "A";
  vm.runInContext("addParticipant()", ctx);
  const nou = ctx.state.participants[ctx.state.participants.length - 1];

  t("întârziatul are stand în manșa activă",
    vm.runInContext("standOfM(state.participants[4],2)", ctx), "3");
  t("…și sector acolo", vm.runInContext("sectorOfM(state.participants[4],2)", ctx), "A");
  t("dar manșa 1 rămâne goală la el",
    vm.runInContext("standOfM(state.participants[4],1)", ctx), "");
  t("…fără sector în manșa 1", vm.runInContext("sectorOfM(state.participants[4],1)", ctx), "");

  const dupa = JSON.parse(vm.runInContext("JSON.stringify(pointsMapS(1))", ctx));
  t("punctele manșei încheiate rămân neatinse pentru ceilalți",
    ["Ion", "Vlad", "Radu2", "Mihai"].map(k => dupa[k]),
    ["Ion", "Vlad", "Radu2", "Mihai"].map(k => inainte[k]));

  // și nu se aprinde o alarmă de stand dublu pe manșa 1, unde standul 3 e al lui Radu2
  let cutie = { style: {}, textContent: "" };
  ctx.document = { getElementById: id => id === "warn-stand" ? cutie : null };
  ctx.state.manche = 1;
  vm.runInContext("updateWarnStand()", ctx);
  t("nicio alarmă falsă de stand dublu pe manșa 1", cutie.style.display, "none");
  ctx.state.manche = 2;
  vm.runInContext("updateWarnStand()", ctx);
  t("iar pe manșa 2 standul lui e singur", cutie.style.display, "none");
}

/* ================================================================
   7. Același lucru pe drumul de import
   ================================================================ */
console.log("\n=== 7. Importul nu atinge manșele încheiate ===");
{
  const ctx = aplicatie(2, 2);
  ctx.state.sectors = ["A", "B"];
  ctx.state.numStanduri = "4";
  ctx.guard = () => false;
  ctx.queueSave = () => {}; ctx.renderList = () => {}; ctx.renderSectors = () => {};
  ctx.toast = () => {}; ctx.showView = () => {}; ctx.uid = () => "imp";
  ctx.curataNumarul = () => false;
  ctx.document = { getElementById: () => ({ value: "3, Radu Nou", innerHTML: "" }) };
  vm.runInContext(["parseImport", "splitName", "sectorRanges", "sectorForStand", "doImport"]
    .map(n => grabFunction(src, n)).join("\n"), ctx);

  ctx.state.participants = [{
    id: "vechi", nume: "Ion", prenume: "", stand: "1", sector: "A", msv: 1,
    m: { 1: { catches: [5], extras: [], stand: "1", sector: "A" },
         2: { catches: [], extras: [], stand: "", sector: "" } }
  }];
  vm.runInContext("doImport()", ctx);

  t("importatul intră în manșa activă",
    vm.runInContext("standOfM(state.participants[1],2)", ctx), "3");
  t("dar manșa 1 rămâne goală la el",
    vm.runInContext("standOfM(state.participants[1],1)", ctx), "");
  t("…și fără sector acolo",
    vm.runInContext("sectorOfM(state.participants[1],1)", ctx), "");
  t("cel care chiar a pescuit manșa 1 rămâne neatins",
    vm.runInContext("standOfM(state.participants[0],1)+sectorOfM(state.participants[0],1)", ctx), "1A");
}

/* ================================================================
   8. Balta pusă pe un concurs deja arhivat
      Arhivele nu se pot modifica pe server: se scriu o dată și se șterg.
      Ca să pui balta pe un concurs vechi, salvezi o copie cu ea și ștergi
      originalul. Ordinea contează: ștergere-întâi înseamnă că o pică de
      rețea la mijloc pierde singurul exemplar al concursului.
   ================================================================ */
console.log("\n=== 8. Numele și balta pe o arhivă veche ===");
{
  const fn = grabFunction(src, "setArhivaCampuri");
  const iPost = fn.indexOf('method:"POST"');
  const iDel = fn.indexOf("delArhiva(");
  t("salvarea copiei există", iPost > -1, true);
  t("ștergerea originalului există", iDel > -1, true);
  t("copia se salvează ÎNAINTE de ștergere", iPost < iDel, true);
  t("ștergerea e tăcută, ca să nu ceară a doua confirmare", /delArhiva\(id, true\)/.test(fn), true);
  t("câmpurile se curăță de spații", (fn.match(/\.trim\(\)/g) || []).length >= 2, true);

  /* Numele arhivat ajunge în clasamentul de sezon și pe pozele trimise pe WhatsApp,
     deci o greșeală de tastare („22.08.2926") se plimbă mai departe. Editorul avea
     doar câmp de baltă: numele se putea îndrepta numai rearhivând de pe telefon,
     și numai dacă mai aveai concursul acolo. */
  t("numele se scrie în arhivă", /d\.name=nume/.test(fn), true);
  t("…citit din câmpul lui", /arh-nume-/.test(fn), true);
  t("balta rămâne și ea salvată în aceeași apăsare", /d\.balta=balta/.test(fn), true);
  t("un nume gol e refuzat, nu salvat",
    fn.indexOf("if(!nume)") > -1 && fn.indexOf("if(!nume)") < fn.indexOf('spune("Se salvează'), true);
  t("…iar balta goală rămâne îngăduită (se poate șterge cu bună știință)",
    /if\(!balta\)/.test(fn), false);
  t("rândul are câmp de nume, cu numele de acum în el",
    /id="arh-nume-'\+esc\(a\.id\)\+'" placeholder="Numele concursului" value="'\+esc\(nume\)/.test(grabFunction(src, "loadArhive")), true);
  t("un singur buton salvează amândouă câmpurile",
    (grabFunction(src, "loadArhive").match(/setArhivaCampuri/g) || []).length, 1);
  t("data concursului se păstrează, ca să nu pară de azi",
    /if\(!d\.startAt && a\.archived_at\) d\.startAt=/.test(fn), true);
  t("camera concursului se păstrează", /a\.room\?\("\?room="/.test(fn), true);
  t("fără cheie de scriere se oprește înainte de orice cerere",
    fn.indexOf("if(!syncKey)") > -1 && fn.indexOf("if(!syncKey)") < fn.indexOf("fetch("), true);

  // Un toast trece în două secunde, iar omul se uită la câmp. Cine rata mesajul credea
  // că a salvat, vedea câmpul gol la reîncărcare și n-avea de unde ști de ce.
  t("răspunsul se scrie lângă rând, nu doar în toast", /function\(txt, rau\)/.test(fn), true);
  t("…și fiecare ieșire îl folosește",
    (fn.match(/spune\(/g) || []).length >= 5, true);
  t("rândul chiar are unde să-l scrie",
    /id="arh-stare-/.test(grabFunction(src, "loadArhive")), true);
}

/* ================================================================
   9. Backup-ul restaurat aduce înapoi tot concursul
      exportData scrie toată starea în fișier, dar restaurarea o
      reconstruia dintr-o listă fixă de câmpuri și arunca restul în
      tăcere. Cel grav era scalaSectoare — felul punctajului: un concurs
      ținut pe „aceeași scală" revenea la locuri simple, adică alte
      puncte pe aceleași kilograme. Iar ora de start e identitatea
      concursului în sezon, deci fără ea un concurs restaurat ar fi
      intrat a doua oară în clasament.
   ================================================================ */
console.log("\n=== 9. Restaurarea din fișier ===");
{
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(grabFunction(src, "stareDinFisier"), ctx);

  ctx.__f = {
    name: "Cupa de Miercuri", balta: "Remus Lake", numStanduri: "50",
    sectors: ["A","B","C","D","E"], manche: 2, numManse: 3,
    scalaSectoare: true, startAt: 1787119200000, endAt: 1787148000000, nadireMin: 15,
    rules: "regulamentul nostru", sponsors: [{nume:"Balta X"}],
    voiceOn: true, pushOn: true,
    pinHash: "PIN-DIN-FISIER", lock: true,
    participants: [{ id:"a", prenume:"Ion", nume:"Popescu", stand:"1" }],
    camp_dintr_o_versiune_viitoare: "ceva"
  };
  const s = vm.runInContext("stareDinFisier(__f, 'PIN-UL-MEU', false)", ctx);

  t("felul punctajului se întoarce", s.scalaSectoare, true);
  t("ora de start se întoarce", s.startAt, 1787119200000);
  t("…și ora de stop", s.endAt, 1787148000000);
  t("balta se întoarce", s.balta, "Remus Lake");
  t("numărul de standuri se întoarce", s.numStanduri, "50");
  t("minutele de nădire se întorc", s.nadireMin, 15);

  t("PIN-ul rămâne al telefonului, nu vine din fișier", s.pinHash, "PIN-UL-MEU");
  t("nici lacătul nu vine din fișier", s.lock, false);

  t("participanții vin întregi", s.participants.length, 1);
  t("sectoarele vin din fișier", s.sectors, ["A","B","C","D","E"]);
  t("manșa activă și numărul de manșe vin din fișier", [s.manche, s.numManse], [2, 3]);
  t("regulamentul și sponsorii la fel", [s.rules, s.sponsors.length], ["regulamentul nostru", 1]);

  // un export făcut de o versiune mai nouă nu trebuie ciuntit de una mai veche
  t("un câmp necunoscut trece neatins", s.camp_dintr_o_versiune_viitoare, "ceva");

  // fișierul de pe alt telefon poate veni fără sectoare
  const faraSectoare = vm.runInContext(
    "stareDinFisier({participants:[]}, 'PIN', false)", ctx);
  t("fără sectoare în fișier, ies A B C", faraSectoare.sectors, ["A","B","C"]);
  t("…iar PIN-ul tot al telefonului rămâne", faraSectoare.pinHash, "PIN");

  // fișierul nu are voie să lase telefonul blocat cu un PIN pe care omul nu-l știe
  const cuLacat = vm.runInContext(
    "stareDinFisier({lock:true, pinHash:'AL-LUI', participants:[]}, '', false)", ctx);
  t("un fișier cu lacăt pus nu blochează telefonul", [cuLacat.lock, cuLacat.pinHash], [false, ""]);
}

/* ================================================================
   10. Balta cerută în clipa arhivării
   ================================================================
   Concursul din 19 august a plecat în sezon cu balta goală. Sezonul a căzut pe
   numele concursului (cheiaLocatiei) și Remus Lake a ieșit în două clasamente de
   standuri, reparate pe urmă arhivă cu arhivă, de pe telefon. Acum se cere o dată,
   în clipa în care contează. Nu blochează arhivarea — doar Renunță o oprește.
   ================================================================ */
console.log("\n=== 10. Balta cerută în clipa arhivării ===");
{
  function cuBalta(balta, raspuns) {
    const ctx = {
      state: { balta: balta, participants: [] },
      salvari: 0,
      intrebari: [],
      console
    };
    // protezele se leagă de ctx, nu de `this`: chemate gol din vm, `this` nu e contextul
    ctx.queueSave = function () { ctx.salvari++; };
    ctx.prompt = function (text, implicit) { ctx.intrebari.push(text); return raspuns; };
    vm.createContext(ctx);
    vm.runInContext(grabFunction(src, "ceriBalta"), ctx);
    ctx.rezultat = vm.runInContext("ceriBalta()", ctx);
    return ctx;
  }

  // balta scrisă deja: nicio întrebare, nicio atingere în plus la fiecare concurs
  const scrisa = cuBalta("Remus Lake", null);
  t("cu balta scrisă, arhivarea merge mai departe", scrisa.rezultat, true);
  t("…și nu întreabă nimic", scrisa.intrebari.length, 0);
  t("…și nu salvează degeaba", scrisa.salvari, 0);

  // spațiile singure nu sunt o baltă
  const spatii = cuBalta("   ", "Bazinul Trofee");
  t("o baltă din spații se cere din nou", spatii.intrebari.length, 1);
  t("…și se scrie cea dată acum", spatii.state.balta, "Bazinul Trofee");

  // omul o scrie pe loc
  const scrisaAcum = cuBalta("", "Remus Lake");
  t("balta scrisă la întrebare intră în concurs", scrisaAcum.state.balta, "Remus Lake");
  t("…arhivarea merge mai departe", scrisaAcum.rezultat, true);
  t("…și se salvează o dată", scrisaAcum.salvari, 1);
  t("întrebarea spune de ce contează", /clasamente separate/.test(scrisaAcum.intrebari[0]), true);

  // spațiile se taie, ca aceeași baltă să nu iasă în două clasamente
  const cuSpatii = cuBalta("", "  Remus Lake  ");
  t("spațiile din jur se taie", cuSpatii.state.balta, "Remus Lake");

  // lasă gol și continuă: arhivarea NU se blochează
  const lasatGol = cuBalta("", "");
  t("lăsată goală, arhivarea tot merge", lasatGol.rezultat, true);
  t("…și nu se scrie nimic", lasatGol.state.balta, "");
  t("…nici nu se salvează degeaba", lasatGol.salvari, 0);

  // Renunță (prompt întoarce null): se oprește tot
  const renuntat = cuBalta("", null);
  t("Renunță oprește arhivarea", renuntat.rezultat, false);
  t("…și nu schimbă nimic", renuntat.state.balta, "");

  /* Reset-ul arhivează singur. Dacă ar cere balta și el, și archiveToSeason,
     ar ieși două ferestre una peste alta — de aceea wipe() cheamă cu `tacut`. */
  const arhiv = grabFunction(src, "archiveToSeason");
  t("archiveToSeason primește al doilea argument", /function archiveToSeason\(cb, tacut\)/.test(arhiv), true);
  t("…și sare peste întrebare când e chemat tăcut", /if\(!tacut\)/.test(arhiv), true);
  const sterge = grabFunction(src, "wipe");
  t("wipe cere balta înainte de confirmarea lui", sterge.indexOf("ceriBalta") < sterge.indexOf("confirm(msg)"), true);
  t("…și arhivează tăcut, ca să nu întrebe de două ori",
    /archiveToSeason\(function\(\)\{ saveArchiveId\(""\); \}, true\)/.test(sterge), true);
}


t.raport();
