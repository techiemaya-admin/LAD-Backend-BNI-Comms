const express = require('express');
const router = express.Router();
const { validateBookingCreate } = require('../validators/booking.validator');
const { validateUUIDParam } = require('../validators/common.validator');
const bookingController = require('../controllers/booking.controller');
const { authenticateToken: jwtAuth } = require('../../../core/middleware/auth');

// POST /api/deals-pipeline/bookings
router.post('/', jwtAuth, validateBookingCreate, bookingController.create);

// GET /api/deals-pipeline/bookings?leadId=...&date=...
router.get('/', jwtAuth, bookingController.list);

// GET availability slots (must come before /:id route)
router.get('/availability', jwtAuth, bookingController.getAvailability);

// GET /api/deals-pipeline/bookings/counsellor/:counsellorId
router.get('/counsellor/:counsellorId', jwtAuth, validateUUIDParam('counsellorId'), bookingController.listByCounsellor);

// GET /api/deals-pipeline/bookings/student/:studentId
router.get('/student/:studentId', jwtAuth, validateUUIDParam('studentId'), bookingController.listByStudent);

// GET /api/deals-pipeline/bookings/range?dayStart=...&dayEnd=...
router.get('/range', jwtAuth, bookingController.listInRange);

// DELETE /api/deals-pipeline/bookings/:id/followup
router.delete('/:id/followup', jwtAuth, validateUUIDParam('id'), bookingController.deleteFollowup);

// GET /api/deals-pipeline/bookings/:id (must come after specific routes)
router.get('/:id', jwtAuth, validateUUIDParam('id'), bookingController.getById);

module.exports = router;