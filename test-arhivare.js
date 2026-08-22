/**
 * Reset pe un concurs deja arhivat ștergea arhiva bună și urca în locul ei una goală.
 *
 * wipe() cheamă archiveToSeason() și apoi golește `state` pe loc, fără să aștepte.
 * Arhivarea ștergea întâi copia veche de pe server și abia după aceea trimitea
 * concursul — dar între timp `state` era deja golit, așa că pleca un concurs cu 0
 * pescari. La Remus Lake, 22 august, s-au pierdut astfel 15 pescari și 199,680 kg de
 * pe server (recuperați din camera live).
 *
 * Testele de aici folosesc cereri care se termină ÎNTR-UN TICK URMĂTOR, ca în realitate:
 * cu răspunsuri instantanee cursa nu s-ar reproduce și testul n-ar dovedi nimic.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));

/** un element de pagină de care codul se poate atinge fără să crape */
function element() {
  return { value: "", textContent: "", style: {}, focus() {},
           classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } } };
}

/**
 * @param opt.arhivaVeche  id-ul arhivării dinainte (adică s-a mai arhivat o dată)
 * @param opt.raspuns      ce întoarce serverul la POST
 */
function aplicatie(opt) {
  opt = opt || {};
  const cereri = [];
  const ctx = {
    state: {
      name: "Caciula de sambata", balta: "Remus Lake", numManse: 2,
      sectors: ["A", "B", "C"], rules: "regulament", sponsors: [{ nume: "Balta" }],
      participants: [
        { id: "a", prenume: "Remus", nume: "Catalin", stand: "33", m: { 1: { catches: [15.09], extras: [], stand: "33", sector: "A" } } },
        { id: "b", prenume: "Mimi", nume: "Fedor", stand: "59", m: { 1: { catches: [25.08], extras: [], stand: "59", sector: "C" } } },
        { id: "c", prenume: "Iosif", nume: "Andrei", stand: "57", m: { 1: { catches: [20.93], extras: [], stand: "57", sector: "C" } } }
      ]
    },
    syncKey: "cheia-mea", syncRoom: "feedermoldova",
    currentArchiveId: opt.arhivaVeche !== undefined ? opt.arhivaVeche : "arhiva-veche",
    API_BASE: "https://exemplu",
    cereri: cereri,
    console,
    toast() {}, nowHM: () => "12:00", guard: () => false,
    puneDeoParte() {}, save() {}, renderSectors() {}, renderList() {}, renderRank() {},
    updateUndoUI() {}, updateManseButtons() {}, improspateazaBalta() {}, ceriBalta: () => true,
    numManse: () => 2,
    confirm: () => true,
    document: { getElementById: () => element() },
    encodeURIComponent
  };
  ctx.saveArchiveId = function (id) { ctx.currentArchiveId = id || ""; };
  ctx.fetch = function (url, o) {
    const metoda = (o && o.method) || "GET";
    let body = null;
    try { body = o && o.body ? JSON.parse(o.body) : null; } catch (e) {}
    const d = body && body.data;
    cereri.push({
      metoda: metoda,
      url: url,
      pescari: d ? (d.participants || []).length : undefined,
      nume: d ? d.name : undefined,
      kg: d ? (d.participants || []).reduce((s, p) => s + ((p.m && p.m[1] && p.m[1].catches) || []).reduce((x, v) => x + v, 0), 0) : undefined
    });
    // răspunsul vine într-un tick următor — exact fereastra în care wipe() golea starea
    return new Promise(function (res, rej) {
      setTimeout(function () {
        if (metoda === "POST" && opt.postPica) return rej(new Error("rețea"));
        res({ json: () => Promise.resolve(metoda === "POST" ? (opt.raspuns || { ok: true, id: "arhiva-noua" }) : { ok: true }) });
      }, 0);
    });
  };
  vm.createContext(ctx);
  vm.runInContext(["archiveToSeason", "wipe"].map(n => grabFunction(src, n)).join("\n"), ctx);
  return ctx;
}

/** lasă cererile pornite să se termine */
const linistit = () => new Promise(r => setTimeout(r, 30));

