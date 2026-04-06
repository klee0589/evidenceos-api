const db = require("../db");
const { attachStripe } = require("./apiKey");

// Lazy-load Stripe so the server starts without a key set (demo mode)
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
}

// Plan → Stripe Price ID mapping (set these in .env)
const PRICE_IDS = {
  pro: process.env.STRIPE_PRO_PRICE_ID,
};

// Create a Stripe Checkout session for upgrading to Pro
async function createCheckoutSession(apiKeyId, userEmail) {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: userEmail,
    line_items: [{ price: PRICE_IDS.pro, quantity: 1 }],
    metadata: { api_key_id: String(apiKeyId) },
    success_url: `${process.env.APP_URL || "https://evidenceos.com"}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL || "https://evidenceos.com"}/billing/cancel`,
  });

  return session;
}

// Handle incoming Stripe webhook events
async function handleWebhook(rawBody, signature) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }

  const { type, data, id: stripeEventId } = event;

  // Idempotency guard
  const existing = db
    .prepare("SELECT id FROM billing_events WHERE stripe_event_id = ?")
    .get(stripeEventId);
  if (existing) return { alreadyProcessed: true };

  switch (type) {
    case "checkout.session.completed": {
      const session = data.object;
      const apiKeyId = parseInt(session.metadata?.api_key_id, 10);
      if (apiKeyId) {
        attachStripe(apiKeyId, session.customer, session.subscription, "pro");
        logBillingEvent(apiKeyId, type, "pro", stripeEventId, session.customer, session.subscription);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = data.object;
      // Downgrade to free
      const keyRow = db
        .prepare("SELECT id FROM api_keys WHERE stripe_subscription_id = ?")
        .get(sub.id);
      if (keyRow) {
        db.prepare("UPDATE api_keys SET plan = 'free', stripe_subscription_id = NULL WHERE id = ?")
          .run(keyRow.id);
        logBillingEvent(keyRow.id, type, "free", stripeEventId, sub.customer, sub.id);
      }
      break;
    }

    case "invoice.payment_failed": {
      const inv = data.object;
      const keyRow = db
        .prepare("SELECT id FROM api_keys WHERE stripe_customer_id = ?")
        .get(inv.customer);
      if (keyRow) {
        logBillingEvent(keyRow.id, type, null, stripeEventId, inv.customer, inv.subscription);
      }
      break;
    }

    default:
      // Log unhandled events for auditing but don't error
      db.prepare(
        "INSERT OR IGNORE INTO billing_events (event_type, stripe_event_id) VALUES (?, ?)"
      ).run(type, stripeEventId);
  }

  return { received: true };
}

function logBillingEvent(apiKeyId, eventType, plan, stripeEventId, customerId, subscriptionId) {
  db.prepare(
    `INSERT OR IGNORE INTO billing_events
      (api_key_id, event_type, plan, stripe_event_id, stripe_customer_id, stripe_subscription_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(apiKeyId, eventType, plan, stripeEventId, customerId, subscriptionId);
}

// Get subscription status for an API key
function getSubscription(apiKeyId) {
  const key = db
    .prepare("SELECT plan, stripe_customer_id, stripe_subscription_id, calls_today, last_reset FROM api_keys WHERE id = ?")
    .get(apiKeyId);

  const events = db
    .prepare(
      "SELECT event_type, plan, created_at FROM billing_events WHERE api_key_id = ? ORDER BY created_at DESC LIMIT 10"
    )
    .all(apiKeyId);

  return { ...key, billingHistory: events };
}

module.exports = { createCheckoutSession, handleWebhook, getSubscription };
