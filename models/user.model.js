const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true,
    },
    lastName: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    termsAccepted: {
        type: Boolean,
        required: true,
    },
    profilePic: {
        type: String,
        default: "",
    },
    phoneNumber: {
        type: String,
        default: "",
    },
    bio: {
        type: String,
        default: "",
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user",
    },
    isVerified: {
        type: Boolean,
        default: false,
    },

    favorites: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
        },
    ],

    ticketsPurchased: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Ticket",
        },
    ],

    eventsCreated: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
        },
    ],
}, {timestamps: true,}
);

module.exports = mongoose.model("User", userSchema);
