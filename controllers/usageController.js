const { getUsageForKey } = require("../services/usage");
const { PLAN_LIMITS } = require("../middleware/rateLimit");

// GET /api/usage?days=30
function getUsage(req, res) {
  const key = req.apiKey;
  const days = Math.min(parseInt(req.query.days) || 30, 90);
  const limit = PLAN_LIMITS[key.plan] ?? PLAN_LIMITS.free;
  const { daily, bySystem, byEndpoint, totals } = getUsageForKey(key.id, days);

  res.json({
    apiKey: key.key_prefix + "...",
    plan: key.plan,

    // Today's quota (live counter)
    today: {
      calls: key.calls_today,
      limit,
      remaining: Math.max(0, limit - key.calls_today),
      resetsAt: "midnight UTC",
    },

    // Period summary
    period: {
      days,
      totalCalls: totals?.calls ?? 0,
      totalErrors: totals?.errors ?? 0,
      avgResponseMs: totals?.avg_ms ?? null,
    },

    // Breakdowns
    bySystem,    // [{ system, calls, errors, avg_ms }]
    byEndpoint,  // [{ endpoint, calls, errors, avg_ms }]
    daily,       // [{ date, calls, errors, avg_ms }] — newest first
  });
}

module.exports = { getUsage };
