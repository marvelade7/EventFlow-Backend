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

            // Parse stringified values (happens with FormData)
            const parsedIsFree =
                typeof isFree === "string" ? isFree === "true" : isFree;
            let parsedTicketTypes = [];

            if (ticketTypes && typeof ticketTypes === "string") {
                try {
                    parsedTicketTypes = JSON.parse(ticketTypes);
                } catch (e) {
                    console.error("Error parsing ticketTypes:", e);
                    parsedTicketTypes = [];
                }
            } else if (Array.isArray(ticketTypes)) {
                parsedTicketTypes = ticketTypes;
            }

            if (!req.file) {
                return res.status(400).json({
                    message: "Banner image is required",
                });
            }

            // Validate ticket types if event is not free
            if (
                !parsedIsFree &&
                (!parsedTicketTypes || parsedTicketTypes.length === 0)
            ) {
                return res.status(400).json({
                    message: "Ticket types are required for paid events",
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
                        isFree: parsedIsFree,
                        ticketTypes: parsedIsFree ? [] : parsedTicketTypes,
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

const getAllEvents = (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    return Event.find()
        .populate("createdBy", "firstName lastName profilePic")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .then((events) => {
            return Event.countDocuments().then((total) => {
                return res.status(200).json({
                    message: "Events retrieved successfully",
                    events,
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalEvents: total,
                });
            });
        })
        .catch((err) => {
            console.error(err);
            return res.status(500).json({
                message: "Error retrieving events",
                error: err.message,
            });
        });
};

const getEventById = (req, res) => {
    const eventId = req.params.eventId;

    if (!eventId) {
        return res.status(400).json({
            message: "Event id is required",
        });
    }

    return Event.findById(eventId)
        .populate("createdBy", "firstName lastName profilePic")
        .then((event) => {
            if (!event) {
                return res.status(404).json({
                    message: "Event not found",
                });
            }

            return res.status(200).json({
                message: "Event retrieved successfully",
                event,
            });
        })
        .catch((err) => {
            console.error(err);
            if (err.name === "CastError") {
                return res.status(400).json({
                    message: "Invalid event ID",
                });
            }
            return res.status(500).json({
                message: "Error retrieving event",
                error: err.message,
            });
        });
};

const getEventsByUserId = (req, res) => {
    const userId =
        req.params.userId ||
        req.query.userId ||
        (req.user && (req.user.id || req.user._id || req.user.userId));

    if (!userId) {
        return res.status(400).json({
            message: "User ID is required",
        });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    return Event.find({ createdBy: userId })
        .populate("createdBy", "firstName lastName profilePic")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .then((events) => {
            return Event.countDocuments({ createdBy: userId }).then((total) => {
                return res.status(200).json({
                    message: "Events retrieved successfully",
                    events,
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalEvents: total,
                });
            });
        })
        .catch((err) => {
            console.error(err);
            if (err.name === "CastError") {
                return res.status(400).json({
                    message: "Invalid user ID",
                });
            }
            return res.status(500).json({
                message: "Error retrieving events",
                error: err.message,
            });
        });
};

const updateEvent = (req, res) => {
    const userId = req.user && (req.user.id || req.user._id || req.user.userId);
    const eventId = req.params.eventId;
    // console.log("Updating event with ID:", eventId, "by user:", userId);

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (!eventId) {
        return res.status(400).json({ message: "Event ID is required" });
    }

    return Event.findById(eventId)
        .then((event) => {
            if (!event) {
                return res.status(404).json({ message: "Event not found" });
            }

            if (event.createdBy.toString() !== userId) {
                return res.status(403).json({ message: "Forbidden" });
            }

            const updateData = { ...req.body };
            // console.log('Updated Data: ' + JSON.stringify(updateData));

            if (typeof updateData.isFree === "string") {
                updateData.isFree = updateData.isFree === "true";
            }

            if (
                updateData.ticketTypes &&
                typeof updateData.ticketTypes === "string"
            ) {
                try {
                    updateData.ticketTypes = JSON.parse(updateData.ticketTypes);
                } catch (e) {
                    updateData.ticketTypes = [];
                }
            }

            if (
                updateData.location &&
                typeof updateData.location === "string"
            ) {
                try {
                    updateData.location = JSON.parse(updateData.location);
                } catch (e) {
                    updateData.location = {};
                }
            }

            if (updateData.startDate && updateData.startTime) {
                updateData.startDateTime = new Date(
                    `${updateData.startDate}T${updateData.startTime}`,
                );
            }

            if (updateData.endDate && updateData.endTime) {
                updateData.endDateTime = new Date(
                    `${updateData.endDate}T${updateData.endTime}`,
                );
            }

            delete updateData.startDate;
            delete updateData.startTime;
            delete updateData.endDate;
            delete updateData.endTime;

            if (req.file) {
                return uploadToCloudinary(
                    req.file.buffer,
                    "event_banners",
                ).then((result) => {
                    updateData.bannerImage = result.secure_url;
                    return Event.findByIdAndUpdate(eventId, updateData, {
                        new: true,
                    });
                });
            } else {
                return Event.findByIdAndUpdate(eventId, updateData, {
                    new: true,
                });
            }
        })
        .then((updatedEvent) => {
            if (!updatedEvent) {
                return res.status(404).json({ message: "Event not found" });
            }

            return res.status(200).json({
                message: "Event updated successfully",
                event: updatedEvent,
            });
        })
        .catch((err) => {
            console.error(err);
            if (err.name === "CastError") {
                return res.status(400).json({ message: "Invalid event ID" });
            }
            return res.status(500).json({
                message: "Error updating event",
                error: err.message,
            });
        });
};

const deleteEvent = (req, res) => {
    const userId = req.user && (req.user.id || req.user._id || req.user.userId);
    const eventId = req.params.eventId;

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (!eventId) {
        return res.status(400).json({ message: "Event ID is required" });
    }

    Event.findByIdAndDelete(eventId)
        .then((deletedEvent) => {
            if (!deletedEvent) {
                return res.status(404).json({ message: "Event not found" });
            }

            if (deletedEvent.createdBy.toString() !== userId) {
                return res.status(403).json({ message: "Forbidden" });
            }

            return res.status(200).json({
                message: "Event deleted successfully",
            });
        })
        .catch((err) => {
            console.error(err);
            if (err.name === "CastError") {
                return res.status(400).json({ message: "Invalid event ID" });
            }
            return res.status(500).json({
                message: "Error deleting event",
                error: err.message,
            });
        });
};

module.exports = {
    createEvent,
    getAllEvents,
    getEventById,
    getEventsByUserId,
    updateEvent,
    deleteEvent,
};
