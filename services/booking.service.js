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

            const ticket = event.ticketTypes.find((t) => t.name === payment.ticketType);

            if (!ticket) {
                throw new Error("Ticket type not found");
            }

            const available = Number(ticket.quantity || 0) - Number(ticket.sold || 0);

            if (available < quantity) {
                throw new Error("Sold out");
            }

            ticket.sold += quantity;
            return event.save().then(() => {
                const bookings = Array.from({ length: quantity }, () => (
                    new Booking({
                        user: payment.user,
                        event: payment.event,
                        ticketTypeName: payment.ticketType,
                        paymentStatus: "paid",
                        paymentReference: payment.reference,
                        ticketCode: generateTicketID(),
                        qrCode: "generated-later",
                        expiresAt: event.endDateTime || undefined,
                    })
                ));

                return Promise.all(bookings.map((booking) => booking.save()));
            });
        });
};

module.exports = {
    handleBooking
};