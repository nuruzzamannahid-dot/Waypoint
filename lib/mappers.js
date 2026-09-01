// Converts snake_case Turso rows into the exact camelCase shape the
// frontend's mkLead()/renderers already expect, so public/index.html
// barely had to change.

export function rowToLead(row) {
  return {
    id: row.id,
    business: row.business,
    contact: row.contact || "",
    phone: row.phone || "",
    altPhone: row.alt_phone || "",
    fb: row.fb || "",
    website: row.website || "",
    type: row.type || "",
    category: row.category || "",
    location: row.location || "",
    source: row.source || "",
    manager: row.manager || "",
    leadDate: row.lead_date || null,
    courier: row.courier || "",
    pain: row.pain || "",
    curOrders: Number(row.cur_orders) || 0,
    expOrders: Number(row.exp_orders) || 0,
    stage: row.stage || "New Lead",
    nextFollowup: row.next_followup || null,
    currentRate: row.current_rate || "",
    proposedRate: row.proposed_rate || "",
    createdBy: row.created_by || "System",
    lastContact: row.last_contact || null,
    lostReason: row.lost_reason || "",
  };
}

export function rowToActivity(row) {
  return {
    leadId: row.lead_id,
    date: row.date,
    manager: row.manager,
    type: row.type,
    outcome: row.outcome,
    summary: row.summary,
    nextAction: row.next_action || "",
    nextDate: row.next_date || "",
  };
}

export function rowToFollowup(row) {
  return {
    id: row.id,
    leadId: row.lead_id,
    manager: row.manager,
    date: row.date,
    type: row.type,
    purpose: row.purpose,
    priority: row.priority,
    status: row.status,
  };
}

export function rowToPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    team: row.team,
    status: row.status,
  };
}
