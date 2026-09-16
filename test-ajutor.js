/**
 * Ajutorul de două propoziții.
 *
 * „Un buton de ajutor contextual de maximum două propoziții." Cuvintele lui.
 *
 * Ajutorul de dinainte pornea de la ideea că omul citește acasă, pe îndelete: erau 49 de
 * texte peste 100 de semne, cel mai lung de 721, cu nouă propoziții. El citește la baltă,
 * în picioare, cu cântarul în mână — și atunci nu citește deloc.
 *
 * Mai rău: o parte din el MINȚEA. Paragraful despre concursurile de mai multe zile trimitea
 * la „tab-ul Participanți" și „tab-ul Clasamente", iar trei mesaje de eroare trimiteau
 * „în Setări" — ecrane care nu mai există de când totul s-a mutat în scară, iar ușa se
 * cheamă „Contul meu". Un ajutor care minte e mai rău decât niciun ajutor: îl trimite pe
 * om să caute ceva ce nu e acolo și îl face să creadă că el greșește.
 *
 * Regula de două propoziții se ține AICI, nu pe cuvânt de onoare: dacă cineva mai adaugă
 * un rând într-un ajutor, proba pică.
 *
 * Codul e scos VERBATIM din index.html.
 */
const H = require("./test-helpers.js");

const src = H.citeste("index.html");
const t = H.creeazaVerificator();

/** textele de ajutor, așa cum sunt scrise în fișier */
function ajutoarele() {
  const out = [];
  const re = /<p class="aj-txt" id="aj-([a-z-]+)"[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(src))) {
    const gol = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    out.push({ id: m[1], text: gol });
  }
  return out;
}
/** câte propoziții are un text: punctele de la capăt de frază.
    Zecimalele românești au virgulă („2,25"), deci nu numără ca puncte. */
const propozitii = (s) => (s.match(/[.!?](\s|$)/g) || []).length;

/* ================================================================
   1. Regula: două propoziții. Nu trei.
   ================================================================ */
console.log("\n=== 1. Cel mult două propoziții ===");
{
  const a = ajutoarele();
  t("sunt ajutoare de citit", a.length > 0, true);
  a.forEach((x) => {
    t("„" + x.id + "” are cel mult două propoziții (" + propozitii(x.text) + ")",
      propozitii(x.text) <= 2, true);
  });
  /* Și o măsură a lungimii, ca două propoziții să nu devină două paragrafe. */
  a.forEach((x) => {
    t("…iar „" + x.id + "” încape într-o privire (" + x.text.length + " semne)",
      x.text.length <= 260, true);
  });
}

/* ================================================================
   2. Fiecare semn are textul lui, și fiecare text are semnul lui
   ================================================================ */
console.log("\n=== 2. Semnul și textul merg în pereche ===");
{
  const semne = [...src.matchAll(/onclick="ajuta\(this,'([a-z-]+)'\)"/g)].map((m) => m[1]).sort();
  const texte = ajutoarele().map((x) => x.id).sort();
  t("fiecare semn „?” are un text", semne, texte);
  t("…și nu e niciun text rătăcit fără semn", texte.length, semne.length);
}

/* ================================================================
   3. Semnul nu se ia la întrecere cu butonul scos în față
   ================================================================
   „Un singur buton scos în față pe ecran." Semnul de ajutor n-are voie să fie al doilea. */
