const { Router } = require("express");
const { getAccessReview, getSystems, getAuditLog } = require("../controllers/demoController");

const router = Router();

router.get("/access-review", getAccessReview);
router.get("/audit-log", getAuditLog);
router.get("/systems", getSystems);

module.exports = router;
