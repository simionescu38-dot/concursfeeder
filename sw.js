/* Service worker – Cântar & Clasament
   Strategie: stale-while-revalidate (servește din cache instant, actualizează în fundal).
   Mărește versiunea CACHE când modifici index.html ca să forțezi reîmprospătarea. */
var CACHE = "concurs-pescuit-v40";
var ASSETS = ["./", "./index.html", "./qr.js", "./manifest.json", "./icon-192.png", "./icon-512.png", "./sezon.html", "./concursuri.html"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
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
  if (e.request.method !== "GET") return;
  var url;
  try { url = new URL(e.request.url); } catch (err) { return; }
  /* În cache intră DOAR fișierele aplicației. Apelurile către API-uri nu au ce căuta
     aici: cu strategia de mai jos (cached || fetched) o interogare a camerei live ar
     întoarce răspunsul de la interogarea ANTERIOARĂ, iar vremea ar apărea veche dar
     cu oră nouă. Lăsate netratate, pleacă normal în rețea. */
  if (url.origin !== self.location.origin || url.pathname.indexOf("/api/") === 0) return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var fetched = fetch(e.request).then(function (res) {
        if (res && res.ok && e.request.url.indexOf("http") === 0) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || fetched;
    })
  );
});
