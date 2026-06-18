"use strict";
const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");
const SqliteStore = require("better-sqlite3-session-store")(session);
const app = express();

// -------------------- Config --------------------
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "data", "app.db");

// Grade-Listen
const LEAD_GRADES = [
  "4a","4b","4c","5a","5b","5c",
  "6a","6a+","6b","6b+","6c","6c+",
  "7a","7a+","7b","7b+","7c","7c+",
  "8a","8a+","8b","8b+","8c","8c+","9a"
];
const BOULDER_GRADES = ["1","2","3","4","5","6","7","8","9"];
const BOULDER_OUTDOOR_GRADES = [
  "4a","4b","4c","5a","5b","5c",
  "6a","6a+","6b","6b+","6c","6c+",
  "7a","7a+","7b","7b+","7c","7c+",
  "8a","8a+","8b","8b+","8c","8c+","9a"
];
// UIAA scale for alpine routes (not part of the weekly score)
const UIAA_GRADES = [
  "I","II","III","III+","IV-","IV","IV+","V-","V","V+",
  "VI-","VI","VI+","VII-","VII","VII+","VIII-","VIII","VIII+",
  "IX-","IX","IX+","X-","X","X+","XI-","XI"
];

const DISCIPLINES = ["boulder", "sport", "alpin"];
const MODES = ["lead", "toprope"];
// Crag "kinds" decouple the location list from the climbing discipline:
// indoor halls are shared between indoor sport & boulder, outdoor crags stay per discipline.
const CRAG_KINDS = ["indoor", "sport", "boulder", "alpin"];

function isValidGrade(category, grade, environment) {
  if (category === "lead") return LEAD_GRADES.includes(grade);
  if (category === "boulder") {
    if (environment === "outdoor") return BOULDER_OUTDOOR_GRADES.includes(grade);
    return BOULDER_GRADES.includes(String(grade));
  }
  return false;
}

// Validate a grade for the new discipline-based entry flow
function gradeValidForEntry(discipline, environment, grade) {
  const g = String(grade);
  if (discipline === "alpin") return UIAA_GRADES.includes(g);
  if (discipline === "sport") return LEAD_GRADES.includes(g);
  if (discipline === "boulder") {
    return environment === "outdoor"
      ? BOULDER_OUTDOOR_GRADES.includes(g)
      : BOULDER_GRADES.includes(g);
  }
  return false;
}

// Map a discipline to the scoring grade-family kept in log_entries.category
function categoryForDiscipline(discipline) {
  return discipline === "boulder" ? "boulder" : "lead";
}

// -------------------- Weights (for performance score) --------------------
const LEAD_WEIGHT = {
  "4a": 10, "4b": 11, "4c": 12,
  "5a": 14, "5b": 16, "5c": 18,
  "6a": 22, "6a+": 24, "6b": 26, "6b+": 29, "6c": 32, "6c+": 36,
  "7a": 40, "7a+": 45, "7b": 50, "7b+": 56, "7c": 63, "7c+": 71,
  "8a": 80, "8a+": 90, "8b": 101, "8b+": 113, "8c": 126, "8c+": 140,
  "9a": 155
};
const BOULDER_WEIGHT = {
  "1": 10, "2": 13, "3": 17, "4": 22, "5": 29, "6": 38, "7": 50, "8": 66, "9": 87
};
const BOULDER_OUTDOOR_WEIGHT = {
  "4a": 10, "4b": 11, "4c": 12,
  "5a": 14, "5b": 16, "5c": 18,
  "6a": 22, "6a+": 24, "6b": 26, "6b+": 29, "6c": 32, "6c+": 36,
  "7a": 40, "7a+": 45, "7b": 50, "7b+": 56, "7c": 63, "7c+": 71,
  "8a": 80, "8a+": 90, "8b": 101, "8b+": 113, "8c": 126, "8c+": 140,
  "9a": 155
};

function weightFor(category, grade, environment) {
  if (category === "lead") return LEAD_WEIGHT[String(grade)] ?? 0;
  if (category === "boulder") {
    if (environment === "outdoor") return BOULDER_OUTDOOR_WEIGHT[String(grade)] ?? 0;
    return BOULDER_WEIGHT[String(grade)] ?? 0;
  }
  return 0;
}

// -------------------- DB init --------------------
fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
const db = new Database(DB_FILE);

const schemaFile = path.join(__dirname, "db", "schema.sql");
if (fs.existsSync(schemaFile)) {
  const schema = fs.readFileSync(schemaFile, "utf8");
  db.exec(schema);
}

// Ensure `is_admin` exists (safe migration)
try {
  db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;");
} catch (e) {
  // ignore if column already exists
}

// Ensure `bio` exists (safe migration)
try {
  db.exec("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT '';");
} catch (e) {
  // ignore if column already exists
}

// Ensure `ascent_style` and `attempts` exist on log_entries
try { db.exec("ALTER TABLE log_entries ADD COLUMN ascent_style TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE log_entries ADD COLUMN attempts INTEGER;"); } catch(e) {}

// Ensure `environment` exists on log_entries (safe migration)
try {
  db.exec("ALTER TABLE log_entries ADD COLUMN environment TEXT NOT NULL DEFAULT 'indoor';");
} catch (e) {
  // ignore if column already exists
}

