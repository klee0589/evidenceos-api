const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../db");

const ADMIN_SECRET = process.env.ADMIN_JWT_SECRET || "change-me-in-production";

// Hash an API key for safe storage/lookup
function hashKey(rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

// Reset daily call counter if it's a new day
function resetIfNewDay(keyRow) {
  const today = new Date().toISOString().slice(0, 10);
  if (keyRow.last_reset !== today) {
    db.prepare(
      "UPDATE api_keys SET calls_today = 0, last_reset = ? WHERE id = ?"
    ).run(today, keyRow.id);
    keyRow.calls_today = 0;
    keyRow.last_reset = today;
  }
  return keyRow;
}

// ── requireApiKey ─────────────────────────────────────────────────────────────
// Attaches req.apiKey (the DB row) — used on all protected routes
function requireApiKey(req, res, next) {
  const raw =
    req.headers["x-api-key"] ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null) ||
    req.query["X-API-Key"] ||
    req.query["api_key"] ||
    null;

  if (!raw) {
    return res.status(401).json({ error: "Missing API key. Pass via X-API-Key header or Authorization: Bearer <key>." });
  }

  if (!raw.startsWith("eos_")) {
    return res.status(401).json({ error: "Invalid API key format." });
  }

  // ── Master key bypass (survives DB resets) ───────────────────────────────────
  // Set MASTER_API_KEY in Render env vars so your dev key always works.
  if (process.env.MASTER_API_KEY && raw === process.env.MASTER_API_KEY) {
    req.apiKey = {
      id: 0,
      key_prefix: raw.slice(0, 16),
      user_email: process.env.MASTER_API_EMAIL || "admin@evidenceos.com",
      plan: process.env.MASTER_API_PLAN || "pro",
      calls_today: 0,
      last_reset: new Date().toISOString().slice(0, 10),
      is_active: 1,
    };
    const { PLAN_LIMITS } = require("./rateLimit");
    const limit = PLAN_LIMITS[req.apiKey.plan] ?? PLAN_LIMITS.free;
    res.set({ "X-RateLimit-Limit": limit, "X-RateLimit-Remaining": limit, "X-RateLimit-Plan": req.apiKey.plan });
    return next();
  }

  const hash = hashKey(raw);
  let keyRow = db.prepare("SELECT * FROM api_keys WHERE key_hash = ?").get(hash);

  if (!keyRow) {
    return res.status(401).json({ error: "API key not found." });
  }

  if (!keyRow.is_active) {
    return res.status(403).json({ error: "API key has been revoked." });
  }

  keyRow = resetIfNewDay(keyRow);

  // Update last_used_at
  db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(keyRow.id);

  req.apiKey = keyRow;

  // Set rate-limit headers for this key (rateLimitByPlan will override after incrementing)
  const { PLAN_LIMITS } = require("./rateLimit");
  const limit = PLAN_LIMITS[keyRow.plan] ?? PLAN_LIMITS.free;
  res.set({
    "X-RateLimit-Limit": limit,
    "X-RateLimit-Remaining": Math.max(0, limit - keyRow.calls_today),
    "X-RateLimit-Plan": keyRow.plan,
  });

  next();
}

// ── requireAdmin ──────────────────────────────────────────────────────────────
// Validates a signed admin JWT — only for /api/admin/* routes
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Admin JWT required." });
  }

  try {
    const payload = jwt.verify(auth.slice(7), ADMIN_SECRET);
    if (payload.role !== "admin") throw new Error("Not admin");
    req.admin = payload;
    next();
  } catch {
    res.status(403).json({ error: "Invalid or expired admin token." });
  }
}

module.exports = { requireApiKey, requireAdmin, hashKey };
