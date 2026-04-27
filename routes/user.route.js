const express = require("express");
const { postSignup, postSignin, getDashboard } = require("../controllers/user.controller");

const router = express.Router();

router.post('/register', postSignup)
router.post('/login', postSignin)
router.get('/dashboard', getDashboard)

module.exports = router;
