const { createCheckoutSession, handleWebhook, getSubscription } = require("../services/billing");

// POST /api/billing/checkout
async function checkout(req, res) {
  try {
    const session = await createCheckoutSession(req.apiKey.id, req.apiKey.user_email);
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
}

// POST /api/billing/webhook  (raw body — wired before express.json())
async function webhook(req, res) {
  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).json({ error: "Missing Stripe signature header." });

  try {
    const result = await handleWebhook(req.body, sig);
    res.json(result);
  } catch (err) {
    console.error("[webhook]", err.message);
    res.status(400).json({ error: err.message });
  }
}

// GET /api/billing/subscription
function subscription(req, res) {
  const data = getSubscription(req.apiKey.id);
  res.json(data);
}

module.exports = { checkout, webhook, subscription };
