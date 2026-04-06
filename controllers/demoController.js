const dispatcher = require("../services/webhookDispatcher");

// Seed data for each supported system
const SYSTEMS = {
  "google-workspace": {
    label: "Google Workspace",
    users: [
      { email: "alice@example.com", role: "Admin", mfa: true, lastLogin: "2026-04-04T09:12:00Z" },
      { email: "bob@example.com", role: "Member", mfa: false, lastLogin: "2026-04-03T14:45:00Z" },
      { email: "carol@example.com", role: "Member", mfa: true, lastLogin: "2026-04-05T08:01:00Z" },
    ],
  },
  github: {
    label: "GitHub",
    users: [
      { email: "dev-alice@example.com", role: "Owner", mfa: true, lastLogin: "2026-04-05T07:30:00Z" },
      { email: "dev-bob@example.com", role: "Member", mfa: false, lastLogin: "2026-04-02T11:22:00Z" },
      { email: "dev-carol@example.com", role: "Member", mfa: true, lastLogin: "2026-04-04T16:55:00Z" },
      { email: "dev-dan@example.com", role: "Billing Manager", mfa: true, lastLogin: "2026-04-01T09:00:00Z" },
    ],
  },
  aws: {
    label: "AWS IAM",
    users: [
      { email: "ops-alice@example.com", role: "Administrator", mfa: true, lastLogin: "2026-04-05T06:15:00Z" },
      { email: "ops-bob@example.com", role: "Developer", mfa: true, lastLogin: "2026-04-04T21:00:00Z" },
      { email: "ops-eve@example.com", role: "ReadOnly", mfa: false, lastLogin: "2026-03-29T10:30:00Z" },
    ],
  },
  okta: {
    label: "Okta",
    users: [
      { email: "alice@example.com", role: "Super Admin", mfa: true, lastLogin: "2026-04-05T08:45:00Z" },
      { email: "frank@example.com", role: "User", mfa: false, lastLogin: "2026-04-03T13:10:00Z" },
      { email: "grace@example.com", role: "User", mfa: true, lastLogin: "2026-04-04T17:22:00Z" },
      { email: "henry@example.com", role: "User", mfa: false, lastLogin: "2026-04-01T08:00:00Z" },
    ],
  },
};

const SUPPORTED_SYSTEMS = Object.keys(SYSTEMS);
const DEFAULT_SYSTEM = "okta";

// Returns the resolved system key, or null if the param is explicitly invalid
function resolveSystem(query) {
  if (!query) return DEFAULT_SYSTEM;
  const key = query.toLowerCase().replace(/\s+/g, "-");
  return SYSTEMS[key] ? key : null;
}

function buildSummary(users) {
  const total = users.length;
  const warnings = users.filter((u) => !u.mfa).length;
  return warnings === 0
    ? `${total}/${total} users reviewed, all clear`
    : `${total}/${total} users reviewed, ${warnings} warning${warnings > 1 ? "s" : ""}`;
}

function randomTimestamp() {
  // Vary timestamp slightly so each request feels "live"
  const now = new Date();
  now.setSeconds(now.getSeconds() - Math.floor(Math.random() * 60));
  return now.toISOString();
}

// GET /api/demo/access-review
function getAccessReview(req, res) {
  const systemKey = resolveSystem(req.query.system);
  if (!systemKey) {
    return res.status(400).json({
      error: `Invalid system. Supported: ${SUPPORTED_SYSTEMS.join(", ")}`,
    });
  }

  const { label, users } = SYSTEMS[systemKey];
  const warnings = users.filter((u) => !u.mfa).length;

  const ts = randomTimestamp();

  if (warnings > 0) {
    dispatcher.dispatch("access_review.flagged", {
      event: "access_review.flagged",
      system: label,
      flagged_users: warnings,
      timestamp: ts,
      data: users.filter((u) => !u.mfa),
    });
  }

  res.json({
    control: "Access Review",
    system: label,
    timestamp: ts,
    status: warnings === 0 ? "Pass" : "Warning",
    users,
    summary: buildSummary(users),
  });
}

// GET /api/demo/systems  — list available mock systems
function getSystems(req, res) {
  const list = Object.entries(SYSTEMS).map(([key, { label }]) => ({ key, label }));
  res.json({ systems: list });
}

