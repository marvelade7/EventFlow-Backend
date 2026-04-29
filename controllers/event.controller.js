const Event = require("../models/event.model");
const Customer = require("../models/user.model");
const uploadToCloudinary = require("../utils/uploadToCloudinary");

const createEvent = (req, res) => {
    const userId = req.user && (req.user.id || req.user._id || req.user.userId);

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    return Customer.findById(userId)
        .then((user) => {
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            if (!user.isVerified) {
                return res.status(403).json({
                    message:
                        "User not verified. Please verify your email to create an event.",
                });
            }

            const {
                title,
                description,
                category,
                startDate,
                endDate,
                startTime,
                endTime,
                venue,
                address,
                city,
                country,
                isFree,
                ticketTypes,
                timeZone,
            } = req.body;

            if (!req.file) {
                return res.status(400).json({
                    message: "Banner image is required",
                });
            }

            return uploadToCloudinary(req.file.buffer, "event_banners").then(
                (result) => {
                    const bannerImageUrl = result.secure_url;
                    const startDateTime = new Date(`${startDate}T${startTime}`);
                    const endDateTime = new Date(`${endDate}T${endTime}`);

                    const newEvent = new Event({
                        title,
                        description,
                        category,
                        bannerImage: bannerImageUrl,
                        startDateTime,
                        endDateTime,
                        timeZone,
                        location: {
                            venue,
                            address,
                            city,
                            country,
                        },
                        isFree: isFree ?? false,
                        ticketTypes: isFree ? [] : ticketTypes,
                        createdBy: userId,
                    });

                    return newEvent.save();
                },
            );
        })
        .then((savedEvent) => {
            if (!savedEvent) {
                return;
            }

            return res.status(201).json({
                message: "Event created successfully",
                event: savedEvent,
            });
        })
        .catch((err) => {
            console.error(err);
            return res.status(500).json({
                message: "Error creating event",
                error: err.message,
            });
        });
};

module.exports = { createEvent };