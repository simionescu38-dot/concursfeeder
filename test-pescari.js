/**
 * Baza de pescari: fiecare om cu codul lui, o dată, pentru tot sezonul.
 *
 * De ce există: clasamentul de sezon leagă oamenii DUPĂ NUME. „Ciufi Man" și
 * „Ciufy Man" au ieșit doi pescari, fiecare cu un concurs, amândoi sub pragul de
 * clasare — deși omul fusese la două etape. Cu un cod, omul E codul.
 *
 * Ce se probează aici:
 *   1. codurile se dau pe rând și NU se refolosesc după ce scoți pe cineva;
 *   2. același om, scris cu sau fără diacritice, e găsit ca fiind deja în bază;
 *   3. umplerea din concursul de pe telefon sare peste cine e deja acolo;
 *   4. baza stă în cheia ei, deci nu se golește când începe un concurs nou;
 *   5. ecranul e legat cum trebuie (buton, înapoi, lacăt).
 *
 * Testul rulează codul REAL din index.html.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));

/* ================================================================
   Bancul de probă: funcțiile adevărate, într-o lume de carton
   ================================================================ */
const NUME = [
  "pescariIncarca", "pescariSalveaza", "pescarCodNou", "cheiePescar", "pescarCauta",
  "numePescar", "scrierileLui", "pescarNou", "pescarAdauga", "pescarSterge", "pescariDinConcurs", "renderPescari",
  "faraSemne", "esc", "uid"
];

/** lume nouă la fiecare bucată de test, ca una să n-o murdărească pe alta */
function lume(optiuni) {
  const o = optiuni || {};
  const memorie = Object.assign({}, o.localStorage || {});
  const campuri = { "pb-prenume": { value: o.prenume || "", focus() {} },
                    "pb-nume":    { value: o.nume    || "", focus() {} },
                    "pescari-cauta": { value: o.cauta || "" } };
  const cutii = {};
  ["pescari-numar", "pescari-din-concurs-cati", "pescari-din-concurs", "pescari-lista", "pescari-sezon"]
    .forEach(id => { cutii[id] = { innerHTML: "", style: {} }; });

  const ctx = {
    console,
    toast: msg => ctx.toasturi.push(msg),
    toasturi: [],
    confirm: () => (o.confirma === undefined ? true : o.confirma),
    guard: () => !!o.blocat,
    isLocked: () => !!o.blocat,
    state: o.state || { name: "", participants: [] },
    Date, Math, JSON, parseInt, String, Array,
    localStorage: {
      getItem: k => (k in memorie ? memorie[k] : null),
      setItem: (k, v) => { if (o.stocarePlina) throw new Error("plin"); memorie[k] = v; },
    },
    memorie,
    campuri, cutii,
    document: { getElementById: id => campuri[id] || cutii[id] || null }
  };
  vm.createContext(ctx);
  vm.runInContext(NUME.map(n => grabFunction(src, n)).join("\n"), ctx);
  /* variabilele de modul (cheia și lista) nu sunt funcții, deci se scot separat */
  vm.runInContext('var PESCARI_KEY="concurs-pescari-v1"; var pescari=[]; var pescariUltimCod=0;', ctx);
  vm.runInContext("pescariIncarca();", ctx);
  return ctx;
}

/** adaugă un om prin butonul adevărat, nu prin push în listă */
function adauga(ctx, prenume, nume) {
  ctx.campuri["pb-prenume"].value = prenume;
  ctx.campuri["pb-nume"].value = nume;
  vm.runInContext("pescarAdauga();", ctx);
}
const lista = ctx => vm.runInContext("JSON.parse(JSON.stringify(pescari))", ctx);
const coduri = ctx => lista(ctx).map(p => p.cod);

/* ================================================================
   1. Codurile se dau pe rând
   ================================================================ */
console.log("\n=== 1. Codurile se dau pe rând ===");
{
  const ctx = lume();
  t("baza pornește goală", lista(ctx).length, 0);
  t("primul cod ar fi 1", vm.runInContext("pescarCodNou()", ctx), 1);

  adauga(ctx, "Mihai", "Ionescu");
  adauga(ctx, "Vasile", "Popescu");
  adauga(ctx, "Ștefan", "Bălan");
  t("trei oameni în bază", lista(ctx).length, 3);
  t("codurile sunt 1, 2, 3", coduri(ctx), [1, 2, 3]);
  t("numele au intrat întregi", lista(ctx).map(p => p.prenume + " " + p.nume),
    ["Mihai Ionescu", "Vasile Popescu", "Ștefan Bălan"]);
  t("i se spune omului ce cod a primit", ctx.toasturi[2], "Ștefan Bălan — codul 3");
  t("câmpurile se golesc după adăugare",
    [ctx.campuri["pb-prenume"].value, ctx.campuri["pb-nume"].value], ["", ""]);
}

