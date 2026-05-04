const express = require("express");
const router = express.Router();

const { checkAvailability } = require("../controllers/bookings.controller");

router.get("/check-availability", checkAvailability);

module.exports = router;