const dispatcher = require("../services/webhookDispatcher");

// Seed data for each supported system — realistic user counts, stale logins, mixed MFA
const SYSTEMS = {
  "google-workspace": {
    label: "Google Workspace",
    users: [
      { email: "alice@company.com",   role: "Admin",  mfa: true,  lastLogin: "2026-04-05T09:12:00Z", status: "active" },
      { email: "bob@company.com",     role: "Member", mfa: false, lastLogin: "2026-04-03T14:45:00Z", status: "active" },
      { email: "carol@company.com",   role: "Member", mfa: true,  lastLogin: "2026-04-05T08:01:00Z", status: "active" },
      { email: "david@company.com",   role: "Member", mfa: true,  lastLogin: "2026-03-10T11:30:00Z", status: "active" },
      { email: "eve@company.com",     role: "Member", mfa: false, lastLogin: "2026-02-14T16:00:00Z", status: "active" },
      { email: "frank@company.com",   role: "Admin",  mfa: true,  lastLogin: "2026-04-04T07:55:00Z", status: "active" },
      { email: "grace@company.com",   role: "Member", mfa: true,  lastLogin: "2026-04-01T13:22:00Z", status: "suspended" },
    ],
  },
  github: {
    label: "GitHub",
    users: [
      { email: "dev-alice@company.com",  role: "Owner",          mfa: true,  lastLogin: "2026-04-05T07:30:00Z", status: "active" },
      { email: "dev-bob@company.com",    role: "Member",         mfa: false, lastLogin: "2026-04-02T11:22:00Z", status: "active" },
      { email: "dev-carol@company.com",  role: "Member",         mfa: true,  lastLogin: "2026-04-04T16:55:00Z", status: "active" },
      { email: "dev-dan@company.com",    role: "Billing Manager",mfa: true,  lastLogin: "2026-04-01T09:00:00Z", status: "active" },
      { email: "dev-eve@company.com",    role: "Member",         mfa: false, lastLogin: "2026-03-15T14:10:00Z", status: "active" },
      { email: "dev-frank@company.com",  role: "Owner",          mfa: true,  lastLogin: "2026-04-05T06:45:00Z", status: "active" },
    ],
  },
  aws: {
    label: "AWS IAM",
    users: [
      { email: "ops-alice@company.com",  role: "Administrator", mfa: true,  lastLogin: "2026-04-05T06:15:00Z", status: "active",   consoleAccess: true  },
      { email: "ops-bob@company.com",    role: "Developer",     mfa: true,  lastLogin: "2026-04-04T21:00:00Z", status: "active",   consoleAccess: true  },
      { email: "ops-carol@company.com",  role: "Developer",     mfa: true,  lastLogin: "2026-04-03T18:30:00Z", status: "active",   consoleAccess: true  },
      { email: "ops-dan@company.com",    role: "ReadOnly",      mfa: false, lastLogin: "2026-03-29T10:30:00Z", status: "active",   consoleAccess: false },
      { email: "ops-eve@company.com",    role: "ReadOnly",      mfa: false, lastLogin: "2026-02-20T08:00:00Z", status: "active",   consoleAccess: false },
      { email: "ops-frank@company.com",  role: "Administrator", mfa: true,  lastLogin: "2026-04-05T05:00:00Z", status: "active",   consoleAccess: true  },
      { email: "svc-deploy@company.com", role: "ServiceAccount",mfa: false, lastLogin: null,                   status: "active",   consoleAccess: false },
    ],
  },
  okta: {
    label: "Okta",
    users: [
      { email: "alice@company.com",  role: "Super Admin", mfa: true,  lastLogin: "2026-04-05T08:45:00Z", status: "ACTIVE"    },
      { email: "bob@company.com",    role: "Org Admin",   mfa: true,  lastLogin: "2026-04-04T12:30:00Z", status: "ACTIVE"    },
      { email: "carol@company.com",  role: "User",        mfa: true,  lastLogin: "2026-04-04T17:22:00Z", status: "ACTIVE"    },
      { email: "dan@company.com",    role: "User",        mfa: false, lastLogin: "2026-04-03T13:10:00Z", status: "ACTIVE"    },
      { email: "eve@company.com",    role: "User",        mfa: false, lastLogin: "2026-04-01T08:00:00Z", status: "ACTIVE"    },
      { email: "frank@company.com",  role: "User",        mfa: true,  lastLogin: "2026-03-20T09:15:00Z", status: "ACTIVE"    },
      { email: "grace@company.com",  role: "User",        mfa: false, lastLogin: "2026-02-10T11:00:00Z", status: "SUSPENDED" },
      { email: "henry@company.com",  role: "Read Only",   mfa: true,  lastLogin: "2026-04-02T16:40:00Z", status: "ACTIVE"    },
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

function buildSummary(allUsers) {
  const total = allUsers.length;
  const warnings = allUsers.filter((u) => !u.mfa).length;
  return warnings === 0
    ? `${total}/${total} users reviewed, all clear`
    : `${total}/${total} users reviewed, ${warnings} warning${warnings > 1 ? "s" : ""}`;
}

function randomTimestamp() {
  const now = new Date();
  now.setSeconds(now.getSeconds() - Math.floor(Math.random() * 60));
  return now.toISOString();
}

// Cursor-based pagination over an array
function paginate(items, rawLimit, rawCursor) {
  const limit = Math.min(Math.max(parseInt(rawLimit) || items.length, 1), 100);
  const start = rawCursor
    ? parseInt(Buffer.from(String(rawCursor), "base64").toString("ascii"), 10) || 0
    : 0;
  const page = items.slice(start, start + limit);
  const nextStart = start + page.length;
  const hasMore = nextStart < items.length;
  return {
    items: page,
    pagination: {
      next_cursor: hasMore ? Buffer.from(String(nextStart)).toString("base64") : null,
      has_more: hasMore,
    },
  };
}

// Simulate slow/error responses for testing
async function applySimulate(req, res) {
  const sim = req.query.simulate;
  if (sim === "slow") {
    await new Promise((r) => setTimeout(r, 500 + Math.floor(Math.random() * 700)));
  } else if (sim === "error" && Math.random() < 0.1) {
    res.status(500).json({ error: "Simulated internal error." });
    return true; // signal that response was sent
  }
  return false;
}

// GET /api/demo/access-review
async function getAccessReview(req, res) {
  if (await applySimulate(req, res)) return;

  const systemKey = resolveSystem(req.query.system);
  if (!systemKey) {
    return res.status(400).json({
      error: `Invalid system. Supported: ${SUPPORTED_SYSTEMS.join(", ")}`,
    });
  }

  const { label, users: allUsers } = SYSTEMS[systemKey];

  // Filtering
  let filtered = allUsers;
  if (req.query.onlyWarnings === "true") {
    filtered = filtered.filter((u) => !u.mfa);
  }

  // Sorting
  if (req.query.sort === "timestamp_asc") {
    filtered = [...filtered].sort((a, b) => (a.lastLogin || "").localeCompare(b.lastLogin || ""));
  } else if (req.query.sort === "timestamp_desc") {
    filtered = [...filtered].sort((a, b) => (b.lastLogin || "").localeCompare(a.lastLogin || ""));
  }

  // Pagination
  const { items: users, pagination } = paginate(filtered, req.query.limit, req.query.cursor);

  const warnings = allUsers.filter((u) => !u.mfa).length;
  const ts = randomTimestamp();

  if (warnings > 0) {
    dispatcher.dispatch("access_review.flagged", {
      event: "access_review.flagged",
      system: label,
      flagged_users: warnings,
      timestamp: ts,
      data: allUsers.filter((u) => !u.mfa),
    });
  }

  res.json({
    control: "Access Review",
    system: label,
    timestamp: ts,
    status: warnings === 0 ? "Pass" : "Warning",
    users,
    pagination,
    summary: buildSummary(allUsers),
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
async function getAuditLog(req, res) {
  if (await applySimulate(req, res)) return;

  const systemKey = resolveSystem(req.query.system);
  if (!systemKey) {
    return res.status(400).json({
      error: `Invalid system. Supported: ${SUPPORTED_SYSTEMS.join(", ")}`,
    });
  }

  const allEvents = AUDIT_LOGS[systemKey];
  const { label } = SYSTEMS[systemKey];

  // Filtering
  let filtered = allEvents;
  if (req.query.risk) {
    filtered = filtered.filter((e) => e.risk === req.query.risk.toLowerCase());
  }
  if (req.query.user) {
    const u = req.query.user.toLowerCase();
    filtered = filtered.filter((e) => e.user.toLowerCase().includes(u));
  }

  // Sorting
  if (req.query.sort === "timestamp_asc") {
    filtered = [...filtered].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  } else if (req.query.sort === "timestamp_desc") {
    filtered = [...filtered].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  // Pagination
  const { items: events, pagination } = paginate(filtered, req.query.limit, req.query.cursor);

  const warnings = allEvents.filter((e) => e.risk === "high" || e.risk === "medium").length;
  const highRisk = allEvents.filter((e) => e.risk === "high");
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
    events,
    pagination,
    summary: `${allEvents.length} events reviewed, ${warnings} warning${warnings !== 1 ? "s" : ""}`,
  });
}

module.exports = { getAccessReview, getSystems, getAuditLog, SYSTEMS };
