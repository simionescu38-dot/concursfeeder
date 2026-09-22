/**
 * Cele trei uși din „Contul meu”.
 *
 * Ecranul avea 21 de carduri unul sub altul: pregătirea concursului, setările telefonului
 * și reparațiile de urgență, toate la grămadă. Recenziile au spus „e stufoasă” — și aveau
 * dreptate: aplicația n-are prea multe funcții, are prea multe funcții deodată pe același
 * ecran.
 *
 * Nu s-a șters niciun card. Fiecare a primit ușa lui, după MOMENTUL în care ai nevoie de
 * el: înainte de start, o dată în viața telefonului, sau când s-a stricat ceva. Momentul
 * e mai ușor de ghicit decât „cât de des se umblă la el”, care era regula sertarelor de
 * dinainte.
 *
 * Se citește pagina LIVRATĂ și se rulează funcția adevărată din ea.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const t = H.creeazaVerificator();
const src = H.citeste("index.html");

/* doar bucata de ecran care ne privește */
const set = src.slice(src.indexOf('<section class="view" id="view-set"'),
                      src.indexOf('<section class="view" id="view-strat"'));

/** titlurile cardurilor, în ordinea de pe ecran, cu ușa fiecăruia */
function carduri() {
  const out = [];
  const re = /<div class="card([^"]*)"[^>]*>(?:\s*\r?\n)?\s*<div class="sec-title"[^>]*>([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(set))) {
    const usa = (m[1].match(/\bu[123]\b/) || [""])[0];
    /* Semnul „?" de ajutor stă în același rând cu titlul, dar nu E titlul: se scoate
       întreg înainte de dezbrăcat, altfel cardul s-ar chema „Manșe?". */
    out.push({ usa: usa, titlu: m[2]
      .replace(/<button[^>]*class="aj"[\s\S]*?<\/button>/g, "")
      .replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim() });
  }
  return out;
}
const ale = (u) => carduri().filter((c) => c.usa === u).map((c) => c.titlu);

/* ================================================================
   1. Fiecare card are o ușă. Niciunul nu rămâne pe dinafară.
   ================================================================ */
console.log("\n=== 1. Toate cardurile au ușa lor ===");
{
  const toate = carduri();
  /* De la 21, cât era: „Puncte la sectoare inegale" s-a strâns în pliant (−1), fiindcă se
     alege o dată și rămâne tot sezonul; „Import participanți" a plecat la Cântar (−1),
     unde se face înscrierea; iar cele patru lucruri care FAC un concurs — numele și
     balta, sectoarele, manșele, orele — au plecat pe ecranul lor, „Fă concursul", și au
     lăsat în urmă un singur card care-l deschide (−4 +1, ceasul venit din Calendar
     plecând odată cu ele). */
  t("ecranul are tot atâtea carduri câte avea", toate.length, 18);
  t("niciunul nu a rămas fără ușă", toate.filter((c) => !c.usa).map((c) => c.titlu), []);
  t("nu s-a pierdut niciunul pe drum",
    ale("u1").length + ale("u2").length + ale("u3").length, 18);
}

/* ================================================================
   2. Ce stă după fiecare ușă — lista întreagă, ca s-o poată citi și el.
   ================================================================ */
