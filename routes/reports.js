const { Router } = require("express");
const { requireApiKey } = require("../middleware/auth");
const { generateReport, getReport } = require("../controllers/reportsController");

const router = Router();

router.post("/access-review", requireApiKey, generateReport);
router.get("/:id", getReport);

module.exports = router;
