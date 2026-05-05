const Event = require("../models/event.model");
const Booking = require("../models/bookings.model");
const Payment = require("../models/payment.model");
const { generateTicketID } = require("../utils/ticketGenerator");
const { handleBooking } = require("../services/booking.service");
const { sendUserEmail, sendOrganizerEmail } = require("../utils/email");
const crypto = require("crypto");

const checkAvailability = (req, res) => {
    const { eventId, ticketTypeName } = req.body;

    Event.findById(eventId)
        .then((event) => {
            if (!event) {
                return res.status(404).json({ message: "Event not found" });
            }

            const ticketType = event.ticketTypes.find(
                (t) => t.name === ticketTypeName,
            );

            if (!ticketType) {
                return res
                    .status(404)
                    .json({ message: "Ticket type not found" });
            }

            const availableTickets = ticketType.quantity - ticketType.sold;
            return res.status(200).json({
                available: availableTickets > 0,
                remaining: availableTickets,
            });
        })
        .catch((err) => {
            return res.status(500).json({
                message: "Error occurred while checking availability",
                error: err.message,
            });
        });
};

const initializePayment = (req, res) => {
    const { eventId, ticketTypeName } = req.body;

    const reference = crypto.randomBytes(6).toString("hex");
    const userId = req.user && (req.user.id || req.user._id || req.user.userId);

    if (!userId) {
        return res.status(401).json({ message: "User ID not found in token" });
    }

    Payment.create({
        user: userId,
        event: eventId,
        ticketType: ticketTypeName,
        reference,
        status: "pending",
    })
        .then((payment) => {
            return res.status(200).json({
                reference,
                message: "Payment initialized",
                paymentId: payment._id,
            });
        })
        .catch((err) => {
            return res.status(500).json({ message: err.message });
        });
};

const simulatePayment = (req, res) => {
    const { reference } = req.body;

    Payment.findOne({ reference })
        .then(payment => {
            if (!payment) {
                return res.status(404).json({ message: "Payment not found" });
            }

            payment.status = "success";
            return payment.save();
        })
        .then(payment => {
            return handleBooking(payment);
        })
        .then(booking => {
            sendUserEmail(booking.user, booking.event, booking.ticketCode);
            sendOrganizerEmail(booking.event.organizer, booking.event, booking.ticketCode);
            return res.status(201).json(booking);
        })
        .catch(err => {
            return res.status(500).json({ message: err.message });
        });
};

module.exports = {
    checkAvailability,
    initializePayment,
    simulatePayment,
};
