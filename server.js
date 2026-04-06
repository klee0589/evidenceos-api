const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const demoRouter = require("./routes/demo");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "*", // Lock down to your landing page domain in production
  methods: ["GET"],
}));

app.use(express.json());
app.use(morgan("dev")); // request logging

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

app.use("/api/demo", demoRouter);

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`EvidenceOS API running on http://localhost:${PORT}`);
});

module.exports = app; // exported for testing
