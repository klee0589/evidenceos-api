const db = require("../db");
const { revokeKey, renewKey } = require("../services/apiKey");
const { getGlobalUsage } = require("../services/usage");

// GET /api/admin/keys
function listAllKeys(req, res) {
  const { plan, active } = req.query;
  let query = `
    SELECT id, key_prefix, user_email, plan, calls_today, last_reset,
           is_active, created_at, last_used_at
    FROM api_keys WHERE 1=1`;
  const params = [];

  if (plan) { query += " AND plan = ?"; params.push(plan); }
  if (active !== undefined) { query += " AND is_active = ?"; params.push(active === "true" ? 1 : 0); }

  query += " ORDER BY created_at DESC";
  const keys = db.prepare(query).all(...params);
  res.json({ total: keys.length, keys });
}

// DELETE /api/admin/keys/:id
function revokeKeyById(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: "Invalid key ID." });

  const key = db.prepare("SELECT id, is_active FROM api_keys WHERE id = ?").get(id);
  if (!key) return res.status(404).json({ error: "Key not found." });
  if (!key.is_active) return res.status(409).json({ error: "Key is already revoked." });

  revokeKey(id);
  res.json({ message: `Key ${id} revoked.` });
}

// POST /api/admin/keys/:id/renew
function renewKeyById(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: "Invalid key ID." });

  const key = db.prepare("SELECT id, is_active FROM api_keys WHERE id = ?").get(id);
  if (!key) return res.status(404).json({ error: "Key not found." });
  if (key.is_active) return res.status(409).json({ error: "Key is already active." });

  renewKey(id);
  res.json({ message: `Key ${id} reactivated.` });
}

// PATCH /api/admin/keys/:id/plan
function updatePlan(req, res) {
  const id = parseInt(req.params.id, 10);
  const { plan } = req.body || {};
  if (!["free", "pro"].includes(plan)) {
    return res.status(400).json({ error: "plan must be 'free' or 'pro'." });
  }
  db.prepare("UPDATE api_keys SET plan = ? WHERE id = ?").run(plan, id);
  res.json({ message: `Key ${id} plan updated to ${plan}.` });
}

// GET /api/admin/usage
function usageStats(req, res) {
  const days = Math.min(parseInt(req.query.days) || 7, 90);
  const stats = getGlobalUsage(days);
  res.json({ periodDays: days, ...stats });
}

// GET /api/admin/billing-events
function billingEvents(req, res) {
  const events = db
    .prepare(
      `SELECT be.*, k.user_email, k.plan
       FROM billing_events be
       LEFT JOIN api_keys k ON k.id = be.api_key_id
       ORDER BY be.created_at DESC LIMIT 100`
    )
    .all();
  res.json({ total: events.length, events });
}

module.exports = { listAllKeys, revokeKeyById, renewKeyById, updatePlan, usageStats, billingEvents };
