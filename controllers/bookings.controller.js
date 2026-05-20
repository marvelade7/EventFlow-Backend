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
                        select: "firstName lastName fullName name profilePic email",
                    },
                })
                .populate({ path: "user", select: "firstName lastName email" })
                .then((existingBookings) => {
                    // console.log(
                    //     "Existing bookings count:",
                    //     existingBookings.length,
                    // );

                    if (existingBookings.length > 0) {
                        // console.log(
                        //     "Bookings already exist, returning existing:",
                        //     {
                        //         count: existingBookings.length,
                        //         paymentStatus:
                        //             existingBookings[0].paymentStatus,
                        //     },
                        // );
                        return res.status(200).json({
                            message: "Payment already processed",
                            bookings: existingBookings,
                        });
                    }

                    payment.status = "success";
                    return payment
                        .save()
                        .then(() => {
                            // console.log("Payment status updated to success");
                            return handleBooking(payment);
                        })
                        .then((savedBookings) => {
                            // console.log("Bookings created:", {
                            //     count: savedBookings?.length,
                            // });
                            return Booking.find({ paymentReference: reference })
                                .sort({ createdAt: 1 })
                                .populate({
                                    path: "event",
                                    populate: {
                                        path: "createdBy",
                                        select: "firstName lastName fullName name profilePic, email",
                                    },
                                })
                                .populate({
                                    path: "user",
                                    select: "firstName lastName email",
                                });
                        })
                        .then((bookings) => {
                            // console.log("Found bookings after creation:", {
                            //     count: bookings.length,
                            //     bookings: bookings.map((b) => ({
                            //         ticketCode: b.ticketCode,
                            //         paymentStatus: b.paymentStatus,
                            //         paymentReference: b.paymentReference,
                            //     })),
                            // });

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
        .catch((err) => {
            // Handle sold out specifically
            if (err.message === "Sold out") {
                return res
                    .status(400)
                    .json({ message: "Sorry, tickets are sold out" });
            }
            if (err.message === "Ticket type not found") {
                return res
                    .status(404)
                    .json({ message: "Ticket type not found" });
            }
            // console.error("simulatePayment error:", err);
            res.status(500).json({ message: err.message });
        });
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
    const ticketCode = (req.body?.ticketCode || "")
        .toString()
        .trim()
        .toUpperCase();

    const currentUserId =
        req.user && (req.user.id || req.user._id || req.user.userId);

    if (!ticketCode) {
        return res.status(400).json({ message: "Ticket code is required" });
    }

    Booking.findOne({ ticketCode })
        .populate({
            path: "event",
            populate: {
                path: "createdBy",
                select: "_id firstName lastName",
            },
        })
        .populate({ path: "user" })
        .then((booking) => {
            if (!booking) {
                // console.log("Booking not found for ticketCode:", ticketCode);
                return res.status(404).json({ message: "Invalid ticket" });
            }

            // console.log("Booking found:", {
            //     ticketCode: booking.ticketCode,
            //     paymentStatus: booking.paymentStatus,
            //     paymentReference: booking.paymentReference,
            //     organizerId: booking.event.createdBy?._id,
            //     currentUserId,
            // });

            // Check if the event has a createdBy field
            if (!booking.event.createdBy) {
                // console.error(
                //     "Event missing createdBy field:",
                //     booking.event._id,
                // );
                return res
                    .status(500)
                    .json({ message: "Event configuration error" });
            }

            // console.log("CreatedBy check:", {
            //     organizerIdString: booking.event.createdBy._id.toString(),
            //     currentUserIdString: currentUserId,
            //     match: booking.event.createdBy._id.toString() === currentUserId,
            // });

            // Check if the scanner is the event organizer
            if (booking.event.createdBy._id.toString() !== currentUserId) {
                // console.log("Authorization failed - not event organizer");
                return res.status(403).json({
                    message:
                        "You are not authorized to check in attendees for this event",
                });
            }
            console.log("Authorization passed");

            if (booking.checkedIn || booking.status === "checked-in") {
                console.log("Ticket already checked in");
                return res.status(200).json({
                    message: "Ticket has already been used for check-in",
                    status: "checked-in",
                    booking,
                });
            }
            console.log("Already checked in check passed");

            if (booking.paymentStatus !== "paid") {
                console.log("Payment not paid. Status:", booking.paymentStatus);
                return res.status(400).json({ message: "Ticket is not paid" });
            }
            console.log("Payment status check passed");

            // Remove expiry check - organizers should be able to scan past events
            // if (booking.expiresAt && booking.expiresAt < new Date()) {
            //     console.log("Booking expired");
            //     return res.status(400).json({ message: "Booking has expired" });
            // }

            console.log(
                "All checks passed. Sending success response with booking:",
                { ticketCode: booking.ticketCode },
            );

            return Booking.countDocuments({
                paymentReference: booking.paymentReference,
            }).then((totalTickets) =>
                res.status(200).json({
                    message: "QR code is valid",
                    booking,
                    totalTickets, // e.g. 3
                }),
            );
        })
        .catch((err) => {
            console.error("verifyQr error:", err);
            res.status(500).json({ message: err.message });
        });
};

const checkIn = (req, res) => {
    const { ticketCode } = req.params;
    const currentUserId =
        req.user && (req.user.id || req.user._id || req.user.userId);

    Booking.findOne({ ticketCode })
        .populate({
            path: "event",
            populate: {
                path: "createdBy",
                select: "_id firstName lastName",
            },
        })
        .then((booking) => {
            if (!booking) {
                return res.status(404).json({ message: "Invalid Ticket" });
            }

            // Check if the scanner is the event organizer
            if (booking.event.createdBy._id.toString() !== currentUserId) {
                return res.status(403).json({
                    message:
                        "You are not authorized to check in attendees for this event",
                });
            }

            if (booking.checkedIn) {
                return res.status(400).json({ message: "Already checked in" });
            }

            booking.checkedIn = true;
            booking.status = "checked-in";
            booking.checkedInAt = new Date();

            return booking.save().then((savedBooking) =>
                res.status(200).json({
                    message: "Check-in successful",
                    booking: savedBooking,
                }),
            );
        })
        .catch((err) => {
            console.error("checkIn error:", err);
            res.status(500).json({ message: err.message });
        });
};

// Debug endpoint - list all bookings for current user
const getAllMyBookingsDebug = (req, res) => {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
        return res.status(401).json({ message: "User ID not found in token" });
    }

    return Booking.find({ user: userId })
        .select("ticketCode paymentStatus paymentReference createdAt")
        .sort({ createdAt: -1 })
        .limit(20)
        .then((bookings) => {
            // console.log("Debug - User's bookings:", {
            //     userId,
            //     count: bookings.length,
            //     bookings: bookings.map((b) => ({
            //         ticketCode: b.ticketCode,
            //         paymentStatus: b.paymentStatus,
            //         paymentReference: b.paymentReference,
            //         createdAt: b.createdAt,
            //     })),
            // });
            return res.status(200).json({
                message: "Debug bookings",
                count: bookings.length,
                bookings,
            });
        })
        .catch((err) => {
            // console.error("getAllMyBookingsDebug error:", err);
            res.status(500).json({ message: err.message });
        });
};

const getUserDashboardStats = (req, res) => {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
        return res.status(401).json({ message: "User ID not found in token" });
    }
    const now = new Date();

    return Booking.find({ user: userId, paymentStatus: "paid" })
        .populate({
            path: "event",
            populate: {
                path: "createdBy",
                select: "firstName lastName fullName name profilePic",
            },
        })
        .populate({ path: "user", select: "firstName lastName email" })
        .then((bookings) => {
            const seenUpcoming = {};
            const upcomingEvents = [];

            bookings.forEach((booking) => {
                if (booking.event && booking.event.startDateTime > now) {
                    const id = booking.event._id.toString();
                    if (!seenUpcoming[id]) {
                        seenUpcoming[id] = true;
                        upcomingEvents.push(booking.event);
                    }
                }
            });

            const activeTickets = bookings.filter(
                (booking) =>
                    booking.event &&
                    !booking.checkedIn &&
                    booking.event.endDateTime > now,
            );

            const seenAttendedEvents = {};
            const attendedEvents = [];

            bookings.forEach((booking) => {
                if (
                    booking.event &&
                    (booking.checkedIn || booking.event.endDateTime < now)
                ) {
                    const id = booking.event._id.toString();
                    if (!seenAttendedEvents[id]) {
                        seenAttendedEvents[id] = true;
                        attendedEvents.push(booking.event);
                    }
                }
            });
            return res.status(200).json({
                upcomingEventCount: upcomingEvents.length,
                activeTicketCount: activeTickets.length,
                attendedEventCount: attendedEvents.length,

                upcomingEvents,
                activeTickets,
                attendedEvents,
            });
        })
        .catch((err) => {
            // console.error("getUserDashboardStats error:", err);
            res.status(500).json({ message: err.message });
        });
};

module.exports = {
    checkAvailability,
    initializePayment,
    simulatePayment,
    getMyBookings,
    getMyEventBookings,
    verifyQr,
    checkIn,
    getAllMyBookingsDebug,
    getUserDashboardStats,
};
