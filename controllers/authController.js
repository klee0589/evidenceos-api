const jwt = require("jsonwebtoken");
const { createApiKey, getKeysByEmail } = require("../services/apiKey");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register
// Body: { email }
// Creates a new free-tier API key
function register(req, res) {
  const { email } = req.body || {};

  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }

  // Prevent duplicate registrations (allow multiple keys per email though)
  const { key, prefix, plan, id } = createApiKey(email, "free");

  res.status(201).json({
    message: "API key created. Save this — it will not be shown again.",
    apiKey: key,
    keyPrefix: prefix,
    plan,
    id,
    docsUrl: "https://evidenceos.com/docs",
  });
}

// GET /api/auth/keys?email=
// Lists all keys for an email (shows prefix, never raw key)
function listKeys(req, res) {
  const { email } = req.query;
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Valid email query param required." });
  }
  const keys = getKeysByEmail(email);
  res.json({ email, keys });
}

// POST /api/auth/admin-token
// Body: { secret }
// Issues a short-lived admin JWT
function adminToken(req, res) {
  const { secret } = req.body || {};
  if (!secret || secret !== process.env.ADMIN_JWT_SECRET) {
    return res.status(403).json({ error: "Invalid admin secret." });
  }
  const token = jwt.sign({ role: "admin" }, process.env.ADMIN_JWT_SECRET, { expiresIn: "8h" });
  res.json({ token, expiresIn: "8h" });
}

module.exports = { register, listKeys, adminToken };
