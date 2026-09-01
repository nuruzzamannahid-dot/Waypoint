import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error("Missing TURSO_DATABASE_URL — set it in your environment (.env locally, Render env vars in production).");
}

export const db = createClient({ url, authToken });

// Executed with CREATE TABLE IF NOT EXISTS, so this is safe to run on every
// boot — a fresh Turso database gets its tables created automatically the
// first time the server starts, and it's a no-op after that.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL,
    team          TEXT,
    status        TEXT NOT NULL DEFAULT 'Active',
    password_hash TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS leads (
    id            TEXT PRIMARY KEY,
    business      TEXT NOT NULL,
    contact       TEXT,
    phone         TEXT,
    alt_phone     TEXT,
    fb            TEXT,
    website       TEXT,
    type          TEXT,
    category      TEXT,
    location      TEXT,
    source        TEXT,
    manager       TEXT,
    lead_date     TEXT,
    courier       TEXT,
    pain          TEXT,
    cur_orders    INTEGER DEFAULT 0,
    exp_orders    INTEGER DEFAULT 0,
    stage         TEXT DEFAULT 'New Lead',
    next_followup TEXT,
    current_rate  TEXT,
    proposed_rate TEXT,
    created_by    TEXT,
    last_contact  TEXT,
    lost_reason   TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS activities (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id     TEXT NOT NULL REFERENCES leads(id),
    date        TEXT,
    manager     TEXT,
    type        TEXT,
    outcome     TEXT,
    summary     TEXT,
    next_action TEXT,
    next_date   TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS followups (
    id       TEXT PRIMARY KEY,
    lead_id  TEXT NOT NULL REFERENCES leads(id),
    manager  TEXT,
    date     TEXT,
    type     TEXT,
    purpose  TEXT,
    priority TEXT,
    status   TEXT DEFAULT 'Pending'
  )`,
  `CREATE TABLE IF NOT EXISTS lead_seq (
    id  INTEGER PRIMARY KEY CHECK (id = 1),
    seq INTEGER NOT NULL DEFAULT 0
  )`,
];

export async function migrate() {
  for (const stmt of SCHEMA) {
    await db.execute(stmt);
  }
  await db.execute(`INSERT OR IGNORE INTO lead_seq (id, seq) VALUES (1, 0)`);
  console.log("Turso schema is up to date (tables created if they didn't exist).");
}

// Atomically hands out the next CB-L-00001-style id.
export async function nextLeadId() {
  const res = await db.execute(`UPDATE lead_seq SET seq = seq + 1 WHERE id = 1 RETURNING seq`);
  const seq = Number(res.rows[0].seq);
  return "CB-L-" + String(seq).padStart(5, "0");
}
