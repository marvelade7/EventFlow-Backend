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
        price,
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
        price: isFree ? 0 : price,
        timeZone,
    });

    newEvent.save().then((event) => {
        console.log(event)
        res.status(201).json({
            message: "Event created successfully 🎉",
            event,
        });
    })
    .catch((err) => {
        console.log(err)
        res.status(501).json({
            message: 'Error creating event',
            error: err.message
        })
    })
};

module.exports = { createEvent }