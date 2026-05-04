const express = require("express");
const router = express.Router();
const { initializePayment } = require("../controllers/bookings.controller");
const auth = require("../middlewares/auth.middleware");

router.use(auth);
router.post("/initialize-payment", initializePayment);

module.exports = router;


