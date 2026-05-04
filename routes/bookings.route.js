const express = require("express");
const router = express.Router();

const {
    simulatePayment
} = require("../controllers/bookings.controller");

const auth = require("../middlewares/auth.middleware");

router.use(auth);

router.post("/payment/success", simulatePayment);

module.exports = router;