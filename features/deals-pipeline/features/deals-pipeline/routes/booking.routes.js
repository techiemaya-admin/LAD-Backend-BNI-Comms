const express = require('express');
const router = express.Router();
const { jwtAuth } = require('../middleware/auth');
const bookingController = require('../controllers/booking.controller');

// POST /api/deals-pipeline/bookings
router.post('/', jwtAuth, bookingController.create);

// GET /api/deals-pipeline/bookings/counsellor/:counsellorId
router.get('/counsellor/:counsellorId', jwtAuth, bookingController.listByCounsellor);

// GET /api/deals-pipeline/bookings/student/:studentId
router.get('/student/:studentId', jwtAuth, bookingController.listByStudent);

// GET /api/deals-pipeline/bookings/range?dayStart=...&dayEnd=...
router.get('/range', jwtAuth, bookingController.listInRange);

// GET availability slots
router.get(
  '/availability',
  jwtAuth,
  bookingController.getAvailability
);

module.exports = router;