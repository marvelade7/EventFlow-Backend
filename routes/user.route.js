const express = require("express");
const { postSignup, postSignin, getDashboard, updateUser, uploadImage } = require("../controllers/user.controller");

const router = express.Router();

router.post('/register', postSignup)
router.post('/login', postSignin)
router.get('/dashboard', getDashboard)
router.patch('/update-user', updateUser)

module.exports = router;
