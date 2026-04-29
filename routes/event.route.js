const express = require('express');
const { createEvent, getAllEvents, getEventById } = require('../controllers/event.controller');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const authMiddleware = require('../middlewares/auth.middleware');
const router = express.Router()

router.post('/create-event', authMiddleware, upload.single("banner"), createEvent)
router.get('/get-event/:id', getEventById)
router.get('/get-events', getAllEvents)

module.exports = router