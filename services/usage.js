const db = require("../db");

// Rolling in-memory analytics buffer (max 1000 entries)
const analyticsLog = [];
const ANALYTICS_MAX = 1000;

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

    const responseMs = Date.now() - start;

    logUsage({
      apiKeyId: req.apiKey.id,
      endpoint: req.path,
      system: req.query.system || null,
      statusCode: res.statusCode,
      responseMs,
    });

    // Push to in-memory analytics buffer
    const entry = {
      api_key_id: req.apiKey.id,
      endpoint: req.path,
      system: req.query.system || null,
      status: res.statusCode,
      response_ms: responseMs,
      ts: new Date().toISOString(),
    };
    analyticsLog.push(entry);
    if (analyticsLog.length > ANALYTICS_MAX) analyticsLog.shift();
  });
  next();
}

// Aggregate usage for a specific API key — full breakdown
function getUsageForKey(apiKeyId, days = 30) {
  const window = `-${days}`;

  // Daily call totals (for trend chart)
  const daily = db
    .prepare(
      `SELECT
         date(created_at) AS date,
         COUNT(*) AS calls,
         SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors,
         ROUND(AVG(response_ms)) AS avg_ms
       FROM usage_logs
       WHERE api_key_id = ?
         AND created_at >= datetime('now', ? || ' days')
       GROUP BY date(created_at)
       ORDER BY date DESC`
    )
    .all(apiKeyId, window);

  // Calls per system (e.g. github: 42, aws: 18)
  const bySystem = db
    .prepare(
      `SELECT
         system,
         COUNT(*) AS calls,
         SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors,
         ROUND(AVG(response_ms)) AS avg_ms
       FROM usage_logs
       WHERE api_key_id = ?
         AND system IS NOT NULL
         AND created_at >= datetime('now', ? || ' days')
       GROUP BY system
       ORDER BY calls DESC`
    )
    .all(apiKeyId, window);

  // Calls per endpoint
  const byEndpoint = db
    .prepare(
      `SELECT
         endpoint,
         COUNT(*) AS calls,
         SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors,
         ROUND(AVG(response_ms)) AS avg_ms
       FROM usage_logs
       WHERE api_key_id = ?
         AND created_at >= datetime('now', ? || ' days')
       GROUP BY endpoint
       ORDER BY calls DESC`
    )
    .all(apiKeyId, window);

  // Period totals
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS calls,
         SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors,
         ROUND(AVG(response_ms)) AS avg_ms
       FROM usage_logs
       WHERE api_key_id = ?
         AND created_at >= datetime('now', ? || ' days')`
    )
    .get(apiKeyId, window);

  return { daily, bySystem, byEndpoint, totals };
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

module.exports = { logUsage, usageLogger, getUsageForKey, getGlobalUsage, analyticsLog };
