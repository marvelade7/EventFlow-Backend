const express = require("express");
const {
    createEvent,
    getAllEvents,
    getEventById,
    getEventsByUserId,
    deleteEvent,
    updateEvent,
    getTotalEvents,
} = require("../controllers/event.controller");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const authMiddleware = require("../middlewares/auth.middleware");
const router = express.Router();

router.post(
    "/create-event",
    authMiddleware,
    upload.single("banner"),
    createEvent,
);
router.get("/user/:userId/events", getEventsByUserId);
router.get("/get-events/:eventId", getEventById);
router.get("/get-events", getAllEvents);
router.get("/get-events-by-user", authMiddleware, getEventsByUserId);
router.patch(
    "/update-event/:eventId",
    authMiddleware,
    upload.single("banner"),
    updateEvent,
);
router.delete("/delete-event/:eventId", authMiddleware, deleteEvent);
router.get("/total-events", getTotalEvents);

module.exports = router;
