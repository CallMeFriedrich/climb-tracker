PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_admin INTEGER NOT NULL DEFAULT 0,
  bio TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('lead','boulder')),
  grade TEXT NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 0 CHECK(target_count >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, category, grade)
);

-- Crowdsourced locations: crag -> sector -> route -> entry
CREATE TABLE IF NOT EXISTS crags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  discipline TEXT NOT NULL DEFAULT 'sport',  -- 'sport' | 'boulder' | 'alpin' (indoor halls stored per discipline)
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_crags_name ON crags(lower(name), discipline);

CREATE TABLE IF NOT EXISTS sectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crag_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (crag_id) REFERENCES crags(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sectors_name ON sectors(crag_id, lower(name));

CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crag_id INTEGER NOT NULL,
  sector_id INTEGER,
  name TEXT NOT NULL,
  grade TEXT,
  length_m INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (crag_id) REFERENCES crags(id) ON DELETE CASCADE,
  FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_routes_name ON routes(sector_id, lower(name));

CREATE TABLE IF NOT EXISTS log_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('lead','boulder')),  -- scoring grade family (sport/alpin -> lead)
  grade TEXT NOT NULL,
  count INTEGER NOT NULL CHECK(count >= 1),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  environment TEXT NOT NULL DEFAULT 'indoor',  -- 'indoor' | 'outdoor'
  ascent_style TEXT,                            -- os | flash | rp | pp | tr
  attempts INTEGER,
  discipline TEXT,                              -- 'boulder' | 'sport' | 'alpin'
  mode TEXT,                                    -- sport only: 'lead' | 'toprope'
  crag_id INTEGER,
  sector_id INTEGER,
  route_id INTEGER,
  details_json TEXT,                            -- length_m, quickdraws, alpine metadata, beta, gpx filename
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (crag_id) REFERENCES crags(id) ON DELETE SET NULL,
  FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE SET NULL,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
);
