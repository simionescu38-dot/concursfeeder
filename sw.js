/* Service worker – Cântar & Clasament
   Strategie: stale-while-revalidate (servește din cache instant, actualizează în fundal).
   Mărește versiunea CACHE când modifici index.html ca să forțezi reîmprospătarea. */
var CACHE = "concurs-pescuit-v146";
/* Magazia pozelor venite din meniul „Distribuie" al telefonului. Separată de cache-ul
   aplicației fiindcă are altă viață: se golește la fiecare trimitere nouă și după ce
   cântarele au fost trecute — nu la fiecare versiune nouă a aplicației. */
var POZE = "concurs-poze-primite";
var ASSETS = ["./", "./index.html", "./qr.js", "./manifest.json", "./icon-192.png", "./icon-512.png", "./sezon.html", "./concursuri.html", "./rezultat.html"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) {
        /* Fără cache:"reload", addAll ia fișierele din cache-ul browserului: versiunea
           nouă a service worker-ului putea salva în cache-ul ei exact index.html-ul
           vechi, și totul părea actualizat fără să fie. */
        return c.addAll(ASSETS.map(function (u) { return new Request(u, { cache: "reload" }); }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      /* POZE nu se șterge aici: o poză trimisă din „Distribuie" poate porni chiar
         actualizarea aplicației, iar dacă s-ar șterge la activare, omul ar ateriza pe un
         ecran de import gol, fără să înțeleagă unde i-a dispărut foaia. */
      return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== POZE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("push", function (e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) {}
  var title = data.title || "Concurs pescuit";
  var body = data.body || "Actualizare nouă";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: "icon-192.png",
      badge: "icon-192.png",
      vibrate: [200, 100, 200],
      tag: "concurs-lider",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window" }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ("focus" in list[i]) return list[i].focus();
      }
      if (clients.openWindow) return clients.openWindow("./");
    })
  );
});

self.addEventListener("fetch", function (e) {
  var url;
  try { url = new URL(e.request.url); } catch (err) { return; }
  /* Poza aleasă din meniul „Distribuie" al telefonului vine ca POST cu fișier, către
     adresa scrisă în manifest (share_target). Aplicația stă pe GitHub Pages, care nu
     poate primi un POST — fără rândurile astea Androidul ar lua 405 și omul ar vedea o
     pagină de eroare în loc de foaia lui. Deci îl oprim aici: punem pozele în magazie și
     trimitem aplicația, cu GET, la ecranul ei de import. */
  /* Se prinde ORICE POST către aplicație, nu doar cel cu „?poze=1".
     Motivul: nu e lămurit dacă Androidul duce mai departe interogarea scrisă în „action"
     din manifest. Dacă n-o duce, POST-ul ar veni pe „./index.html" curat, n-ar fi
     recunoscut aici, ar pleca spre GitHub Pages — care nu primește POST-uri — și omul ar
     vedea o pagină de eroare în loc de foaia lui. Pe originea noastră nu există niciun alt
     POST de pierdut: tot ce merge la server pleacă spre worker, pe altă adresă. */
  if (e.request.method === "POST" && url.origin === self.location.origin
      && url.pathname.indexOf("/api/") < 0) {
    e.respondWith((async function () {
      try {
        var form = await e.request.formData();
        var poze = form.getAll("poze").filter(function (f) { return f && f.size; });
        var c = await caches.open(POZE);
        // magazia ține DOAR trimiterea curentă: altfel foile de duminica trecută ar
        // apărea lângă cele de azi, iar amândouă ar arăta la fel de proaspete
        var vechi = await c.keys();
        await Promise.all(vechi.map(function (k) { return c.delete(k); }));
        for (var i = 0; i < poze.length; i++) {
          /* Numele fișierului se duce mai departe, pe răspuns: în magazie intră doar
             conținutul, iar numele s-ar pierde. Contează fiindcă e SINGURUL loc de unde se
             mai poate afla când s-a făcut poza — „IMG-20260827-WA0012.jpg". Ora din poză o
             taie WhatsApp, iar ora fișierului nu trece printr-un POST multipart (măsurat:
             ajunge tot „acum"). Se duce și ea, că e bună când poza vine din galerie. */
          await c.put(new Request("./poza-primita-" + i),
            new Response(poze[i], { headers: {
              "Content-Type": poze[i].type || "image/jpeg",
              "X-Poza-Nume": encodeURIComponent(poze[i].name || ""),
              "X-Poza-Ora": String(poze[i].lastModified || 0)
            } }));
        }
        /* Greutatea e în imagine, dar STANDUL e în textul de sub poză: pe grup se scrie
           „St 13", „St 5". Manifestul cere deja câmpurile astea la share_target; până acum
           se aruncau, iar aplicația rămânea fără singurul lucru care spune al cui e
           cântarul. Se păstrează lângă poze, sub o adresă cu „legenda" în ea. */
        var legenda = [form.get("title") || "", form.get("text") || ""].join("\n").trim();
        if (legenda) {
          await c.put(new Request("./legenda-primita"),
            new Response(legenda, { headers: { "Content-Type": "text/plain; charset=utf-8" } }));
        }
      } catch (err) {}
      return Response.redirect(new URL("./index.html?poze=1", self.location).href, 303);
    })());
    return;
  }
  if (e.request.method !== "GET") return;
  /* În cache intră DOAR fișierele aplicației. Apelurile către API-uri nu au ce căuta
     aici: cu strategia de mai jos (cached || fetched) o interogare a camerei live ar
     întoarce răspunsul de la interogarea ANTERIOARĂ, iar vremea ar apărea veche dar
     cu oră nouă. Lăsate netratate, pleacă normal în rețea.
     Fișierele din arhiva/ sunt tot date, nu aplicație: se îndreaptă din depozit fără ca
     aplicația să se schimbe. Prinse în cache, telefonul citea luni rezultatele de
     duminică — un nume corectat sau o baltă adăugată nu mai ajungeau niciodată. */
  if (url.origin !== self.location.origin
      || url.pathname.indexOf("/api/") === 0
      || url.pathname.indexOf("/arhiva/") >= 0) return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var fetched = fetch(e.request).then(function (res) {
        if (res && res.ok && e.request.url.indexOf("http") === 0) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        /* Paginile surori sunt cerute cu ?v=<versiune>, ca browserul să nu le poată servi
           dintr-un cache vechi. Prima cerere a unei versiuni noi are deci nevoie de rețea —
           iar fără internet n-ar găsi nimic. Atunci ne mulțumim cu ultima copie a aceleiași
           pagini, oricare i-ar fi fost adresa: mai bine varianta de ieri decât nimic. */
        return cached || caches.match(e.request, { ignoreSearch: true });
      });
      return cached || fetched;
    })
  );
});
