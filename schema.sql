-- Reference copy of the schema. You never need to run this by hand —
-- lib/db.js runs the same statements (CREATE TABLE IF NOT EXISTS) every
-- time the server boots, so the tables create themselves automatically
-- against a fresh Turso database. Kept here for documentation.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL,        -- 'AD Manager' | 'Team Lead / Admin'
  team          TEXT,
  status        TEXT NOT NULL DEFAULT 'Active',
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id            TEXT PRIMARY KEY,     -- CB-L-00001 style, assigned by lead_seq
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
);

CREATE TABLE IF NOT EXISTS activities (
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
);

CREATE TABLE IF NOT EXISTS followups (
  id       TEXT PRIMARY KEY,
  lead_id  TEXT NOT NULL REFERENCES leads(id),
  manager  TEXT,
  date     TEXT,
  type     TEXT,
  purpose  TEXT,
  priority TEXT,
  status   TEXT DEFAULT 'Pending'
);

-- Single-row counter used to hand out CB-L-##### ids atomically via
-- `UPDATE lead_seq SET seq = seq + 1 WHERE id = 1 RETURNING seq`.
CREATE TABLE IF NOT EXISTS lead_seq (
  id  INTEGER PRIMARY KEY CHECK (id = 1),
  seq INTEGER NOT NULL DEFAULT 0
);
