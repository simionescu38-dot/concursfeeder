/**
 * Tandem în clasamentul de sezon.
 *
 * În concurs, o echipă de doi e UN concurent: un stand, un cântar, un loc în sector. În
 * sezon însă rezultatul ei trebuie să conteze pentru AMÂNDOI, individual — altfel cine
 * schimbă partenerul de la o etapă la alta pierde tot ce a pescuit cu celălalt.
 *
 * Coechipierul e scris de mână la înscriere, deci n-are cod de pescar: se leagă după nume,
 * ca pescarii dinaintea codurilor.
 *
 * Se rulează bucata ADEVĂRATĂ de agregare din sezon.html, scoasă din `loadSeason` — nu o
 * copie care poate diverge.
 */
const vm = require("vm");
const H = require("./test-helpers.js");

const t = H.creeazaVerificator();
const src = H.citeste("sezon.html");

/* Bucata de agregare stă înăuntrul lui loadSeason, deci nu se poate lua cu grabFunction.
   Se taie între două repere stabile și se rulează cu ajutoarele reale din pagină. */
const start = src.indexOf("      ranked.forEach(function(row, idx){");
const stop = src.indexOf("      });", src.indexOf("st[stand].uses += 1;"));
if (start < 0 || stop < 0) throw new Error("nu găsesc bucata de agregare din sezon.html");
const agregare = src.slice(start, stop + "      });".length);

/* BAZA e baza de pescari cu codurile lor, umplută în pagină din server. Aici e goală:
   pescarii de probă n-au coduri, deci se leagă după nume — exact ca un coechipier.
   ACELASI ține scrierile diferite ale aceluiași nume; goală, fiecare nume rămâne el însuși. */
const ctx = { console, BAZA: {}, ACELASI: {} };
vm.createContext(ctx);
vm.runInContext(
  ["nameOf", "normKey", "cheiaOmului", "numeleOmului", "codulOmului", "numeleAfisat",
   "codBun", "cheiaLocatiei"]
    .map(n => H.grabFunction(src, n)).join("\n"), ctx);

/** rulează agregarea peste un singur concurs și întoarce ce a strâns */
function aduna(participanti, kgSiPeste) {
  ctx.byKey = {}; ctx.byLoc = {}; ctx.seasonFish = null;
  ctx.src = { compName: "Cupa de probă", compDate: 1, code: "proba", location: "Remus Lake" };
  ctx.oficial = {};
  ctx.ranked = participanti.map((p, i) => ({ p: p, kg: kgSiPeste[i][0], fish: kgSiPeste[i][1] }));
  ctx.places = participanti.map((_, i) => i + 1);
  vm.runInContext(agregare, ctx);
  return { byKey: ctx.byKey, byLoc: ctx.byLoc, seasonFish: ctx.seasonFish };
}
const pescar = (prenume, nume, coechipier, stand) =>
  ({ id: prenume + nume, prenume, nume, stand: stand || "1", coechipier: coechipier || undefined });
/** numele strânse, sortate, ca ordinea din obiect să nu conteze */
const oameni = r => Object.keys(r.byKey).map(k => r.byKey[k].name).sort();
const recDupaNume = (r, n) => Object.keys(r.byKey).map(k => r.byKey[k]).find(x => x.name === n);

/* ================================================================
   1. Cazul care motivează schimbarea.
   ================================================================ */
console.log("\n=== 1. O echipă intră în sezon ca doi pescari ===");
{
  const r = aduna([pescar("Ion", "Popescu", "Vasile Marin")], [[8.4, 1.9]]);
  t("amândoi apar în clasamentul de sezon", oameni(r), ["Ion Popescu", "Vasile Marin"]);

  const titular = recDupaNume(r, "Ion Popescu"), co = recDupaNume(r, "Vasile Marin");
  t("titularul ia locul echipei", titular.totalPoints, 1);
  t("coechipierul ia același loc", co.totalPoints, 1);
  t("amândoi au kilogramele echipei", [titular.totalKg, co.totalKg], [8.4, 8.4]);
  t("amândoi au fost la un concurs", [titular.competitions, co.competitions], [1, 1]);
  t("amândoi au rândul lor de istoric", [titular.rows.length, co.rows.length], [1, 1]);
}

