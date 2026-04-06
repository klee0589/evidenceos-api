const db = require("../db");

// Log a single API call — PII-safe: no user emails, no response bodies
function logUsage({ apiKeyId, endpoint, system = null, statusCode, responseMs }) {
  db.prepare(
    `INSERT INTO usage_logs (api_key_id, endpoint, system, status_code, response_ms)
     VALUES (?, ?, ?, ?, ?)`
  ).run(apiKeyId ?? null, endpoint, system, statusCode, responseMs);
}

// Express middleware: automatically log every request after response
function usageLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    if (!req.apiKey) return; // skip unauthenticated (demo/health) routes
    logUsage({
      apiKeyId: req.apiKey.id,
      endpoint: req.path,
      system: req.query.system || null,
      statusCode: res.statusCode,
      responseMs: Date.now() - start,
    });
  });
  next();
}

// Aggregate usage for a specific API key
function getUsageForKey(apiKeyId, days = 30) {
  return db
    .prepare(
      `SELECT
         date(created_at) AS date,
         endpoint,
         system,
         COUNT(*) AS calls,
         AVG(response_ms) AS avg_ms,
         SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors
       FROM usage_logs
       WHERE api_key_id = ?
         AND created_at >= datetime('now', ? || ' days')
       GROUP BY date(created_at), endpoint, system
       ORDER BY date DESC`
    )
    .all(apiKeyId, `-${days}`);
}

// Admin: global usage summary
function getGlobalUsage(days = 7) {
  return {
    byEndpoint: db
      .prepare(
        `SELECT endpoint, COUNT(*) AS calls, AVG(response_ms) AS avg_ms
         FROM usage_logs
         WHERE created_at >= datetime('now', ? || ' days')
         GROUP BY endpoint ORDER BY calls DESC`
      )
      .all(`-${days}`),

    bySystem: db
      .prepare(
        `SELECT system, COUNT(*) AS calls
         FROM usage_logs
         WHERE system IS NOT NULL AND created_at >= datetime('now', ? || ' days')
         GROUP BY system ORDER BY calls DESC`
      )
      .all(`-${days}`),

    byPlan: db
      .prepare(
        `SELECT k.plan, COUNT(u.id) AS calls
         FROM usage_logs u
         JOIN api_keys k ON k.id = u.api_key_id
         WHERE u.created_at >= datetime('now', ? || ' days')
         GROUP BY k.plan`
      )
      .all(`-${days}`),

    total: db
      .prepare(
        `SELECT COUNT(*) AS calls FROM usage_logs
         WHERE created_at >= datetime('now', ? || ' days')`
      )
      .get(`-${days}`),
  };
}

module.exports = { logUsage, usageLogger, getUsageForKey, getGlobalUsage };
