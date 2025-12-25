const bookingService = require('../services/booking.service');

exports.create = async (req, res) => {
  try {
    const {
      tenant_id,
      lead_id,
      assigned_user_id,
      booking_type,
      booking_source,
      scheduled_at,
      created_by,
      timezone,
      notes,
      metadata
    } = req.body;

    if (!scheduled_at) {
      return res.status(400).json({ error: "scheduled_at is required" });
    }

    const booking = await bookingService.create({
      tenant_id,
      lead_id,
      assigned_user_id,
      booking_type,
      booking_source,
      scheduled_at,
      created_by,
      timezone,
      notes,
      metadata
    });

    res.status(201).json(booking);
  } catch (error) {
    console.error('[Booking Controller] Error creating booking:', error);
    res.status(400).json({
      error: 'Failed to create booking',
      details: error.message
    });
  }
};


exports.listByCounsellor = async (req, res) => {
  try {
    const bookings = await bookingService.getByCounsellor(req.params.counsellorId);
    res.json(bookings);
  } catch (error) {
    console.error('[Booking Controller] Error listing counsellor bookings:', error);
    res.status(500).json({
      error: 'Failed to fetch bookings',
      details: error.message,
    });
  }
};

exports.listByStudent = async (req, res) => {
  try {
    const bookings = await bookingService.getByStudent(req.params.studentId);
    res.json(bookings);
  } catch (error) {
    console.error('[Booking Controller] Error listing student bookings:', error);
    res.status(500).json({
      error: 'Failed to fetch bookings',
      details: error.message,
    });
  }
};

exports.listInRange = async (req, res) => {
  try {
    const { dayStart, dayEnd } = req.query;

    if (!dayStart || !dayEnd) {
      return res.status(400).json({
        error: 'dayStart and dayEnd query parameters are required',
      });
    }

    const bookings = await bookingService.getInRange(
      new Date(dayStart),
      new Date(dayEnd)
    );

    res.json(bookings);
  } catch (error) {
    console.error('[Booking Controller] Error listing bookings in range:', error);
    res.status(500).json({
      error: 'Failed to fetch bookings',
      details: error.message,
    });
  }
};

exports.getAvailability = async (req, res) => {
  try {
    const { userId, dayStart, dayEnd, slotMinutes = 5 } = req.query;

    if (!userId || !dayStart || !dayEnd) {
      return res.status(400).json({
        error: 'userId, dayStart, dayEnd are required'
      });
    }

    const slots = await bookingService.getAvailability({
      userId,
      dayStart: new Date(dayStart),
      dayEnd: new Date(dayEnd),
      slotMinutes: Number(slotMinutes)
    });

    res.json(slots);
  } catch (error) {
    console.error('[Booking Controller] Availability error:', error);
    res.status(500).json({
      error: 'Failed to fetch availability',
      details: error.message
    });
  }
};
