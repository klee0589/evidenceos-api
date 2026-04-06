const { Router } = require("express");
const { requireApiKey } = require("../middleware/auth");
const { getUsage } = require("../controllers/usageController");

const router = Router();

router.get("/", requireApiKey, getUsage);

module.exports = router;