/* ================================================================
   2. Ce NU trebuie numărat de două ori.
   ================================================================ */
console.log("\n=== 2. Ce se numără o singură dată ===");
{
  const r = aduna([pescar("Ion", "Popescu", "Vasile Marin", "7")], [[8.4, 1.9]]);
  const standuri = r.byLoc[Object.keys(r.byLoc)[0]];
  t("standul echipei se numără o dată, nu de două ori", standuri["7"].uses, 1);
  t("…iar kilogramele lui la fel", standuri["7"].totalKg, 8.4);

  t("peștele sezonului e unul singur, pe numele echipei",
    r.seasonFish.name, "Ion Popescu + Vasile Marin");
  t("…cu greutatea lui adevărată", r.seasonFish.v, 1.9);
}

/* ================================================================
   3. Concursurile individuale rămân exact cum erau.
   ================================================================ */
console.log("\n=== 3. Fără coechipier, nimic nu se schimbă ===");
{
  const r = aduna([pescar("Ion", "Popescu"), pescar("Ana", "Dinu")], [[8.4, 1.9], [5.1, 0]]);
  t("doi pescari, două rânduri", oameni(r), ["Ana Dinu", "Ion Popescu"]);
  t("locurile rămân ale lor", [recDupaNume(r, "Ion Popescu").totalPoints,
                               recDupaNume(r, "Ana Dinu").totalPoints], [1, 2]);
  t("peștele sezonului poartă un singur nume", r.seasonFish.name, "Ion Popescu");
}

/* ================================================================
   4. Același om, în etape diferite, cu parteneri diferiți.
   Ăsta e chiar motivul pentru care punctele merg la fiecare.
   ================================================================ */
console.log("\n=== 4. Schimbi partenerul, nu pierzi nimic ===");
{
  ctx.byKey = {}; ctx.byLoc = {}; ctx.seasonFish = null;
  const etapa = (participanti, kg) => {
    ctx.src = { compName: "Etapa", compDate: 1, code: "e", location: "Remus Lake" };
    ctx.oficial = {};
    ctx.ranked = participanti.map((p, i) => ({ p: p, kg: kg[i][0], fish: kg[i][1] }));
    ctx.places = participanti.map((_, i) => i + 1);
    vm.runInContext(agregare, ctx);
  };
  // Ion pescuiește prima etapă cu Vasile, a doua cu Gheorghe
  etapa([pescar("Ion", "Popescu", "Vasile Marin")], [[8, 0]]);
  etapa([pescar("Ion", "Popescu", "Gheorghe Radu")], [[6, 0]]);
  const r = { byKey: ctx.byKey };
  const ion = recDupaNume(r, "Ion Popescu");
  t("Ion are amândouă etapele", ion.competitions, 2);
  t("…cu kilogramele adunate", ion.totalKg, 14);
  t("fiecare partener are doar etapa lui",
    [recDupaNume(r, "Vasile Marin").competitions, recDupaNume(r, "Gheorghe Radu").competitions], [1, 1]);
}

/* ================================================================
   5. Cazuri-limită.
   ================================================================ */
console.log("\n=== 5. Cazuri-limită ===");
{
  t("coechipier gol nu creează un al doilea rând",
    oameni(aduna([pescar("Ion", "Popescu", "   ")], [[3, 0]])), ["Ion Popescu"]);

  // coechipierul unuia e titularul altuia: se contopesc într-un singur om
  const r = aduna([pescar("Ion", "Popescu", "Ana Dinu"), pescar("Ana", "Dinu")], [[8, 0], [5, 0]]);
  t("coechipierul care e și titular altundeva se leagă de același om",
    oameni(r), ["Ana Dinu", "Ion Popescu"]);
  t("…și strânge amândouă rezultatele", recDupaNume(r, "Ana Dinu").competitions, 2);
}

t.raport();
