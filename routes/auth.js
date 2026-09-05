import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../lib/db.js";
import { rowToPublicUser } from "../lib/mappers.js";

const router = Router();
const JWT_SECRET = process.env.SESSION_SECRET;

if (!JWT_SECRET) {
  throw new Error("Missing SESSION_SECRET — set it in your environment (.env locally, Render env vars in production).");
}

// Unauthenticated on purpose: only returns id/name/role/team/status, the same
// info that used to sit in plain sight inside the HTML's USERS array. Used to
// populate the login screen's manager/admin dropdown before anyone is signed in.
router.get("/users/public", async (req, res) => {
  const { role } = req.query;
  const result = role
    ? await db.execute({ sql: "SELECT * FROM users WHERE role = ? AND status = 'Active' ORDER BY name", args: [role] })
    : await db.execute("SELECT * FROM users WHERE status = 'Active' ORDER BY name");
  res.json(result.rows.map(rowToPublicUser));
});

router.post("/login", async (req, res) => {
  const { userId, password } = req.body || {};
  if (!userId || !password) {
    return res.status(400).json({ error: "userId and password are required" });
  }
  const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [userId] });
  const user = rows[0];
  if (!user || user.status !== "Active") {
    return res.status(401).json({ error: "Invalid user or password" });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid user or password" });
  }
  const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: "12h" });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing auth token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Session expired — please log in again" });
  }
}

export default router;
