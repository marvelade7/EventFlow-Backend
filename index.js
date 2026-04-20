const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

require("dotenv").config();
const URI = process.env.MONGO_URI;

const userRoutes = require("./routes/user.route");
const eventRoutes = require("./routes/event.route");

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

app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);

app.get("/", (req, res) => {
    res.send("Backend is running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
