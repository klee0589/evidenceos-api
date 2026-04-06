const { Router } = require("express");
const express = require("express");
const { requireApiKey } = require("../middleware/auth");
const { checkout, webhook, subscription } = require("../controllers/billingController");

const router = Router();

// Stripe webhook needs raw body — must be declared BEFORE express.json()
// We handle this at the server level by mounting the webhook route separately.
// This route file handles the authenticated billing endpoints.

router.post("/checkout", requireApiKey, checkout);
router.get("/subscription", requireApiKey, subscription);

module.exports = router;
