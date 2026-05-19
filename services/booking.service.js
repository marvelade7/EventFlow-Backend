const Event = require("../models/event.model");
const Booking = require("../models/bookings.model");
const { generateTicketID } = require("../utils/ticketGenerator");

const handleBooking = (payment) => {
    const quantity = Math.max(1, Number(payment.quantity || 1));
    console.log("handleBooking called with:", { paymentId: payment._id, quantity, ticketType: payment.ticketType });
    
    return Event.findById(payment.event)
        .then((event) => {
            if (!event) {
                throw new Error("Event not found");
            }

            console.log("Event found:", { eventId: event._id, title: event.title, isFree: event.isFree });

            const requestedName = (payment.ticketType || "").toString().trim().toLowerCase();
            let ticket = (event.ticketTypes || []).find((t) => {
                const name = (t && t.name) ? t.name.toString().trim().toLowerCase() : "";
                return requestedName && name === requestedName;
            });

            console.log("Ticket type lookup:", { requested: payment.ticketType, found: ticket?.name });

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

            console.log("Availability check:", { requested: quantity, available });

            if (available < quantity) {
                throw new Error("Sold out");
            }

            // Only increment sold on the real ticket stored on the event document
            if (ticketFromEvent) {
                ticket.sold += quantity;
                return event.save().then(() => {
                    console.log("Event updated with sold count");
                    return event;
                });
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
                        expiresAt: event.endDateTime || undefined,
                        
                    }),
            );

            console.log("Creating bookings:", { count: bookings.length, paymentStatus: "paid" });

            return Promise.all(bookings.map((booking) => {
                console.log("Saving booking:", { ticketCode: booking.ticketCode, paymentStatus: booking.paymentStatus });
                return booking.save().then(saved => {
                    console.log("Booking saved:", { ticketCode: saved.ticketCode, paymentStatus: saved.paymentStatus });
                    return saved;
                });
            }));
        })
        .catch((err) => {
            console.error("handleBooking error:", err);
            throw err;
        });
};

module.exports = {
    handleBooking,
};
