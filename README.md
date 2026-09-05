# Waypoint — New Merchant CRM

Node/Express backend + Turso (libSQL) persistence for the Waypoint UI, deployed on Render — same stack as the other AD-team dashboards.

## How it works

- `lib/db.js` runs `CREATE TABLE IF NOT EXISTS` for every table on **every boot**. Point it at a brand-new, empty Turso database and the schema creates itself the first time the server starts — nothing to run by hand.
- `lib/seed.js` seeds the 3 real users (Ahmed Asif Rashid, Nuruzzaman Nahid, Sheikh Solayman Shady) **once**, only if the `users` table is empty. It never overwrites existing data on a redeploy.
- Login is manager+password, checked against bcrypt hashes stored in Turso (not Google OAuth — kept separate from the other dashboards on purpose).
- `public/index.html` is your original Waypoint UI. It no longer has any hardcoded mock leads/activities/follow-ups — on login it calls `GET /api/bootstrap` once and renders from what Turso returns. Adding a lead, logging an activity, and "log contact now" all write straight to Turso through the API.
- The 7-day stale-lead fire-alarm/auto-transfer policy now runs **server-side** (`lib/staleLeads.js`), as part of every `/api/bootstrap` call, using the real current date. It's idempotent — once a lead is transferred, its clock resets, so it won't fire again until another 7 untouched days pass.

## Project layout

```
server.js            Express app: migrate → seed → mount routes → serve public/
lib/db.js             Turso client + auto-migration + lead-id sequence
lib/seed.js           One-time user seeding
lib/mappers.js         DB row → frontend camelCase shape
lib/staleLeads.js      7-day fire-alarm auto-transfer (runs on bootstrap)
routes/auth.js         Login + public user list (for the login dropdown)
routes/bootstrap.js    GET /api/bootstrap — one call returns everything
routes/leads.js        Create lead, log activity, touch-now
public/index.html      The Waypoint UI (frontend)
db/schema.sql          Reference copy of the schema (documentation only)
scripts/hash-password.js  Generate a bcrypt hash for changing a password by hand
```

## Environment variables

Copy `.env.example` to `.env` for local runs; set the same on Render.

| Variable | Description |
|---|---|
| `TURSO_DATABASE_URL` | Your Turso DB URL, e.g. `libsql://waypoint-crm-yourorg.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso auth token for that database |
| `SESSION_SECRET` | Long random string used to sign login sessions (JWT). Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DEFAULT_USER_PASSWORD` | Password the 3 seeded users get on first boot only. Defaults to `waypoint2026` if unset. |
| `PORT` | Optional locally; Render sets this automatically. |

Since you already have a Turso database + token, just plug those two in — no `turso db create` step needed.

## Deploy on Render

1. Push this project to a GitHub repo (matches the `db/`, `lib/`, `public/` layout used on your other dashboards).
2. New Web Service on Render → connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add the environment variables above in Render's dashboard (Environment tab) — **don't** commit `.env`.
5. Deploy. On first boot you'll see in the logs:
   - `Turso schema is up to date (tables created if they didn't exist).`
   - `Seeded 3 users with default password "waypoint2026" — change these immediately.`

## First login

All 3 users start with the same password (`DEFAULT_USER_PASSWORD`, default `waypoint2026`). Change each one immediately:

1. Locally, generate a hash for the new password:
   ```
   npm run hash-password -- "theNewPassword"
   ```
2. Update it directly in Turso (swap in the real hash and the right user id — `U-01` Rashid, `U-02` Nahid, `U-03` Shady):
   ```
   turso db shell <your-db-name> "UPDATE users SET password_hash='<hash>' WHERE id='U-02';"
   ```

There's no in-app "change password" screen yet — this is the fastest safe path for a 3-person team. Happy to add a proper change-password screen later if useful.

## Local development (no Turso needed)

`@libsql/client` can point at a local SQLite file instead of Turso, which is handy for testing without touching production data:

```bash
npm install
TURSO_DATABASE_URL="file:local.db" SESSION_SECRET="dev-secret" npm start
```

Then open `http://localhost:3000`. Delete `local.db` to reset.

## Notes / things worth knowing

- **Credentials**: don't paste `TURSO_AUTH_TOKEN` or `SESSION_SECRET` into chat screenshots — rotate the token in the Turso dashboard if one ever leaks, same as with the other dashboards.
- **Lead IDs** (`CB-L-00001`, ...) are handed out atomically from a single-row counter table, so two people creating a lead at the same moment can't collide.
- **Controlled vocabularies** (lead sources, pain points, lost reasons, pipeline stages) are still hardcoded constants in `public/index.html`, same as before — only actual lead/activity/follow-up/user data moved into Turso.
- **Follow-ups** are currently read-only from the API (no UI action creates or completes one yet, matching the original prototype) — the `followups` table and `GET` are in place if you want to wire that up later.
