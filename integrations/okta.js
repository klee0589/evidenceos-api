const fetch = require("node-fetch");

// Okta integration using the REST API (no SDK dependency needed).
// Env vars: OKTA_DOMAIN (e.g. dev-123456.okta.com), OKTA_API_TOKEN

async function fetchAccessReview({ warningsOnly = false } = {}) {
  if (!process.env.OKTA_DOMAIN || !process.env.OKTA_API_TOKEN) {
    throw new Error("OKTA_DOMAIN and OKTA_API_TOKEN are required.");
  }

  const base = `https://${process.env.OKTA_DOMAIN}/api/v1`;
  const headers = {
    Authorization: `SSWS ${process.env.OKTA_API_TOKEN}`,
    Accept: "application/json",
  };

  // List active users
  const usersRes = await fetch(`${base}/users?filter=status+eq+"ACTIVE"&limit=200`, { headers });
  if (!usersRes.ok) {
    throw new Error(`Okta API error: ${usersRes.status} ${usersRes.statusText}`);
  }
  const rawUsers = await usersRes.json();

  // Fetch MFA factors for each user (parallel, capped for perf)
  const users = await Promise.all(
    rawUsers.map(async (u) => {
      let hasMfa = false;
      try {
        const factorsRes = await fetch(`${base}/users/${u.id}/factors`, { headers });
        if (factorsRes.ok) {
          const factors = await factorsRes.json();
          hasMfa = factors.some((f) => f.status === "ACTIVE");
        }
      } catch {
        // non-critical
      }

      return {
        id: u.id,
        email: u.profile.email,
        login: u.profile.login,
        firstName: u.profile.firstName,
        lastName: u.profile.lastName,
        mfa: hasMfa,
        status: u.status,
        lastLogin: u.lastLogin || null,
        created: u.created || null,
      };
    })
  );

  const warnings = users.filter((u) => !u.mfa).length;
  const filtered = warningsOnly ? users.filter((u) => !u.mfa) : users;

  return {
    control: "Access Review",
    system: "Okta",
    source: "live",
    timestamp: new Date().toISOString(),
    lastFetched: new Date().toISOString(),
    status: warnings === 0 ? "Pass" : "Warning",
    totalUsers: users.length,
    warningsCount: warnings,
    users: filtered,
    summary: `${users.length} users reviewed, ${warnings} without MFA`,
  };
}

module.exports = { fetchAccessReview };
