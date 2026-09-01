import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

import { migrate } from "./lib/db.js";
import { seedUsers } from "./lib/seed.js";
import authRoutes, { requireAuth } from "./routes/auth.js";
import bootstrapRoutes from "./routes/bootstrap.js";
import leadsRoutes from "./routes/leads.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api", authRoutes);
app.use("/api", bootstrapRoutes);
app.use("/api/leads", requireAuth, leadsRoutes);

// Basic error handler so a thrown/rejected error in a route returns JSON
// instead of an HTML stack trace.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;

(async () => {
  await migrate();
  await seedUsers();
  app.listen(PORT, () => console.log(`Waypoint running on port ${PORT}`));
})().catch((err) => {
  console.error("Failed to start Waypoint:", err);
  process.exit(1);
});
