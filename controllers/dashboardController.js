const db = require("../db");
const { analyticsLog } = require("../services/usage");

// GET /api/dashboard
function getDashboard(req, res) {
  const keyId = req.apiKey.id;
  const email = req.apiKey.user_email;

  // Total calls ever
  const totalCalls = db
    .prepare("SELECT COUNT(*) AS n FROM usage_logs WHERE api_key_id = ?")
    .get(keyId)?.n || 0;

  // Top 5 endpoints by call count
  const topEndpoints = db
    .prepare(
      `SELECT endpoint, COUNT(*) AS count
       FROM usage_logs
       WHERE api_key_id = ?
       GROUP BY endpoint
       ORDER BY count DESC LIMIT 5`
    )
    .all(keyId);

  // First call info
  const firstCall = db
    .prepare(
      `SELECT endpoint, system, created_at
       FROM usage_logs
       WHERE api_key_id = ?
       ORDER BY created_at ASC LIMIT 1`
    )
    .get(keyId);

  // Active days (distinct calendar days with at least one call)
  const activeDays = db
    .prepare(
      `SELECT COUNT(DISTINCT date(created_at)) AS n
       FROM usage_logs WHERE api_key_id = ?`
    )
    .get(keyId)?.n || 0;

  // Recent in-memory analytics (last 20 calls for this key)
  const recent = analyticsLog
    .filter((e) => e.api_key_id === keyId)
    .slice(-20)
    .reverse();

  res.json({
    email,
    plan: req.apiKey.plan,
    total_calls: totalCalls,
    active_days: activeDays,
    top_endpoints: topEndpoints,
    first_used_at: firstCall?.created_at || req.apiKey.created_at,
    first_endpoint: firstCall?.endpoint || null,
    first_system: firstCall?.system || null,
    last_used_at: req.apiKey.last_used_at,
    recent_calls: recent,
  });
}

module.exports = { getDashboard };
