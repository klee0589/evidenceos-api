const dispatcher = require("../services/webhookDispatcher");

const WEBHOOK_LIMITS = { free: 1, pro: Infinity };
const UPGRADE_URL = process.env.UPGRADE_URL || "https://evidenceos.com/pricing";

const VALID_EVENTS = ["access_review.flagged", "audit_log.high_risk"];

// POST /api/webhooks
function register(req, res) {
  const { url, events } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required." });
  }
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: "events must be a non-empty array." });
  }

  const invalid = events.filter((e) => !VALID_EVENTS.includes(e));
  if (invalid.length) {
    return res.status(400).json({
      error: `Unknown event(s): ${invalid.join(", ")}. Supported: ${VALID_EVENTS.join(", ")}`,
    });
  }

  const limit = WEBHOOK_LIMITS[req.apiKey.plan] ?? 1;
  const current = dispatcher.countByKey(req.apiKey.id);
  if (current >= limit) {
    return res.status(403).json({
      error: "Webhook limit reached for your plan.",
      upgradeUrl: UPGRADE_URL,
    });
  }

  const webhook = dispatcher.register(req.apiKey.id, url, events);
  const { apiKeyId, ...response } = webhook;
  // secret is returned exactly once — store it; it will not be shown again
  res.status(201).json({ ...response, _notice: "Save your webhook secret. It will not be shown again." });
}

// GET /api/webhooks
function list(req, res) {
  const hooks = dispatcher.getByKey(req.apiKey.id).map(({ apiKeyId, secret, ...wh }) => wh);
  res.json({ webhooks: hooks, total: hooks.length });
}

// POST /api/webhooks/test
function test(req, res) {
  const hooks = dispatcher.getByKey(req.apiKey.id);
  if (!hooks.length) {
    return res.status(400).json({ error: "No webhooks registered for this key." });
  }

  const payload = {
    event: "test",
    message: "This is a test webhook from EvidenceOS",
    timestamp: new Date().toISOString(),
  };

  // Fire to all hooks for this key regardless of subscribed events
  const fetch = require("node-fetch");
  for (const wh of hooks) {
    fetch(wh.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      timeout: 5000,
    }).catch(() => {});
  }

  res.json({ dispatched: hooks.length, event: "test", timestamp: payload.timestamp });
}

module.exports = { register, list, test };
