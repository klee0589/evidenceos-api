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

const ADMIN_ROLES = ["Admin", "Owner", "Super Admin", "Administrator", "Org Admin"];
const STALE_DAYS = 30;

function isStale(lastLogin) {
  if (!lastLogin) return false;
  const days = (Date.now() - new Date(lastLogin).getTime()) / 86400000;
  return days > STALE_DAYS;
}

function buildReport(systemKey, includeWarningsOnly) {
  const { users } = SYSTEMS[systemKey];

  const adminAccounts  = users.filter((u) => ADMIN_ROLES.some((r) => u.role.includes(r)));
  const noMfa          = users.filter((u) => !u.mfa);
  const staleLogins    = users.filter((u) => isStale(u.lastLogin));
  const criticalUsers  = noMfa.filter((u) => ADMIN_ROLES.some((r) => u.role.includes(r)));

  const findings = [
    // Critical: admin with no MFA
    ...criticalUsers.map((u) => ({
      user: u.email,
      role: u.role,
      issue: "Admin account with MFA disabled",
      severity: "critical",
      recommendation: "Enable MFA on this admin account immediately",
    })),
    // High: non-admin with no MFA (not already listed as critical)
    ...noMfa
      .filter((u) => !ADMIN_ROLES.some((r) => u.role.includes(r)))
      .map((u) => ({
        user: u.email,
        role: u.role,
        issue: "MFA not enabled",
        severity: "high",
        recommendation: "Enable MFA immediately",
      })),
    // Medium: stale login > 30 days
    ...staleLogins
      .filter((u) => u.mfa) // only flag stale if not already caught above
      .map((u) => ({
        user: u.email,
        role: u.role,
        issue: `No login in ${Math.floor((Date.now() - new Date(u.lastLogin).getTime()) / 86400000)} days`,
        severity: "medium",
        recommendation: "Review account necessity or offboard user",
      })),
  ];

  const severityCount = (s) => findings.filter((f) => f.severity === s).length;

  return {
    summary: {
      total_users: users.length,
      flagged_users: findings.length,
      mfa_issues: noMfa.length,
      stale_logins: staleLogins.length,
      admin_accounts: adminAccounts.length,
      severity_distribution: {
        critical: severityCount("critical"),
        high:     severityCount("high"),
        medium:   severityCount("medium"),
        low:      severityCount("low"),
      },
    },
    findings,
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