/* ================================================================
   2. Codul scos NU se mai dă nimănui
   ------------------------------------------------------------------
   Dacă următorul cod ar fi „câți sunt în bază, plus unu", scoaterea unui om ar da
   numărătoarea înapoi peste un cod deja folosit. Doi oameni din concursuri diferite
   ar ajunge cu același cod, iar clasamentul de sezon i-ar aduna la un loc — exact
   greșeala pe care baza asta trebuie s-o repare.
   ================================================================ */
console.log("\n=== 2. Codul scos nu se mai dă nimănui ===");
{
  const ctx = lume();
  adauga(ctx, "Mihai", "Ionescu");
  adauga(ctx, "Vasile", "Popescu");
  adauga(ctx, "Ion", "Țăranu");
  t("trei coduri date", coduri(ctx), [1, 2, 3]);

  const alTreilea = lista(ctx)[2].id;
  ctx.id = alTreilea;
  vm.runInContext("pescarSterge(id);", ctx);
  t("au rămas doi", lista(ctx).length, 2);
  t("următorul cod e 4, nu 3", vm.runInContext("pescarCodNou()", ctx), 4);

  adauga(ctx, "Radu", "Georgescu");
  t("al patrulea om ia codul 4", coduri(ctx), [1, 2, 4]);
  t("nimeni nu are codul 3", lista(ctx).filter(p => p.cod === 3).length, 0);

  /* și dacă scoți pe primul, cei de după nu se mută cu un pas în jos */
  ctx.id = lista(ctx)[0].id;
  vm.runInContext("pescarSterge(id);", ctx);
  t("codurile celorlalți rămân neatinse", coduri(ctx), [2, 4]);
  t("următorul cod tot 5 e", vm.runInContext("pescarCodNou()", ctx), 5);
}

console.log("\n=== 2b. Scoaterea se întreabă întâi ===");
{
  const ctx = lume({ confirma: false });
  adauga(ctx, "Mihai", "Ionescu");
  ctx.id = lista(ctx)[0].id;
  vm.runInContext("pescarSterge(id);", ctx);
  t("dacă zice «nu», omul rămâne în bază", lista(ctx).length, 1);
}

/* ================================================================
   3. Același om, scris în două feluri
   ================================================================ */
console.log("\n=== 3. Același om, scris în două feluri ===");
{
  const ctx = lume();
  adauga(ctx, "Petrică", "Cazacu");
  t("un singur Petrică", lista(ctx).length, 1);

  adauga(ctx, "Petrica", "Cazacu");
  t("fără diacritice, tot el e", lista(ctx).length, 1);
  t("i se spune că e deja în bază", ctx.toasturi[1], "Petrică Cazacu e deja în bază, cu codul 1");

  adauga(ctx, "PETRICĂ", "CAZACU");
  t("cu majuscule, tot el", lista(ctx).length, 1);
  adauga(ctx, "  Petrică ", " Cazacu  ");
  t("cu spații în plus, tot el", lista(ctx).length, 1);

  adauga(ctx, "Ștefan", "Bălan");
  t("un om chiar nou intră", lista(ctx).length, 2);
  t("și ia codul următor", coduri(ctx), [1, 2]);

  /* ce nu poate ști aplicația singură: două nume care n-au nicio literă comună.
     De-aia există codul — omul îl are pe al lui, indiferent cum îi scrie numele. */
  adauga(ctx, "Ciufi", "Man");
  t("«Ciufi Man» e om nou pentru aplicație", lista(ctx).length, 3);
}