console.log("\n=== 2. Ce e după fiecare ușă ===");
{
  t("Concursul — ce mai rămâne aici, după ce pregătirea a plecat pe ecranul ei", ale("u1"), [
    "Concursul de acum", "Concurs pe echipe", "Cum se calculează", "Baza de pescari",
  ]);
  /* Cardul care deschide ecranul e primul: e drumul înapoi spre pregătire. */
  t("drumul spre «Fă concursul» e primul", ale("u1")[0], "Concursul de acum");
  t("Telefonul — ce se setează o dată", ale("u2"), [
    "Sincronizare & backup", "Clasament live pe alte telefoane",
    "Notificări live (doar Android/Chrome)", "Anunț vocal la cântar",
    "Pune iconița pe ecran", "Protecție cu PIN",
  ]);
  t("Nu merge ceva — reparațiile, rar sau niciodată", ale("u3"), [
    "Versiunea aplicației", "Curăță arhiva de sezon", "Moderare calendar regional",
    "Istoric cameră", "Adu înapoi ce era", "Adu concursul din cameră",
    "Serverul răspunde?", "Reset",
  ]);
  /* Frați: unul aduce de pe telefon, celălalt din cameră. Stau unul lângă altul. */
  t("cele două „adu” stau alături",
    ale("u3").indexOf("Adu concursul din cameră"), ale("u3").indexOf("Adu înapoi ce era") + 1);

  /* „Golește camera" a intrat ca BUTON în cardul lui aduDinCamera, nu ca un card nou:
     sunt același lucru privit din două părți — camera vine pe telefon, sau camera rămâne
     goală. Un card în plus ar fi mărit tocmai ecranul pe care l-am strâns. */
  const cardulCamerei = /<div class="card u3 lockhide">\s*<div class="sec-title">[^<]*<svg[\s\S]*?Adu concursul din cameră<\/div>([\s\S]*?)<\/div>\s*\r?\n\s*\r?\n/.exec(src);
  t("cardul „Adu concursul din cameră” se găsește", !!cardulCamerei, true);
  t("…și ține amândouă butoanele",
    (cardulCamerei ? cardulCamerei[1] : "").match(/onclick="(aduDinCamera|golesteCamera)\(\)"/g),
    ['onclick="aduDinCamera()"', 'onclick="golesteCamera()"']);
  t("…„Adu” e primul, „Golește” al doilea",
    (cardulCamerei ? cardulCamerei[1] : "").indexOf("aduDinCamera()")
      < (cardulCamerei ? cardulCamerei[1] : "").indexOf("golesteCamera()"), true);
  /* Regula lui: un singur buton scos în față pe ecran. Aici sunt amândouă de contur. */
  t("niciunul nu e scos în față",
    /class="btn btn-ghost" onclick="golesteCamera\(\)"/.test(src), true);
  t("numărul cardurilor n-a crescut", carduri().length, 18);
}

/* ================================================================
   3. Câte se văd deodată — miezul plângerii „e stufoasă”.
   ================================================================ */
console.log("\n=== 3. Câte carduri vezi odată ===");
{
  const max = Math.max(ale("u1").length, ale("u2").length, ale("u3").length);
  t("cel mai încărcat ecran are 8 carduri, nu 18", max, 8);
  t("…adică mai puțin de jumătate din cât era", max * 2 < 18, true);
}

/* ================================================================
   4. Butoanele ușilor.
   ================================================================ */
console.log("\n=== 4. Butoanele de sus ===");
{
  t("sunt trei", (set.match(/onclick="usaSet\('u[123]'\)"/g) || []).length, 3);
  const nume = (set.match(/>([^<]+)<span class="cand">([^<]+)</g) || [])
    .map((x) => x.replace(/^>/, "").replace(/<span class="cand">/, " · ").replace(/<$/, ""));
  t("spun ce e după ele și când", nume, [
    "Concursul · înainte de start",
    "Telefonul · o dată, și gata",
    "Nu merge ceva · rar",
  ]);
  /* Niciunul nu e scos în față: sunt trei drumuri la fel de bune, nu un buton al zilei. */
  t("niciunul nu e btn-primary",
    /class="usi"[\s\S]{0,600}btn-primary/.test(set), false);
}

/* ================================================================
   5. Ușa închisă chiar ascunde, iar cea deschisă nu învie nimic.
   ================================================================ */
