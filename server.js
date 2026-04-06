const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const demoRouter = require("./routes/demo");
const authRouter = require("./routes/auth");
const systemsRouter = require("./routes/systems");
const usageRouter = require("./routes/usage");
const billingRouter = require("./routes/billing");
const adminRouter = require("./routes/admin");
const { usageLogger } = require("./services/usage");

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "*",
    methods: ["GET", "POST", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  })
);

// ── General middleware ────────────────────────────────────────────────────────
app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
    // Never log Authorization or X-API-Key headers
    skip: (req) => req.path === "/api/health",
  })
);
app.use(express.json());

// Usage logging middleware (runs after auth middleware per-route)
app.use(usageLogger);

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", ts: new Date().toISOString(), version: "2.0.0" })
);

app.use("/api/demo", demoRouter);       // Public mock endpoints (landing page)
app.use("/api/auth", authRouter);       // Register, get API key
app.use("/api/systems", systemsRouter); // Real system integrations (pro)
app.use("/api/usage", usageRouter);     // Usage stats (any authenticated key)
app.use("/api/billing", billingRouter); // Stripe checkout + subscription info
app.use("/api/admin", adminRouter);     // Admin management (JWT)

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found." }));

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[error]", err.message);
  res.status(500).json({ error: "Internal server error." });
});

// ── Start ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`EvidenceOS API v2 running on http://localhost:${PORT}`);
  });
}

module.exports = app;