console.log("\n=== 3b. Căutarea după nume și după cod ===");
{
  const ctx = lume();
  adauga(ctx, "Petrică", "Cazacu");
  adauga(ctx, "Ștefan", "Bălan");
  ctx.pr = "Stefan"; ctx.nm = "Balan";
  t("găsește după nume fără diacritice", vm.runInContext("pescarCauta(pr,nm).cod", ctx), 2);
  ctx.pr = "Nimeni"; ctx.nm = "Nimeni";
  t("nu inventează pe cineva", vm.runInContext("pescarCauta(pr,nm)", ctx), null);
  ctx.pr = ""; ctx.nm = "";
  t("numele gol nu se potrivește cu nimeni", vm.runInContext("pescarCauta(pr,nm)", ctx), null);
}

/* ================================================================
   4. Umplerea din concursul de pe telefon
   ================================================================ */
console.log("\n=== 4. Ia-i din concursul de acum ===");
{
  const concurs = { name: "Cupa Feeder Moldova", participants: [
    { prenume: "Mihai",   nume: "Ionescu" },
    { prenume: "Petrica", nume: "Cazacu" },   // e deja în bază, scris fără diacritice
    { prenume: "Ion",     nume: "Țăranu" },
    { prenume: "",        nume: "" },         // rând gol pe foaie: nu e om
    { prenume: "Mihai",   nume: "Ionescu" }   // scris de două ori în concurs
  ]};
  const ctx = lume({ state: concurs });
  adauga(ctx, "Petrică", "Cazacu");
  vm.runInContext("pescariDinConcurs();", ctx);

  t("au intrat doar cei noi", lista(ctx).map(p => p.prenume + " " + p.nume),
    ["Petrică Cazacu", "Mihai Ionescu", "Ion Țăranu"]);
  t("codurile merg mai departe de unde erau", coduri(ctx), [1, 2, 3]);
  t("rândul gol n-a devenit pescar", lista(ctx).filter(p => !p.prenume && !p.nume).length, 0);
  t("cel scris de două ori a intrat o dată", lista(ctx).filter(p => p.prenume === "Mihai").length, 1);
  t("se spune câți au intrat și câți erau", ctx.toasturi[1], "Adăugați 2 · 1 erau deja în bază");

  /* a doua apăsare nu mai are ce adăuga */
  vm.runInContext("pescariDinConcurs();", ctx);
  t("a doua apăsare nu adaugă nimic", lista(ctx).length, 3);
  t("și o spune pe șleau", ctx.toasturi[2], "Toți erau deja în bază");
}

console.log("\n=== 4b. Fără concurs pe telefon ===");
{
  const ctx = lume({ state: { name: "", participants: [] } });
  vm.runInContext("renderPescari();", ctx);
  t("bucata «din concursul de acum» se ascunde", ctx.cutii["pescari-din-concurs"].style.display, "none");

  const ctx2 = lume({ state: { name: "Cupa de probă", participants: [{ prenume: "Mihai", nume: "Ionescu" }] } });
  vm.runInContext("renderPescari();", ctx2);
  t("cu concurs pe telefon, bucata se vede", ctx2.cutii["pescari-din-concurs"].style.display, "");
  t("scrie ce concurs e și câți lipsesc",
    ctx2.cutii["pescari-din-concurs-cati"].innerHTML,
    "Pe telefon e concursul <b>Cupa de probă</b>, cu <b>1</b> pescari, dintre care <b>1</b> nu-s încă în bază.");
}

/* ================================================================
   5. Baza ține de sezon, nu de concurs
   ================================================================ */
console.log("\n=== 5. Baza ține de sezon, nu de concurs ===");
{
  const ctx = lume();
  adauga(ctx, "Mihai", "Ionescu");
  adauga(ctx, "Vasile", "Popescu");
  t("s-a salvat în cheia ei", "concurs-pescari-v1" in ctx.memorie, true);
  t("nu s-a atins cheia concursului", "concurs-pescuit-v1" in ctx.memorie, false);

  /* telefonul se închide și se redeschide: baza trebuie să fie tot acolo */
  const ctx2 = lume({ localStorage: ctx.memorie });
  t("la redeschidere, oamenii sunt tot acolo", lista(ctx2).length, 2);
  t("cu codurile lor", coduri(ctx2), [1, 2]);
  adauga(ctx2, "Ion", "Țăranu");
  t("următorul cod continuă de unde a rămas", coduri(ctx2), [1, 2, 3]);

  /* Cazul care contează cel mai mult: scoți tocmai omul cu codul cel mai mare, apoi
     închizi telefonul. Dacă numărătoarea s-ar reface din listă, la redeschidere codul
     lui ar fi liber și l-ar lua altcineva. */
  ctx2.id = lista(ctx2)[2].id;
  vm.runInContext("pescarSterge(id);", ctx2);
  const ctx3 = lume({ localStorage: ctx2.memorie });
  t("codul celui scos rămâne pierdut și după repornire",
    vm.runInContext("pescarCodNou()", ctx3), 4);
  adauga(ctx3, "Radu", "Georgescu");
  t("următorul venit ia 4, nu codul lui Ion", coduri(ctx3), [1, 2, 4]);
}

