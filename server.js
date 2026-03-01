"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");

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

function isValidGrade(category, grade) {
  if (category === "lead") return LEAD_GRADES.includes(grade);
  if (category === "boulder") return BOULDER_GRADES.includes(String(grade));
  return false;
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

// -------------------- Middlewares --------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || "CHANGE_ME_TO_A_LONG_RANDOM_SECRET",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
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
  const { username, password } = req.body;

  const user = db.prepare("SELECT id, password_hash FROM users WHERE username=?").get(String(username));
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(String(password), user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  req.session.userId = user.id;
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", requireAuth, (req, res) => {
  const me = db.prepare("SELECT id, username, is_admin FROM users WHERE id=?")
    .get(currentUserId(req));
  res.json({ me });
});

// -------------------- Community / Users --------------------
app.get("/api/users", requireAuth, (req, res) => {
  const users = db.prepare("SELECT id, username, created_at FROM users ORDER BY username").all();
  res.json({ users });
});

// -------------------- Goals --------------------
app.get("/api/goals/me", requireAuth, (req, res) => {
  const rows = db.prepare(
    "SELECT category, grade, target_count FROM goals WHERE user_id=? AND target_count > 0"
  ).all(currentUserId(req));

  res.json({ goals: rows, leadGrades: LEAD_GRADES, boulderGrades: BOULDER_GRADES });
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
  const { category, grade, count, notes } = req.body;

  if (!["lead", "boulder"].includes(category)) return res.status(400).json({ error: "Bad category" });

  const g = String(grade);
  const c = Number(count);

  if (!isValidGrade(category, g)) return res.status(400).json({ error: "Bad grade" });
  if (!Number.isInteger(c) || c < 1) return res.status(400).json({ error: "Bad count" });

  db.prepare(
    "INSERT INTO log_entries (user_id, category, grade, count, notes) VALUES (?,?,?,?,?)"
  ).run(currentUserId(req), category, g, c, (notes || "").toString().slice(0, 500));

  res.json({ ok: true });
});

app.get("/api/log/me", requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT id, category, grade, count, notes, created_at
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
    SELECT id, category, grade, count, notes, created_at
    FROM log_entries
    WHERE user_id=?
    ORDER BY datetime(created_at) DESC
    LIMIT 50
  `).all(userId);

  res.json({ entries: rows });
});

// -------------------- Progress (X/Y) --------------------
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

// Reset everything (all users): delete goals + log entries
app.post("/api/admin/reset", requireAdmin, (req, res) => {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM log_entries").run();
    db.prepare("DELETE FROM goals").run();
  });
  tx();
  res.json({ ok: true });
});

// Reset a single user: delete goals + log entries for that user
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

// Reset a user's password (admin sets a new password)
app.post("/api/admin/reset-password/:id", requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const { newPassword } = req.body;

  if (!Number.isInteger(userId)) return res.status(400).json({ error: "Bad user id" });
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const row = db.prepare("SELECT is_admin FROM users WHERE id=?").get(userId);
  if (row?.is_admin === 1) return res.status(400).json({ error: "Cannot reset admin password here" });

  const hash = await bcrypt.hash(String(newPassword), 12);
  const info = db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hash, userId);

  if (info.changes === 0) return res.status(404).json({ error: "User not found" });
  res.json({ ok: true });
});

// -------------------- Start --------------------
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));