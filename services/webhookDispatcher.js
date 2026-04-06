const crypto = require("crypto");
const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");

// In-memory store: webhook_id -> { webhook_id, apiKeyId, url, events, secret, created_at }
const webhookStore = new Map();

function generateId() {
  return "wh_" + uuidv4().replace(/-/g, "").slice(0, 12);
}

function generateSecret() {
  return "whsec_" + crypto.randomBytes(24).toString("hex");
}

function sign(payload, secret) {
  return "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function register(apiKeyId, url, events) {
  const secret = generateSecret();
  const webhook = {
    webhook_id: generateId(),
    apiKeyId,
    url,
    events,
    secret,
    created_at: new Date().toISOString(),
  };
  webhookStore.set(webhook.webhook_id, webhook);
  return webhook; // secret is returned once on registration
}

function getByKey(apiKeyId) {
  return [...webhookStore.values()].filter((wh) => wh.apiKeyId === apiKeyId);
}

function countByKey(apiKeyId) {
  return getByKey(apiKeyId).length;
}

// Fire to all webhooks globally that subscribed to this event (public demo endpoints)
function dispatch(event, payload) {
  for (const wh of webhookStore.values()) {
    if (wh.events.includes(event)) {
      fire(wh.url, wh.secret, payload);
    }
  }
}

// Fire only to webhooks belonging to a specific API key (authenticated endpoints)
function dispatchToKey(apiKeyId, event, payload) {
  for (const wh of getByKey(apiKeyId)) {
    if (wh.events.includes(event)) {
      fire(wh.url, wh.secret, payload);
    }
  }
}

function fire(url, secret, payload) {
  const body = JSON.stringify(payload);
  const signature = sign(body, secret);
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-EvidenceOS-Signature": signature,
    },
    body,
    timeout: 5000,
  }).catch(() => {}); // fail silently
}

module.exports = { register, getByKey, countByKey, dispatch, dispatchToKey, sign };
