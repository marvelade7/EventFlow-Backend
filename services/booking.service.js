const Event = require("../models/event.model");
const Booking = require("../models/bookings.model");
const { generateTicketID } = require("../utils/ticketGenerator");

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

            return Promise.all(bookings.map((booking) => booking.save()));
        });
};

module.exports = {
    handleBooking,
};
