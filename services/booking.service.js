const Event = require("../models/event.model");
const Booking = require("../models/bookings.model");
const User = require("../models/user.model");
const { generateTicketID } = require("../utils/ticketGenerator");
const QRcode = require("qrcode");
const crypto = require("crypto");

const handleBooking = (payment) => {
    const quantity = Math.max(1, Number(payment.quantity || 1));
    return Event.findById(payment.event)
        .then((event) => {
            if (!event) {
                throw new Error("Event not found");
            }

            const requestedName = (payment.ticketType || "").toString().trim().toLowerCase();
            let ticket = (event.ticketTypes || []).find((t) => {
                const name = (t && t.name) ? t.name.toString().trim().toLowerCase() : "";
                return requestedName && name === requestedName;
            });

            // If ticket type not found, allow booking for free events by creating
            // a placeholder ticket object. For paid events, throw an error.
            const ticketFromEvent = Boolean(ticket);
            if (!ticket) {
                if (event.isFree) {
                    ticket = {
                        name:
                            payment.ticketType ||
                            (event.ticketTypes[0] &&
                                event.ticketTypes[0].name) ||
                            "Free",
                        quantity: Number.POSITIVE_INFINITY,
                        sold: 0,
                    };
                } else {
                    throw new Error("Ticket type not found");
                }
            }

            const available =
                Number(ticket.quantity || 0) - Number(ticket.sold || 0);

            if (available < quantity) {
                throw new Error("Sold out");
            }

            // Only increment sold on the real ticket stored on the event document
            if (ticketFromEvent) {
                ticket.sold += quantity;
                return event.save().then(() => event);
            }

            // For free events with a placeholder ticket, skip saving the event
            // and proceed to create bookings immediately.
            // Return the event so the next then() has access to it.
            return Promise.resolve(event);
        })
        .then((event) => {
            const ticketName =
                payment.ticketType ||
                (event.ticketTypes[0] && event.ticketTypes[0].name) ||
                "Free";

            // Load user details to include in the QR payload
            return User.findById(payment.user)
                .then((user) => {
                    const bookings = Array.from(
                        { length: quantity },
                        () =>
                            new Booking({
                                user: payment.user,
                                event: payment.event,
                                ticketTypeName: ticketName,
                                paymentStatus: "paid",
                                paymentReference: payment.reference,
                                ticketCode: generateTicketID(),
                                qrCode: null,
                                expiresAt: event.endDateTime || undefined,
                            }),
                    );

                    // Generate QR code Data URLs for each booking and save
                    return Promise.all(
                        bookings.map((booking) => {
                            const userName = (user && (user.firstName || user.name)) ? `${user.firstName || user.name}${user.lastName ? ` ${user.lastName}` : ''}` : 'User';
                            const userEmail = (user && user.email) || 'N/A';
                            const eventTitle = event.title || 'Event';
                            const checkedIn = booking.status === 'checked-in' ? 'Yes' : 'No';

                            const ticketData = {
                                ticketCode: booking.ticketCode,
                                userName,
                                userEmail,
                                event: eventTitle,
                                checkedIn,
                            };

                            const payloadString = JSON.stringify(ticketData);
                            const secret = process.env.QR_HMAC_SECRET || "dev_secret";
                            const signature = crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
                            const envelope = { payload: ticketData, signature };
                            const envelopeString = JSON.stringify(envelope);

                            return QRcode.toDataURL(envelopeString)
                                .then((dataUrl) => {
                                    booking.qrCode = dataUrl;
                                    booking.qrSignature = signature;
                                    return booking.save();
                                })
                                .catch((err) => {
                                    booking.qrCode = null;
                                    booking.qrSignature = null;
                                    return booking.save();
                                });
                        }),
                    );
                });
        });
};

module.exports = {
    handleBooking,
};
