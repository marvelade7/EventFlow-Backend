const express = require("express");
const router = express.Router();

const {
    simulatePayment,
    getMyBookings,
    getMyEventBookings,
    verifyQr,
    checkIn,
    getAllMyBookingsDebug,
    getUserDashboardStats,
} = require("../controllers/bookings.controller");

const auth = require("../middlewares/auth.middleware");

router.use(auth);

router.get("/my-bookings", getMyBookings);
router.get("/debug/my-bookings", getAllMyBookingsDebug);
router.get("/my-event-bookings", getMyEventBookings);
router.post("/payment/success", simulatePayment);
router.post("/verify-qr", verifyQr);
router.post("/check-in/:ticketCode", checkIn);
router.get("/dashboard-stats", auth, getUserDashboardStats);

module.exports = router;