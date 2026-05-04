const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    ticketType: {
        type: String,
        required: true,
    },
    reference: {
        type: String,
        required: true,
        unique: true,
    },
    status: {
        type: String,
        enum: ["success", "pending", "failed"],
        default: "pending",
    },
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);
