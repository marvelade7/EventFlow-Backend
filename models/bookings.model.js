const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
    {
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        status: {
            type: String,
            enum: ['booked', 'checked-in'],
            default: 'booked',
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid'],
            default: 'paid'
        },
        ticketCode: {
            type: String,
            required: true,
            unique: true,
        },
        ticketTypeName: {
            type: String,
        },
        expiresAt: {
            type: Date
        },
        paymentReference: {
            type: String,
            index: true,
            sparse: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);