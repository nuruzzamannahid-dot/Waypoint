import { db } from "./db.js";

// Mirrors the original client-side "fire alarm" policy, but runs server-side
// against real dates so it's correct across every user's browser instead of
// re-deciding independently on each client. It's naturally idempotent: once
// a lead is transferred, last_contact resets to today, so it won't fire
// again until another 7 days pass without a logged activity.
const STALE_ALARM_DAYS = 7;
const TERMINAL_STAGES = ["Lost", "Unresponsive"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const t = new Date(dateStr + "T00:00:00");
  t.setDate(t.getDate() + n);
  return t.toISOString().slice(0, 10);
}
function daysSince(dateStr) {
  const t = new Date(dateStr + "T00:00:00");
  const now = new Date(todayStr() + "T00:00:00");
  return Math.floor((now - t) / 86400000);
}

function isActive(lead) {
  return !TERMINAL_STAGES.includes(lead.stage) && lead.stage !== "Converted";
}

function managerConversionStats(leads) {
  const owners = [...new Set(leads.map((l) => l.manager).filter(Boolean))];
  return owners
    .map((m) => {
      const own = leads.filter((l) => l.manager === m);
      const relevant = own.filter((l) => l.stage !== "New Lead" && l.stage !== "Assigned").length;
      const converted = own.filter((l) => l.stage === "Converted").length;
      return { manager: m, rate: relevant > 0 ? converted / relevant : 0 };
    })
    .sort((a, b) => b.rate - a.rate);
}

// Runs on every /api/bootstrap call. Returns the list of transfers made this
// run (usually empty) so the frontend can show the same toast notice it used to.
export async function reconcileStaleLeads() {
  const { rows: leads } = await db.execute("SELECT * FROM leads");
  const activeLeads = leads.filter(isActive);
  if (!activeLeads.length) return [];

  const stats = managerConversionStats(leads);
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const transfers = [];

  for (const lead of activeLeads) {
    const anchor = lead.last_contact || lead.lead_date;
    if (!anchor) continue;
    const days = daysSince(anchor);
    if (days <= STALE_ALARM_DAYS) continue;

    const pick = stats.find((s) => s.manager !== lead.manager) || stats[0];
    const newManager = pick ? pick.manager : null;
    if (!newManager || newManager === lead.manager) continue;

    const oldManager = lead.manager;
    await db.execute({
      sql: `INSERT INTO activities (lead_id, date, manager, type, outcome, summary, next_action, next_date)
            VALUES (?, ?, 'System', 'Other', 'No Response', ?, 'Re-engage merchant', ?)`,
      args: [
        lead.id,
        today,
        `Auto-transferred from ${oldManager} to ${newManager} — no activity logged for ${days} days (7-day stale-lead policy).`,
        tomorrow,
      ],
    });
    await db.execute({
      sql: `UPDATE leads SET manager = ?, last_contact = ?, next_followup = ? WHERE id = ?`,
      args: [newManager, today, tomorrow, lead.id],
    });

    transfers.push({ business: lead.business, from: oldManager, to: newManager, days });
  }

  return transfers;
}
