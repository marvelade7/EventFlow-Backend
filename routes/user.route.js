const express = require("express");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const authMiddleware = require("../middlewares/auth.middleware");

const {
    postSignup,
    postSignin,
    getDashboard,
    updateUser,
    verifyEmail,
    sendOtpEmail,
    forgotPassword,
    resetPassword,
    postSignUpWithGoogle,
} = require("../controllers/user.controller");

const router = express.Router();

router.post("/register", postSignup);
router.post("/login", postSignin);
router.post("/google-auth", postSignUpWithGoogle);
router.get("/dashboard", authMiddleware, getDashboard);
router.patch("/update-user", authMiddleware, upload.single("profilePic"), updateUser);
router.post('/verify-email', verifyEmail);
router.post('/send-otp-email', sendOtpEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

module.exports = router;
