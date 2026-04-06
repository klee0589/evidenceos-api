const { Router } = require("express");
const { requireAdmin } = require("../middleware/auth");
const {
  listAllKeys,
  revokeKeyById,
  renewKeyById,
  updatePlan,
  usageStats,
  billingEvents,
} = require("../controllers/adminController");

const router = Router();

router.use(requireAdmin);

router.get("/keys", listAllKeys);
router.delete("/keys/:id", revokeKeyById);
router.post("/keys/:id/renew", renewKeyById);
router.patch("/keys/:id/plan", updatePlan);
router.get("/usage", usageStats);
router.get("/billing-events", billingEvents);

module.exports = router;
