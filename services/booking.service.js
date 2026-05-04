const Event = require("../models/Event");
const Booking = require("../models/bookings.model");
const { generateTicketID } = require("../utils/ticketGenerator");

const handleBooking = (payment) => {

    return Event.findById(payment.event)
        .then((event) => {

            if (!event) {
                throw new Error("Event not found");
            }

            const ticket = event.ticketTypes.find(
                (t) => t.name === payment.ticketType
            );

            if (!ticket) {
                throw new Error("Ticket type not found");
            }

            const available = ticket.quantity - ticket.sold;

            if (available <= 0) {
                throw new Error("Sold out");
            }

            ticket.sold += 1;

            return event.save()
                .then(() => {
                    const booking = new Booking({
                        user: payment.user,
                        event: payment.event,
                        ticketTypeName: payment.ticketType,
                        paymentStatus: "paid",
                        ticketCode: generateTicketID(),
                        qrCode: "generated-later",
                        expiresAt: new Date()
                    });

                    return booking.save();
                });
        });
};

module.exports = {
    handleBooking
};