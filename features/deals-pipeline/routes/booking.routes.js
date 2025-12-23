const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');

// POST /api/deals-pipeline/bookings
router.post('/', bookingController.create);

// GET /api/deals-pipeline/bookings/counsellor/:counsellorId
router.get('/counsellor/:counsellorId', bookingController.listByCounsellor);

// GET /api/deals-pipeline/bookings/student/:studentId
router.get('/student/:studentId', bookingController.listByStudent);

// GET /api/deals-pipeline/bookings/range?dayStart=...&dayEnd=...
router.get('/range', bookingController.listInRange);

// GET availability slots
router.get('/availability', bookingController.getAvailability);

module.exports = router;