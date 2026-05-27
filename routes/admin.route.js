const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");

const {
    postAdminSignin,
    getAdminDashboard,
    getAdminStats,
} = require("../controllers/admin.controller");

const router = express.Router();

router.post("/login", postAdminSignin);
router.get("/dashboard", authMiddleware, getAdminDashboard);
router.get("/stats", authMiddleware, getAdminStats);
// router.delete("/delete-user/:userId", authMiddleware, deleteUser);
// router.delete("/delete-event/:eventId", authMiddleware, deleteEvent);

module.exports = router;