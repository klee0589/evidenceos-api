const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../data/evidenceos.db");

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash    TEXT    NOT NULL UNIQUE,
    key_prefix  TEXT    NOT NULL,          -- e.g. "eos_live_abc1" (first 16 chars shown to user)
    user_email  TEXT    NOT NULL,
    plan        TEXT    NOT NULL DEFAULT 'free', -- 'free' | 'pro'
    calls_today INTEGER NOT NULL DEFAULT 0,
    last_reset  TEXT    NOT NULL DEFAULT (date('now')),
    is_active   INTEGER NOT NULL DEFAULT 1,
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
  );

  CREATE TABLE IF NOT EXISTS usage_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id      INTEGER REFERENCES api_keys(id),
    endpoint        TEXT NOT NULL,
    system          TEXT,
    status_code     INTEGER,
    response_ms     INTEGER,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS billing_events (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id             INTEGER REFERENCES api_keys(id),
    event_type             TEXT NOT NULL,   -- 'subscription.created' | 'subscription.cancelled' | 'invoice.paid' etc.
    plan                   TEXT,
    stripe_event_id        TEXT UNIQUE,
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT,
    created_at             TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_usage_key_date ON usage_logs(api_key_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_usage_endpoint ON usage_logs(endpoint);
  CREATE INDEX IF NOT EXISTS idx_billing_key ON billing_events(api_key_id);
`);

module.exports = db;
