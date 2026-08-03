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
  archived_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_season_archive_archived_at ON season_archive (archived_at DESC);

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