// ---- New logging model: discipline / mode / crowdsourced locations / details ----
try { db.exec("ALTER TABLE log_entries ADD COLUMN discipline TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE log_entries ADD COLUMN mode TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE log_entries ADD COLUMN crag_id INTEGER;"); } catch(e) {}
try { db.exec("ALTER TABLE log_entries ADD COLUMN sector_id INTEGER;"); } catch(e) {}
try { db.exec("ALTER TABLE log_entries ADD COLUMN route_id INTEGER;"); } catch(e) {}
try { db.exec("ALTER TABLE log_entries ADD COLUMN details_json TEXT;"); } catch(e) {}

// Backfill discipline/mode for pre-existing entries so scoring stays consistent
try { db.exec("UPDATE log_entries SET discipline = CASE WHEN category='boulder' THEN 'boulder' ELSE 'sport' END WHERE discipline IS NULL;"); } catch(e) {}
try { db.exec("UPDATE log_entries SET mode = 'lead' WHERE category='lead' AND mode IS NULL;"); } catch(e) {}

// Crowdsourced location tables: crag -> sector -> route -> entry
db.exec(`
  CREATE TABLE IF NOT EXISTS crags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    discipline TEXT NOT NULL DEFAULT 'sport',
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(name, discipline) ON CONFLICT IGNORE
  );
  CREATE TABLE IF NOT EXISTS sectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crag_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (crag_id) REFERENCES crags(id) ON DELETE CASCADE,
    UNIQUE(crag_id, name) ON CONFLICT IGNORE
  );
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
    FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE CASCADE,
    UNIQUE(sector_id, name) ON CONFLICT IGNORE
  );
  CREATE INDEX IF NOT EXISTS idx_sectors_crag ON sectors(crag_id);
  CREATE INDEX IF NOT EXISTS idx_routes_sector ON routes(sector_id);
  CREATE INDEX IF NOT EXISTS idx_routes_crag ON routes(crag_id);
`);

// Use case-insensitive uniqueness for crowdsourced names (dedupe "Frankenjura" vs "frankenjura")
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS ux_crags_name ON crags(lower(name), discipline);
  CREATE UNIQUE INDEX IF NOT EXISTS ux_sectors_name ON sectors(crag_id, lower(name));
  CREATE UNIQUE INDEX IF NOT EXISTS ux_routes_name ON routes(sector_id, lower(name));
`);

// Crag coordinates (for the topo map) — crowdsourced, nullable
try { db.exec("ALTER TABLE crags ADD COLUMN lat REAL;"); } catch (e) {}
try { db.exec("ALTER TABLE crags ADD COLUMN lng REAL;"); } catch (e) {}

// Per-user IP log — admin-visible only, invisible to the user themselves
db.exec(`
  CREATE TABLE IF NOT EXISTS user_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ip TEXT NOT NULL,
    first_seen TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen  TEXT NOT NULL DEFAULT (datetime('now')),
    hits INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, ip)
  );
  CREATE INDEX IF NOT EXISTS idx_user_ips_user ON user_ips(user_id);
`);

// Directory for uploaded GPX tracks (alpine tours)
const GPX_DIR = path.join(__dirname, "data", "gpx");
fs.mkdirSync(GPX_DIR, { recursive: true });

// -------------------- Middlewares --------------------
// Behind a reverse proxy (TLS termination): trust the first hop so req.ip and
// req.secure / x-forwarded-proto reflect the real client.
app.set("trust proxy", 1);

// Optional HTTPS enforcement — only active when FORCE_HTTPS=1 (i.e. once a TLS
// proxy is in front). Off by default so plain-HTTP access keeps working.
if (process.env.FORCE_HTTPS === "1") {
  app.use((req, res, next) => {
    if (req.secure || req.headers["x-forwarded-proto"] === "https") return next();
    return res.redirect(308, "https://" + req.headers.host + req.originalUrl);
  });
}

app.use(express.json({ limit: "8mb" }));        // larger limit for inline GPX track uploads
app.use(express.urlencoded({ extended: true, limit: "8mb" }));
const sessionDb = new Database(path.join(__dirname, "data", "sessions.db"));
app.use(session({
  secret: process.env.SESSION_SECRET || "CHANGE_ME_TO_A_LONG_RANDOM_SECRET",
  resave: false,
  saveUninitialized: false,
  store: new SqliteStore({ client: sessionDb }),
  cookie: {
    httpOnly: true,
    sameSite: "lax",                              // mitigates CSRF, safe over HTTP
    secure: process.env.SECURE_COOKIES === "1",   // enable once served over HTTPS
    // maxAge wird per Login dynamisch gesetzt ("Eingeloggt bleiben")
  }
}));

// -------------------- IP logging (admin-visible only) --------------------
const ipUpsert = db.prepare(`
  INSERT INTO user_ips (user_id, ip, first_seen, last_seen, hits)
  VALUES (?, ?, datetime('now'), datetime('now'), 1)
  ON CONFLICT(user_id, ip) DO UPDATE SET last_seen=datetime('now'), hits=hits+1
