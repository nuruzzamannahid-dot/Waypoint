import { Router } from "express";
import { db } from "../lib/db.js";
import { rowToLead, rowToActivity, rowToFollowup, rowToPublicUser } from "../lib/mappers.js";
import { reconcileStaleLeads } from "../lib/staleLeads.js";
import { requireAuth } from "./auth.js";

const router = Router();

// Single call the frontend makes right after login: runs the 7-day
// stale-lead auto-transfer check, then returns everything the app needs to
// render (leads, activities, followups, users) in one round trip.
router.get("/bootstrap", requireAuth, async (req, res) => {
  const transfers = await reconcileStaleLeads();

  const [leads, activities, followups, users] = await Promise.all([
    db.execute("SELECT * FROM leads ORDER BY created_at DESC"),
    db.execute("SELECT * FROM activities ORDER BY date ASC"),
    db.execute("SELECT * FROM followups"),
    db.execute("SELECT * FROM users ORDER BY name"),
  ]);

  res.json({
    leads: leads.rows.map(rowToLead),
    activities: activities.rows.map(rowToActivity),
    followups: followups.rows.map(rowToFollowup),
    users: users.rows.map(rowToPublicUser),
    transfers,
  });
});

export default router;
