/**
 * Ceasul concursului e al serverului, nu al telefonului.
 *
 * Orele se sincronizau deja, dar numărătoarea mergea pe Date.now() al fiecărui
 * telefon. Două telefoane cu ceasuri diferite arătau timpi rămași diferiți la
 * același concurs, iar claxonul de final suna la momente diferite — exact lucrul
 * pe care nimeni nu-l bănuiește, fiindcă nimeni nu-și verifică ora telefonului.
 *
 * Decalajul se ia din antetul „Date", pe care îl întoarce orice răspuns al
 * serverului și care se citește și de pe alt domeniu.
 */
const { grabFunction, citeste, creeazaVerificator, RADACINA } = require("./test-helpers");
const path = require("path");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(path.join(RADACINA, "index.html"));

/** un telefon cu ceasul lui, poate greșit */
function telefon(oraTelefon) {
  let acum = oraTelefon;
  class CeasFals extends Date {}
  CeasFals.now = () => acum;
  const ctx = { Date: CeasFals, console };
  vm.createContext(ctx);
  vm.runInContext([
    "var clockSkew=0, clockSet=false;",
    grabFunction(src, "nowSync"),
    grabFunction(src, "adoptServerClock")
  ].join("\n"), ctx);
  return {
    ctx,
    la: ms => { acum = ms; },
    /** un răspuns al serverului, cu ora lui și cu o latență dată */
    raspuns: (oraServer, latentaMs) => {
      const t0 = acum;
      acum += (latentaMs || 0);
      ctx.__resp = { headers: { get: h => (h === "Date" ? new Date(oraServer).toUTCString() : null) } };
      vm.runInContext("adoptServerClock(" + t0 + ", __resp);", ctx);
    },
    acum: () => vm.runInContext("nowSync()", ctx),
    decalaj: () => vm.runInContext("clockSkew", ctx)
  };
}

const ORA = 1787040000000; // un moment oarecare, rotund la secundă

/* ---------- 1. fără server, nimic nu se schimbă ---------- */
console.log("\n=== 1. Telefon fără legătură la server ===");
{
  const f = telefon(ORA + 300000); // ceasul lui e cu 5 minute înainte
  t("fără niciun răspuns, decalajul e 0", f.decalaj(), 0);
  t("deci ceasul concursului e chiar ceasul telefonului", f.acum(), ORA + 300000);
}

/* ---------- 2. telefonul cu ceasul înainte ---------- */
console.log("\n=== 2. Telefon cu ceasul înainte cu 5 minute ===");
{
  const f = telefon(ORA + 300000);
  f.raspuns(ORA, 0);
  t("decalajul prinde cele 5 minute", Math.round(f.decalaj() / 1000), -300);
  t("ora concursului e cea a serverului", Math.round(f.acum() / 1000), Math.round(ORA / 1000));
}

/* ---------- 3. telefonul cu ceasul în urmă ---------- */
console.log("\n=== 3. Telefon cu ceasul în urmă cu 2 minute ===");
{
  const f = telefon(ORA - 120000);
  f.raspuns(ORA, 0);
  t("ora concursului tot cea a serverului", Math.round(f.acum() / 1000), Math.round(ORA / 1000));
}

/* ---------- 4. două telefoane diferite ajung la aceeași oră ---------- */
console.log("\n=== 4. Două telefoane, același concurs ===");
{
  const a = telefon(ORA + 300000); // unul înainte
  const b = telefon(ORA - 120000); // altul în urmă
  a.raspuns(ORA, 0);
  b.raspuns(ORA, 0);
  t("arată aceeași oră a concursului",
    Math.round(a.acum() / 1000), Math.round(b.acum() / 1000));

  // trece un minut real pe amândouă
  a.la(ORA + 300000 + 60000);
  b.la(ORA - 120000 + 60000);
  t("și rămân sincronizate după un minut",
    Math.round(a.acum() / 1000), Math.round(b.acum() / 1000));
}

/* ---------- 5. latența nu trece drept decalaj ---------- */
console.log("\n=== 5. Legătură proastă la baltă ===");
{
  // telefon cu ceasul bun, dar răspunsul vine în 2 secunde
  const f = telefon(ORA);
  f.raspuns(ORA + 1000, 2000); // serverul a răspuns la mijlocul dus-întorsului
  t("un telefon cu ceasul bun nu e împins de latență", Math.abs(f.decalaj()) <= 1000, true);
}

/* ---------- 6. nu tremură la fiecare interogare ---------- */
console.log("\n=== 6. Afișajul nu sare înainte și înapoi ===");
{
  // antetul „Date" are rezoluție de o secundă, deci răspunsuri succesive dau
  // valori care diferă cu până la o secundă; fără prag, secundele ar sări
  const f = telefon(ORA + 300000);
  f.raspuns(ORA, 0);
  const primul = f.decalaj();
  f.raspuns(ORA + 900, 0);
  f.raspuns(ORA - 800, 0);
  t("decalajul rămâne cel dintâi", f.decalaj(), primul);

  // dar un decalaj adevărat (cineva a pus ceasul telefonului) e preluat
  f.la(ORA + 300000 + 3600000); // telefonul a sărit cu o oră
  f.raspuns(ORA + 60000, 0);
  t("o schimbare adevărată de ceas e totuși prinsă", f.decalaj() !== primul, true);
}

/* ---------- 7. antet lipsă sau stricat ---------- */
console.log("\n=== 7. Răspuns fără antet bun ===");
{
  const f = telefon(ORA);
  f.ctx.__gol = { headers: { get: () => null } };
  vm.runInContext("adoptServerClock(" + ORA + ", __gol);", f.ctx);
  t("fără antet, decalajul rămâne 0", f.decalaj(), 0);

  f.ctx.__rau = { headers: { get: () => "nu e o dată" } };
  vm.runInContext("adoptServerClock(" + ORA + ", __rau);", f.ctx);
  t("cu antet stricat, la fel", f.decalaj(), 0);

  vm.runInContext("adoptServerClock(" + ORA + ", null);", f.ctx);
  t("fără răspuns deloc, nu crapă", f.decalaj(), 0);
}

/* ---------- 8. cronometrul chiar folosește ceasul comun ---------- */
console.log("\n=== 8. Cronometrul folosește ceasul comun ===");
{
  const tick = grabFunction(src, "timerTick");
  const adopt = grabFunction(src, "adoptTimer");
  const reset = grabFunction(src, "resetWarnings");
  t("numărătoarea din bară merge pe nowSync", /var now=nowSync\(\)/.test(tick), true);
  t("preluarea orelor din cameră la fel", /var now=nowSync\(\)/.test(adopt), true);
  t("și pragurile de avertisment", /nowSync\(\)/.test(reset), true);
  t("nu a mai rămas Date.now() în cronometru",
    /Date\.now\(\)/.test(tick + adopt + reset), false);
}

t.raport();
