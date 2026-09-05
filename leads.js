import { Router } from "express";
import { db, nextLeadId } from "../lib/db.js";
import { rowToLead, rowToActivity } from "../lib/mappers.js";

const router = Router();

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

  await db.execute({
    sql: `INSERT INTO leads (
      id, business, contact, phone, alt_phone, fb, website, type, category,
      location, source, manager, lead_date, courier, pain, cur_orders,
      exp_orders, stage, next_followup, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New Lead', ?, ?)`,
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

  await db.execute({
    sql: `UPDATE leads SET last_contact = ?, next_followup = COALESCE(NULLIF(?, ''), next_followup) WHERE id = ?`,
    args: [today, nextDate || "", lead.id],
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
  await db.execute({ sql: "UPDATE leads SET last_contact = ? WHERE id = ?", args: [today, lead.id] });

  const [activityRes, updatedLead] = await Promise.all([
    db.execute({ sql: "SELECT * FROM activities WHERE lead_id = ? ORDER BY id DESC LIMIT 1", args: [lead.id] }),
    getLeadRow(lead.id),
  ]);

  res.json({ activity: rowToActivity(activityRes.rows[0]), lead: rowToLead(updatedLead) });
});

export default router;
