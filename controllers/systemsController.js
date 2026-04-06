// Real system integrations — only accessible on the 'pro' plan
const INTEGRATIONS = {
  "google-workspace": require("../integrations/googleWorkspace"),
  github: require("../integrations/github"),
  aws: require("../integrations/aws"),
  okta: require("../integrations/okta"),
};

const SUPPORTED_SYSTEMS = Object.keys(INTEGRATIONS);

// GET /api/systems/access-review?system=github&warningsOnly=true
async function getAccessReview(req, res) {
  const system = (req.query.system || "google-workspace").toLowerCase();
  const warningsOnly = req.query.warningsOnly === "true";

  if (!INTEGRATIONS[system]) {
    return res.status(400).json({
      error: `Unknown system "${system}". Supported: ${SUPPORTED_SYSTEMS.join(", ")}`,
    });
  }

  try {
    const data = await INTEGRATIONS[system].fetchAccessReview({ warningsOnly });
    res.json(data);
  } catch (err) {
    // Surface config errors clearly; don't leak internal stack traces
    const isConfig = err.message.includes("not configured") || err.message.includes("is not configured");
    res.status(isConfig ? 503 : 502).json({
      error: isConfig
        ? `Integration not configured: ${err.message}`
        : `Error fetching data from ${system}. Check credentials.`,
      system,
    });
  }
}

// GET /api/systems
function listSystems(_req, res) {
  res.json({ systems: SUPPORTED_SYSTEMS });
}

module.exports = { getAccessReview, listSystems };
