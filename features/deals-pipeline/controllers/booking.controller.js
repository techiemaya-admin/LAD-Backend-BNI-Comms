const bookingService = require('../services/booking.service');

// Try core paths first, fallback to local shared
let getTenantContext, logger;
try {
  ({ getTenantContext } = require('../../../../core/utils/schemaHelper'));
  logger = require('../../../../core/utils/logger');
} catch (e) {
  ({ getTenantContext } = require('../../../shared/utils/schemaHelper'));
  logger = require('../../../shared/utils/logger');
}

exports.create = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    const {
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
      schema,
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
    logger.error('Error creating booking', error, { leadId: req.body.lead_id });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    res.status(400).json({
      error: 'Failed to create booking',
      details: error.message
    });
  }
};


exports.listByCounsellor = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    const bookings = await bookingService.getByCounsellor(req.params.counsellorId, tenant_id, schema);
    res.json(bookings);
  } catch (error) {
    logger.error('Error listing counsellor bookings', error, { counsellorId: req.params.counsellorId });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({
      error: 'Failed to fetch bookings',
      details: error.message,
    });
  }
};

exports.listByStudent = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    const bookings = await bookingService.getByStudent(req.params.studentId, tenant_id, schema);
    res.json(bookings);
  } catch (error) {
    logger.error('Error listing student bookings', error, { studentId: req.params.studentId });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({
      error: 'Failed to fetch bookings',
      details: error.message,
    });
  }
};

exports.listInRange = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const { dayStart, dayEnd } = req.query;

    if (!dayStart || !dayEnd) {
      return res.status(400).json({
        error: 'dayStart and dayEnd query parameters are required',
      });
    }

    const bookings = await bookingService.getInRange(
      new Date(dayStart),
      new Date(dayEnd),
      tenant_id,
      schema
    );

    res.json(bookings);
  } catch (error) {
    logger.error('Error listing bookings in range', error, { dayStart: req.query.dayStart, dayEnd: req.query.dayEnd });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({
      error: 'Failed to fetch bookings',
      details: error.message,
    });
  }
};

exports.getAvailability = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
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
      slotMinutes: Number(slotMinutes),
      tenant_id,
      schema
    });

    res.json(slots);
  } catch (error) {
    logger.error('Availability error', error, { userId: req.query.userId });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({
      error: 'Failed to fetch availability',
      details: error.message
    });
  }
};