console.log("\n=== 5. Regula de ascundere ===");
{
  t("ușile închise se ascund",
    /body\[data-usa="u1"\] \.u2, body\[data-usa="u1"\] \.u3,/.test(src), true);
  /* Dacă ușa deschisă ar avea o regulă proprie de afișare, ar bate .lockhide și ar învia
     cardurile pe care lacătul le ascunde — adică editarea ar reapărea la un telefon
     blocat cu PIN. De aceea deschisul NU e scris nicăieri: se ascunde doar ce e închis. */
  t("ușa deschisă NU are regulă de afișare, ca să nu bată lacătul",
    /body\[data-usa="u[123]"\] \.u[123]\{display:(block|grid|flex)/.test(src), false);
}

/* ================================================================
   6. Funcția adevărată, rulată.
   ================================================================ */
console.log("\n=== 6. Cum se deschide o ușă ===");
{
  const ctx = {
    console,
    document: {
      body: { dataset: {} },
      _b: {},
      getElementById(id) {
        /* Numai butoanele ușilor există în DOM-ul ăsta de mimă. „view-set" lipsește
           dinadins: aici se probează ușa, iar strânsul cardurilor are proba lui. */
        if (id.indexOf("usa-") !== 0) return null;
        if (!this._b[id]) this._b[id] = { clasa: null, classList: { toggle: (c, on) => { ctx.document._b[id].clasa = on; } } };
        return this._b[id];
      },
    },
    localStorage: {
      _d: {},
      getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
      setItem(k, v) { this._d[k] = String(v); },
    },
  };
  vm.createContext(ctx);
  vm.runInContext('var USA_KEY = "concurs-usa-setari";', ctx);
  /* `usaSet` strânge acum și cardurile ușii. Aici se probează ușa, nu strânsul — deci
     DOM-ul de mimă n-are `view-set`, iar funcția adevărată iese pe prima linie. */
  vm.runInContext([H.grabFunction(src, "cardPliabil"), H.grabFunction(src, "cardPus"),
    H.grabFunction(src, "strangeCardurile"), H.grabFunction(src, "usaSet"),
    H.grabFunction(src, "usaPornire")].join("\n"), ctx);

  vm.runInContext('usaSet("u2")', ctx);
  t("ușa cerută se deschide", ctx.document.body.dataset.usa, "u2");
  t("butonul ei se aprinde", ctx.document._b["usa-u2"].clasa, true);
  t("celelalte se sting",
    [ctx.document._b["usa-u1"].clasa, ctx.document._b["usa-u3"].clasa], [false, false]);

  /* Cine e la al treilea concurs știe unde se duce; n-are rost să caute din nou. */
  t("ușa se ține minte pe telefon", ctx.localStorage.getItem("concurs-usa-setari"), "u2");
  ctx.document.body.dataset.usa = "";
  vm.runInContext("usaPornire()", ctx);
  t("…și se deschide singură data viitoare", ctx.document.body.dataset.usa, "u2");

  /* Un telefon nou, sau o valoare rămasă de la o versiune mai veche, nu trebuie să lase
     ecranul gol — toate ușile închise ar însemna niciun card pe ecran. */
  ctx.localStorage._d = {};
  vm.runInContext("usaPornire()", ctx);
  t("un telefon nou intră pe prima ușă", ctx.document.body.dataset.usa, "u1");
  vm.runInContext('usaSet("altceva")', ctx);
  t("o ușă care nu există cade tot pe prima", ctx.document.body.dataset.usa, "u1");
}

/* ================================================================
   7. Se deschide la intrarea pe ecran, nu la pornirea aplicației.
   ================================================================ */
console.log("\n=== 7. Când se așază ===");
{
  t("showView o pune la intrarea în Contul meu",
    /if\(v==="set"\) usaPornire\(\);/.test(src), true);
  t("sertarele de dinainte nu mai există",
    /pliant-server|pliant-odata|pliant-necaz/.test(src), false);
}

/* ================================================================
   8. Saltul din altă parte deschide ușa cardului căutat.

   Banda de sincronizare din antet și dalele de pe Acasă sar direct la un card.
   Dacă acela stă după o ușă închisă, saltul aterizează pe un card ascuns — adică
   nicăieri, iar omul crede că butonul nu face nimic.
   ================================================================ */
console.log("\n=== 8. Saltul deschide ușa ===");
{
  t("meniuGo caută ușa cardului", /var usa=\(el\.className\.match\(\/\\bu\[123\]\\b\/\)\|\|\[\]\)\[0\];/.test(src), true);
  t("…și o deschide înainte să sară", /if\(usa\) usaSet\(usa\);[\s\S]{0,120}scrollIntoView/.test(src), true);

  /* Două ținte care lipseau de mult, găsite tocmai fiindcă ușile le-au făcut vizibile. */
  t("banda de sincronizare are unde să sară", /id="card-sync"/.test(src), true);
  t("…iar ținta ei e cardul cu codul camerei",
    /id="card-sync">(?:\s*\r?\n)?\s*<div class="sec-title">[\s\S]{0,120}Clasament live pe alte telefoane/.test(src), true);
  /* Cronometrul stă în Calendar, nu în Contul meu — dala de pe Acasă trimitea în alt
     ecran. A ieșit cu totul odată cu „ce urmează": butonul panoului pornește și oprește
     manșa, iar același drum în două locuri pe același ecran nu ajută pe nimeni. */
  t("dala nu mai trimite în Contul meu", /meniuGo\('set','card-cronometru'\)/.test(src), false);
  t("nici nu mai există ca dală", /"Cronometru","meniuGo/.test(src), false);
  /* Ceasul a plecat din Calendar la Contul meu › Concursul: acolo faci concursul, iar
     orele sunt ale lui, nu ale calendarului regional. */
  t("ceasul nu mai stă în Calendar",
    /id="view-cal"[\s\S]*?id="card-cronometru"/.test(
      src.slice(src.indexOf('id="view-cal"'), src.indexOf('id="view-rank"'))), false);
  /* Ceasul a plecat mai departe, odată cu celelalte trei, pe ecranul „Fă concursul". */
  t("…ci pe ecranul «Fă concursul»",
    /id="view-nou"[\s\S]*?id="card-cronometru"/.test(src), true);
}

/* ================================================================
   9. Saltul aterizează SUB bara de sus, nu în spatele ei.

   Antetul e `position:sticky; top:0`, deci un salt cu scrollIntoView({block:"start"})
   duce ținta la y=0 — adică fix în spatele barei. „Fă concursul" ajungea pe cardul cu
   numele, dar căsuța de scris rămânea acoperită: primul lucru vizibil era „Balta", și
   omul credea că a nimerit aiurea. Măsurat în browser, pe fișierul livrat: −49px pe
   telefon, −59px pe ecran lat.
   ================================================================ */
console.log("\n=== 9. Saltul nu intră sub bară ===");
{
  t("ținta saltului lasă loc barei",
    /\.card, \.pliant, #event-form\{ scroll-margin-top:var\(--antet,\s*\d+px\); \}/.test(src), true);
  /* Bara e mai înaltă pe ecran lat (93px pe telefon, 102px la 900px lățime), deci
     înălțimea nu se scrie de mână — se măsoară. */
  const m = H.grabFunction(src, "masoaraAntetul");
  t("înălțimea barei se măsoară, nu se ghicește", /h\.offsetHeight/.test(m), true);
  t("…și se pune acolo unde o citește regula", /setProperty\("--antet"/.test(m), true);
  t("se măsoară la pornirea aplicației", /\(function\(\)\{(?:\s*\r?\n)?\s*masoaraAntetul\(\);/.test(src), true);
  t("…și când se rotește telefonul",
    /window\.addEventListener\("resize", masoaraAntetul\);/.test(src), true);
  /* Dacă regula ar prinde doar cardurile, „Trage la sorți" — care sare la un pliant —
     ar rămâne cu defectul. */
  t("regula prinde și pliantele, unde sare tragerea la sorți",
    /\.pliant[^{]*\{ scroll-margin-top/.test(src), true);
}

/* ================================================================
   10. Ce se alege o dată se strânge, nu se șterge.

   „Puncte la sectoare inegale" e o regulă a clubului: se alege o dată și rămâne tot
   sezonul. Stătea ca un card întreg printre lucrurile pe care le atingi înainte de
   FIECARE concurs. Acum e pliant — la o apăsare distanță, nu în drum.

   NU s-a mutat pe altă ușă, fiindcă e o alegere a CONCURSULUI (se ține în starea lui și
   pleacă la celelalte telefoane), nu una a telefonului.
   ================================================================ */
console.log("\n=== 10. Alegerea de-o dată, strânsă în pliant ===");
{
  t("nu mai e card", /<div class="card[^"]*"[^>]*>(?:\s*\r?\n)?\s*<div class="sec-title"[^>]*>[^<]*<\/svg>Puncte la sectoare inegale/.test(set), false);
  t("…ci pliant", /id="pliant-puncte"/.test(set), true);
  t("…cu numele neschimbat", /Puncte la sectoare inegale <span class="rar">/.test(set), true);
  t("…și spune cât de rar", /<span class="rar">o dată, și rămâne<\/span>/.test(set), true);

  /* Fără ușa lui, pliantul s-ar vedea pe toate trei — greșeala pe care o are „Codul
     arbitrilor" și care urmează la rând. */
  t("stă după ușa Concursul, ca tot ce e acolo",
    /<div class="pliant mt u1 lockhide" id="pliant-puncte">/.test(set), true);

  /* Butoanele n-au plecat nicăieri: doar au intrat sub capac. */
  t("butonul „Locul 3 = 3 puncte” e în el",
    /id="pliant-puncte"[\s\S]{0,700}id="sc-simplu"/.test(set), true);
  t("…și cel „Îndreptat”", /id="pliant-puncte"[\s\S]{0,800}id="sc-scala"/.test(set), true);
  t("cuprinsul stă închis până e apăsat",
    /id="pliant-puncte"[\s\S]{0,400}<div class="pliant-in" hidden>/.test(set), true);

  /* Regulamentul trimite omul la el pe nume: dacă numele s-ar schimba, drumul ar minți. */
  t("regulamentul trimite tot la numele ăsta",
    /Se poate schimba din Contul meu, la „Puncte la sectoare inegale"/.test(src), true);
}

/* ================================================================
   11. Ce dai la ședința tehnică stă la Concursul, nu la Telefonul.

   Linkul live pentru pescari și codul arbitrilor stăteau amândouă în cardul „Clasament
   live pe alte telefoane", pe ușa Telefonului — adică la „ce se setează o dată". Dar
   codul camerei și cheia se pun o dată; codurile astea se dau la FIECARE concurs,
   dimineața, în fața oamenilor.

   (Pliantul arbitrilor NU se vedea pe toate ușile, cum crezusem la prima citire: stătea
   ÎNĂUNTRUL cardului de pe ușa u2, deci moștenea ușa lui. Verificat în browser.)
   ================================================================ */
console.log("\n=== 11. Codurile date oamenilor, la Concursul ===");
{
  const sync = set.slice(set.indexOf('id="card-sync"'),
                         set.indexOf('id="card-sync"') + 2600);
  const sed = set.slice(set.indexOf('id="pliant-sedinta"'),
                        set.indexOf('id="pliant-sedinta"') + 3000);

  t("pliantul ședinței stă după ușa Concursul",
    /<div class="pliant mt u1 lockhide" id="pliant-sedinta">/.test(set), true);
  t("…cu vorba lui, luată de pe pliantul vechi",
    /La ședința tehnică <span class="rar">dimineața, la baltă<\/span>/.test(set), true);

  /* Amândouă codurile au venit aici. */
  t("linkul live e în el", /onclick="shareLiveLink\(\)"/.test(sed), true);
  t("…și codul QR al lui", /id="live-qr-wrap"/.test(sed), true);
  t("codul arbitrilor e în el", /onclick="faCodArbitri\(\)"/.test(sed), true);
  t("…și codul QR al lor", /id="arb-qr-wrap"/.test(sed), true);

  /* …și au plecat de unde erau. */
  t("cardul Telefonului nu mai are linkul live", /shareLiveLink/.test(sync), false);
  t("…nici codul arbitrilor", /faCodArbitri/.test(sync), false);
  t("…iar pliantul vechi nu mai există nicăieri", /pliant-arbitri/.test(src), false);

  /* Ce se setează o dată a rămas unde era. */
  t("codul camerei a rămas la Telefonul", /id="sync-room"/.test(sync), true);
  t("…cheia de scriere la fel", /id="sync-key"/.test(sync), true);
  t("…și trimiterea de mână în cameră", /onclick="trimiteAcum\(\)"/.test(sync), true);
  t("cardul lui trimite omul unde s-au mutat celelalte",
    /Concursul → La ședința tehnică/.test(sync), true);

  /* Fără codul camerei, butoanele n-au de unde scoate nimic: se spune pe loc. */
  t("spune când lipsește codul camerei", /id="sedinta-fara-camera"/.test(set), true);
  t("…iar semnul se aprinde chiar din codul camerei",
    /fara\.style\.display = syncRoom \? "none" : "block";/.test(H.grabFunction(src, "updateLiveQr")), true);

  /* Niciun card în plus pe nicio ușă: au venit ca pliant, nu ca încă un card. */
  t("ușa Concursul are 4 carduri", ale("u1").length, 4);
  t("ușa Telefonului are tot 6", ale("u2").length, 6);
}

/* ================================================================
   12. Înscrierea pescarilor stă acolo unde se înscriu — la Cântar.

   „Import participanți" stătea în Contul meu, la setări, deși înscrierea se face pe
   ecranul de cântar, lângă butonul „+ Adaugă la listă". Cine avea lista pe WhatsApp o
   lipea abia după ce dădea de ea, două ecrane mai încolo.

   ÎNDREPTARE la hartă: scrisesem că „face exact ce face butonul de pe Cântar". Nu e
   adevărat — importul ADUCE oameni în concurs, tragerea doar îi MUTĂ pe standuri pe cei
   deja înscriși. Locul era greșit, nu fapta.

   Odată venit, pliantele de la Cântar stau în ordinea zilei.
   ================================================================ */
console.log("\n=== 12. Pliantele de la Cântar, în ordinea zilei ===");
{
  const cantar = src.slice(src.indexOf('id="view-cantar"'), src.indexOf('id="view-rank"'));

  t("importul a venit la Cântar", /id="pliant-import"/.test(cantar), true);
  t("…și nu mai e în Contul meu", /id="pliant-import"/.test(set), false);
  t("căsuța de lipit a venit cu el", /id="pliant-import"[\s\S]{0,900}id="imp-text"/.test(cantar), true);
  t("…și amândouă butoanele lui",
    /id="pliant-import"[\s\S]{0,1600}onclick="previewImport\(\)"[\s\S]{0,300}onclick="doImport\(\)"/.test(cantar), true);
  t("stă strâns, nu deschis",
    /id="pliant-import"[\s\S]{0,400}class="pliant-in" hidden/.test(cantar), true);
  /* Arbitrii cântăresc, nu înscriu — ca la tragere. */
  t("arbitrii nu-l văd", /<div class="pliant mt lockhide arbhide" id="pliant-import">/.test(cantar), true);

  /* Ordinea zilei: aduci pescarii, tragi la sorți, cântărești, te uiți în jurnal.
     Înainte cântarele erau primele și tragerea a doua. */
  const ordine = ["pliant-import", "pliant-tragere", "pliant-cantare", "pliant-jurnal"]
    .map((id) => cantar.indexOf('id="' + id + '"'));
  t("toate patru sunt pe ecran", ordine.filter((x) => x < 0), []);
  t("…și stau în ordinea zilei", ordine.slice().sort((x, y) => x - y), ordine);

  /* Spune limpede care e diferența, ca omul să nu le încurce. */
  t("importul spune că ADUCE oameni",
    /id="pliant-import"[\s\S]{0,2400}aduce în concurs/.test(cantar), true);
  t("…și trimite la tragere pentru cei deja înscriși",
    /id="pliant-import"[\s\S]{0,2600}Trec tragerea la sorți/.test(cantar), true);
}

/* ================================================================
   13. „Fă concursul" are ecranul lui.

   Butonul de pe Acasă ducea în Contul meu, printre setări. Chiar aterizat pe cardul bun,
   omul vedea un ecran plin și credea că a nimerit aiurea — de aici a pornit tot: „este
   foarte încâlcită".

   Cardurile sunt ACELEAȘI, mutate. Nu copiate: două locuri pentru același lucru e tocmai
   ce am scos din aplicație în cele cinci mutări de dinainte.
   ================================================================ */
console.log("\n=== 13. Ecranul «Fă concursul» ===");
{
  /* Marginea era „până la comentariul SETĂRI", adică se bizuia pe faptul că ecranul
     următor era chiar acela. Când s-a strecurat un ecran nou între ele, proba a început
     să numere cardurile VECINULUI. Acum se oprește la propriul </section>. */
  const deLaNou = src.indexOf('id="view-nou"');
  const nou = src.slice(deLaNou, src.indexOf("</section>", deLaNou));

  t("ecranul există", /<section class="view" id="view-nou">/.test(src), true);
  t("are drum înapoi la Acasă", /id="view-nou">[\s\S]{0,300}showView\('part'\)/.test(src), true);

  /* Exact lucrurile care fac un concurs, în ordinea în care se pun. */
  const titluri = (nou.match(/<div class="sec-title"[^>]*>([\s\S]*?)<\/div>/g) || [])
    .map((x) => x
      .replace(/<button[^>]*class="aj"[\s\S]*?<\/button>/g, "")
      .replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim());
  t("are exact cele patru lucruri care fac un concurs", titluri,
    ["Numele concursului", "Sectoare", "Manșe", "Orele manșelor"]);

  /* …și un buton la capăt care duce mai departe, nu te lasă în aer. */
  t("se termină cu drumul spre pescari",
    /onclick="showView\('cantar'\)"[\s\S]{0,120}Gata · trecem la pescari/.test(nou), true);
  t("…iar el e singurul scos în față pe ecran",
    (nou.match(/btn-primary/g) || []).length, 1);

  /* Mutate, nu copiate: nicăieri altundeva în pagină. */
  ["card-nume", "card-cronometru"].forEach(function (id) {
    t("«" + id + "» e o singură dată în toată pagina",
      (src.match(new RegExp('id="' + id + '"', "g")) || []).length, 1);
  });
  t("căsuța numelui nu e în două locuri",
    (src.match(/id="set-name"/g) || []).length, 1);
  t("…nici rândurile de ore", (src.match(/id="ore-manse"/g) || []).length, 1);
  t("…nici numărul de standuri", (src.match(/id="set-standuri"/g) || []).length,
    (src.match(/id="set-standuri"/g) || []).length);

  /* Drumul înapoi: din Contul meu se ajunge la el, altfel numele nu s-ar mai putea drege. */
  t("din Contul meu se ajunge înapoi la el",
    /id="card-concursul"[\s\S]{0,400}onclick="showView\('nou'\)"/.test(set), true);

  /* Bara de jos rămâne aprinsă pe Contul meu, ca la Baza de pescari. */
  /* „Fă concursul" e treapta 1 din scară, deci se agață de „Concursul" — butonul care
     ține scara. Înainte se agăța de Contul meu, fiindcă de-acolo se ajungea la el. */
  t("bara de jos știe de ecranul nou", /nou:"part"/.test(src), true);
  /* Rândurile de ore se fac din cod: la intrare trebuie aduse la zi. */
  t("orele se desenează la intrarea pe ecran", /if\(v==="nou"\) deseneazaOre\(\);/.test(src), true);
}

/* ================================================================
   14. Ecranul de verificare — semaforul.
   „Aplicația trebuie să inspire încredere și să prevină greșelile."
   Un pas din zi, nu o setare: de-aia NU e card în Contul meu.
   ================================================================ */
console.log("\n=== 14. Semaforul de verificare ===");
{
  const deLaV = src.indexOf('id="view-verific"');
  const v = src.slice(deLaV, src.indexOf("</section>", deLaV));

  t("ecranul există", deLaV > 0, true);
  t("are drum înapoi la Cântar", /showView\('cantar'\)/.test(v), true);
  t("are cele trei locuri care se umplu din cod",
    ["verific-far", "verific-lista", "verific-buton"].filter((id) => v.indexOf('id="' + id + '"') >= 0).length, 3);

  /* Nu e un card în Contul meu: acolo sunt setări, iar asta e un pas din zi. */
  t("nu s-a mai adăugat niciun card în Contul meu", carduri().length, 18);
  t("…și ecranul nu stă sub niciuna dintre cele trei uși",
    /id="view-verific"[\s\S]*?class="card( u[123])?"/.test(v) && /class="card u[123]"/.test(v), false);

  /* Bara de jos rămâne pe Cântar: de acolo vii, acolo te întorci să repari. */
  /* Verificarea e treapta 5: se agață tot de „Concursul", ca toate treptele. */
  t("bara de jos rămâne pe «Concursul»", /verific:"part"/.test(src), true);
  t("se redesenează la fiecare intrare",
    /if\(v==="verific"\) deseneazaVerificarea\(\);/.test(src), true);

  /* Miezul: pe roșu butonul e STINS, nu însoțit de un avertisment. */
  t("pe roșu butonul de publicare e stins",
    /stare === "rosu"\)[\s\S]{0,120}class="btn stins" disabled/.test(src), true);
  t("…și nu există niciun «publică totuși»",
    /public[ăa] totuși|salvezi totuși/i.test(src), false);
  t("butonul stins chiar arată stins", /\.btn\.stins\{/.test(src), true);

  /* Culorile semaforului nu sunt accentul aplicației: altfel verdictul s-ar citi ca
     încă un buton. */
  ["#3ddc84", "#f2b84b", "#ff6b6b"].forEach((c) =>
    t("semaforul are culoarea " + c, src.indexOf(c) > 0, true));
  t("…și niciuna nu e teal-ul butoanelor", /\.far\.[vpr]\s*\{[^}]*var\(--teal\)/.test(src), false);
}

/* ================================================================
   Debaraua: cardurile rar folosite se strâng
   ================================================================
   Măsurat pe 412px, cu un concurs pornit: după ușa „Telefonul" stăteau șase carduri
   desfăcute — 2229px, 2,5 ecrane; după „Nu merge ceva", opt carduri — 1821px. Sunt
   lucruri la care omul umblă o dată la câteva luni. Acum rămâne titlul, iar o atingere
   îl deschide: 751px și 848px, amândouă sub un ecran. Nu s-a șters niciun card.
   ================================================================ */
console.log("\n=== Debaraua din Contul meu ===");
{
  const vm2 = require("vm");
  const ctx = { console };
  vm2.createContext(ctx);
  ["cardPliabil", "cardPus"].forEach((n) => vm2.runInContext(H.grabFunction(src, n), ctx));

  /** un card de mimă, cu clasele lui */
  const card = (clase, cuTitlu) => ({
    _c: clase.split(" "),
    classList: {
      contains(x) { return this._o._c.indexOf(x) >= 0; },
      toggle(x, on) { const i = this._o._c.indexOf(x);
        if (on && i < 0) this._o._c.push(x);
        if (!on && i >= 0) this._o._c.splice(i, 1); },
    },
    querySelector(sel) { return (cuTitlu && sel.indexOf(".sec-title") >= 0)
      ? { _a: {}, setAttribute(k, v) { this._a[k] = v; } } : null; },
  });
  const fa = (clase, cuTitlu) => { const c = card(clase, cuTitlu); c.classList._o = c; return c; };
  const pliabil = (c) => { ctx.__c = c; return vm2.runInContext("cardPliabil(__c)", ctx); };

  t("cardurile ușii „Telefonul” se strâng", pliabil(fa("card u2", true)), true);
  t("…și cele de la „Nu merge ceva”", pliabil(fa("card u3 lockhide", true)), true);
  /* Ușa „Concursul" NU se atinge: acolo se intră înaintea fiecărui concurs. */
  t("…dar cele de la „Concursul” NU", pliabil(fa("card u1", true)), false);
  t("…iar un card fără titlu n-are de ce mâner", pliabil(fa("card u2", false)), false);

  const c = fa("card u2", true);
  ctx.__c = c;
  vm2.runInContext("cardPus(__c, false)", ctx);
  t("strâns, cardul poartă semnul", c._c.indexOf("strans") >= 0, true);
  vm2.runInContext("cardPus(__c, true)", ctx);
  t("…iar deschis, nu-l mai poartă", c._c.indexOf("strans") >= 0, false);
}
{
  /* Capcana obișnuită: fără `!important`, corpul cardului ar rămâne pe ecran. */
  t("regula care ascunde corpul cardului există",
    /\.card\.strans > \*:not\(\.sec-title\)\{display:none !important;\}/.test(src), true);
  t("…iar mânerul e cât un deget", /\.card\.plicat > \.sec-title\{[^}]*min-height:44px/.test(src), true);
  t("…și arată că se deschide", /\.card\.plicat > \.sec-title::after\{content:"▾"/.test(src), true);

  const u = H.grabFunction(src, "usaSet");
  t("ușa le strânge de fiecare dată când intri", /strangeCardurile\(\);/.test(u), true);

  const g = H.grabFunction(src, "strangeCardurile");
  t("mânerul se pune o singură dată", /if\(!c\.dataset\.plicat\)/.test(g), true);
  t("…și se poate apăsa și de la tastatură", /keydown/.test(g), true);

  const m = H.grabFunction(src, "meniuGo");
  t("cine e trimis la un card îl găsește deschis", /deschideCardul\(el\);/.test(m), true);

  const l = H.grabFunction(src, "toggleLock");
  t("„Setează întâi un PIN” duce chiar la cardul lui",
    /meniuGo\('set', 'card-pin'\)/.test(l), true);
  t("…iar cardul are numele după care e găsit",
    /<div class="card u2" id="card-pin">/.test(src), true);
}
{
  const m = H.citeste("sw.js").match(/concurs-pescuit-v(\d+)/);
  t("telefonul ia varianta nouă (v207 sau mai nouă)", m && parseInt(m[1], 10) >= 207, true);
}

t.raport();
