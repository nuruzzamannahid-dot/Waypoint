import bcrypt from "bcryptjs";
import { db } from "./db.js";

// The three real AD-team users. Only inserted if the users table is empty,
// so this never overwrites real data on redeploys.
const DEFAULT_USERS = [
  { id: "U-01", name: "Ahmed Asif Rashid", role: "Team Lead / Admin", team: "Account Development" },
  { id: "U-02", name: "Nuruzzaman Nahid", role: "AD Manager", team: "Account Development" },
  { id: "U-03", name: "Sheikh Solayman Shady", role: "AD Manager", team: "Account Development" },
];

export async function seedUsers() {
  const { rows } = await db.execute("SELECT COUNT(*) AS c FROM users");
  if (Number(rows[0].c) > 0) return;

  const defaultPassword = process.env.DEFAULT_USER_PASSWORD || "waypoint2026";
  const hash = await bcrypt.hash(defaultPassword, 10);

  for (const u of DEFAULT_USERS) {
    await db.execute({
      sql: `INSERT INTO users (id, name, role, team, status, password_hash) VALUES (?, ?, ?, ?, 'Active', ?)`,
      args: [u.id, u.name, u.role, u.team, hash],
    });
  }
  console.log(
    `Seeded ${DEFAULT_USERS.length} users with default password "${defaultPassword}". ` +
    `Change each real password now — see README "First login".`
  );
}