console.log("\n=== 5b. Memorie stricată sau plină ===");
{
  t("cheie stricată → bază goală, nu pagină moartă",
    lista(lume({ localStorage: { "concurs-pescari-v1": "{asta nu-i JSON" } })).length, 0);
  t("cheie cu altceva decât o listă → bază goală",
    lista(lume({ localStorage: { "concurs-pescari-v1": '{"a":1}' } })).length, 0);

  const plin = lume({ stocarePlina: true });
  adauga(plin, "Mihai", "Ionescu");
  t("stocare plină → i se spune omului", plin.toasturi[0], "Stocare plină – nu am putut salva baza");
}

/* ================================================================
   6. Lacătul
   ================================================================ */
console.log("\n=== 6. Cu lacătul pus nu se scrie ===");
{
  const ctx = lume({ blocat: true, state: { name: "Cupa", participants: [{ prenume: "Ion", nume: "Țăranu" }] } });
  adauga(ctx, "Mihai", "Ionescu");
  t("nu se adaugă nimeni", lista(ctx).length, 0);
  vm.runInContext("pescariDinConcurs();", ctx);
  t("nici din concurs", lista(ctx).length, 0);
}

console.log("\n=== 6b. Lista se vede, dar fără butonul de scos ===");
{
  const ctx = lume();
  adauga(ctx, "Mihai", "Ionescu");
  vm.runInContext("renderPescari();", ctx);
  const deschis = ctx.cutii["pescari-lista"].innerHTML;
  t("descuiat: se vede și numele, și codul",
    /class="cod">1<\/div><div class="nm">Mihai Ionescu/.test(deschis), true);
  t("descuiat: are buton de scos", /pescarSterge\(/.test(deschis), true);

  const blocat = lume({ blocat: true, localStorage: ctx.memorie });
  vm.runInContext("renderPescari();", blocat);
  const inchis = blocat.cutii["pescari-lista"].innerHTML;
  t("blocat: numele și codul se văd tot", /Mihai Ionescu/.test(inchis), true);
  t("blocat: nu are buton de scos", /pescarSterge\(/.test(inchis), false);
}

/* ================================================================
   7. Ce se vede pe ecran
   ================================================================ */
console.log("\n=== 7. Ce se vede pe ecran ===");
{
  const gol = lume();
  vm.runInContext("renderPescari();", gol);
  t("baza goală o spune limpede",
    gol.cutii["pescari-numar"].innerHTML, "Baza e goală. Adaugă-i mai jos, sau ia-i dintr-un concurs.");
  t("și lista arată de ce e goală", /Niciun pescar în bază/.test(gol.cutii["pescari-lista"].innerHTML), true);

  const ctx = lume();
  adauga(ctx, "Mihai", "Ionescu");
  adauga(ctx, "Vasile", "Popescu");
  vm.runInContext("renderPescari();", ctx);
  t("scrie câți sunt, codurile retrase și codul următor",
    ctx.cutii["pescari-numar"].innerHTML,
    "<b>2</b> pescari activi · <b>0</b> coduri retrase · următorul cod: <b>3</b>");

  vm.runInContext("pescarSterge(pescari[0].id);", ctx);
  vm.runInContext("renderPescari();", ctx);
  t("un cod șters apare retras și nu se dă din nou",
    ctx.cutii["pescari-numar"].innerHTML,
    "<b>1</b> pescari activi · <b>1</b> coduri retrase · următorul cod: <b>3</b>");
}

console.log("\n=== 7b. Căutarea din listă ===");
{
  const ctx = lume();
  adauga(ctx, "Mihai", "Ionescu");
  adauga(ctx, "Ștefan", "Bălan");
  adauga(ctx, "Vasile", "Popescu");

  const cauta = q => {
    const c = lume({ localStorage: ctx.memorie, cauta: q });
    vm.runInContext("renderPescari();", c);
    return c.cutii["pescari-lista"].innerHTML;
  };
  t("caută după nume", /Ștefan Bălan/.test(cauta("stefan")), true);
  t("…și nu-i arată pe ceilalți", /Mihai/.test(cauta("stefan")), false);
  t("caută după numele de familie", /Vasile Popescu/.test(cauta("popescu")), true);
  t("caută după cod", /Mihai Ionescu/.test(cauta("1")), true);
  t("…iar codul 1 nu-l aduce pe al treilea", /Vasile/.test(cauta("1")), false);
  t("căutare fără niciun rezultat o spune", /Niciun pescar găsit/.test(cauta("zzz")), true);
  t("căsuța goală îi arată pe toți",
    (cauta("").match(/class="pesc"/g) || []).length, 3);
}

console.log("\n=== 7c. Lista se scrie în ordinea codurilor ===");
{
  const ctx = lume();
  adauga(ctx, "Vasile", "Popescu");
  adauga(ctx, "Mihai", "Ionescu");
  adauga(ctx, "Ștefan", "Bălan");
  ctx.id = lista(ctx)[0].id;
  vm.runInContext("pescarSterge(id);", ctx);
  adauga(ctx, "Ion", "Țăranu");
  vm.runInContext("renderPescari();", ctx);
  const html = ctx.cutii["pescari-lista"].innerHTML;
  t("codurile apar crescător, cu golul lăsat de cel scos",
    (html.match(/class="cod">(\d+)</g) || []).map(x => x.replace(/\D/g, "")), ["2", "3", "4"]);
}

console.log("\n=== 7d. Numele nu poate intra ca HTML ===");
{
  const ctx = lume();
  adauga(ctx, "<script>", "alert(1)");
  vm.runInContext("renderPescari();", ctx);
  t("un nume cu semne de cod se scrie ca text",
    /&lt;script&gt;/.test(ctx.cutii["pescari-lista"].innerHTML), true);
  t("…și nu ajunge etichetă adevărată",
    /<script>/.test(ctx.cutii["pescari-lista"].innerHTML), false);

  const ctx2 = lume({ state: { name: '<b>"rău"</b>', participants: [{ prenume: "Ion", nume: "Țăranu" }] } });
  vm.runInContext("renderPescari();", ctx2);
  t("nici numele concursului",
    /&lt;b&gt;/.test(ctx2.cutii["pescari-din-concurs-cati"].innerHTML), true);
}

/* ================================================================
   8. Ecranul e legat cum trebuie
   ================================================================ */
console.log("\n=== 8. Ecranul e legat cum trebuie ===");
{
  t("există ecranul", /<section class="view" id="view-pescari">/.test(src), true);
  t("se ajunge la el dintr-un buton", /onclick="showView\('pescari'\)"/.test(src), true);
  t("butonul stă în «Setat o dată, și gata»",
    src.indexOf('id="pliant-odata"') < src.indexOf("showView('pescari')") &&
    src.indexOf("showView('pescari')") < src.indexOf('id="view-pescari"'), true);
  t("butonul spune ce face", /Deschide baza de pescari<\/button>/.test(src), true);
  t("are drum înapoi", /id="view-pescari">[\s\S]{0,200}showView\('set'\)/.test(src), true);
  t("showView îl desenează la intrare", /if\(v==="pescari"\) renderPescari\(\);/.test(src), true);
  t("bara de jos rămâne aprinsă pe Contul meu", /pescari:"set"/.test(src), true);
  t("baza se citește la pornirea aplicației",
    /load\(\);\s*\r?\n\s*pescariIncarca\(\);/.test(src), true);

  /* un singur buton scos în față pe ecran: restul, ghost */
  const ecran = src.slice(src.indexOf('id="view-pescari"'), src.indexOf('id="view-spons"'));
  t("un singur btn-primary pe ecran", (ecran.match(/btn-primary/g) || []).length, 1);
  t("cardurile de scris se ascund la lacăt", (ecran.match(/card lockhide/g) || []).length, 2);
  t("cardul cu lista NU se ascunde la lacăt",
    /id="pescari-lista"/.test(ecran) && !/lockhide[^>]*>\s*<div id="pescari-lista"/.test(ecran), true);
}

t.raport();
