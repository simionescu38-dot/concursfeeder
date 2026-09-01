/**
 * Același om, scris în două feluri.
 *
 * În clasamentul de sezon apăreau „Ciufi Man" și „Ciufy Man" ca doi pescari, fiecare cu
 * un singur concurs — deci amândoi sub pragul de participări, deci amândoi neclasați,
 * deși omul fusese la două etape.
 *
 * Unirea nu se poate ghici. Pe aceeași foaie stau „Paul Selig" (B 9) și „Paul Pelin"
 * (C 18): două litere diferență, doi oameni. De-aia lista se scrie de mână.
 *
 * Codul e scos VERBATIM din sezon.html.
 */
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const H = require("./test-helpers.js");

const src = H.citeste("sezon.html");
const t = H.creeazaVerificator();

const FUNCTII = ["normKey", "nameOf", "incarcaAcelasiOm", "cheiaOmului", "numeleOmului"];

/** contextul sezonului, cu fetch-ul împănat ca să dea lista pe care o cerem */
function pornire(lista) {
  const ctx = {
    console, JSON, Array, Promise, Date,
    cerute: [],
    faraCache(u) { return u + "?cb=1"; },
    fetch(u) {
      ctx.cerute.push(u);
      if (lista === null) return Promise.reject(new Error("fără fișier"));
      return Promise.resolve({ json: () => Promise.resolve(lista) });
    }
  };
  vm.createContext(ctx);
  vm.runInContext("var ACELASI = {};", ctx);
  FUNCTII.forEach(f => vm.runInContext(H.grabFunction(src, f), ctx));
  return ctx;
}
const cheie = (c, nm) => vm.runInContext("cheiaOmului(" + JSON.stringify(nm) + ")", c);
const nume = (c, nm) => vm.runInContext("numeleOmului(" + JSON.stringify(nm) + ")", c);
const incarca = c => new Promise(res => {
  ctx_gata(c, res);
});
function ctx_gata(c, res) {
  c.gata = res;
  vm.runInContext("incarcaAcelasiOm().then(function(){ gata(); })", c);
}

/** lista livrată chiar din depozit — proba merge pe fișierul adevărat, nu pe o copie */
const LISTA = JSON.parse(fs.readFileSync(path.join(H.RADACINA, "arhiva/acelasi-om.json"), "utf8"));

(async () => {
  /* ================================================================
     1. Fără listă, nimic nu se schimbă
     ================================================================ */
  console.log("\n=== 1. Fără listă, sezonul rămâne cum era ===");
  {
    const c = pornire(null);
    await incarca(c);
    t("cele două scrieri rămân doi oameni",
      cheie(c, "Ciufi Man") === cheie(c, "Ciufy Man"), false);
    t("numele rămâne al fiecăruia", nume(c, "Ciufy Man"), "Ciufy Man");
    t("diacriticele se pliază ca înainte",
      cheie(c, "Săndel Hârtopeanu") === cheie(c, "Sandel Hartopeanu"), true);
  }
  {
    const c = pornire({ nu: "e ce trebuie" });
    await incarca(c);
    t("o listă fără „acelasi\" nu strică nimic",
      cheie(c, "Ciufi Man") === cheie(c, "Ciufy Man"), false);
  }
  {
    const c = pornire({ acelasi: [["singur"], "nu e listă", []] });
    await incarca(c);
    t("grupurile stricate se sar, fără să crape", cheie(c, "Ciufi Man"), "ciufi man");
  }

  /* ================================================================
     2. Cu lista adevărată din depozit
     ================================================================ */
  console.log("\n=== 2. Cu lista din arhiva/acelasi-om.json ===");
  {
    const c = pornire(LISTA);
    await incarca(c);

    t("s-a citit din arhiva/, ca să nu stea în memoria telefonului",
      /^arhiva\/acelasi-om\.json/.test(c.cerute[0]), true);
    t("„Ciufi Man\" și „Ciufy Man\" ajung același om",
      cheie(c, "Ciufi Man") === cheie(c, "Ciufy Man"), true);
    t("se arată sub numele scris primul în grup",
      [nume(c, "Ciufi Man"), nume(c, "Ciufy Man")], ["Ciufi Man", "Ciufi Man"]);
    t("merge și scris cu litere mici", cheie(c, "ciufy man"), cheie(c, "Ciufi Man"));

    /* Paza care contează: doi oameni adevărați, cu două litere diferență. */
    t("„Paul Selig\" și „Paul Pelin\" RĂMÂN doi pescari",
      cheie(c, "Paul Selig") === cheie(c, "Paul Pelin"), false);
    t("…și fiecare cu numele lui",
      [nume(c, "Paul Selig"), nume(c, "Paul Pelin")], ["Paul Selig", "Paul Pelin"]);

    t("„Costel Titiana\" e același cu „Costel Tatiana\"",
      cheie(c, "Costel Titiana") === cheie(c, "Costel Tatiana"), true);
    t("…și se arată cum scrie pe foaie", nume(c, "Costel Titiana"), "Costel Tatiana");

    t("un nume care nu e în listă rămâne al lui",
      nume(c, "Sandel Hartopeanu"), "Sandel Hartopeanu");
  }

  /* ================================================================
     3. Pe arhivele adevărate
     ================================================================ */
  console.log("\n=== 3. Pe cele 6 concursuri arhivate ===");
  {
    const c = pornire(LISTA);
    await incarca(c);

    const dosar = path.join(H.RADACINA, "arhiva");
    const peOm = {};
    fs.readdirSync(dosar).filter(f => /\.json$/.test(f) && f !== "acelasi-om.json").forEach(f => {
      const j = JSON.parse(fs.readFileSync(path.join(dosar, f), "utf8"));
      const d = j.data || j;
      (d.participants || []).forEach(p => {
        const nm = vm.runInContext("nameOf(" + JSON.stringify(p) + ")", c);
        if (!nm) return;
        const k = cheie(c, nm);
        (peOm[k] = peOm[k] || new Set()).add(f);
      });
    });

    const ciufi = peOm[cheie(c, "Ciufi Man")];
    t("Ciufi Man are acum două concursuri, nu două rânduri de câte unul",
      ciufi ? ciufi.size : 0, 2);
    t("nu mai există un al doilea rând pentru el",
      Object.keys(peOm).filter(k => /ciuf/.test(k)).length, 1);

    t("Paul Selig a rămas cu concursurile lui",
      peOm[cheie(c, "Paul Selig")].size, 4);
    t("…iar Paul Pelin cu ale lui, separat",
      peOm[cheie(c, "Paul Pelin")].size, 1);

    const costel = peOm[cheie(c, "Costel Tatiana")];
    t("Costel Tatiana ajunge la 3 concursuri, adică la pragul de clasare",
      costel ? costel.size : 0, 3);
    t("nu mai are un al doilea rând",
      Object.keys(peOm).filter(k => /tatiana|titiana/.test(k)).length, 1);

    /* 55 de nume înainte; unind două perechi, rămân 53 de oameni. */
    t("sezonul are doi oameni mai puțin, nu două rânduri", Object.keys(peOm).length, 53);
  }

  t.raport();
})();
