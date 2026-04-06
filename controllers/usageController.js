const { getUsageForKey } = require("../services/usage");
const { PLAN_LIMITS } = require("../middleware/rateLimit");

// GET /api/usage
function getUsage(req, res) {
  const key = req.apiKey;
  const days = Math.min(parseInt(req.query.days) || 30, 90);
  const breakdown = getUsageForKey(key.id, days);
  const limit = PLAN_LIMITS[key.plan] ?? PLAN_LIMITS.free;

  res.json({
    apiKey: key.key_prefix + "...",
    plan: key.plan,
    today: {
      calls: key.calls_today,
      limit,
      remaining: Math.max(0, limit - key.calls_today),
      resetsAt: "midnight UTC",
    },
    breakdown,
    periodDays: days,
  });
}

module.exports = { getUsage };
