const express = require("express");
const { postSignup, postSignin } = require("../controllers/user.controller");

const router = express.Router();

router.post('/register', postSignup)
router.post('/login', postSignin)

module.exports = router;
