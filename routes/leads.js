import { Router } from "express";
import { db, nextLeadId } from "../lib/db.js";
import { rowToLead, rowToActivity } from "../lib/mappers.js";

const router = Router();

// Same pipeline order as the frontend's STAGES const (public/index.html) —
// used to move a lead's stage forward when an activity outcome implies
// progress, and to make sure we only ever move forward, never backward.
const STAGE_ORDER = [
  "New Lead", "Assigned", "Contacted", "Connected", "Qualified", "Interested",
  "Rate/Proposal Shared", "Negotiation", "Trial/First Booking", "Converted",
];
const NON_ADVANCING_STAGES = ["Lost", "Unresponsive", "Converted"]; // never auto-move out of these

// Activity outcome -> the stage that outcome implies the lead has reached.
const OUTCOME_STAGE = {
  "Connected": "Connected",
  "Interested": "Interested",
  "No Response": "Contacted",
  "Rate Shared": "Rate/Proposal Shared",
  "Objection Raised": "Negotiation",
};

// Given a lead's current stage and a logged activity outcome, return the
// stage the lead should move to (or null if it shouldn't change). Only ever
// advances the pipeline line — it never demotes a lead that's already
// further along, and never touches a closed-out lead.
function stageForOutcome(currentStage, outcome) {
  const target = OUTCOME_STAGE[outcome];
  if (!target) return null;
  if (NON_ADVANCING_STAGES.includes(currentStage)) return null;
  const curIdx = STAGE_ORDER.indexOf(currentStage);
  const targetIdx = STAGE_ORDER.indexOf(target);
  if (targetIdx <= curIdx) return null;
  return target;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const t = new Date(dateStr + "T00:00:00");
  t.setDate(t.getDate() + n);
  return t.toISOString().slice(0, 10);
}

async function getLeadRow(id) {
  const { rows } = await db.execute({ sql: "SELECT * FROM leads WHERE id = ?", args: [id] });
  return rows[0] || null;
}

// Create a new lead. Server assigns the id and starting stage — mirrors the
// old client-side mkLead()/addLeadForm submit handler.
router.post("/", async (req, res) => {
  const b = req.body || {};
  if (!b.business || !b.business.trim()) {
    return res.status(400).json({ error: "Business name is required" });
  }
  const id = await nextLeadId();
  const today = todayStr();
  // A lead created with an AD manager already picked is, by definition, past
  // "New Lead" — start it at "Assigned" so the pipeline line matches reality
  // instead of requiring a manual bump.
  const startStage = (b.manager || "").trim() ? "Assigned" : "New Lead";

  await db.execute({
    sql: `INSERT INTO leads (
      id, business, contact, phone, alt_phone, fb, website, type, category,
      location, source, manager, lead_date, courier, pain, cur_orders,
      exp_orders, stage, next_followup, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      b.business.trim(),
      (b.contact || "").trim(),
      (b.phone || "").trim(),
      (b.altPhone || "").trim(),
      (b.fb || "").trim(),
      (b.website || "").trim(),
      b.type || "",
      (b.category || "").trim(),
      (b.location || "").trim(),
      b.source || "",
      b.manager || "",
      b.leadDate || today,
      b.courier || "",
      b.pain || "",
      Number(b.curOrders) || 0,
      Number(b.expOrders) || 0,
      startStage,
      addDays(today, 1),
      req.user.name,
    ],
  });

  const row = await getLeadRow(id);
  res.status(201).json(rowToLead(row));
});

// Log an activity against a lead — updates last_contact and, if a next
// follow-up date was given, next_followup too.
router.post("/:id/activities", async (req, res) => {
  const lead = await getLeadRow(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const { type, outcome, summary, nextAction, nextDate } = req.body || {};
  if (!summary || !summary.trim()) {
    return res.status(400).json({ error: "A discussion summary is required" });
  }
  const today = todayStr();

  await db.execute({
    sql: `INSERT INTO activities (lead_id, date, manager, type, outcome, summary, next_action, next_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [lead.id, today, req.user.name, type || "", outcome || "", summary.trim(), (nextAction || "").trim(), nextDate || ""],
  });

  const newStage = stageForOutcome(lead.stage, outcome);

  await db.execute({
    sql: `UPDATE leads SET last_contact = ?, next_followup = COALESCE(NULLIF(?, ''), next_followup), stage = COALESCE(?, stage) WHERE id = ?`,
    args: [today, nextDate || "", newStage, lead.id],
  });

  const [activityRes, updatedLead] = await Promise.all([
    db.execute({
      sql: "SELECT * FROM activities WHERE lead_id = ? ORDER BY id DESC LIMIT 1",
      args: [lead.id],
    }),
    getLeadRow(lead.id),
  ]);

  res.status(201).json({
    activity: rowToActivity(activityRes.rows[0]),
    lead: rowToLead(updatedLead),
  });
});

// "Log contact now" — clears the 7-day stale-lead fire alarm without a full
// activity form.
router.post("/:id/touch", async (req, res) => {
  const lead = await getLeadRow(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const today = todayStr();
  await db.execute({
    sql: `INSERT INTO activities (lead_id, date, manager, type, outcome, summary, next_action, next_date)
          VALUES (?, ?, ?, 'Other', 'Connected', 'Marked as contacted — fire alarm cleared.', '', '')`,
    args: [lead.id, today, req.user.name],
  });
  const touchStage = stageForOutcome(lead.stage, "Connected");
  await db.execute({
    sql: "UPDATE leads SET last_contact = ?, stage = COALESCE(?, stage) WHERE id = ?",
    args: [today, touchStage, lead.id],
  });

  const [activityRes, updatedLead] = await Promise.all([
    db.execute({ sql: "SELECT * FROM activities WHERE lead_id = ? ORDER BY id DESC LIMIT 1", args: [lead.id] }),
    getLeadRow(lead.id),
  ]);

  res.json({ activity: rowToActivity(activityRes.rows[0]), lead: rowToLead(updatedLead) });
});

export default router;
