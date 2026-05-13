const Event = require("../models/event.model");
const Booking = require("../models/bookings.model");
const Payment = require("../models/payment.model");
const { handleBooking } = require("../services/booking.service");
const { sendUserEmail, sendOrganizerEmail } = require("../utils/email");
const crypto = require("crypto");

const getRequestValue = (req, key) => req.body?.[key] ?? req.query?.[key];

const getUserIdFromRequest = (req) =>
    req.user && (req.user.id || req.user._id || req.user.userId);

const normalizeQuantity = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return 1;
    }

    return Math.floor(parsed);
};

const checkAvailability = (req, res) => {
    const eventId =
        getRequestValue(req, "eventId") || getRequestValue(req, "event");
    const ticketTypeName =
        getRequestValue(req, "ticketTypeName") ||
        getRequestValue(req, "ticketType");

    if (!eventId || !ticketTypeName) {
        return res.status(400).json({
            message: "Event ID and ticket type are required",
        });
    }

    return Event.findById(eventId)
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

            const availableTickets =
                Number(ticketType.quantity || 0) - Number(ticketType.sold || 0);

            return res.status(200).json({
                available: availableTickets > 0,
                remaining: availableTickets,
            });
        })
        .catch((err) =>
            res.status(500).json({
                message: "Error occurred while checking availability",
                error: err.message,
            }),
        );
};

const initializePayment = (req, res) => {
    const eventId =
        getRequestValue(req, "eventId") || getRequestValue(req, "event");
    const ticketTypeName =
        getRequestValue(req, "ticketTypeName") ||
        getRequestValue(req, "ticketType");
    const quantity = normalizeQuantity(getRequestValue(req, "quantity"));

    const reference = crypto.randomBytes(6).toString("hex");
    const userId = getUserIdFromRequest(req);

    if (!userId) {
        return res.status(401).json({ message: "User ID not found in token" });
    }

    if (!eventId) {
        return res.status(400).json({ message: "Event is required" });
    }

    // If ticket type isn't provided, check the event to see if it's free
    return Event.findById(eventId)
        .then((event) => {
            if (!event) {
                return res.status(404).json({ message: "Event not found" });
            }

            let finalTicketType = ticketTypeName;
            if (!finalTicketType) {
                if (event.isFree) {
                    finalTicketType =
                        (event.ticketTypes &&
                            event.ticketTypes[0] &&
                            event.ticketTypes[0].name) ||
                        "Free";
                } else {
                    return res.status(400).json({
                        message: "Ticket type is required for paid events",
                    });
                }
            }

            return Payment.create({
                user: userId,
                event: eventId,
                ticketType: finalTicketType,
                quantity,
                reference,
                status: "pending",
            })
                .then((payment) =>
                    res.status(200).json({
                        reference,
                        message: "Payment initialized",
                        paymentId: payment._id,
                        quantity,
                    }),
                )
                .catch((err) => res.status(500).json({ message: err.message }));
        })
        .catch((err) => res.status(500).json({ message: err.message }));
};

const simulatePayment = (req, res) => {
    const reference = getRequestValue(req, "reference");

    if (!reference) {
        return res
            .status(400)
            .json({ message: "Payment reference is required" });
    }

    return Payment.findOne({ reference })
        .then((payment) => {
            if (!payment) {
                return res.status(404).json({ message: "Payment not found" });
            }

            return Booking.find({ paymentReference: reference })
                .sort({ createdAt: 1 })
                .populate({
                    path: "event",
                    populate: {
                        path: "createdBy",
                        select: "firstName lastName fullName name profilePic",
                    },
                })
                .populate({ path: "user", select: "firstName lastName email" })
                .then((existingBookings) => {
                    if (existingBookings.length > 0) {
                        return res.status(200).json({
                            message: "Payment already processed",
                            bookings: existingBookings,
                        });
                    }

                    payment.status = "success";
                    return payment
                        .save()
                        .then(() => handleBooking(payment))
                        .then(() =>
                            Booking.find({ paymentReference: reference })
                                .sort({ createdAt: 1 })
                                .populate({
                                    path: "event",
                                    populate: {
                                        path: "createdBy",
                                        select: "firstName lastName fullName name profilePic",
                                    },
                                })
                                .populate({
                                    path: "user",
                                    select: "firstName lastName email",
                                }),
                        )
                        .then((bookings) => {
                            bookings.forEach((booking) => {
                                sendUserEmail(booking);
                                sendOrganizerEmail(booking);
                            });

                            return res.status(201).json({
                                message: "Booking confirmed",
                                bookings,
                            });
                        });
                });
        })
        .catch((err) => res.status(500).json({ message: err.message }));
};

