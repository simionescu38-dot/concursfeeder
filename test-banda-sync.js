/**
 * Banda din antet care spune dacă telefonul trimite datele în camera live.
 *
 * Rulează funcția REALĂ `updateUploadBar` din index.html cu un DOM minim,
 * ca textul văzut de organizator să nu ajungă să mintă după vreo modificare.
 */
const { grabFunction, citeste, creeazaVerificator } = require("./test-helpers");
const vm = require("vm");
const t = creeazaVerificator();

const src = citeste(__dirname + "/index.html");

function banda(cfg) {
  const el = { className: "", textContent: "", style: {}, onclick: null };
  // ce se întâmplă la atingere contează la fel de mult ca textul: banda de
  // vizualizare duce la ieșirea din cameră, nu la Setări
  let actiune = "";
  const ctx = {
    state: { participants: cfg.participanti || [] },
    viewerMode: !!cfg.viewerMode, viewerRoom: cfg.viewerRoom || "",
    syncRoom: cfg.syncRoom || "", syncKey: cfg.syncKey || "",
    syncPaused: !!cfg.syncPaused, syncProblem: cfg.syncProblem || "",
    syncLastOk: cfg.syncLastOk || "", syncBusy: !!cfg.syncBusy,
    meniuGo: () => { actiune = "setari"; },
    exitViewerMode: () => { actiune = "iesire"; },
    document: { getElementById: id => (id === "uploadBar" ? el : null) },
    console
  };
  vm.createContext(ctx);
  vm.runInContext(grabFunction(src, "updateUploadBar") + "\nupdateUploadBar();", ctx);
  if (el.onclick) el.onclick();
  return { ascunsa: el.style.display === "none", clasa: el.className, text: el.textContent, tap: !!el.onclick, actiune };
}

const UNUL = [{ id: 1 }];

// 1. telefon fără nimic pe el: banda ar speria degeaba
{
  const b = banda({});
  t("telefon gol, fără sincronizare: banda nu apare", b.ascunsa, true);
}

// 2. are date, dar nu le trimite nicăieri — cazul care trebuie strigat
{
  const b = banda({ participanti: UNUL });
  t("date doar pe telefon: bandă albă de atenție", b.clasa, "ub-off");
  t("spune clar că nu le vede nimeni", /nimeni nu le vede/.test(b.text), true);
  t("se poate atinge ca să deschidă Setările", b.tap, true);
}

// 3. organizator care trimite
{
  const b = banda({ participanti: UNUL, syncRoom: "remus1", syncKey: "x", syncLastOk: "14:07" });
  t("trimite: bandă verde", b.clasa, "ub-on");
  t("scrie camera în care trimite", /remus1/.test(b.text), true);
  t("scrie ora ultimei urcări", /14:07/.test(b.text), true);
}
{
  const b = banda({ participanti: UNUL, syncRoom: "remus1", syncKey: "x" });
  t("cameră setată dar nimic urcat încă: se spune pe față", /n-a plecat nimic/.test(b.text), true);
}

// 4. probleme
{
  const b = banda({ participanti: UNUL, syncRoom: "r", syncKey: "x", syncProblem: "fără semnal, reîncerc" });
  t("eroare de urcare: bandă roșie", b.clasa, "ub-bad");
  t("eroarea scrie motivul", /fără semnal/.test(b.text), true);
}
{
  const b = banda({ participanti: UNUL, syncRoom: "r", syncKey: "x", syncPaused: true });
  t("sincronizare oprită automat: bandă roșie", b.clasa, "ub-bad");
}

// 5. telefonul care doar privește: banda tace, ca să nu vorbească două bare
//    deodată în antet — acolo e bara de vizualizare, care e și ieșirea din cameră
{
  const b = banda({ participanti: UNUL, viewerMode: true, viewerRoom: "remus1", syncRoom: "r", syncKey: "x", syncLastOk: "14:09" });
  t("mod vizualizare: banda urcării se ascunde", b.ascunsa, true);
  t("…și nu duce nicăieri", b.tap, false);
}
// chiar cu cheia completată, modul vizualizare are prioritate — exact capcana
// care a ținut sincronizarea moartă zile întregi
{
  const b = banda({ participanti: UNUL, viewerMode: true, viewerRoom: "r", syncRoom: "r", syncKey: "cheie-bună" });
  t("cheia completată nu păcălește banda în mod vizualizare", b.ascunsa, true);
}
// 6. butonul de trimitere imediata: banda spunea „inca n-a plecat nimic" fara sa
//    dea nimanui ce sa apese
{
  const { grabFunction } = require("./test-helpers");
  const trimite = grabFunction(src, "trimiteAcum");
  t("exista un buton de trimitere imediata", /onclick="trimiteAcum\(\)"/.test(src), true);
  t("nu trimite din modul vizualizare", /if\(viewerMode\)/.test(trimite), true);
  t("cere camera si cheia", /!syncRoom \|\| !syncKey/.test(trimite), true);
  t("si chiar urca starea", /pushState\(\)/.test(trimite), true);
  t("repornind sincronizarea daca era oprita", /syncPaused=false/.test(trimite), true);
}

t.raport();
