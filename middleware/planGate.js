// Restrict an endpoint to specific plans.
// Usage: router.get('/real', requireApiKey, planGate('pro'), rateLimitByPlan, handler)
function planGate(...allowedPlans) {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    if (!allowedPlans.includes(req.apiKey.plan)) {
      return res.status(403).json({
        error: `Your plan (${req.apiKey.plan}) does not have access to this endpoint.`,
        requiredPlan: allowedPlans,
        upgradeUrl: process.env.UPGRADE_URL || "https://evidenceos.com/pricing",
      });
    }
    next();
  };
}

module.exports = { planGate };
