const { Octokit } = require("@octokit/rest");

// Requires a GitHub token with read:org scope.
// Env vars: GITHUB_TOKEN, GITHUB_ORG

async function fetchAccessReview({ warningsOnly = false } = {}) {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is not configured.");
  }
  if (!process.env.GITHUB_ORG) {
    throw new Error("GITHUB_ORG is not configured.");
  }

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const org = process.env.GITHUB_ORG;

  // Fetch org members with their roles
  const { data: members } = await octokit.orgs.listMembers({
    org,
    role: "all",
    per_page: 100,
  });

  // Check 2FA enforcement at org level (requires admin:org scope if desired)
  let mfaRequired = false;
  try {
    const { data: orgData } = await octokit.orgs.get({ org });
    mfaRequired = orgData.two_factor_requirement_enabled ?? false;
  } catch {
    // token may not have admin:org — skip
  }

  // Fetch non-2FA members (requires admin:org scope)
  let noMfaEmails = new Set();
  try {
    const { data: no2fa } = await octokit.orgs.listMembers({
      org,
      filter: "2fa_disabled",
      per_page: 100,
    });
    no2fa.forEach((m) => noMfaEmails.add(m.login));
  } catch {
    // token may not have sufficient scope
  }

  const users = members.map((m) => ({
    login: m.login,
    email: m.email || `${m.login}@github-noreply`,
    role: m.role || "member",
    mfa: !noMfaEmails.has(m.login),
    avatarUrl: m.avatar_url,
    lastLogin: null, // GitHub API does not expose this
  }));

  const filtered = warningsOnly ? users.filter((u) => !u.mfa) : users;
  const warnings = users.filter((u) => !u.mfa).length;

  return {
    control: "Access Review",
    system: "GitHub",
    source: "live",
    timestamp: new Date().toISOString(),
    lastFetched: new Date().toISOString(),
    status: warnings === 0 ? "Pass" : "Warning",
    totalUsers: users.length,
    warningsCount: warnings,
    mfaEnforcedAtOrg: mfaRequired,
    users: filtered,
    summary: `${users.length} members reviewed, ${warnings} warning${warnings !== 1 ? "s" : ""}`,
  };
}

module.exports = { fetchAccessReview };
