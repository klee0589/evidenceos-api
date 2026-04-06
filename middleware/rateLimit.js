const db = require("../db");

const PLAN_LIMITS = {
  free: 100,
  pro: 10_000,
};

// Per-key daily rate limit enforced via the DB counter (survives restarts)
function rateLimitByPlan(req, res, next) {
  const key = req.apiKey;
  if (!key) return next(); // auth middleware should have caught this

  const limit = PLAN_LIMITS[key.plan] ?? PLAN_LIMITS.free;

  if (key.calls_today >= limit) {
    return res.status(429).json({
      error: "Daily rate limit exceeded.",
      plan: key.plan,
      limit,
      reset: "Resets at midnight UTC.",
    });
  }

  // Increment counter
  db.prepare("UPDATE api_keys SET calls_today = calls_today + 1 WHERE id = ?").run(key.id);
  key.calls_today += 1;

  // Expose rate-limit headers
  res.set({
    "X-RateLimit-Limit": limit,
    "X-RateLimit-Remaining": Math.max(0, limit - key.calls_today),
    "X-RateLimit-Plan": key.plan,
  });

  next();
}

module.exports = { rateLimitByPlan, PLAN_LIMITS };
