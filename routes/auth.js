const { Router } = require("express");
const { register, listKeys, adminToken } = require("../controllers/authController");

const router = Router();

router.post("/register", register);
router.get("/keys", listKeys);
router.post("/admin-token", adminToken);

module.exports = router;
