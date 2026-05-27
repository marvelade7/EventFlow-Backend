const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");

const {
    postAdminSignin,
    getAdminDashboard,
} = require("../controllers/admin.controller");

const router = express.Router();

router.post("/login", postAdminSignin);
router.get("/dashboard", authMiddleware, getAdminDashboard);

module.exports = router;