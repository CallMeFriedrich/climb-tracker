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

function isValidGrade(category, grade, environment) {
  if (category === "lead") return LEAD_GRADES.includes(grade);
  if (category === "boulder") {
    if (environment === "outdoor") return BOULDER_OUTDOOR_GRADES.includes(grade);
    return BOULDER_GRADES.includes(String(grade));
  }
  return false;
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

// Ensure `environment` exists on log_entries (safe migration)
try {
  db.exec("ALTER TABLE log_entries ADD COLUMN environment TEXT NOT NULL DEFAULT 'indoor';");
} catch (e) {
  // ignore if column already exists
}

// -------------------- Middlewares --------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const sessionDb = new Database(path.join(__dirname, "data", "sessions.db"));
app.use(session({
  secret: process.env.SESSION_SECRET || "CHANGE_ME_TO_A_LONG_RANDOM_SECRET",
  resave: false,
  saveUninitialized: false,
  store: new SqliteStore({ client: sessionDb }),
  cookie: {
    httpOnly: true,
    // maxAge wird per Login dynamisch gesetzt ("Eingeloggt bleiben")
    // secure: true, // enable when using HTTPS
    // sameSite: "lax"
  }
}));
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
  const users = db.prepare("SELECT id, username, bio, created_at FROM users ORDER BY username").all();
  res.json({ users });
});

// Public-ish profile payload (for profile page header/bio)
app.get("/api/profile/user/:id", requireAuth, (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: "Bad user id" });
  const user = db.prepare("SELECT id, username, bio, created_at FROM users WHERE id=?").get(userId);
  if (!user) return res.status(404).json({ error: "User not found" });
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
      COALESCE(SUM(
        l.count *
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
      ), 0) AS score
    FROM users u
    LEFT JOIN log_entries l
      ON l.user_id = u.id
      AND datetime(l.created_at) >= datetime(?)
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

// -------------------- Logbook --------------------
app.post("/api/log/me", requireAuth, (req, res) => {
  const { category, grade, count, notes, environment } = req.body;

  if (!["lead", "boulder"].includes(category)) return res.status(400).json({ error: "Bad category" });

  const env = String(environment || "indoor");
  if (!["indoor", "outdoor"].includes(env)) return res.status(400).json({ error: "Bad environment" });

  const g = String(grade);
  const c = Number(count);

  if (!isValidGrade(category, g, env)) return res.status(400).json({ error: "Bad grade" });
  if (!Number.isInteger(c) || c < 1) return res.status(400).json({ error: "Bad count" });

  db.prepare(
    "INSERT INTO log_entries (user_id, category, grade, count, notes, environment) VALUES (?,?,?,?,?,?)"
  ).run(currentUserId(req), category, g, c, (notes || "").toString().slice(0, 500), env);

  res.json({ ok: true });
});

app.get("/api/log/me", requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT id, category, grade, count, notes, environment, created_at
    FROM log_entries
    WHERE user_id=?
    ORDER BY datetime(created_at) DESC
    LIMIT 50
  `).all(currentUserId(req));
  res.json({ entries: rows });
});

app.get("/api/log/user/:id", requireAuth, (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: "Bad user id" });

  const rows = db.prepare(`
    SELECT id, category, grade, count, notes, environment, created_at
    FROM log_entries
    WHERE user_id=?
    ORDER BY datetime(created_at) DESC
    LIMIT 50
  `).all(userId);

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

// -------------------- Start --------------------
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));