console.log("\n=== 3. Semnul stă la locul lui ===");
{
  const butoane = [...src.matchAll(/<button[^>]*class="aj"[^>]*>([\s\S]*?)<\/button>/g)];
  t("toate semnele sunt un „?” și atât",
    butoane.every((b) => b[1].trim() === "?"), true);
  t("…niciunul nu e buton de-al casei",
    /class="aj[^"]*\bbtn\b/.test(src), false);
  t("…și fiecare spune orbului ce e",
    butoane.every((b) => /aria-label="/.test(b[0])), true);
  t("…și dacă e deschis",
    butoane.every((b) => /aria-expanded="false"/.test(b[0])), true);
}

/* ================================================================
   4. Deschisul și închisul
   ================================================================ */
console.log("\n=== 4. Se deschide și se închide ===");
{
  const f = H.grabFunction(src, "ajuta");
  t("se caută textul după numele semnului", /getElementById\("aj-" \+ id\)/.test(f), true);
  t("…se comută, nu doar se deschide", /t\.hidden = !t\.hidden/.test(f), true);
  t("…și semnul spune dacă e deschis", /aria-expanded/.test(f), true);
  /* Butonul vine ca argument: cardurile se mută dintr-o treaptă în alta, iar un selector
     după `onclick` s-ar rupe la prima mutare. */
  t("butonul vine dat, nu căutat în pagină", /function ajuta\(b, id\)/.test(f), true);
  t("…și un text care lipsește nu crapă nimic", /if\(!t\) return;/.test(f), true);

  /* `display` bate `hidden` — pățit la „Ies din arbitraj" și la bifa cântarului. */
  t("ascunsul e spus și în CSS", /\.aj-txt\[hidden\]\{display:none !important;\}/.test(src), true);
}

/* ================================================================
   5. Ajutorul nu mai minte
   ================================================================ */
console.log("\n=== 5. Spune adevărul despre aplicația de azi ===");
{
  /* Bara are trei butoane: Concursul · Calendar · Contul meu. „Tab-ul Participanți" și
     „tab-ul Clasamente" au dispărut când totul s-a mutat în scară. */
  t("nu mai trimite la „tab-ul Participanți”", /tab-ul Participanți/.test(src), false);
  t("…nici la „tab-ul Clasamente”", /tab-ul Clasamente/.test(src), false);
  /* Ușa se cheamă „Contul meu", nu „Setări". Trei mesaje de eroare trimiteau acolo. */
  t("…și niciun mesaj nu mai trimite „în Setări”",
    /(pune-o|uită-te|Verifică) în Setări/.test(src), false);
  t("cheia lipsă trimite unde e cu adevărat",
    /N-am cheia de scriere — pune-o în Contul meu → Telefonul/.test(src), true);
  t("…la fel și cheia greșită",
    /Cheia de scriere nu e bună — uită-te în Contul meu → Telefonul/.test(src), true);
  t("…și sincronizarea oprită",
    /camera live avea alte date\. Uită-te în Contul meu → Telefonul/.test(src), true);
}

/* ================================================================
   6. Ce s-a scos
   ================================================================
   „Nu se adaugă fără să se scoată." Cele trei ajutoare lungi au plecat de pe ecran. */
console.log("\n=== 6. Ce a ieșit de pe ecran ===");
{
  t("peretele de text despre calcul a plecat",
    /Cantitatea<\/b> se introduce captură cu captură/.test(src), false);
  t("…și paragraful despre concursurile de mai multe zile",
    /Concurs pe mai multe zile \(manșe\):<\/b> în Setări/.test(src), false);
  t("…și lecția despre punctele la sectoare inegale",
    /sectoarele mai mici se întind pe scala celui mai mare, ca ultimul dintr-un sector de 5 să ia tot cât/.test(src), false);

  /* Dar ce era adevărat în ele n-a pierit: a trecut în cele două propoziții. */
  const a = ajutoarele();
  const gaseste = (id) => (a.find((x) => x.id === id) || {}).text || "";
  t("departajarea la puncte egale a rămas", /puncte egale/.test(gaseste("calc")), true);
  t("…ca și adunarea manșelor", /General/.test(gaseste("manse")), true);
  t("…și zecimalele de la „Îndreptat”", /zecimale/.test(gaseste("puncte")), true);
  /* Manșele se hotărăsc la „Fă concursul", deci acolo se și întreabă ce sunt. */
  t("ajutorul manșelor vorbește de zile", /ziua și orele ei/.test(gaseste("manse")), true);
}

t.raport();
