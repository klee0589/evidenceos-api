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

const DEFAULT_SYSTEM = "google-workspace";

function resolveSystem(query) {
  if (!query) return DEFAULT_SYSTEM;
  const key = query.toLowerCase().replace(/\s+/g, "-");
  return SYSTEMS[key] ? key : DEFAULT_SYSTEM;
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
  const { label, users } = SYSTEMS[systemKey];
  const warnings = users.filter((u) => !u.mfa).length;

  res.json({
    control: "Access Review",
    system: label,
    timestamp: randomTimestamp(),
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

module.exports = { getAccessReview, getSystems };
