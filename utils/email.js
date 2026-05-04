const sendUserEmail = (booking) => {
    console.log("📧 Email to USER");
    console.log("Ticket Code:", booking.ticketCode);
};

const sendOrganizerEmail = (booking) => {
    console.log("📧 Email to ORGANIZER");
    console.log("New booking received");
};

module.exports = {
    sendUserEmail,
    sendOrganizerEmail
};