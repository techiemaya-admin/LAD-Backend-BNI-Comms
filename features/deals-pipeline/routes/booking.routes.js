const express = require('express');
const router = express.Router();
const { validateBookingCreate } = require('../validators/booking.validator');
const { validateUUIDParam } = require('../validators/common.validator');
const bookingController = require('../controllers/booking.controller');

// POST /api/deals-pipeline/bookings
router.post('/', validateBookingCreate, bookingController.create);

// GET /api/deals-pipeline/bookings/counsellor/:counsellorId
router.get('/counsellor/:counsellorId', validateUUIDParam('counsellorId'), bookingController.listByCounsellor);

// GET /api/deals-pipeline/bookings/student/:studentId
router.get('/student/:studentId', validateUUIDParam('studentId'), bookingController.listByStudent);

// GET /api/deals-pipeline/bookings/range?dayStart=...&dayEnd=...
router.get('/range', bookingController.listInRange);

// GET availability slots
router.get(
  '/availability',
  bookingController.getAvailability
);

module.exports = router;