`);
function clientIp(req) {
  return String(req.ip || "").replace(/^::ffff:/, "") || "unknown";
}
function recordIp(userId, ip) {
  try { if (userId && ip) ipUpsert.run(userId, ip); } catch (e) {}
}
// Record the IP of authenticated requests, but only when it changes (cheap)
app.use((req, res, next) => {
  const uid = req.session && req.session.userId;
  if (uid) {
    const ip = clientIp(req);
    if (req.session.lastIp !== ip) {
      recordIp(uid, ip);
      req.session.lastIp = ip;
    }
  }
  next();
});

app.use(express.static(path.join(__dirname, "public")));

// -------------------- Auth helpers --------------------
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated" });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated" });
  const row = db.prepare("SELECT is_admin FROM users WHERE id=?").get(req.session.userId);
  if (!row || row.is_admin !== 1) return res.status(403).json({ error: "Admin only" });
  next();
}
function currentUserId(req) {
  return req.session.userId;
}

// -------------------- Auth API --------------------
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || String(username).length < 3 || String(password).length < 6) {
    return res.status(400).json({ error: "Username >=3, Password >=6" });
  }
  const existing = db.prepare("SELECT id FROM users WHERE username=?").get(String(username));
  if (existing) return res.status(409).json({ error: "Username already exists" });
  const hash = await bcrypt.hash(String(password), 12);
  const info = db.prepare("INSERT INTO users (username, password_hash) VALUES (?,?)")
    .run(String(username), hash);
  req.session.userId = info.lastInsertRowid;
  const ip = clientIp(req);
  recordIp(info.lastInsertRowid, ip);
  req.session.lastIp = ip;
  res.json({ ok: true });
});

app.post("/api/login", async (req, res) => {
  const { username, password, remember } = req.body;
  const user = db.prepare("SELECT id, password_hash FROM users WHERE username=?")
    .get(String(username));
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const ok = await bcrypt.compare(String(password), user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  req.session.userId = user.id;
  const ip = clientIp(req);
  recordIp(user.id, ip);
  req.session.lastIp = ip;
  // "Eingeloggt bleiben": 30 Tage; sonst Session-Cookie (läuft beim Browser-Schließen ab)
  if (remember === "1") {
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
  } else {
    req.session.cookie.expires = false; // Session-Cookie
  }
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// -------------------- Self-service (me) --------------------
app.get("/api/me", requireAuth, (req, res) => {
  const me = db.prepare("SELECT id, username, is_admin, bio FROM users WHERE id=?")
    .get(currentUserId(req));
  res.json({ me });
});

app.post("/api/me/username", requireAuth, (req, res) => {
  const userId = currentUserId(req);
  const newName = String(req.body.username || "").trim();
  if (newName.length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters" });
  }
  const existing = db.prepare("SELECT id FROM users WHERE username=?").get(newName);
  if (existing && existing.id !== userId) {
    return res.status(409).json({ error: "Username already exists" });
  }
  db.prepare("UPDATE users SET username=? WHERE id=?").run(newName, userId);
  res.json({ ok: true });
});

app.post("/api/me/password", requireAuth, async (req, res) => {
  const userId = currentUserId(req);
  const oldPassword = String(req.body.oldPassword || "");
  const newPassword = String(req.body.newPassword || "");
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  const row = db.prepare("SELECT password_hash FROM users WHERE id=?").get(userId);
  if (!row) return res.status(404).json({ error: "User not found" });
  const ok = await bcrypt.compare(oldPassword, row.password_hash);
  if (!ok) return res.status(401).json({ error: "Old password is wrong" });
  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hash, userId);
  res.json({ ok: true });
});

app.post("/api/me/bio", requireAuth, (req, res) => {
  const userId = currentUserId(req);
  const bio = String(req.body.bio || "").slice(0, 500);
  db.prepare("UPDATE users SET bio=? WHERE id=?").run(bio, userId);
  res.json({ ok: true });
});

app.post("/api/me/delete", requireAuth, (req, res) => {
  const userId = currentUserId(req);
  db.prepare("DELETE FROM users WHERE id=?").run(userId);
  req.session.destroy(() => res.json({ ok: true }));
});

// -------------------- Community / Users --------------------
app.get("/api/users", requireAuth, (req, res) => {
  const users = db.prepare("SELECT id, username, bio, created_at FROM users WHERE is_admin=0 ORDER BY username").all();
  res.json({ users });
});

// Public-ish profile payload (for profile page header/bio)
app.get("/api/profile/user/:id", requireAuth, (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: "Bad user id" });
  const user = db.prepare("SELECT id, username, bio, created_at, is_admin FROM users WHERE id=?").get(userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  // Admin profile is only visible to the admin themselves
  const requestingUser = db.prepare("SELECT is_admin FROM users WHERE id=?").get(currentUserId(req));
  if (user.is_admin === 1 && requestingUser?.is_admin !== 1) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({ user });
});

// -------------------- Weekly leaderboard (WEIGHTED SCORE) --------------------
app.get("/api/leaderboard/weekly", requireAuth, (req, res) => {
  const startOfWeek = db.prepare(`
    SELECT datetime('now','localtime','start of day',
      '-' || ((strftime('%w','now','localtime') + 6) % 7) || ' days'
    ) AS start
  `).get().start;

  const rows = db.prepare(`
    SELECT
      u.id AS user_id,
      u.username AS username,
      COALESCE(SUM(CASE WHEN l.category='lead' THEN l.count END), 0) AS lead_count,
      COALESCE(SUM(CASE WHEN l.category='boulder' THEN l.count END), 0) AS boulder_count,
      COALESCE(SUM(l.count), 0) AS total_count,
      ROUND(COALESCE(SUM(
        l.count *
        (CASE WHEN l.mode='toprope' THEN 0.5 ELSE 1 END) *
        CASE
          WHEN l.category='lead' THEN
            CASE l.grade
              WHEN '4a' THEN 10
              WHEN '4b' THEN 11
              WHEN '4c' THEN 12
              WHEN '5a' THEN 14
              WHEN '5b' THEN 16
              WHEN '5c' THEN 18
              WHEN '6a' THEN 22
              WHEN '6a+' THEN 24
              WHEN '6b' THEN 26
              WHEN '6b+' THEN 29
              WHEN '6c' THEN 32
              WHEN '6c+' THEN 36
              WHEN '7a' THEN 40
              WHEN '7a+' THEN 45
              WHEN '7b' THEN 50
              WHEN '7b+' THEN 56
              WHEN '7c' THEN 63
              WHEN '7c+' THEN 71
              WHEN '8a' THEN 80
              WHEN '8a+' THEN 90
              WHEN '8b' THEN 101
              WHEN '8b+' THEN 113
              WHEN '8c' THEN 126
              WHEN '8c+' THEN 140
              WHEN '9a' THEN 155
              ELSE 0
            END
          WHEN l.category='boulder' AND l.environment='outdoor' THEN
            CASE l.grade
              WHEN '4a' THEN 10 WHEN '4b' THEN 11 WHEN '4c' THEN 12
              WHEN '5a' THEN 14 WHEN '5b' THEN 16 WHEN '5c' THEN 18
              WHEN '6a' THEN 22 WHEN '6a+' THEN 24 WHEN '6b' THEN 26 WHEN '6b+' THEN 29 WHEN '6c' THEN 32 WHEN '6c+' THEN 36
              WHEN '7a' THEN 40 WHEN '7a+' THEN 45 WHEN '7b' THEN 50 WHEN '7b+' THEN 56 WHEN '7c' THEN 63 WHEN '7c+' THEN 71
              WHEN '8a' THEN 80 WHEN '8a+' THEN 90 WHEN '8b' THEN 101 WHEN '8b+' THEN 113 WHEN '8c' THEN 126 WHEN '8c+' THEN 140
              WHEN '9a' THEN 155
              ELSE 0
            END
          WHEN l.category='boulder' THEN
            CASE l.grade
              WHEN '1' THEN 10
              WHEN '2' THEN 13
              WHEN '3' THEN 17
              WHEN '4' THEN 22
              WHEN '5' THEN 29
              WHEN '6' THEN 38
              WHEN '7' THEN 50
              WHEN '8' THEN 66
              WHEN '9' THEN 87
              ELSE 0
            END
          ELSE 0
        END
      ), 0), 1) AS score
    FROM users u
    LEFT JOIN log_entries l
      ON l.user_id = u.id
      AND datetime(l.created_at) >= datetime(?)
      AND COALESCE(l.discipline,'') != 'alpin'
    WHERE u.is_admin = 0
    GROUP BY u.id
    ORDER BY score DESC, total_count DESC, u.username ASC
  `).all(startOfWeek);

  res.json({ startOfWeek, rows });
});

// -------------------- Goals --------------------
app.get("/api/goals/me", requireAuth, (req, res) => {
  const rows = db.prepare(
    "SELECT category, grade, target_count FROM goals WHERE user_id=? AND target_count > 0"
  ).all(currentUserId(req));
  res.json({ goals: rows, leadGrades: LEAD_GRADES, boulderGrades: BOULDER_GRADES, boulderOutdoorGrades: BOULDER_OUTDOOR_GRADES });
});

app.post("/api/goals/me", requireAuth, (req, res) => {
  const { category, goals } = req.body;
  if (!["lead", "boulder"].includes(category) || !Array.isArray(goals)) {
    return res.status(400).json({ error: "Bad payload" });
  }

  const userId = currentUserId(req);
  const upsert = db.prepare(`
    INSERT INTO goals (user_id, category, grade, target_count, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, category, grade)
    DO UPDATE SET target_count=excluded.target_count, updated_at=datetime('now')
  `);

  const tx = db.transaction(() => {
    for (const g of goals) {
      const grade = String(g.grade);
      const target = Number(g.target_count);
      if (!isValidGrade(category, grade)) continue;
      if (!Number.isInteger(target) || target < 0) continue;
      upsert.run(userId, category, grade, target);
    }
  });

  tx();
  res.json({ ok: true });
});

app.get("/api/goals/user/:id", requireAuth, (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: "Bad user id" });
  const rows = db.prepare(
    "SELECT category, grade, target_count FROM goals WHERE user_id=? AND target_count > 0"
  ).all(userId);
  res.json({ goals: rows });
});

// -------------------- Crowdsourced locations (crag -> sector -> route) --------------------
// Grade lists for the client (single source of truth)
app.get("/api/grades", requireAuth, (req, res) => {
  res.json({
    leadGrades: LEAD_GRADES,
    boulderGrades: BOULDER_GRADES,
    boulderOutdoorGrades: BOULDER_OUTDOOR_GRADES,
    uiaaGrades: UIAA_GRADES
  });
});

// List crags (optionally filtered by discipline)
app.get("/api/crags", requireAuth, (req, res) => {
  const discipline = req.query.discipline ? String(req.query.discipline) : null;
  const rows = discipline
    ? db.prepare("SELECT id, name, discipline FROM crags WHERE discipline=? ORDER BY name COLLATE NOCASE").all(discipline)
    : db.prepare("SELECT id, name, discipline FROM crags ORDER BY name COLLATE NOCASE").all();
  res.json({ crags: rows });
});

// Create (or reuse existing) crag — crowdsourced, case-insensitive dedupe
app.post("/api/crags", requireAuth, (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 120);
  const discipline = String(req.body.discipline || "sport");
  if (name.length < 1) return res.status(400).json({ error: "Name required" });
  if (!CRAG_KINDS.includes(discipline)) return res.status(400).json({ error: "Bad discipline" });

  let row = db.prepare("SELECT id, name, discipline FROM crags WHERE lower(name)=lower(?) AND discipline=?").get(name, discipline);
  if (!row) {
    db.prepare("INSERT OR IGNORE INTO crags (name, discipline, created_by) VALUES (?,?,?)").run(name, discipline, currentUserId(req));
    row = db.prepare("SELECT id, name, discipline FROM crags WHERE lower(name)=lower(?) AND discipline=?").get(name, discipline);
  }
  res.json({ crag: row });
});

// List sectors of a crag
app.get("/api/crags/:id/sectors", requireAuth, (req, res) => {
  const cragId = Number(req.params.id);
  if (!Number.isInteger(cragId)) return res.status(400).json({ error: "Bad crag id" });
  const rows = db.prepare("SELECT id, name FROM sectors WHERE crag_id=? ORDER BY name COLLATE NOCASE").all(cragId);
  res.json({ sectors: rows });
});

// Create (or reuse) sector within a crag
app.post("/api/sectors", requireAuth, (req, res) => {
  const cragId = Number(req.body.crag_id);
  const name = String(req.body.name || "").trim().slice(0, 120);
  if (!Number.isInteger(cragId)) return res.status(400).json({ error: "Bad crag id" });
  if (name.length < 1) return res.status(400).json({ error: "Name required" });
  const crag = db.prepare("SELECT id FROM crags WHERE id=?").get(cragId);
  if (!crag) return res.status(404).json({ error: "Crag not found" });

  let row = db.prepare("SELECT id, name FROM sectors WHERE crag_id=? AND lower(name)=lower(?)").get(cragId, name);
  if (!row) {
    db.prepare("INSERT OR IGNORE INTO sectors (crag_id, name, created_by) VALUES (?,?,?)").run(cragId, name, currentUserId(req));
    row = db.prepare("SELECT id, name FROM sectors WHERE crag_id=? AND lower(name)=lower(?)").get(cragId, name);
  }
  res.json({ sector: row });
});

// List routes of a sector
app.get("/api/sectors/:id/routes", requireAuth, (req, res) => {
  const sectorId = Number(req.params.id);
  if (!Number.isInteger(sectorId)) return res.status(400).json({ error: "Bad sector id" });
  const rows = db.prepare("SELECT id, name, grade, length_m FROM routes WHERE sector_id=? ORDER BY name COLLATE NOCASE").all(sectorId);
  res.json({ routes: rows });
});

// Create (or reuse) route within a sector
app.post("/api/routes", requireAuth, (req, res) => {
  const cragId = Number(req.body.crag_id);
  const sectorId = Number(req.body.sector_id);
  const name = String(req.body.name || "").trim().slice(0, 120);
  const grade = req.body.grade ? String(req.body.grade).slice(0, 12) : null;
  const lengthM = req.body.length_m ? Math.max(0, Math.floor(Number(req.body.length_m))) : null;
  if (!Number.isInteger(cragId)) return res.status(400).json({ error: "Bad crag id" });
  if (!Number.isInteger(sectorId)) return res.status(400).json({ error: "Bad sector id" });
  if (name.length < 1) return res.status(400).json({ error: "Name required" });
  const sector = db.prepare("SELECT id FROM sectors WHERE id=? AND crag_id=?").get(sectorId, cragId);
  if (!sector) return res.status(404).json({ error: "Sector not found" });

  let row = db.prepare("SELECT id, name, grade, length_m FROM routes WHERE sector_id=? AND lower(name)=lower(?)").get(sectorId, name);
  if (!row) {
    db.prepare("INSERT OR IGNORE INTO routes (crag_id, sector_id, name, grade, length_m, created_by) VALUES (?,?,?,?,?,?)")
      .run(cragId, sectorId, name, grade, lengthM, currentUserId(req));
    row = db.prepare("SELECT id, name, grade, length_m FROM routes WHERE sector_id=? AND lower(name)=lower(?)").get(sectorId, name);
  }
  res.json({ route: row });
});

// Set / update a crag's map position (crowdsourced)
app.post("/api/crags/:id/location", requireAuth, (req, res) => {
  const cragId = Number(req.params.id);
  if (!Number.isInteger(cragId)) return res.status(400).json({ error: "Bad crag id" });
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: "Bad coordinates" });
  }
  const info = db.prepare("UPDATE crags SET lat=?, lng=? WHERE id=?")
    .run(Number(lat.toFixed(6)), Number(lng.toFixed(6)), cragId);
  if (info.changes === 0) return res.status(404).json({ error: "Crag not found" });
  res.json({ ok: true });
});

// -------------------- Topo (browseable crag/sector/route directory) --------------------
app.get("/api/topo/crags", requireAuth, (req, res) => {
  const crags = db.prepare(`
    SELECT c.id, c.name, c.discipline, c.lat, c.lng,
      (SELECT COUNT(*) FROM sectors s WHERE s.crag_id = c.id) AS sector_count,
      (SELECT COUNT(*) FROM routes  r WHERE r.crag_id = c.id) AS route_count
    FROM crags c
    ORDER BY c.discipline, c.name COLLATE NOCASE
  `).all();
  res.json({ crags });
});

app.get("/api/topo/crag/:id", requireAuth, (req, res) => {
  const cragId = Number(req.params.id);
  if (!Number.isInteger(cragId)) return res.status(400).json({ error: "Bad crag id" });

  const crag = db.prepare("SELECT id, name, discipline, lat, lng FROM crags WHERE id=?").get(cragId);
  if (!crag) return res.status(404).json({ error: "Crag not found" });

  const sectors = db.prepare("SELECT id, name FROM sectors WHERE crag_id=? ORDER BY name COLLATE NOCASE").all(cragId);
  const routes = db.prepare("SELECT id, sector_id, name, grade, length_m FROM routes WHERE crag_id=? ORDER BY name COLLATE NOCASE").all(cragId);

  // Per-route stats + remarks (from log entries that reference the route)
  const statsByRoute = {};
  const remarksByRoute = {};
  if (routes.length) {
    const ph = routes.map(() => "?").join(",");
    const ids = routes.map(r => r.id);
    for (const s of db.prepare(`
      SELECT route_id, SUM(count) AS ascents, COUNT(DISTINCT user_id) AS climbers
      FROM log_entries WHERE route_id IN (${ph}) GROUP BY route_id
    `).all(...ids)) {
      statsByRoute[s.route_id] = { ascents: s.ascents || 0, climbers: s.climbers || 0 };
    }
    for (const r of db.prepare(`
      SELECT l.route_id, l.notes, l.created_at, u.username
      FROM log_entries l JOIN users u ON u.id = l.user_id
      WHERE l.route_id IN (${ph}) AND l.notes IS NOT NULL AND TRIM(l.notes) != ''
      ORDER BY datetime(l.created_at) DESC
    `).all(...ids)) {
      (remarksByRoute[r.route_id] ||= []).push({ username: r.username, notes: r.notes, created_at: r.created_at });
    }
  }

  const decorate = (r) => ({
    id: r.id, name: r.name, grade: r.grade, length_m: r.length_m,
    ascents: statsByRoute[r.id]?.ascents || 0,
    climbers: statsByRoute[r.id]?.climbers || 0,
    remarks: remarksByRoute[r.id] || []
  });

  const sectorList = sectors.map(s => ({
    id: s.id, name: s.name,
    routes: routes.filter(r => r.sector_id === s.id).map(decorate)
  }));
  const looseRoutes = routes.filter(r => !r.sector_id).map(decorate);

  res.json({ crag, sectors: sectorList, looseRoutes });
});

// -------------------- Logbook --------------------
const VALID_ASCENT_STYLES = ["os", "flash", "rp", "pp", "tr"];

// Build a safe details_json object from request body, per discipline
function buildDetails(discipline, body) {
  const d = {};
  const num = (v) => (v === "" || v == null || isNaN(Number(v))) ? null : Number(v);
  const str = (v, max = 500) => (v == null ? null : String(v).slice(0, max)) || null;

  if (discipline === "sport") {
    if (num(body.length_m) != null) d.length_m = Math.max(0, Math.floor(num(body.length_m)));
    if (num(body.quickdraws) != null) d.quickdraws = Math.max(0, Math.floor(num(body.quickdraws)));
  } else if (discipline === "alpin") {
    d.tour_name   = str(body.tour_name, 160);
    d.summit      = str(body.summit, 120);
    d.region      = str(body.region, 120);
    d.pitches     = num(body.pitches) != null ? Math.max(0, Math.floor(num(body.pitches))) : null;
    d.height_m    = num(body.height_m) != null ? Math.max(0, Math.floor(num(body.height_m))) : null;
    d.time_spent  = str(body.time_spent, 60);
    d.climb_date  = str(body.climb_date, 30);
    d.protection  = ["trad","bolt","mixed"].includes(body.protection) ? body.protection : null;
    d.approach    = str(body.approach, 1000);
    d.descent     = str(body.descent, 1000);
    d.conditions  = str(body.conditions, 1000);
    d.beta        = str(body.beta, 2000);
    // Map coordinates (pin)
    const lat = num(body.lat), lng = num(body.lng);
    if (lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      d.lat = Number(lat.toFixed(6));
      d.lng = Number(lng.toFixed(6));
    }
    // Climbing partners (must be existing non-admin users)
    if (body.partner_ids) {
      const ids = String(body.partner_ids).split(",").map(x => Number(x)).filter(Number.isInteger);
      if (ids.length) {
        const ph = ids.map(() => "?").join(",");
        const rows = db.prepare(`SELECT id, username FROM users WHERE id IN (${ph}) AND is_admin=0`).all(...ids);
        if (rows.length) d.partners = rows.map(r => ({ id: r.id, username: r.username }));
      }
    }
    // strip empty keys
    for (const k of Object.keys(d)) if (d[k] == null) delete d[k];
  }
  return Object.keys(d).length ? JSON.stringify(d) : null;
}

app.post("/api/log/me", requireAuth, (req, res) => {
  const userId = currentUserId(req);
  const b = req.body;

  // ---- Discipline + environment ----
  const env = String(b.environment || "indoor");
  if (!["indoor", "outdoor"].includes(env)) return res.status(400).json({ error: "Bad environment" });

  let discipline = String(b.discipline || "");
  // Backwards-compat: old clients send category (lead/boulder) without discipline
  if (!discipline && (b.category === "lead" || b.category === "boulder")) {
    discipline = b.category === "boulder" ? "boulder" : "sport";
  }
  if (!DISCIPLINES.includes(discipline)) return res.status(400).json({ error: "Bad discipline" });
  if (env === "indoor" && discipline === "alpin") return res.status(400).json({ error: "Alpin is outdoor only" });

  const category = categoryForDiscipline(discipline);

  // ---- Grade + count ----
  const g = String(b.grade);
  const c = Number(b.count);
  if (!gradeValidForEntry(discipline, env, g)) return res.status(400).json({ error: "Bad grade" });
  if (!Number.isInteger(c) || c < 1) return res.status(400).json({ error: "Bad count" });

  // ---- Mode (sport only) ----
  let mode = null;
  if (discipline === "sport") {
    mode = MODES.includes(b.mode) ? b.mode : "lead";
  }

  // ---- Ascent style + attempts ----
  let style = (b.ascent_style && VALID_ASCENT_STYLES.includes(b.ascent_style)) ? b.ascent_style : null;
  // PP only makes sense for sport lead
  if (style === "pp" && !(discipline === "sport" && mode === "lead")) style = null;
  const att = b.attempts ? Math.max(1, Math.floor(Number(b.attempts))) : null;

  // ---- Crowdsourced location (validate relationships) ----
  let cragId = null, sectorId = null, routeId = null;
  if (b.crag_id) {
    const crag = db.prepare("SELECT id FROM crags WHERE id=?").get(Number(b.crag_id));
    if (crag) cragId = crag.id;
  }
  if (cragId && b.sector_id && discipline === "sport") {
    const sec = db.prepare("SELECT id FROM sectors WHERE id=? AND crag_id=?").get(Number(b.sector_id), cragId);
    if (sec) sectorId = sec.id;
  }
  if (sectorId && b.route_id && discipline === "sport") {
    const rt = db.prepare("SELECT id FROM routes WHERE id=? AND sector_id=?").get(Number(b.route_id), sectorId);
    if (rt) routeId = rt.id;
  }

  // ---- Details (length/quickdraws/alpine metadata/beta) ----
  const details = buildDetails(discipline, b);

  const info = db.prepare(`
    INSERT INTO log_entries
      (user_id, category, grade, count, notes, environment, ascent_style, attempts,
       discipline, mode, crag_id, sector_id, route_id, details_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    userId, category, g, c, (b.notes || "").toString().slice(0, 500), env, style, att,
    discipline, mode, cragId, sectorId, routeId, details
  );

  // ---- Optional GPX track (alpine): saved as a file, referenced from details ----
  if (discipline === "alpin" && b.gpx && typeof b.gpx === "string" && b.gpx.includes("<")) {
    try {
      const fname = `entry-${info.lastInsertRowid}.gpx`;
      fs.writeFileSync(path.join(GPX_DIR, fname), String(b.gpx).slice(0, 8 * 1024 * 1024), "utf8");
      const det = details ? JSON.parse(details) : {};
      det.gpx = fname;
      db.prepare("UPDATE log_entries SET details_json=? WHERE id=?").run(JSON.stringify(det), info.lastInsertRowid);
    } catch (e) { console.error("GPX save failed:", e.message); }
  }

  res.json({ ok: true, id: info.lastInsertRowid });
});

