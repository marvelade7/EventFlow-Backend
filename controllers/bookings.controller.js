const Event = require("../models/event.model");
const Booking = require("../models/bookings.model");
const Payment = require("../models/payment.model");
const { handleBooking } = require("../services/booking.service");
const { sendUserEmail, sendOrganizerEmail } = require("../utils/email");
const crypto = require("crypto");

const getRequestValue = (req, key) => req.body?.[key] ?? req.query?.[key];

const getUserIdFromRequest = (req) => (
    req.user && (req.user.id || req.user._id || req.user.userId)
);

const normalizeQuantity = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return 1;
    }

    return Math.floor(parsed);
};

const checkAvailability = (req, res) => {
    const eventId = getRequestValue(req, "eventId") || getRequestValue(req, "event");
    const ticketTypeName = getRequestValue(req, "ticketTypeName") || getRequestValue(req, "ticketType");

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

            const availableTickets = Number(ticketType.quantity || 0) - Number(ticketType.sold || 0);

            return res.status(200).json({
                available: availableTickets > 0,
                remaining: availableTickets,
            });
        })
        .catch((err) => res.status(500).json({
            message: "Error occurred while checking availability",
            error: err.message,
        }));
};

const initializePayment = (req, res) => {
    const eventId = getRequestValue(req, "eventId") || getRequestValue(req, "event");
    const ticketTypeName = getRequestValue(req, "ticketTypeName") || getRequestValue(req, "ticketType");
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
                    finalTicketType = (event.ticketTypes && event.ticketTypes[0] && event.ticketTypes[0].name) || 'Free';
                } else {
                    return res.status(400).json({ message: "Ticket type is required for paid events" });
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
                .then((payment) => res.status(200).json({
                    reference,
                    message: "Payment initialized",
                    paymentId: payment._id,
                    quantity,
                }))
                .catch((err) => res.status(500).json({ message: err.message }));
        })
        .catch((err) => res.status(500).json({ message: err.message }));
};

const simulatePayment = (req, res) => {
    const reference = getRequestValue(req, "reference");

    if (!reference) {
        return res.status(400).json({ message: "Payment reference is required" });
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
                    return payment.save()
                        .then(() => handleBooking(payment))
                        .then(() => Booking.find({ paymentReference: reference })
                            .sort({ createdAt: 1 })
                            .populate({
                                path: "event",
                                populate: {
                                    path: "createdBy",
                                    select: "firstName lastName fullName name profilePic",
                                },
                            })
                            .populate({ path: "user", select: "firstName lastName email" }))
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

const verifyQr = (req, res) => {
    // Accept either { envelope } or { payload, signature }
    const { envelope, payload, signature } = req.body || {};
    const userId = getUserIdFromRequest(req);

    let parsedPayload = payload;
    let sig = signature;

    if (envelope) {
        let env = envelope;
        if (typeof env === 'string') {
            try {
                env = JSON.parse(env);
            } catch (e) {
                return res.status(400).json({ message: 'Invalid envelope JSON' });
            }
        }

        parsedPayload = env.payload;
        sig = env.signature;
    }

    if (!parsedPayload || !sig) {
        return res.status(400).json({ message: 'Payload and signature are required' });
    }

    const payloadString = typeof parsedPayload === 'string' ? parsedPayload : JSON.stringify(parsedPayload);
    const secret = process.env.QR_HMAC_SECRET || 'dev_secret';
    const computed = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

    if (computed !== sig) {
        return res.status(400).json({ message: 'Invalid signature' });
    }

    const ticketCode = parsedPayload.ticketCode;
    if (!ticketCode) {
        return res.status(400).json({ message: 'ticketCode missing from payload' });
    }

    if (!userId) {
        return res.status(401).json({ message: 'User ID not found in token' });
    }

    return Booking.findOne({ ticketCode })
        .populate({ path: 'user', select: 'firstName lastName email' })
        .populate({ path: 'event', select: 'title createdBy' })
        .then((booking) => {
            if (!booking) {
                return res.status(404).json({ message: 'Booking not found' });
            }

            const eventOwnerId = booking.event && booking.event.createdBy
                ? booking.event.createdBy.toString()
                : null;

            if (!eventOwnerId || eventOwnerId !== userId.toString()) {
                return res.status(403).json({ message: 'Only the event owner can verify this QR code' });
            }

            // If booking has a stored signature, verify it matches
            if (booking.qrSignature && booking.qrSignature !== sig) {
                return res.status(400).json({ message: 'Signature mismatch with stored booking' });
            }

            // Mark as checked-in if not already
            if (booking.status !== 'checked-in') {
                booking.status = 'checked-in';
                return booking.save().then((b) => res.status(200).json({ message: 'Verified and checked-in', booking: b }));
            }

            return res.status(200).json({ message: 'Already checked-in', booking });
        })
        .catch((err) => res.status(500).json({ message: err.message }));
};

module.exports = {
    checkAvailability,
    initializePayment,
    simulatePayment,
    getMyBookings,
    verifyQr,
};
