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
    out.push({ usa: usa, titlu: m[2].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim() });
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
  t("ecranul are tot atâtea carduri câte avea", toate.length, 21);
  t("niciunul nu a rămas fără ușă", toate.filter((c) => !c.usa).map((c) => c.titlu), []);
  t("nu s-a pierdut niciunul pe drum",
    ale("u1").length + ale("u2").length + ale("u3").length, 21);
}

/* ================================================================
   2. Ce stă după fiecare ușă — lista întreagă, ca s-o poată citi și el.
   ================================================================ */
console.log("\n=== 2. Ce e după fiecare ușă ===");
{
  t("Concursul — ce se pregătește înainte de start", ale("u1"), [
    "Numele concursului", "Sectoare", "Manșe", "Concurs pe echipe",
    "Puncte la sectoare inegale", "Import participanți", "Cum se calculează",
    "Baza de pescari",
  ]);
  t("Telefonul — ce se setează o dată", ale("u2"), [
    "Sincronizare & backup", "Clasament live pe alte telefoane",
    "Notificări live (doar Android/Chrome)", "Anunț vocal la cântar",
    "Pune iconița pe ecran", "Protecție cu PIN",
  ]);
  t("Nu merge ceva — reparațiile, rar sau niciodată", ale("u3"), [
    "Versiunea aplicației", "Curăță arhiva de sezon", "Moderare calendar regional",
    "Istoric cameră", "Adu înapoi ce era", "Serverul răspunde?", "Reset",
  ]);
}

/* ================================================================
   3. Câte se văd deodată — miezul plângerii „e stufoasă”.
   ================================================================ */
console.log("\n=== 3. Câte carduri vezi odată ===");
{
  const max = Math.max(ale("u1").length, ale("u2").length, ale("u3").length);
  t("cel mai încărcat ecran are 8 carduri, nu 21", max, 8);
  t("…adică mai puțin de jumătate din cât era", max * 2 < 21, true);
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
  vm.runInContext([H.grabFunction(src, "usaSet"), H.grabFunction(src, "usaPornire")].join("\n"), ctx);

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
  /* Cronometrul stă în Calendar, nu în Contul meu: dala trimitea în alt ecran. */
  t("dala Cronometru duce în ecranul unde chiar e cronometrul",
    /meniuGo\('cal','card-cronometru'\)/.test(src), true);
  t("…și nu mai duce în Contul meu", /meniuGo\('set','card-cronometru'\)/.test(src), false);
}

t.raport();