// Download a stored GPX track for an entry (any logged-in user may view)
app.get("/api/log/:id/gpx", requireAuth, (req, res) => {
  const entryId = Number(req.params.id);
  if (!Number.isInteger(entryId)) return res.status(400).json({ error: "Bad id" });
  const row = db.prepare("SELECT details_json FROM log_entries WHERE id=?").get(entryId);
  if (!row || !row.details_json) return res.status(404).json({ error: "Not found" });
  let det;
  try { det = JSON.parse(row.details_json); } catch { return res.status(404).json({ error: "Not found" }); }
  if (!det.gpx) return res.status(404).json({ error: "No GPX" });
  const file = path.join(GPX_DIR, path.basename(det.gpx));
  if (!fs.existsSync(file)) return res.status(404).json({ error: "Not found" });
  res.download(file, det.gpx);
});

const LOG_SELECT = `
  SELECT
    l.id, l.category, l.grade, l.count, l.notes, l.environment,
    l.ascent_style, l.attempts, l.created_at,
    l.discipline, l.mode, l.crag_id, l.sector_id, l.route_id, l.details_json,
    c.name AS crag_name, s.name AS sector_name, r.name AS route_name
  FROM log_entries l
  LEFT JOIN crags c   ON c.id = l.crag_id
  LEFT JOIN sectors s ON s.id = l.sector_id
  LEFT JOIN routes r  ON r.id = l.route_id
  WHERE l.user_id=?
  ORDER BY datetime(l.created_at) DESC
  LIMIT 50
`;

