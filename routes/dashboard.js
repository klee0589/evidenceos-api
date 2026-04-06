const { Router } = require("express");
const { requireApiKey } = require("../middleware/auth");
const { getDashboard } = require("../controllers/dashboardController");

const router = Router();

router.get("/", requireApiKey, getDashboard);

module.exports = router;
