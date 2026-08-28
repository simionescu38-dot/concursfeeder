/**
 * Cântarele de pe poza foii.
 *
 * „Facem aplicația să apară direct în meniul «Distribuie» al telefonului… deschizi
 * fotografia în WhatsApp, apeși Distribuie, alegi Feeder Moldova Iași."
 *
 * Poza foii ajunge ÎN aplicație și stă deasupra unei foi cu un rând pe pescar, în ordinea
 * standurilor: te uiți sus și scrii în jos. Până acum poza rămânea în WhatsApp și se sărea
 * între două aplicații la fiecare rând.
 *
 * Ce se păzește aici e ce a cerut el, punct cu punct: nimic nu se salvează fără
 * confirmare; se face o copie înainte; aceeași poză trecută de două ori se recunoaște;
 * cine are deja cântar nu primește căsuță; greutatea neobișnuit de mare se vede.
 *
 * Tot codul e scos VERBATIM din index.html.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const swSrc = H.citeste("sw.js");
const manifest = JSON.parse(H.citeste("manifest.json"));
const t = H.creeazaVerificator();

const FUNCTII = ["num", "fmt", "esc", "uid", "numManse", "manseRange", "emptyManche", "ensureManche",
  "mOf", "sectorOfM", "standOfM", "nameOf", "cantOfM", "extraOfM", "totalOfM", "nameKey",
  "standKeyM", "byStandM", "scrieInJurnal", "amprentaPozei", "randeazaFoaia", "scrieInFoaie",
  "improspateazaFoaieRezumat", "treceDeFoaie", "renuntaLaPoze", "inchidePozele"];

/** un DOM cât îi trebuie foii: elementele cerute pe nume, cu innerHTML și classList */
function elem() {
  const cls = new Set();
  return {
    innerHTML: "", textContent: "", value: "",
    classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: c => cls.has(c), _c: cls }
  };
}