// Per-system audit log seed data
const AUDIT_LOGS = {
  okta: [
    {
      timestamp: "2026-04-01T10:22:11Z",
      user: "frank@example.com",
      action: "login",
      ip: "203.0.113.42",
      mfa_used: false,
      risk: "medium",
      warning: "Login without MFA",
    },
    {
      timestamp: "2026-04-02T09:15:30Z",
      user: "henry@example.com",
      action: "login",
      ip: "198.51.100.7",
      mfa_used: false,
      risk: "medium",
      warning: "Login without MFA",
    },
    {
      timestamp: "2026-04-03T14:05:00Z",
      user: "alice@example.com",
      action: "privilege_escalation",
      from_role: "User",
      to_role: "Super Admin",
      approved: false,
      risk: "high",
      warning: "Unauthorized privilege escalation",
    },
    {
      timestamp: "2026-04-04T08:44:00Z",
      user: "grace@example.com",
      action: "login",
      ip: "192.0.2.55",
      mfa_used: true,
      risk: "low",
    },
  ],
  github: [
    {
      timestamp: "2026-04-01T11:02:45Z",
      user: "dev-bob@example.com",
      action: "privilege_escalation",
      from_role: "Member",
      to_role: "Owner",
      approved: false,
      risk: "high",
      warning: "Unauthorized privilege escalation",
    },
    {
      timestamp: "2026-04-02T16:30:00Z",
      user: "dev-bob@example.com",
      action: "login",
      ip: "203.0.113.88",
      mfa_used: false,
      risk: "medium",
      warning: "Login without MFA",
    },
    {
      timestamp: "2026-04-03T10:10:00Z",
      user: "dev-alice@example.com",
      action: "repo_delete",
      repo: "org/infrastructure",
      risk: "high",
      warning: "Production repository deleted",
    },
    {
      timestamp: "2026-04-04T12:00:00Z",
      user: "dev-carol@example.com",
      action: "login",
      ip: "192.0.2.12",
      mfa_used: true,
      risk: "low",
    },
  ],
  aws: [
    {
      timestamp: "2026-04-01T07:55:00Z",
      user: "ops-eve@example.com",
      action: "login",
      ip: "198.51.100.99",
      mfa_used: false,
      risk: "medium",
      warning: "Console login without MFA",
    },
    {
      timestamp: "2026-04-02T13:20:00Z",
      user: "ops-bob@example.com",
      action: "iam_policy_attach",
      policy: "AdministratorAccess",
      target_user: "ops-eve@example.com",
      approved: false,
      risk: "high",
      warning: "AdministratorAccess attached to non-admin user",
    },
    {
      timestamp: "2026-04-03T09:00:00Z",
      user: "ops-alice@example.com",
      action: "login",
      ip: "192.0.2.34",
      mfa_used: true,
      risk: "low",
    },
    {
      timestamp: "2026-04-04T17:45:00Z",
      user: "ops-eve@example.com",
      action: "s3_bucket_public",
      bucket: "prod-data-exports",
      risk: "high",
      warning: "S3 bucket made publicly accessible",
    },
  ],
  "google-workspace": [
    {
      timestamp: "2026-04-01T08:30:00Z",
      user: "bob@example.com",
      action: "login",
      ip: "203.0.113.15",
      mfa_used: false,
      risk: "medium",
      warning: "Login without 2-Step Verification",
    },
    {
      timestamp: "2026-04-02T11:45:00Z",
      user: "alice@example.com",
      action: "privilege_escalation",
      from_role: "Member",
      to_role: "Admin",
      approved: false,
      risk: "high",
      warning: "Unauthorized admin role assignment",
    },
    {
      timestamp: "2026-04-03T15:10:00Z",
      user: "carol@example.com",
      action: "login",
      ip: "192.0.2.77",
      mfa_used: true,
      risk: "low",
    },
    {
      timestamp: "2026-04-04T09:55:00Z",
      user: "bob@example.com",
      action: "drive_share_external",
      file: "Q1 Financial Report.xlsx",
      shared_with: "unknown@external.com",
      risk: "high",
      warning: "Sensitive file shared with external domain",
    },
  ],
};

// GET /api/demo/audit-log
function getAuditLog(req, res) {
  const systemKey = resolveSystem(req.query.system);
  if (!systemKey) {
    return res.status(400).json({
      error: `Invalid system. Supported: ${SUPPORTED_SYSTEMS.join(", ")}`,
    });
  }

  const auditEvents = AUDIT_LOGS[systemKey];
  const { label } = SYSTEMS[systemKey];
  const warnings = auditEvents.filter((e) => e.risk === "high" || e.risk === "medium").length;
  const highRisk = auditEvents.filter((e) => e.risk === "high");
  const ts = randomTimestamp();

  if (highRisk.length > 0) {
    dispatcher.dispatch("audit_log.high_risk", {
      event: "audit_log.high_risk",
      system: label,
      high_risk_count: highRisk.length,
      timestamp: ts,
      data: highRisk,
    });
  }

  res.json({
    control: "Audit Log",
    system: label,
    timestamp: ts,
    status: warnings === 0 ? "Pass" : "Warning",
    events: auditEvents,
    summary: `${auditEvents.length} events reviewed, ${warnings} warning${warnings !== 1 ? "s" : ""}`,
  });
}

module.exports = { getAccessReview, getSystems, getAuditLog, SYSTEMS };
