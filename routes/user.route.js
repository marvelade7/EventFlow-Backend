const express = require("express");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const {
    postSignup,
    postSignin,
    getDashboard,
    updateUser,
} = require("../controllers/user.controller");

const router = express.Router();

router.post("/register", postSignup);
router.post("/login", postSignin);
router.get("/dashboard", getDashboard);
router.patch("/update-user", upload.single("profilePic"), updateUser);

module.exports = router;
