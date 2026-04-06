const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");

// In-memory store: webhook_id -> { webhook_id, apiKeyId, url, events, created_at }
const webhookStore = new Map();

function generateId() {
  return "wh_" + uuidv4().replace(/-/g, "").slice(0, 12);
}

function register(apiKeyId, url, events) {
  const webhook = {
    webhook_id: generateId(),
    apiKeyId,
    url,
    events,
    created_at: new Date().toISOString(),
  };
  webhookStore.set(webhook.webhook_id, webhook);
  return webhook;
}

function getByKey(apiKeyId) {
  return [...webhookStore.values()].filter((wh) => wh.apiKeyId === apiKeyId);
}

function countByKey(apiKeyId) {
  return getByKey(apiKeyId).length;
}

// Fire to all webhooks globally that subscribed to this event (used by public demo endpoints)
function dispatch(event, payload) {
  for (const wh of webhookStore.values()) {
    if (wh.events.includes(event)) {
      fire(wh.url, payload);
    }
  }
}

// Fire only to webhooks belonging to a specific API key (used by authenticated endpoints)
function dispatchToKey(apiKeyId, event, payload) {
  for (const wh of getByKey(apiKeyId)) {
    if (wh.events.includes(event)) {
      fire(wh.url, payload);
    }
  }
}

function fire(url, payload) {
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    timeout: 5000,
  }).catch(() => {}); // fail silently
}

module.exports = { register, getByKey, countByKey, dispatch, dispatchToKey };
