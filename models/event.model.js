const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        category: {
            type: String,
            required: true,
        },
        bannerImage: {
            type: String,
            required: true,
        },
        startDateTime: {
            type: Date,
            required: true,
        },
        endDateTime: {
            type: Date,
            required: true,
        },
        timeZone: {
            type: String,
            default: "Africa/Lagos",
        },
        location: {
            venue: {
                type: String,
                required: true,
            },
            address: String,
            city: String,
            country: String,
        },
        isFree: {
            type: Boolean,
            default: false,
        },
        ticketTypes: [
            {
                name: String,
                price: Number,
                quantity: Number,
                sold: {
                    type: Number,
                    default: 0,
                },
            },
        ],
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        status: {
            type: String,
            enum: ["upcoming", "ongoing", "completed", "cancelled"],
            default: "upcoming",
        },
    },
    { timestamps: true },
);

module.exports = mongoose.model("Event", eventSchema);
