const crypto = require("crypto");
const { hashKey } = require("../middleware/auth");
const db = require("../db");

// Generate a new API key: eos_live_<32 random hex chars>
function generateKey() {
  const random = crypto.randomBytes(20).toString("hex"); // 40 hex chars
  return `eos_live_${random}`;
}

// Create and persist a new API key for a user
function createApiKey(userEmail, plan = "free") {
  const raw = generateKey();
  const hash = hashKey(raw);
  const prefix = raw.slice(0, 16); // "eos_live_abc123d" shown to user

  const result = db
    .prepare(
      `INSERT INTO api_keys (key_hash, key_prefix, user_email, plan)
       VALUES (?, ?, ?, ?)`
    )
    .run(hash, prefix, userEmail.toLowerCase().trim(), plan);

  return { id: result.lastInsertRowid, key: raw, prefix, plan };
}

// Look up an API key row by email (for display purposes — never returns the raw key)
function getKeysByEmail(email) {
  return db
    .prepare(
      `SELECT id, key_prefix, plan, calls_today, last_reset, is_active, created_at, last_used_at
       FROM api_keys WHERE user_email = ? ORDER BY created_at DESC`
    )
    .all(email.toLowerCase().trim());
}

// Revoke a key
function revokeKey(id) {
  return db.prepare("UPDATE api_keys SET is_active = 0 WHERE id = ?").run(id);
}

// Re-activate a key
function renewKey(id) {
  return db.prepare("UPDATE api_keys SET is_active = 1 WHERE id = ?").run(id);
}

module.exports = { createApiKey, getKeysByEmail, revokeKey, renewKey };
