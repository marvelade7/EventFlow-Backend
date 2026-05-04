const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

require("dotenv").config();
const URI = process.env.MONGO_URI;

const userRoutes = require("./routes/user.route");
const eventRoutes = require("./routes/event.route");
const paymentRoutes = require("./routes/payment.route");
const bookingRoutes = require("./routes/bookings.route");
const availabilityRoutes = require("./routes/availability.route");

mongoose
    .connect(URI)
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch((err) => {
        console.error("Error connecting to MongoDB:", err);
    });
    
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/bookings", bookingRoutes);
app.use('/api/available', availabilityRoutes);

app.get("/", (req, res) => {
    res.send("Backend is running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