function pornire(pescari, optiuni) {
  const o = optiuni || {};
  const el = {};
  ["poza-strip", "poza-info", "poza-mansa", "poza-foaie", "poza-rezumat", "st-total"].forEach(id => el[id] = elem());
  const ctx = {
    console, JSON, Date, Math, parseInt, parseFloat, isNaN, Array, Object, Number, Promise, Uint8Array,
    blocat: !!o.blocat, intrebat: [], raspunsLaConfirm: o.confirma !== false,
    toasturi: [], salvat: 0, copii: [], ecrane: [], magaziaStearsa: 0, urlEliberate: 0,
    pozePrimite: (o.poze || []).map((h, i) => ({ url: "blob:" + i, hash: h })),
    cantarePoza: {},
    document: { getElementById: id => el[id] || (el[id] = elem()) },
    guard() { return ctx.blocat; },
    confirm(q) { ctx.intrebat.push(q); return ctx.raspunsLaConfirm; },
    toast(m) { ctx.toasturi.push(m); },
    queueSave() { ctx.salvat++; },
    renderList() {},
    improspateazaCantariti() {},
    puneDeoParte(m) { ctx.copii.push(m); },
    sumAll() { return 0; },
    showView(v) { ctx.ecrane.push(v); },
    stergePozelePrimite() { ctx.magaziaStearsa++; return Promise.resolve(); },
    URL: { revokeObjectURL() { ctx.urlEliberate++; } }
  };
  ctx.el = el;
  ctx.state = {
    name: "Probă", manche: o.mansa || 1, numManse: 2, sectors: ["A", "B"], jurnal: [],
    pozeTrecute: (o.pozeTrecute || []).slice(),
    participants: pescari.map((x, i) => ({
      id: "p" + i, prenume: x.prenume, nume: x.nume, stand: x.stand, sector: "A",
      m: { 1: { catches: (x.catches || []).slice(), catchTimes: [], catchPhotos: [], extras: [], extraTimes: [], extraPhotos: [], stand: x.stand, sector: "A" },
           2: { catches: [], catchTimes: [], catchPhotos: [], extras: [], extraTimes: [], extraPhotos: [], stand: x.stand, sector: "A" } } }))
  };
  vm.createContext(ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  vm.runInContext("var PRAG_KG=" + /var PRAG_KG=(\d+)/.exec(src)[1] + ";", ctx);
  return ctx;
}

const LOT = [
  { stand: "3", prenume: "Vasile", nume: "Popescu" },
  { stand: "1", prenume: "Remus", nume: "Catalin" },
  { stand: "2", prenume: "Mihai", nume: "Ionescu" }
];

(async () => {
  /* ================================================================
     1. Foaia: un rând pe pescar, în ordinea standurilor
     ================================================================ */
  console.log("\n=== 1. Cum arată foaia ===");
  {
    const c = pornire(LOT);
    vm.runInContext("randeazaFoaia()", c);
    const h = c.el["poza-foaie"].innerHTML;
    const standuri = (h.match(/foaie-st">(\d+)</g) || []).map(x => x.replace(/\D/g, ""));

    t("e câte un rând de fiecare pescar", (h.match(/class="foaie-r/g) || []).length, 3);
    /* Foaia arbitrului e scrisă pe standuri. Dacă rândurile ar sta în ordinea în care au
       fost adăugați, cifrele de pe ecran ar sări față de cele din poză — exact bâlba pe
       care o repară ecranul ăsta. */
    t("rândurile stau în ordinea standurilor", standuri, ["1", "2", "3"]);
    t("fiecare are o căsuță de scris", (h.match(/<input/g) || []).length, 3);
    t("…și numele scris pe el", /Remus Catalin/.test(h), true);
    t("fără pescari, o spune", (() => {
      const g = pornire([]);
      vm.runInContext("randeazaFoaia()", g);
      return /Nu e niciun pescar/.test(g.el["poza-foaie"].innerHTML);
    })(), true);
  }
  {
    /* Cine are deja cântar NU primește căsuță: altfel a doua trecere de pe aceeași foaie
       i-ar aduna încă o dată juvelnicul, iar în clasament n-ar arăta nimic ciudat. */
    const c = pornire([{ stand: "1", prenume: "Mihai", nume: "Ionescu", catches: [10.5] },
                       { stand: "2", prenume: "Vasile", nume: "Popescu" }]);
    vm.runInContext("randeazaFoaia()", c);
    const h = c.el["poza-foaie"].innerHTML;
    t("cel cântărit n-are căsuță", (h.match(/<input/g) || []).length, 1);
    t("…dar i se arată ce are", /are 10,500/.test(h), true);
  }

  /* ================================================================
     2. Ce se scrie în foaie rămâne deocamdată în aer
     ================================================================ */
  console.log("\n=== 2. Scrisul în foaie ===");
  {
    const c = pornire(LOT);
    vm.runInContext("randeazaFoaia(); scrieInFoaie('p1','12,340'); scrieInFoaie('p2','8.150')", c);
    t("virgula se citește", vm.runInContext("cantarePoza.p1", c), 12.34);
    t("punctul se citește la fel", vm.runInContext("cantarePoza.p2", c), 8.15);
    t("nimic nu s-a scris în concurs", vm.runInContext("state.participants[1].m[1].catches", c), []);
    t("…și nici în jurnal", vm.runInContext("state.jurnal.length", c), 0);

    t("rezumatul numără și adună", /2 cântare scrise · 20,490 kg/.test(c.el["poza-rezumat"].innerHTML), true);
    vm.runInContext("scrieInFoaie('p1','')", c);
    t("căsuța golită scoate cântarul", vm.runInContext("'p1' in cantarePoza", c), false);
    t("…și rezumatul scade", /1 cântar scris · 8,150 kg/.test(c.el["poza-rezumat"].innerHTML), true);
  }
  {
    // greutatea neobișnuit de mare se VEDE, nu se oprește: un juvelnic de 60 kg există,
    // unul de 600 e o virgulă pusă greșit
    const c = pornire(LOT);
    vm.runInContext("randeazaFoaia(); scrieInFoaie('p1','600')", c);
    t("greutatea prea mare se însemnează", c.el["fr-p1"].classList.contains("mare"), true);
    t("…dar tot intră în socoteală", vm.runInContext("cantarePoza.p1", c), 600);
    t("…și se spune în rezumat", /peste 50 kg/.test(c.el["poza-rezumat"].innerHTML), true);
    vm.runInContext("scrieInFoaie('p1','12,340')", c);
    t("corectată, semnul dispare", c.el["fr-p1"].classList.contains("mare"), false);
  }

  /* ================================================================
     3. Trecerea în concurs
     ================================================================ */
  console.log("\n=== 3. „Trece cântarele\" ===");
  {
    const c = pornire(LOT, { poze: ["a1"] });
    vm.runInContext("randeazaFoaia(); scrieInFoaie('p1','12,340'); scrieInFoaie('p2','8,150'); treceDeFoaie()", c);

    t("cântarele au intrat", vm.runInContext("[state.participants[1].m[1].catches, state.participants[2].m[1].catches]", c), [[12.34], [8.15]]);
    t("cine n-a fost scris a rămas gol", vm.runInContext("state.participants[0].m[1].catches", c), []);
    t("s-a întrebat o dată", c.intrebat.length, 1);
    t("…cu numărul și manșa în întrebare", /Treci 2 cântare în manșa 1\?/.test(c.intrebat[0]), true);
    t("s-a pus o copie deoparte", c.copii, ["înainte de cântarele de pe poză"]);
    t("s-a salvat", c.salvat > 0, true);
    t("jurnalul spune de unde vin", vm.runInContext("state.jurnal.map(function(x){return x.cine;})", c), ["de pe poză", "de pe poză"]);
    t("…cu greutățile", vm.runInContext("state.jurnal.map(function(x){return x.kg;})", c), [12.34, 8.15]);
    t("amprenta foii s-a ținut minte", vm.runInContext("state.pozeTrecute", c), ["a1"]);
    t("magazia de poze s-a golit", c.magaziaStearsa > 0, true);
    t("se întoarce la Cântar", c.ecrane[c.ecrane.length - 1], "cantar");
    t("foaia s-a golit", vm.runInContext("Object.keys(cantarePoza).length", c), 0);
  }

  /* ================================================================
     4. Ce NU trebuie să se întâmple
     ================================================================ */
  console.log("\n=== 4. Paze ===");
  {
    const c = pornire(LOT, { blocat: true });
    vm.runInContext("randeazaFoaia(); cantarePoza.p1=12.34; treceDeFoaie()", c);
    t("pe telefonul blocat nu intră nimic", vm.runInContext("state.jurnal.length", c), 0);
    t("…și nici nu se întreabă", c.intrebat.length, 0);
  }
  {
    const c = pornire(LOT, { confirma: false });
    vm.runInContext("randeazaFoaia(); cantarePoza.p1=12.34; treceDeFoaie()", c);
    t("dacă răspunde „nu\", nu intră nimic", vm.runInContext("state.jurnal.length", c), 0);
    t("…și copia nu se pune degeaba", c.copii, []);
    t("…iar foaia rămâne scrisă", vm.runInContext("cantarePoza.p1", c), 12.34);
  }
  {
    const c = pornire(LOT);
    vm.runInContext("treceDeFoaie()", c);
    t("foaie goală: nu se întreabă", c.intrebat.length, 0);
    t("…și se spune de ce", /N-ai scris niciun cântar/.test(c.toasturi.join(" ")), true);
  }
  {
    /* Aceeași foaie trimisă de două ori ar dubla toate cântarele, iar dublura nu s-ar mai
       vedea în clasament. Amprenta o prinde și o spune ÎN întrebare. */
    const c = pornire(LOT, { poze: ["a1"], pozeTrecute: ["a1"] });
    vm.runInContext("randeazaFoaia(); scrieInFoaie('p1','12,340'); treceDeFoaie()", c);
    t("poza deja trecută e strigată în întrebare", /a mai fost trecută/.test(c.intrebat[0]), true);
    t("…și se spune ce s-ar întâmpla", /s-ar dubla/.test(c.intrebat[0]), true);
    t("amprenta nu se scrie de două ori", vm.runInContext("state.pozeTrecute", c), ["a1"]);
  }
  {
    const c = pornire(LOT);
    vm.runInContext("randeazaFoaia(); scrieInFoaie('p1','600'); treceDeFoaie()", c);
    t("greutatea prea mare e strigată în întrebare", /peste 50 kg — uită-te încă o dată/.test(c.intrebat[0]), true);
  }
  {
    const c = pornire(LOT, { mansa: 2 });
    vm.runInContext("randeazaFoaia(); scrieInFoaie('p1','12,340'); treceDeFoaie()", c);
    t("intră în manșa deschisă, nu în alta", vm.runInContext("state.participants[1].m[2].catches", c), [12.34]);
    t("…iar manșa 1 rămâne goală", vm.runInContext("state.participants[1].m[1].catches", c), []);
  }
  {
    // amprentele n-au de ce să crească la nesfârșit
    const c = pornire(LOT, { poze: ["nou"], pozeTrecute: Array.from({ length: 40 }, (_, i) => "v" + i) });
    vm.runInContext("randeazaFoaia(); scrieInFoaie('p1','12,340'); treceDeFoaie()", c);
    const pt = vm.runInContext("state.pozeTrecute", c);
    t("se țin doar ultimele patruzeci de amprente", pt.length, 40);
    t("…iar cea nouă e printre ele", pt.indexOf("nou") >= 0, true);
  }

  /* ================================================================
     5. „Renunț"
     ================================================================ */
  console.log("\n=== 5. „Renunț\" ===");
  {
    const c = pornire(LOT, { confirma: false });
    vm.runInContext("randeazaFoaia(); scrieInFoaie('p1','12,340'); renuntaLaPoze()", c);
    t("întreabă înainte să piardă ce e scris", /Renunți\? Ce ai scris/.test(c.intrebat[0] || ""), true);
    t("…și dacă zice nu, nu pierde nimic", vm.runInContext("cantarePoza.p1", c), 12.34);
  }
  {
    const c = pornire(LOT, { poze: ["a1"] });
    vm.runInContext("renuntaLaPoze()", c);
    t("cu foaia goală nu întreabă degeaba", c.intrebat.length, 0);
    t("magazia se golește", c.magaziaStearsa > 0, true);
    t("pozele deschise se eliberează din memorie", c.urlEliberate > 0, true);
    t("nimic nu s-a scris în concurs", vm.runInContext("state.jurnal.length", c), 0);
  }

  /* ================================================================
     6. Amprenta pozei
     ================================================================ */
  console.log("\n=== 6. Amprenta foii ===");
  {
    const c = pornire(LOT);
    c.Blob = Blob;
    const amp = async b => { c.__b = b; return vm.runInContext("amprentaPozei(__b)", c); };
    const poza = s => new Blob([s], { type: "image/jpeg" });

    const a = await amp(poza("foaia unu".repeat(9000)));
    const a2 = await amp(poza("foaia unu".repeat(9000)));
    const b = await amp(poza("foaia doi".repeat(9000)));
    t("aceeași poză dă aceeași amprentă", a, a2);
    t("altă poză dă altă amprentă", a !== b, true);
    t("amprenta e scurtă, nu toată poza", a.length < 30, true);
    // două poze de aceeași mărime dar cu alt conținut nu trebuie confundate
    t("mărimea singură nu ajunge", a.split("-")[0] === b.split("-")[0] && a !== b, true);
  }

  /* ================================================================
     7. Legăturile din afară: manifest, service worker, ecran
     ================================================================ */
  console.log("\n=== 7. Drumul poza → aplicație ===");
  {
    const st = manifest.share_target;
    t("manifestul spune că aplicația primește poze", !!st, true);
    t("…prin POST, cum cere trimiterea de fișiere", [st.method, st.enctype], ["POST", "multipart/form-data"]);
    t("…jpg, png și webp", st.params.files[0].accept, ["image/jpeg", "image/png", "image/webp"]);
    t("…numele câmpului e cel pe care-l citește service worker-ul", st.params.files[0].name, "poze");
    t("…iar adresa e cea pe care o prinde el", /\?poze=1/.test(st.action), true);
    t("adresa stă în domeniul aplicației (scope)", st.action.indexOf("./") === 0, true);
  }
  {
    t("service worker-ul oprește POST-ul cu poze",
      /e\.request\.method === "POST" && url\.searchParams\.has\("poze"\)/.test(swSrc), true);
    t("…citește câmpul „poze\"", /form\.getAll\("poze"\)/.test(swSrc), true);
    t("…le pune în magazia lor", /caches\.open\(POZE\)/.test(swSrc), true);
    /* Fără golirea magaziei, foile de duminica trecută ar apărea lângă cele de azi. */
    t("…golind-o de trimiterea dinainte", /vechi\.map\(function \(k\) \{ return c\.delete\(k\); \}\)/.test(swSrc), true);
    t("…și întoarce aplicația cu GET (303)", /Response\.redirect\([\s\S]{0,80}303\)/.test(swSrc), true);
    /* Activarea șterge toate cache-urile în afară de al aplicației. Fără excepția asta, o
       poză trimisă chiar în clipa unei actualizări ar dispărea, iar omul ar ateriza pe un
       ecran gol fără să înțeleagă de ce. */
    t("actualizarea aplicației nu șterge pozele primite",
      /k !== CACHE && k !== POZE/.test(swSrc), true);
    t("versiunea din service worker a fost urcată", /concurs-pescuit-v135/.test(swSrc), true);
  }
  {
    t("ecranul de import există", /<section class="view" id="view-poze">/.test(src), true);
    // nu are tab propriu: se ajunge din „Distribuie" sau din pliantul de pe Cântar
    t("nu s-a mai pus un buton în bara de jos", /id="tab-poze"/.test(src), false);
    t("…dar se aprinde tabul Cântar", /poze:"cantar"/.test(src), true);
    t("un singur buton albastru pe ecranul lui", (() => {
      const s0 = src.indexOf('id="view-poze"');
      const v = src.slice(s0, src.indexOf('<section class="view"', s0 + 10));
      return (v.match(/btn-primary/g) || []).length;
    })(), 1);
    t("are și „Renunț\"", /onclick="renuntaLaPoze\(\)"/.test(src), true);
    t("pornirea citește pozele primite", /qp\.has\("poze"\)[\s\S]{0,120}iaPozelePrimite\(\)/.test(src), true);
    /* Fără curățarea adresei, o reîncărcare ar redeschide importul la nesfârșit. */
    t("…și curăță adresa după", /qp\.has\("poze"\)[\s\S]{0,220}history\.replaceState/.test(src), true);

    // variantele de rezervă: aceleași verificări, fără WhatsApp — așa se poate proba tot drumul
    t("se poate alege o poză din telefon", /onclick="document\.getElementById\('poza-fis'\)\.click\(\)"/.test(src), true);
    t("…mai multe deodată", /id="poza-fis"[^>]*multiple/.test(src), true);
    t("se poate fotografia foaia pe loc", /id="poza-cam"[^>]*capture="environment"/.test(src), true);
    t("amândouă duc în același ecran", (src.match(/onchange="pozeDinTelefon\(this\)"/g) || []).length, 2);

    /* Poza nu intră în starea concursului: ar umfla și memoria telefonului, și ce urcă la
       sincronizare — buba reparată în v131. */
    const tr = H.grabFunction(src, "treceDeFoaie");
    t("poza nu se scrie în starea concursului", /catchPhotos\.push\(null\)/.test(tr), true);
    t("…și nu se agață de participant", /p\.photo\s*=/.test(tr), false);
  }

  t.raport();
})();
