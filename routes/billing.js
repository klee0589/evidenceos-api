const { Router } = require("express");
const { requireApiKey } = require("../middleware/auth");
const { webhook, subscription } = require("../controllers/billingController");

const router = Router();

// Public — called by Base44, no API key needed (secured by shared secret header)
router.post("/webhook", webhook);

// Authenticated — any valid API key can check their own subscription
router.get("/subscription", requireApiKey, subscription);

module.exports = router;
