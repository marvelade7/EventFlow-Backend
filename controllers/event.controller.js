const Event = require("../models/event.model");

const createEvent = (req, res) => {
    const {
        title,
        description,
        category,
        bannerImage,
        startDate,
        endDate,
        startTime,
        endTime,
        venue,
        location,
        isFree,
        ticketPrice,
        timeZone,
    } = req.body;

    const newEvent = new Event({
        title,
        description,
        category,
        bannerImage,
        startDate,
        endDate,
        startTime,
        endTime,
        venue,
        location,
        isFree: isFree ?? false,
        ticketPrice: isFree ? 0 : ticketPrice,
        timeZone,
    });

    if (!user.isVerified) {
        return res.status(403).json({
            message: "Email not verified. Please verify your email to create an event.",
        });
    }

    newEvent
        .save()
        .then((event) => {
            console.log(event);
            res.status(201).json({
                message: "Event created successfully 🎉",
                event,
            });
        })
        .catch((err) => {
            console.log(err);
            res.status(501).json({
                message: "Error creating event",
                error: err.message,
            });
        });
};

module.exports = { createEvent };