const getMyBookings = (req, res) => {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
        return res.status(401).json({ message: "User ID not found in token" });
    }

    return Booking.find({ user: userId })
        .sort({ createdAt: -1 })
        .populate({
            path: "event",
            populate: {
                path: "createdBy",
                select: "firstName lastName fullName name profilePic",
            },
        })
        .populate({ path: "user", select: "firstName lastName email" })
        .then((bookings) => res.status(200).json({ bookings }))
        .catch((err) => res.status(500).json({ message: err.message }));
};

const getMyEventBookings = (req, res) => {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
        return res.status(401).json({ message: "User ID not found in token" });
    }

    return Event.find({ createdBy: userId })
        .select("_id")
        .then((events) => {
            const eventIds = events.map((event) => event._id);

            if (eventIds.length === 0) {
                return res.status(200).json({ bookings: [] });
            }

            return Booking.find({ event: { $in: eventIds } })
                .sort({ createdAt: -1 })
                .populate({
                    path: "event",
                    populate: {
                        path: "createdBy",
                        select: "firstName lastName fullName name profilePic",
                    },
                })
                .populate({
                    path: "user",
                    select: "firstName lastName email avatar profilePic name",
                })
                .then((bookings) => res.status(200).json({ bookings }));
        })
        .catch((err) => res.status(500).json({ message: err.message }));
};

const verifyQr = (req, res) => {
    const ticketCode = (req.body?.ticketCode || "").toString().trim().toUpperCase();

    const currentUserId = req.user && (req.user.id || req.user._id || req.user.userId);

    if (!ticketCode) {
        return res.status(400).json({ message: "Ticket code is required" });
    }

    Booking.findOne({ ticketCode })
        .populate({ path: "event" })
        .populate({ path: "user" })
        .then((booking) => {
            if (!booking) {
                return res.status(404).json({ message: "Invalid ticket" });
            }

            if (booking.user._id.toString() !== currentUserId) {
                return res.status(403).json({ message: "You are not authorized to check in attendees for this event" });
            }

            if (booking.paymentStatus !== "paid") {
                return res.status(400).json({ message: "Ticket is not paid" });
            }

            if (booking.checkedIn) {
                return res.status(400).json({
                    message: "Ticket has already been used for check-in",
                });
            }

            if (booking.expiresAt && booking.expiresAt < new Date()) {
                return res.status(400).json({ message: "Booking has expired" });
            }

            // Mark the booking as used or checked-in if needed
            // booking.checkedIn = true;
            // return booking.save().then(() => res.status(200).json({ message: "QR code is valid", booking }));

            return res
                .status(200)
                .json({ message: "QR code is valid", booking });
        })
        .catch((err) => res.status(500).json({ message: err.message }));
};

const checkIn = (req, res) => {
    const { ticketCode } = req.params;
    const currentUserId = req.user && (req.user.id || req.user._id || req.user.userId);

    Booking.findOne({ ticketCode })
        .then((booking) => {
            if (!booking) {
                return res.status(404).json({ message: "Invalid Ticket" });
            }

            if (booking.user._id.toString() !== currentUserId) {
                return res.status(403).json({ message: "You are not authorized to check in attendees for this event" });
            }

            if (booking.checkedIn) {
                return res.status(400).json({ message: "Already checked in" });
            }

            booking.checkedIn = true;
            booking.checkedInAt = new Date();

            return booking
                .save()
                .then(() =>
                    res
                        .status(200)
                        .json({ message: "Check-in successful", booking }),
                );
        })
        .catch((err) => res.status(500).json({ message: err.message }));
};

module.exports = {
    checkAvailability,
    initializePayment,
    simulatePayment,
    getMyBookings,
    getMyEventBookings,
    verifyQr,
    checkIn,
};
