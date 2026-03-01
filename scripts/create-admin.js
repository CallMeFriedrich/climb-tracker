const path = require("path");
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");

const DB_FILE = path.join(__dirname, "..", "data", "app.db");
const db = new Database(DB_FILE);

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.log("Usage: node scripts/create-admin.js <username> <password>");
    process.exit(1);
  }

  // add column if missing (try/catch)
  try {
    db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;");
  } catch (e) {}

  const existing = db.prepare("SELECT id FROM users WHERE username=?").get(username);
  if (existing) {
    db.prepare("UPDATE users SET is_admin=1 WHERE username=?").run(username);
    console.log("User exists -> promoted to admin:", username);
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 12);
  db.prepare("INSERT INTO users (username, password_hash, is_admin) VALUES (?,?,1)")
    .run(username, hash);
  console.log("Admin created:", username);
}

main();
