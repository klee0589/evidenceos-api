const { Router } = require("express");
const { requireApiKey } = require("../middleware/auth");
const { register, list, test } = require("../controllers/webhooksController");

const router = Router();

router.post("/test", requireApiKey, test);
router.post("/", requireApiKey, register);
router.get("/", requireApiKey, list);

module.exports = router;
