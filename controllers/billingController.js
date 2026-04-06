const { applyPlanChange, getSubscription } = require("../services/billing");

// POST /api/billing/webhook
// Called by Base44 automation when a User entity's plan field changes.
// Expected payload:
//   {
//     "event":    { "type": "update", "entity_name": "User", "entity_id": "abc123" },
//     "data":     { "email": "user@example.com", "plan": "pro", ... },
//     "old_data": { "email": "user@example.com", "plan": "free", ... }
//   }
function webhook(req, res) {
  // Validate shared secret (read fresh each call so env var changes in tests work)
  const webhookSecret = process.env.BASE44_WEBHOOK_SECRET;
  const incomingSecret = req.headers["x-webhook-secret"] || req.headers["x-base44-secret"];
  if (webhookSecret && incomingSecret !== webhookSecret) {
    return res.status(401).json({ error: "Invalid webhook secret." });
  }

  const { event, data, old_data } = req.body || {};

  if (!data?.email) {
    return res.status(400).json({ error: "Payload must include data.email." });
  }

  if (!data?.plan) {
    return res.status(400).json({ error: "Payload must include data.plan." });
  }

  // Skip if plan hasn't actually changed
  if (old_data?.plan && old_data.plan === data.plan) {
    return res.json({ skipped: true, reason: "Plan unchanged." });
  }

  try {
    const result = applyPlanChange({
      email: data.email,
      plan: data.plan,
      base44EntityId: event?.entity_id || null,
      eventType: event?.type || "webhook",
    });

    console.log(`[billing] Plan updated: ${data.email} → ${data.plan} (${result.updatedKeys} key(s))`);
    res.json({ received: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// GET /api/billing/subscription
function subscription(req, res) {
  const data = getSubscription(req.apiKey.id);
  res.json(data);
}

module.exports = { webhook, subscription };
