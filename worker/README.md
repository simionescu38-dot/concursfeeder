# Room state API worker

Cod sursă pentru Worker-ul `concurs-api`, deployat la `https://concurs-api.simionescu38.workers.dev/`. Ține starea unei camere de concurs într-un tabel D1, ca `index.html` să poată sincroniza clasamentul live pe mai multe telefoane (vezi secțiunea „Clasament live pe alte telefoane" din Setări).

Acest folder e doar sursa de referință — Worker-ul `concurs-api` e administrat direct din Cloudflare Dashboard (editor de cod / `wrangler deploy`), nu e conectat prin Git la acest repo. Dacă modifici `index.js` aici, copiază conținutul și în editorul Worker-ului din Dashboard (sau rulează `wrangler deploy` local din acest folder, cu contul Cloudflare corect).

## Endpoints

- `GET /api/state?room=<code>` — returnează `{ ok, rev, data, name }` pentru cameră (`rev: 0, data: null` dacă nu există încă).
- `PUT /api/state?room=<code>` — creează/actualizează starea camerei. Necesită header-ul `x-write-key: <WRITE_KEY>`. Body: `{ "data": { ...starea completă..., "name": "nume opțional" } }`. Dacă se schimbă liderul concursului față de starea anterioară, trimite automat o notificare push (pop-up + sunet) tuturor telefoanelor abonate la acea cameră.
- `GET /api/rooms` — listează ultimele 100 camere actualizate (`code`, `name`, `rev`, `updated_at`).
- `POST /api/subscribe?room=<code>` — înregistrează un abonament de notificări push pentru cameră. Body: `{ "subscription": {...obiectul PushSubscription din browser...} }`.
- `POST /api/unsubscribe` — șterge un abonament. Body: `{ "endpoint": "..." }`.
- `POST /api/archive?room=<code opțional>` — arhivează un concurs terminat, permanent, pentru `sezon.html`. Necesită `x-write-key`. Body: `{ "data": {...starea completă a concursului...} }`. Răspunde `{ ok, id }`.
- `GET /api/archive` — listează toate concursurile arhivate (cele mai noi primele), cu datele complete: `{ ok, archives: [{ id, room, name, archived_at, data }] }`.
- `DELETE /api/archive?id=<id>` — șterge un concurs arhivat greșit. Necesită `x-write-key`.
- `GET /api/history?room=<code>` — istoricul automat de versiuni al unei camere (ultimele 40, salvate la fiecare suprascriere, fără nicio acțiune din partea organizatorului): `{ ok, versions: [{ id, rev, saved_at, name, participants }] }`. E o plasă de siguranță: dacă un telefon suprascrie din greșeală camera cu date vechi/greșite, versiunea anterioară tot există aici.
- `POST /api/restore?room=<code>&id=<historyId>` — restaurează camera la o versiune din istoric. Necesită `x-write-key`. Salvează și starea curentă în istoric înainte (restaurarea e la rândul ei reversibilă).

## Configurare în Cloudflare Dashboard (Worker `concurs-api`)

1. **Baza de date D1** — Workers & Pages → `concurs-api` → Settings → Bindings → Add binding → D1 database. Variable name: `DB`. Dacă nu există încă baza de date, o creezi din Workers & Pages → D1 → Create database, apoi rulezi conținutul din `schema.sql` (D1 → baza ta → Console). Dacă baza există deja de dinainte, rulează doar blocurile noi (`push_subs`, `season_archive`, `room_history`) din `schema.sql`.
2. **Cheia de scriere** — Settings → Variables and Secrets → Add → tip „Secret", nume `WRITE_KEY`, valoare aleasă de tine (o pui apoi și în aplicație, la „Cheie de scriere").
3. **Notificări push (VAPID)** — Settings → Variables and Secrets → Add, de două ori (cheile sunt generate separat, în afara acestui repo — nu se pun niciodată în Git):
   - Secret `VAPID_PRIVATE_JWK` — cheia privată (JSON).
   - Variable `VAPID_PUBLIC_KEY` — cheia publică (base64url). Aceeași valoare trebuie copiată și în `index.html`, la constanta `VAPID_PUBLIC_KEY`.

## Notă: proiectul „concursiasi"

Când ai adăugat acest folder `worker/` la repo, Cloudflare a creat automat un proiect separat numit `concursiasi`, conectat prin Git la acest repo — de-aia pică build-ul lui (nu are D1/secrete configurate și nu e nevoie de el). E un duplicat neintenționat: poți să-l ștergi din Cloudflare Dashboard → Workers & Pages → `concursiasi` → Settings → Delete. Worker-ul real folosit de aplicație rămâne `concurs-api`, neschimbat.
