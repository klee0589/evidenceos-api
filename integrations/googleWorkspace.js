const { google } = require("googleapis");

// Requires a Google service account with domain-wide delegation and
// the Admin SDK Directory API enabled.
// Env vars: GOOGLE_SERVICE_ACCOUNT_JSON (full JSON), GOOGLE_ADMIN_EMAIL

async function fetchAccessReview({ warningsOnly = false } = {}) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured.");
  }

  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;
  if (!adminEmail) throw new Error("GOOGLE_ADMIN_EMAIL is not configured.");

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      "https://www.googleapis.com/auth/admin.directory.user.readonly",
    ],
    subject: adminEmail,
  });

  const admin = google.admin({ version: "directory_v1", auth });

  const res = await admin.users.list({
    customer: "my_customer",
    maxResults: 200,
    orderBy: "email",
    projection: "full",
  });

  const rawUsers = res.data.users || [];

  const users = rawUsers.map((u) => ({
    email: u.primaryEmail,
    role: u.isAdmin ? "Admin" : u.isDelegatedAdmin ? "Delegated Admin" : "Member",
    mfa: u.isEnrolledIn2Sv ?? false,
    suspended: u.suspended ?? false,
    lastLogin: u.lastLoginTime || null,
  }));

  const filtered = warningsOnly ? users.filter((u) => !u.mfa || u.suspended) : users;
  const warnings = users.filter((u) => !u.mfa || u.suspended).length;

  return {
    control: "Access Review",
    system: "Google Workspace",
    source: "live",
    timestamp: new Date().toISOString(),
    lastFetched: new Date().toISOString(),
    status: warnings === 0 ? "Pass" : "Warning",
    totalUsers: users.length,
    warningsCount: warnings,
    users: filtered,
    summary: `${users.length} users reviewed, ${warnings} warning${warnings !== 1 ? "s" : ""}`,
  };
}

module.exports = { fetchAccessReview };
