// One-time fix for leads created before the auto-assign fix: any lead that
// already has a manager but is still sitting at "New Lead" gets bumped to
// "Assigned", to match what routes/leads.js now does automatically for new
// leads. Safe to run more than once — it only ever touches rows matching
// both conditions, so already-fixed leads are left alone.
//
// Usage: node scripts/backfill-assigned-stage.js
// Requires the same TURSO_DATABASE_URL / TURSO_AUTH_TOKEN env vars the
// server uses (set them locally in .env, or run this from Render's shell).
import { db } from "../lib/db.js";

const res = await db.execute(`
  UPDATE leads
  SET stage = 'Assigned'
  WHERE stage = 'New Lead'
    AND manager IS NOT NULL
    AND TRIM(manager) != ''
  RETURNING id, business, manager
`);

if (res.rows.length === 0) {
  console.log("Nothing to fix — no New Lead rows with a manager assigned.");
} else {
  console.log(`Bumped ${res.rows.length} lead(s) from "New Lead" to "Assigned":`);
  for (const row of res.rows) {
    console.log(`  ${row.id} — ${row.business} (${row.manager})`);
  }
}
process.exit(0);
