const express = require('express');
const { createEvent } = require('../controllers/event.controller');
const router = express.Router()

router.post('/create-event', createEvent)

module.exports = router