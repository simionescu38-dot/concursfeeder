# Room state API worker

Cod sursă pentru Worker-ul `concurs-api`, deployat la `https://concurs-api.simionescu38.workers.dev/`. Ține starea unei camere de concurs într-un tabel D1, ca `index.html` să poată sincroniza clasamentul live pe mai multe telefoane (vezi secțiunea „Clasament live pe alte telefoane" din Setări).

Acest folder e doar sursa de referință — Worker-ul `concurs-api` e administrat direct din Cloudflare Dashboard (editor de cod / `wrangler deploy`), nu e conectat prin Git la acest repo. Dacă modifici `index.js` aici, copiază conținutul și în editorul Worker-ului din Dashboard (sau rulează `wrangler deploy` local din acest folder, cu contul Cloudflare corect).

## Endpoints

- `GET /api/state?room=<code>` — returnează `{ ok, rev, data, name }` pentru cameră (`rev: 0, data: null` dacă nu există încă).
- `PUT /api/state?room=<code>` — creează/actualizează starea camerei. Necesită header-ul `x-write-key: <WRITE_KEY>`. Body: `{ "data": { ...starea completă..., "name": "nume opțional" } }`. Dacă se schimbă liderul concursului față de starea anterioară, trimite automat o notificare push (pop-up + sunet) tuturor telefoanelor abonate la acea cameră.
- `GET /api/rooms` — listează ultimele 100 camere actualizate (`code`, `name`, `rev`, `updated_at`).
- `POST /api/subscribe?room=<code>` — înregistrează un abonament de notificări push pentru cameră. Body: `{ "subscription": {...obiectul PushSubscription din browser...} }`.
- `POST /api/unsubscribe` — șterge un abonament. Body: `{ "endpoint": "..." }`.
- `POST /api/archive?room=<code opțional>` — arhivează un concurs terminat, permanent, pentru `sezon.html`. Necesită `x-write-key`. Body: `{ "data": {...starea completă a concursului...} }`. Răspunde `{ ok, id, gitBackup }` — dacă e configurat `GITHUB_TOKEN` (vezi mai jos), arhiva se scrie și ca fișier `arhiva/<data>-<nume>.json`, commit-uit direct pe `main`; `gitBackup: true` confirmă că backup-ul a reușit (D1 rămâne sursa validă chiar dacă backup-ul în git eșuează — best-effort, nu blochează arhivarea).
- `GET /api/archive` — listează toate concursurile arhivate (cele mai noi primele), cu datele complete: `{ ok, archives: [{ id, room, name, archived_at, data }] }`.
- `DELETE /api/archive?id=<id>` — șterge un concurs arhivat greșit. Necesită `x-write-key`. **Nu** șterge și fișierul din git — arhiva rămâne permanent în `arhiva/`, imună la o ștergere greșită din D1 (ex. butonul „Șterge TOATE arhivele online" din Setări). Excepție: `DELETE /api/archive?id=<id>&replace=1` — folosit doar intern, când aplicația rearhivează același concurs de la același telefon (înlocuire, nu ștergere) — atunci se șterge și fișierul vechi din git, ca să nu rămână un duplicat orfan.
- `GET /api/history?room=<code>` — istoricul automat de versiuni al unei camere (ultimele 40, salvate la fiecare suprascriere, fără nicio acțiune din partea organizatorului): `{ ok, versions: [{ id, rev, saved_at, name, participants }] }`. E o plasă de siguranță: dacă un telefon suprascrie din greșeală camera cu date vechi/greșite, versiunea anterioară tot există aici.
- `POST /api/restore?room=<code>&id=<historyId>` — restaurează camera la o versiune din istoric. Necesită `x-write-key`. Salvează și starea curentă în istoric înainte (restaurarea e la rândul ei reversibilă).
- `GET /api/events` — listă publică de concursuri programate (viitoare), sortate după dată: `{ ok, events: [{ id, name, location, event_date, type, fee, slots_total, slots_taken, organizer, contact, created_at }] }`.
- `POST /api/events` — publică un concurs nou. **Fără cheie** — oricine poate adăuga (calendar regional, nu doar concursurile tale). Body: `{ name, location, eventDate, type, fee, slotsTotal, organizer, contact }` (`name`, `location`, `eventDate` obligatorii). Răspunde `{ ok, id, manageToken }` — `manageToken`-ul se generează o singură dată, la creare, și nu se poate recupera ulterior; aplicația îl salvează local, pe telefonul celui care a publicat anunțul.
- `PUT /api/events/edit?id=<id>` — editează un concurs programat. Necesită **fie** header-ul `x-manage-token` egal cu token-ul primit la creare (oricine publică, dar doar el poate edita ce a publicat), **fie** `x-write-key: <WRITE_KEY>` (moderare — administratorul poate edita orice eveniment, nu doar pe-ale lui). Body: aceleași câmpuri ca la creare, plus opțional `slotsTaken`.
- `DELETE /api/events/edit?id=<id>` — șterge un concurs programat. Necesită `x-manage-token` **sau** `x-write-key` (moderare).

## Configurare în Cloudflare Dashboard (Worker `concurs-api`)

1. **Baza de date D1** — Workers & Pages → `concurs-api` → Settings → Bindings → Add binding → D1 database. Variable name: `DB`. Dacă nu există încă baza de date, o creezi din Workers & Pages → D1 → Create database, apoi rulezi conținutul din `schema.sql` (D1 → baza ta → Console). Dacă baza există deja de dinainte, rulează doar blocurile/coloanele noi din `schema.sql` (inclusiv `ALTER TABLE season_archive ADD COLUMN git_path TEXT;`, dacă tabela `season_archive` există deja fără ea).
2. **Cheia de scriere** — Settings → Variables and Secrets → Add → tip „Secret", nume `WRITE_KEY`, valoare aleasă de tine (o pui apoi și în aplicație, la „Cheie de scriere").
3. **Notificări push (VAPID)** — Settings → Variables and Secrets → Add, de două ori (cheile sunt generate separat, în afara acestui repo — nu se pun niciodată în Git):
   - Secret `VAPID_PRIVATE_JWK` — cheia privată (JSON).
   - Variable `VAPID_PUBLIC_KEY` — cheia publică (base64url). Aceeași valoare trebuie copiată și în `index.html`, la constanta `VAPID_PUBLIC_KEY`.
4. **Backup arhive în git (opțional, dar recomandat)** — Settings → Variables and Secrets → Add → tip „Secret", nume `GITHUB_TOKEN`. Valoare: un token GitHub *fine-grained* (Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token), cu acces **doar** la repo-ul `concursfeeder` și permisiunea **Contents: Read and write**. Fără acest secret, arhivarea funcționează normal, doar că sare peste pasul de backup în git (rămâne doar în D1, ca înainte).

## Concursuri ale altor cluburi — trei trepte de cheie

Serverul avea o singură cheie de scriere (`WRITE_KEY`), aceeași pentru toate camerele:
cine o avea putea scrie oriunde, putea publica în arhiva de sezon și putea modera
calendarul. Bun cât timp organizatorul era unul singur.

Acum fiecare cameră are cheile ei:

| treaptă | cheia | ce poate |
|---|---|---|
| **administrator** | `WRITE_KEY` (secretul serverului) | tot, în orice cameră; invitații; ștergere din arhivă |
| **organizator** | `ownerKey`, dată la facerea camerei | tot, dar **numai în camera lui** |
| **arbitru** | `refKey`, dată la facerea camerei | **numai cifrele cântarului**, în camera lui |

În bază se ține amprenta SHA-256 a cheii, nu cheia. Cheile se arată **o singură dată**,
în răspunsul de la facerea camerei.

**Camerele făcute înainte** n-au rând în `room_keys`. Pentru ele merge mai departe doar
`WRITE_KEY`, exact ca până acum — nicio zi de concurs în desfășurare nu se strică.

### Ce poate arbitrul, mai exact

Scrierea lui nu se respinge **niciodată** — s-ar pierde cântăriri făcute la baltă. În
schimb se ia din ea doar ce are voie să schimbe: se pleacă de la starea de pe server și
se pun peste ea cifrele lui (`CAMPURI_CANTAR` din `index.js`: capturi, pești extra, orele
și pozele lor, cel mai mare pește, „lampă/absent"). Standul și sectorul **nu** sunt în
listă: alea vin din tragerea la sorți.

Poate și să **șteargă** o cântărire greșită — cerut explicit, e mai simplu la baltă decât
să sune organizatorul.

### Căi noi

- `POST /api/room/create` — face o cameră cu cheile ei. Body: `{ invite, room?, club? }`.
  Fără `x-write-key` cere o invitație valabilă; cu cheia serverului merge și fără.
  Răspunde `{ ok, room, club, ownerKey, refKey }` — **singura dată** când se văd cheile.
  O cameră care are deja stăpân nu poate fi luată a doua oară (`409 camera-are-stapan`).
- `POST /api/room/refkey?room=<cod>` — schimbă cheia de arbitru (organizator sau
  administrator). La baltă cheia stă pe ecran, în fața tuturor; de aceea se poate schimba.
  Cea de organizator **nu** se schimbă de aici — ar fi calea prin care cineva ia camera altuia.
- `GET|POST|DELETE /api/invites` — invitațiile cluburilor, **numai** cu cheia serverului.
  `POST { club }` → `{ code }`. `DELETE ?code=` stinge invitația (`active=0`); nu se șterge,
  iar camerele făcute cu ea rămân ale clubului.

### La livrare

Tabelele `room_keys` și `invites` sunt **noi**. Se rulează blocurile de la coada lui
`schema.sql` în D1 → baza ta → Console. Sunt `CREATE TABLE IF NOT EXISTS`, deci nu ating
nimic din ce există: nicio coloană adăugată la tabelele vechi, nimic șters.

## Legăturile stau în `wrangler.toml`, nu în panou

`npx wrangler deploy` pune pe Worker **exact** legăturile scrise în `wrangler.toml` și le
scoate pe cele adăugate doar din panoul Cloudflare. Așa s-a pierdut o dată modelul care
citește cântarul din poză: `env.AI` era pus de mână din browser, iar prima livrare făcută
cu `wrangler` l-a șters, fără ca ceva să pară stricat — aplicația spunea doar „scrie tu".

De aceea toate legăturile de care are nevoie codul stau acum în `wrangler.toml`: `DB`
(baza D1) și `AI` (modelul). Ce se adaugă pe viitor în panou trebuie scris și acolo,
altfel dispare la următoarea livrare.

**Secretele nu se pierd.** `WRITE_KEY`, `VAPID_PRIVATE_JWK` și `GITHUB_TOKEN` sunt ținute
separat de Cloudflare; o livrare nu le atinge.

## Notă: proiectul „concursiasi"

Când ai adăugat acest folder `worker/` la repo, Cloudflare a creat automat un proiect separat numit `concursiasi`, conectat prin Git la acest repo — de-aia pică build-ul lui (nu are D1/secrete configurate și nu e nevoie de el). E un duplicat neintenționat: poți să-l ștergi din Cloudflare Dashboard → Workers & Pages → `concursiasi` → Settings → Delete. Worker-ul real folosit de aplicație rămâne `concurs-api`, neschimbat.
