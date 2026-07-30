# Room state API worker

Cloudflare Worker backing `https://concurs-api.simionescu38.workers.dev/`. Stores per-room JSON state in a D1 table so `index.html` can sync a contest's live state across devices via a room code (see the "Clasament live pe alte telefoane" section in the app's settings).

## Endpoints

- `GET /api/state?room=<code>` — returns `{ ok, rev, data, name }` for the room (`rev: 0, data: null` if the room doesn't exist yet).
- `PUT /api/state?room=<code>` — upserts the room's state. Requires header `x-write-key: <WRITE_KEY>`. Body: `{ "data": { ...room state..., "name": "optional display name" } }`.
- `GET /api/rooms` — lists the 100 most recently updated rooms (`code`, `name`, `rev`, `updated_at`).

## Deploy

```sh
cd worker
wrangler d1 create concurs-api            # then paste the database_id into wrangler.toml
wrangler d1 execute concurs-api --file=schema.sql --remote
wrangler secret put WRITE_KEY
wrangler deploy
```
