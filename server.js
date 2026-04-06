const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const demoRouter = require("./routes/demo");
const authRouter = require("./routes/auth");
const systemsRouter = require("./routes/systems");
const usageRouter = require("./routes/usage");
const billingRouter = require("./routes/billing");
const adminRouter = require("./routes/admin");
const reportsRouter = require("./routes/reports");
const webhooksRouter = require("./routes/webhooks");
const dashboardRouter = require("./routes/dashboard");
const requestContext = require("./middleware/requestContext");
const { usageLogger } = require("./services/usage");

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "*",
    methods: ["GET", "POST", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    exposedHeaders: ["X-Request-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Plan", "X-API-Deprecated"],
  })
);

// ── General middleware ────────────────────────────────────────────────────────
app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
    skip: (req) => req.path === "/api/health" || req.path === "/api/v1/health",
  })
);
app.use(express.json());

// Request context: X-Request-Id header, response wrapper, structured logging
app.use(requestContext);

// Usage logging (fires after response, for authenticated requests)
app.use(usageLogger);

// Default rate-limit headers for public endpoints (auth middleware overrides per key)
app.use((_req, res, next) => {
  res.set({
    "X-RateLimit-Limit": 100,
    "X-RateLimit-Remaining": 100,
    "X-RateLimit-Plan": "public",
  });
  next();
});

// ── Deprecated marker (added before legacy /api/* routes) ────────────────────
const markDeprecated = (_req, res, next) => {
  res.set("X-API-Deprecated", "true");
  next();
};

// ── Health (v1 + legacy) ──────────────────────────────────────────────────────
const healthHandler = (_req, res) =>
  res.json({ status: "ok", ts: new Date().toISOString(), version: "2.0.0" });

app.get("/api/v1/health", healthHandler);
app.get("/api/health", markDeprecated, healthHandler);

// ── API v1 routes (canonical, no deprecation header) ─────────────────────────
app.use("/api/v1/demo", demoRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/systems", systemsRouter);
app.use("/api/v1/usage", usageRouter);
app.use("/api/v1/billing", billingRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/reports", reportsRouter);
app.use("/api/v1/webhooks", webhooksRouter);
app.use("/api/v1/dashboard", dashboardRouter);

// ── Legacy /api/* routes (deprecated, still functional) ──────────────────────
app.use("/api/demo", markDeprecated, demoRouter);
app.use("/api/auth", markDeprecated, authRouter);
app.use("/api/systems", markDeprecated, systemsRouter);
app.use("/api/usage", markDeprecated, usageRouter);
app.use("/api/billing", markDeprecated, billingRouter);
app.use("/api/admin", markDeprecated, adminRouter);
app.use("/api/reports", markDeprecated, reportsRouter);
app.use("/api/webhooks", markDeprecated, webhooksRouter);
app.use("/api/dashboard", markDeprecated, dashboardRouter);

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
