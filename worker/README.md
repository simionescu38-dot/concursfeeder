# Room state API worker

Cod sursă pentru Worker-ul `concurs-api`, deployat la `https://concurs-api.simionescu38.workers.dev/`. Ține starea unei camere de concurs într-un tabel D1, ca `index.html` să poată sincroniza clasamentul live pe mai multe telefoane (vezi secțiunea „Clasament live pe alte telefoane" din Setări).

Acest folder e doar sursa de referință — Worker-ul `concurs-api` e administrat direct din Cloudflare Dashboard (editor de cod / `wrangler deploy`), nu e conectat prin Git la acest repo. Dacă modifici `index.js` aici, copiază conținutul și în editorul Worker-ului din Dashboard (sau rulează `wrangler deploy` local din acest folder, cu contul Cloudflare corect).

## Endpoints

- `GET /api/state?room=<code>` — returnează `{ ok, rev, data, name }` pentru cameră (`rev: 0, data: null` dacă nu există încă).
- `PUT /api/state?room=<code>` — creează/actualizează starea camerei. Necesită header-ul `x-write-key: <WRITE_KEY>`. Body: `{ "data": { ...starea completă..., "name": "nume opțional" } }`.
- `GET /api/rooms` — listează ultimele 100 camere actualizate (`code`, `name`, `rev`, `updated_at`).

## Configurare în Cloudflare Dashboard (Worker `concurs-api`)

1. **Baza de date D1** — Workers & Pages → `concurs-api` → Settings → Bindings → Add binding → D1 database. Variable name: `DB`. Dacă nu există încă baza de date, o creezi din Workers & Pages → D1 → Create database, apoi rulezi conținutul din `schema.sql` (D1 → baza ta → Console).
2. **Cheia de scriere** — Settings → Variables and Secrets → Add → tip „Secret", nume `WRITE_KEY`, valoare aleasă de tine (o pui apoi și în aplicație, la „Cheie de scriere").

## Notă: proiectul „concursiasi"

Când ai adăugat acest folder `worker/` la repo, Cloudflare a creat automat un proiect separat numit `concursiasi`, conectat prin Git la acest repo — de-aia pică build-ul lui (nu are D1/secrete configurate și nu e nevoie de el). E un duplicat neintenționat: poți să-l ștergi din Cloudflare Dashboard → Workers & Pages → `concursiasi` → Settings → Delete. Worker-ul real folosit de aplicație rămâne `concurs-api`, neschimbat.
