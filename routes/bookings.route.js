const express = require("express");
const router = express.Router();

const {
    simulatePayment,
    getMyBookings,
    verifyQr,
} = require("../controllers/bookings.controller");

const auth = require("../middlewares/auth.middleware");

router.use(auth);

router.get("/my-bookings", getMyBookings);
router.post("/payment/success", simulatePayment);
router.post("/verify-qr", verifyQr);

module.exports = router;