const { Router } = require("express");
const { requireApiKey } = require("../middleware/auth");
const { rateLimitByPlan } = require("../middleware/rateLimit");
const { planGate } = require("../middleware/planGate");
const { getAccessReview, listSystems } = require("../controllers/systemsController");

const router = Router();

// All real system endpoints require auth + pro plan
router.use(requireApiKey, planGate("pro"), rateLimitByPlan);

router.get("/access-review", getAccessReview);
router.get("/", listSystems);

module.exports = router;