app.get("/api/log/me", requireAuth, (req, res) => {
  const rows = db.prepare(LOG_SELECT).all(currentUserId(req));
  res.json({ entries: rows });
});

app.get("/api/log/user/:id", requireAuth, (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: "Bad user id" });
  const rows = db.prepare(LOG_SELECT).all(userId);
  res.json({ entries: rows });
});

app.delete("/api/log/me/:entryId", requireAuth, (req, res) => {
  const entryId = Number(req.params.entryId);
  if (!Number.isInteger(entryId)) return res.status(400).json({ error: "Bad id" });
  const userId = currentUserId(req);
  // Only delete if the entry belongs to the current user
  const result = db.prepare(
    "DELETE FROM log_entries WHERE id=? AND user_id=?"
  ).run(entryId, userId);
  if (result.changes === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

// -------------------- Activity Graph --------------------
app.get("/api/activity/user/:id", requireAuth, (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: "Bad user id" });

  // Last 365 days, grouped by date (YYYY-MM-DD)
  const rows = db.prepare(`
    SELECT
      date(created_at) AS day,
      SUM(count) AS total
    FROM log_entries
    WHERE user_id = ?
      AND datetime(created_at) >= datetime('now', '-364 days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all(userId);

  res.json({ activity: rows });
});

// -------------------- Progress (X/Y) --------------------
app.get("/api/progress/user/:id", requireAuth, (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: "Bad user id" });

  const goals = db.prepare(`
    SELECT category, grade, target_count
    FROM goals
    WHERE user_id=?
  `).all(userId);

  const done = db.prepare(`
    SELECT category, grade, SUM(count) AS done_count
    FROM log_entries
    WHERE user_id=?
    GROUP BY category, grade
  `).all(userId);

  const doneMap = new Map(done.map(r => [`${r.category}:${r.grade}`, r.done_count || 0]));

  const progress = goals
    .map(g => ({
      category: g.category,
      grade: g.grade,
      target: g.target_count,
      done: doneMap.get(`${g.category}:${g.grade}`) || 0
    }))
    .filter(p => p.target > 0);

  res.json({ progress });
});

app.get("/api/progress/me", requireAuth, (req, res) => {
  const userId = currentUserId(req);

  const goals = db.prepare(`
    SELECT category, grade, target_count
    FROM goals
    WHERE user_id=?
  `).all(userId);

  const done = db.prepare(`
    SELECT category, grade, SUM(count) AS done_count
    FROM log_entries
    WHERE user_id=?
    GROUP BY category, grade
  `).all(userId);

  const doneMap = new Map(done.map(r => [`${r.category}:${r.grade}`, r.done_count || 0]));

  const progress = goals
    .map(g => ({
      category: g.category,
      grade: g.grade,
      target: g.target_count,
      done: doneMap.get(`${g.category}:${g.grade}`) || 0
    }))
    .filter(p => p.target > 0);

  res.json({ progress });
});

// -------------------- Admin API --------------------
app.post("/api/admin/reset", requireAdmin, (req, res) => {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM log_entries").run();
    db.prepare("DELETE FROM goals").run();
  });
  tx();
  res.json({ ok: true });
});

app.post("/api/admin/reset-user/:id", requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: "Bad user id" });

  const row = db.prepare("SELECT is_admin FROM users WHERE id=?").get(userId);
  if (row?.is_admin === 1) return res.status(400).json({ error: "Cannot reset admin user" });

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM log_entries WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM goals WHERE user_id=?").run(userId);
  });

  tx();
  res.json({ ok: true });
});

app.post("/api/admin/reset-password/:id", requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const { newPassword } = req.body;

  if (!Number.isInteger(userId)) return res.status(400).json({ error: "Bad user id" });
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const row = db.prepare("SELECT is_admin FROM users WHERE id=?").get(userId);
  if (row?.is_admin === 1) {
    return res.status(400).json({ error: "Cannot reset admin password here" });
  }

  const hash = await bcrypt.hash(String(newPassword), 12);
  const info = db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hash, userId);

  if (info.changes === 0) return res.status(404).json({ error: "User not found" });
  res.json({ ok: true });
});

// Admin rename user
app.post("/api/admin/rename-user/:id", requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  const newName = String(req.body.username || "").trim();

  if (!Number.isInteger(userId)) return res.status(400).json({ error: "Bad user id" });
  if (newName.length < 3) return res.status(400).json({ error: "Username must be at least 3 characters" });

  const row = db.prepare("SELECT is_admin FROM users WHERE id=?").get(userId);
  if (!row) return res.status(404).json({ error: "User not found" });
  if (row.is_admin === 1) return res.status(400).json({ error: "Cannot rename admin user" });

  const existing = db.prepare("SELECT id FROM users WHERE username=?").get(newName);
  if (existing && existing.id !== userId) return res.status(409).json({ error: "Username already exists" });

  db.prepare("UPDATE users SET username=? WHERE id=?").run(newName, userId);
  res.json({ ok: true });
});

// Admin delete user
app.post("/api/admin/delete-user/:id", requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: "Bad user id" });

  const row = db.prepare("SELECT is_admin FROM users WHERE id=?").get(userId);
  if (!row) return res.status(404).json({ error: "User not found" });
  if (row.is_admin === 1) return res.status(400).json({ error: "Cannot delete admin user" });

  db.prepare("DELETE FROM users WHERE id=?").run(userId);
  res.json({ ok: true });
});

// Admin: view the IP addresses recorded for a user (invisible to the user)
app.get("/api/admin/user-ips/:id", requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: "Bad user id" });
  const ips = db.prepare(
    "SELECT ip, first_seen, last_seen, hits FROM user_ips WHERE user_id=? ORDER BY datetime(last_seen) DESC"
  ).all(userId);
  res.json({ ips });
});

// -------------------- Admin Backup --------------------
app.get("/api/admin/backup", requireAdmin, (req, res) => {
  // Checkpoint WAL so the file is consistent
  try { db.pragma("wal_checkpoint(TRUNCATE)"); } catch(e) {}

  // Also save a timestamped copy inside the data dir
  const backupDir = path.join(__dirname, "data", "backups");
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const dest = path.join(backupDir, `app-${ts}.db`);
    fs.copyFileSync(DB_FILE, dest);
    // Keep only the last 10 backups
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith(".db"))
      .sort();
    if (files.length > 10) {
      files.slice(0, files.length - 10).forEach(f =>
        fs.unlinkSync(path.join(backupDir, f))
      );
    }
  } catch(e) { console.error("Backup copy failed:", e.message); }

  res.download(DB_FILE, "climb-tracker-backup.db");
});

// -------------------- Start --------------------
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));