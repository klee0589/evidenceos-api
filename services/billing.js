const db = require("../db");

const VALID_PLANS = ["free", "pro"];

// Apply a plan change coming from a Base44 webhook
function applyPlanChange({ email, plan, eventType = "update" }) {
  if (!VALID_PLANS.includes(plan)) {
    throw new Error(`Unknown plan "${plan}". Valid: ${VALID_PLANS.join(", ")}`);
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Update ALL active keys for this email (a user may have more than one)
  const result = db
    .prepare("UPDATE api_keys SET plan = ? WHERE user_email = ? AND is_active = 1")
    .run(plan, normalizedEmail);

  // Log the billing event for auditing
  const keys = db
    .prepare("SELECT id FROM api_keys WHERE user_email = ? AND is_active = 1")
    .all(normalizedEmail);

  const stmt = db.prepare(
    `INSERT INTO billing_events (api_key_id, event_type, plan)
     VALUES (?, ?, ?)`
  );

  for (const key of keys) {
    stmt.run(key.id, eventType, plan);
  }

  return { updatedKeys: result.changes, email: normalizedEmail, plan };
}

// Get subscription info for a given API key id
function getSubscription(apiKeyId) {
  const key = db
    .prepare(
      `SELECT plan, calls_today, last_reset
       FROM api_keys WHERE id = ?`
    )
    .get(apiKeyId);

  const events = db
    .prepare(
      `SELECT event_type, plan, created_at
       FROM billing_events
       WHERE api_key_id = ?
       ORDER BY created_at DESC LIMIT 10`
    )
    .all(apiKeyId);

  return { ...key, billingHistory: events };
}

module.exports = { applyPlanChange, getSubscription };