(async () => {

  /* ================================================================
     1. Reset pe un concurs deja arhivat
     ================================================================ */
  console.log("\n=== 1. Reset pe un concurs deja arhivat ===");
  {
    const ctx = aplicatie();
    vm.runInContext("wipe()", ctx);
    t("Reset golește lista pe loc, fără să aștepte serverul", ctx.state.participants.length, 0);
    await linistit();

    const post = ctx.cereri.find(c => c.metoda === "POST");
    const del = ctx.cereri.find(c => c.metoda === "DELETE");
    t("s-a trimis o arhivare", !!post, true);
    t("arhivarea duce concursul, NU lista golită de Reset", post && post.pescari, 3);
    t("…cu numele lui", post && post.nume, "Caciula de sambata");
    t("…și cu kilogramele lui", Math.round((post && post.kg || 0) * 1000) / 1000, 61.1);
    t("arhiva veche se șterge și ea", !!del, true);
    t("dar ABIA DUPĂ ce copia nouă e salvată",
      ctx.cereri.indexOf(post) < ctx.cereri.indexOf(del), true);
    t("se șterge chiar arhivarea de dinainte", /arhiva-veche/.test((del && del.url) || ""), true);
    t("…și cu replace=1, ca să plece și copia din git", /replace=1/.test((del && del.url) || ""), true);
  }

  /* ================================================================
     2. Arhivare obișnuită, de la buton
     ================================================================ */
  console.log("\n=== 2. Arhivare de la buton, primul concurs ===");
  {
    const ctx = aplicatie({ arhivaVeche: "" });
    vm.runInContext("archiveToSeason()", ctx);
    await linistit();
    const post = ctx.cereri.find(c => c.metoda === "POST");
    t("concursul pleacă întreg", post && post.pescari, 3);
    t("nu se șterge nimic — nu era nicio arhivă dinainte",
      ctx.cereri.some(c => c.metoda === "DELETE"), false);
    t("id-ul arhivei se ține minte pentru data viitoare", ctx.currentArchiveId, "arhiva-noua");
    t("camera merge în adresă", /room=feedermoldova/.test((post && post.url) || ""), true);
  }

  /* ================================================================
     3. Serverul refuză: arhiva veche NU se pierde
     ================================================================
     Ordinea ștergere-întâi însemna că o pică de rețea la mijloc lăsa concursul
     fără nicio arhivă. Acum lasă cel mult o dublură, pe care sezonul o contopește. */
  console.log("\n=== 3. Când salvarea nu reușește, arhiva veche rămâne ===");
  {
    const ctx = aplicatie({ raspuns: { ok: false, error: "forbidden" } });
    let rezultat = null;
    ctx.gata = function (v) { rezultat = v; };
    vm.runInContext("archiveToSeason(gata)", ctx);
    await linistit();
    t("nu se șterge nimic dacă serverul a refuzat",
      ctx.cereri.some(c => c.metoda === "DELETE"), false);
    t("arhiva veche rămâne cea știută", ctx.currentArchiveId, "arhiva-veche");
    t("cel care a cerut arhivarea află că n-a mers", rezultat, false);
  }

  console.log("\n=== 4. Când pică rețeaua, la fel ===");
  {
    const ctx = aplicatie({ postPica: true });
    let rezultat = null;
    ctx.gata = function (v) { rezultat = v; };
    vm.runInContext("archiveToSeason(gata)", ctx);
    await linistit();
    t("nicio ștergere", ctx.cereri.some(c => c.metoda === "DELETE"), false);
    t("arhiva veche rămâne", ctx.currentArchiveId, "arhiva-veche");
    t("se anunță eșecul", rezultat, false);
  }

  /* ================================================================
     5. Pazele de la intrare
     ================================================================ */
  console.log("\n=== 5. Pazele de la intrare ===");
  {
    const faraCheie = aplicatie();
    faraCheie.syncKey = "";
    vm.runInContext("archiveToSeason()", faraCheie);
    await linistit();
    t("fără cheie de scriere nu pleacă nicio cerere", faraCheie.cereri.length, 0);

    const faraOameni = aplicatie();
    faraOameni.state.participants = [];
    vm.runInContext("archiveToSeason()", faraOameni);
    await linistit();
    t("fără participanți nu se arhivează nimic", faraOameni.cereri.length, 0);
    t("…și arhiva veche rămâne neatinsă", faraOameni.currentArchiveId, "arhiva-veche");
  }

  /* ================================================================
     6. Ce scrie în cod, ca să nu se întoarcă greșeala
     ================================================================ */
  console.log("\n=== 6. Codul spune ce trebuie ===");
  {
    const fn = grabFunction(src, "archiveToSeason");
    t("starea se îngheață la apăsare, nu la trimitere", /var deTrimis *= *JSON\.parse\(JSON\.stringify\(state\)\)/.test(fn), true);
    t("cererea duce copia înghețată, nu starea vie", /body: JSON\.stringify\(\{data: deTrimis\}\)/.test(fn), true);
    t("nu mai rămâne nicio trimitere a stării vii", /\{data: state\}/.test(fn), false);
    t("salvarea e înaintea ștergerii în text, nu doar în intenție",
      fn.indexOf('method:"POST"') < fn.indexOf('method:"DELETE"'), true);

    const w = grabFunction(src, "wipe");
    t("Reset arhivează tăcut, ca să nu întrebe de două ori", /archiveToSeason\(function\(\)\{ saveArchiveId\(""\); \}, true\)/.test(w), true);
    t("Reset pune deoparte o copie înainte să șteargă", w.indexOf("puneDeoParte") < w.indexOf("state={ name:\"\""), true);
  }

  t.raport();
})();
