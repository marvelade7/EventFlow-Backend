const express = require('express');
const { createEvent } = require('../controllers/event.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const router = express.Router()

router.post('/create-event', authMiddleware, createEvent)

module.exports = router