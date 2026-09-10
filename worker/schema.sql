CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  name TEXT,
  data TEXT NOT NULL,
  rev INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms (updated_at DESC);

CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_subs_room ON push_subs (room);

CREATE TABLE IF NOT EXISTS season_archive (
  id TEXT PRIMARY KEY,
  room TEXT,
  name TEXT,
  data TEXT NOT NULL,
  archived_at TEXT NOT NULL,
  git_path TEXT
);

CREATE INDEX IF NOT EXISTS idx_season_archive_archived_at ON season_archive (archived_at DESC);

-- migrare pentru baze deja existente (create înainte de coloana git_path de mai sus):
-- ALTER TABLE season_archive ADD COLUMN git_path TEXT;

CREATE TABLE IF NOT EXISTS room_history (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  rev INTEGER NOT NULL,
  data TEXT NOT NULL,
  saved_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_history_room_saved ON room_history (room, saved_at DESC);

-- concursuri programate (calendar regional) — publicare publică, fără cont;
-- editarea/ștergerea necesită manage_token-ul generat la creare (deținut doar de creator)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  event_date TEXT NOT NULL,
  type TEXT,
  fee TEXT,
  slots_total INTEGER,
  slots_taken INTEGER NOT NULL DEFAULT 0,
  organizer TEXT,
  contact TEXT,
  manage_token TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events (event_date);

/* ---------------------------------------------------------------------------
   Concursuri ale altor cluburi (adăugat septembrie 2026)

   Până acum serverul avea o singură cheie de scriere, aceeași pentru toate
   camerele: cine o avea putea scrie oriunde. Ca să poată ține concurs și alt
   club, fiecare cameră capătă cheile ei — una de organizator și una de arbitru.

   Blocurile de mai jos sunt NOI. Se rulează pe o bază care există deja fără
   nicio grijă: `IF NOT EXISTS` nu atinge nimic din ce e acolo, iar tabelele
   vechi rămân neschimbate (nicio coloană adăugată, nimic șters).
   --------------------------------------------------------------------------- */

/* Cheile unei camere. Se ține hash-ul (SHA-256), nu cheia — dacă cineva ajunge
   la baza de date, tot nu poate scrie în camere. */
CREATE TABLE IF NOT EXISTS room_keys (
  room       TEXT PRIMARY KEY,
  owner_key  TEXT NOT NULL,
  ref_key    TEXT NOT NULL,
  club       TEXT,
  invite     TEXT,
  created_at TEXT NOT NULL
);

/* Codurile date cluburilor. Unul pe club, nu unul pe concurs: clubul îl
   folosește de câte ori vrea, până i se stinge. */
CREATE TABLE IF NOT EXISTS invites (
  code       TEXT PRIMARY KEY,
  club       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_room_keys_club ON room_keys (club);
