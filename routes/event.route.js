const express = require('express');
const { createEvent, getAllEvents, getEventById, getEventsByUserId } = require('../controllers/event.controller');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const authMiddleware = require('../middlewares/auth.middleware');
const router = express.Router()

router.post('/create-event', authMiddleware, upload.single("banner"), createEvent)
router.get('/user/:userId/events', getEventsByUserId)
router.get('/get-events/:id', getEventById)
router.get('/get-events', getAllEvents)
router.get('/get-events-by-user', authMiddleware, getEventsByUserId)

module.exports = router