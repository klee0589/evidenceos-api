const crypto = require("crypto");
const { SYSTEMS } = require("./demoController");
const dispatcher = require("../services/webhookDispatcher");

const UPGRADE_URL = process.env.UPGRADE_URL || "https://evidenceos.com/pricing";
const FREE_DAILY_LIMIT = 3;

// In-memory report store: report_id -> report object
const reports = new Map();

// Per-key daily counter: "keyId:date" -> count
const dailyCounts = new Map();

function generateId() {
  return "rpt_" + crypto.randomBytes(6).toString("hex");
}

function getDailyCount(keyId) {
  const today = new Date().toISOString().slice(0, 10);
  return dailyCounts.get(`${keyId}:${today}`) || 0;
}

function incrementDailyCount(keyId) {
  const today = new Date().toISOString().slice(0, 10);
  const k = `${keyId}:${today}`;
  dailyCounts.set(k, (dailyCounts.get(k) || 0) + 1);
}

function buildReport(systemKey, includeWarningsOnly) {
  const { users } = SYSTEMS[systemKey];

  const flaggedUsers = users.filter((u) => !u.mfa);
  const adminRoles = ["Admin", "Owner", "Super Admin", "Administrator"];
  const adminAccounts = users.filter((u) => adminRoles.some((r) => u.role.includes(r)));

  const findings = flaggedUsers.map((u) => ({
    user: u.email,
    issue: "MFA not enabled",
    severity: "high",
    recommendation: "Enable MFA immediately",
  }));

  return {
    summary: {
      total_users: users.length,
      flagged_users: flaggedUsers.length,
      mfa_issues: flaggedUsers.length,
      admin_accounts: adminAccounts.length,
    },
    findings: includeWarningsOnly ? findings : findings,
  };
}

// POST /api/reports/access-review
function generateReport(req, res) {
  const { system = "okta", includeWarningsOnly = false } = req.body || {};

  if (!SYSTEMS[system]) {
    return res.status(400).json({
      error: `Invalid system. Supported: ${Object.keys(SYSTEMS).join(", ")}`,
    });
  }

  // Plan gating
  if (req.apiKey.plan === "free") {
    const count = getDailyCount(req.apiKey.id);
    if (count >= FREE_DAILY_LIMIT) {
      return res.status(403).json({
        error: "Report limit reached",
        upgradeUrl: UPGRADE_URL,
      });
    }
  }

  const report_id = generateId();
  const generated_at = new Date().toISOString();
  const { summary, findings } = buildReport(system, includeWarningsOnly);

  const report = { report_id, system, generated_at, summary, findings };
  reports.set(report_id, report);
  incrementDailyCount(req.apiKey.id);

  // Fire webhook if there are flagged users
  if (summary.flagged_users > 0) {
    dispatcher.dispatchToKey(req.apiKey.id, "access_review.flagged", {
      event: "access_review.flagged",
      system,
      flagged_users: summary.flagged_users,
      timestamp: generated_at,
      data: findings,
    });
  }

  res.status(201).json(report);
}

// GET /api/reports/:id
function getReport(req, res) {
  const { id } = req.params;
  const { format = "json" } = req.query;

  const report = reports.get(id);
  if (!report) {
    return res.status(404).json({ error: "Report not found." });
  }

  if (format === "pdf") {
    return res.json({
      download_url: `https://example.com/reports/${id}.pdf`,
    });
  }

  res.json(report);
}

module.exports = { generateReport, getReport };
