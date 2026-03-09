const bookingService = require('../services/booking.service');
const leadService = require('../services/lead.service');

// Use core utils in LAD architecture
const { getTenantContext } = require('../../../core/utils/schemaHelper');
const logger = require('../../../core/utils/logger');
const { isValidUUID } = require('../validators/common.validator');
const { ERROR_RESPONSES } = require('../../../core/constants/errorConstants');

exports.create = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    logger.info('BookingController received booking request', {
      leadId: req.body.lead_id,
      assignedUserId: req.body.assigned_user_id,
      tenantId: tenant_id,
      schema
    });

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

    // Validate required fields
    if (!lead_id || !isValidUUID(lead_id)) {
      logger.warn('BookingController validation failed: Invalid lead_id', { lead_id, tenant_id });
      const { response, status } = ERROR_RESPONSES.VALIDATION_FAILED('Valid lead_id (UUID) is required');
      return res.status(status).json(response);
    }
    if (!assigned_user_id || !isValidUUID(assigned_user_id)) {
      logger.warn('BookingController validation failed: Invalid assigned_user_id', { assigned_user_id, tenant_id });
      const { response, status } = ERROR_RESPONSES.VALIDATION_FAILED('Valid assigned_user_id (UUID) is required');
      return res.status(status).json(response);
    }
    if (!scheduled_at) {
      logger.warn('BookingController validation failed: Missing scheduled_at', { tenant_id });
      const { response, status } = ERROR_RESPONSES.VALIDATION_FAILED('scheduled_at is required');
      return res.status(status).json(response);
    }
    if (!created_by || !isValidUUID(created_by)) {
      logger.warn('BookingController validation failed: Invalid created_by', { created_by, tenant_id });
      const { response, status } = ERROR_RESPONSES.VALIDATION_FAILED('Valid created_by (UUID) is required');
      return res.status(status).json(response);
    }

    // Ensure lead is assigned to the user before creating booking
    // This prevents the database trigger from failing
    try {
      const lead = await leadService.getById(lead_id, tenant_id, schema);
      
      if (!lead) {
        logger.warn('BookingController lead not found', { lead_id, tenant_id });
        const { response, status } = ERROR_RESPONSES.LEAD_NOT_FOUND();
        return res.status(status).json(response);
      }
      
      // If lead is not assigned to the user, assign it
      if (lead.assigned_user_id !== assigned_user_id) {
        logger.info('BookingController assigning lead to user before booking', { 
          lead_id, 
          currentAssigned: lead.assigned_user_id, 
          newAssigned: assigned_user_id,
          tenant_id
        });
        
        await leadService.update(lead_id, tenant_id, {
          assigned_user_id: assigned_user_id,
          assigned_at: new Date().toISOString()
        }, schema);
        
        logger.info('BookingController lead successfully assigned to user', { lead_id, assigned_user_id, tenant_id });
      }
    } catch (leadError) {
      logger.error('BookingController error handling lead assignment', {
        error: leadError.message,
        lead_id,
        assigned_user_id,
        tenant_id
      });
      const { response, status } = ERROR_RESPONSES.DATABASE_ERROR('Failed to assign lead');
      return res.status(status).json(response);
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
    logger.error('Error creating booking', error, { 
      leadId: req.body.lead_id,
      body: req.body 
    });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: error.message });
    }
    res.status(400).json({
      error: 'Failed to create booking',
      details: error.message
    });
  }
};

// GET /api/deals-pipeline/bookings/:id
exports.getById = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'Booking ID is required'
      });
    }

    const booking = await bookingService.getById(id, tenant_id, schema);

    if (!booking) {
      return res.status(404).json({
        error: 'Booking not found'
      });
    }

    res.json(booking);
  } catch (error) {
    logger.error('Get booking by ID error', {
      error: error.message,
      bookingId: req.params.id,
      stack: error.stack
    });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      const { response, status } = ERROR_RESPONSES.TENANT_ACCESS_DENIED();
      return res.status(status).json(response);
    }
    const { response, status } = ERROR_RESPONSES.DATABASE_ERROR('Failed to fetch booking');
    res.status(status).json(response);
  }
};

// GET /api/deals-pipeline/bookings?leadId=...&date=...
exports.list = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const { leadId, lead_id, date, counsellorId, studentId } = req.query;

    // Use leadId or lead_id (frontend sends both)
    const effectiveLeadId = leadId || lead_id;
    
    let bookings = [];
    
    if (effectiveLeadId && date) {
      // Get bookings for specific lead and date
      bookings = await bookingService.getByLeadAndDate(effectiveLeadId, date, tenant_id, schema);
    } else if (effectiveLeadId) {
      // Get all bookings for a lead
      bookings = await bookingService.getByLead(effectiveLeadId, tenant_id, schema);
    } else if (counsellorId) {
      // Get bookings by counsellor
      bookings = await bookingService.getByCounsellor(counsellorId, tenant_id, schema);
    } else if (studentId) {
      // Get bookings by student
      bookings = await bookingService.getByStudent(studentId, tenant_id, schema);
    } else {
      return res.status(400).json({
        error: 'At least one filter is required: leadId, counsellorId, or studentId'
      });
    }

    res.json(bookings);
  } catch (error) {
    logger.error('Error listing bookings', {
      error: error.message,
      query: req.query,
      stack: error.stack
    });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      const { response, status } = ERROR_RESPONSES.TENANT_ACCESS_DENIED();
      return res.status(status).json(response);
    }
    const { response, status } = ERROR_RESPONSES.DATABASE_ERROR('Failed to fetch bookings');
    res.status(status).json(response);
  }
};

exports.listByCounsellor = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    const bookings = await bookingService.getByCounsellor(req.params.counsellorId, tenant_id, schema);
    res.json(bookings);
  } catch (error) {
    logger.error('Error listing counsellor bookings', {
      error: error.message,
      counsellorId: req.params.counsellorId,
      stack: error.stack
    });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      const { response, status } = ERROR_RESPONSES.TENANT_ACCESS_DENIED();
      return res.status(status).json(response);
    }
    const { response, status } = ERROR_RESPONSES.DATABASE_ERROR('Failed to fetch bookings');
    res.status(status).json(response);
  }
};

exports.listByStudent = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    const bookings = await bookingService.getByStudent(req.params.studentId, tenant_id, schema);
    res.json(bookings);
  } catch (error) {
    logger.error('Error listing student bookings', {
      error: error.message,
      studentId: req.params.studentId,
      stack: error.stack
    });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      const { response, status } = ERROR_RESPONSES.TENANT_ACCESS_DENIED();
      return res.status(status).json(response);
    }
    const { response, status } = ERROR_RESPONSES.DATABASE_ERROR('Failed to fetch bookings');
    res.status(status).json(response);
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
    logger.error('Error listing bookings in range', {
      error: error.message,
      dayStart: req.query.dayStart,
      dayEnd: req.query.dayEnd,
      stack: error.stack
    });
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      const { response, status } = ERROR_RESPONSES.TENANT_ACCESS_DENIED();
      return res.status(status).json(response);
    }
    const { response, status } = ERROR_RESPONSES.DATABASE_ERROR('Failed to fetch bookings');
    res.status(status).json(response);
  }
};

exports.getAvailability = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const { 
      userId, 
      dayStart, 
      dayEnd, 
      slotMinutes = 15,
      businessHoursStart,
      businessHoursEnd,
      timezone = 'UTC'
    } = req.query;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required'
      });
    }

    // Validate userId format - allow both UUID and numeric IDs
    const isValidUUID = (id) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(id);
    };
    
    const isNumericId = (id) => {
      return /^\d+$/.test(id);
    };

    if (!isValidUUID(userId) && !isNumericId(userId)) {
      return res.status(400).json({
        error: 'userId must be a valid UUID or numeric ID'
      });
    }

    // If dayStart/dayEnd not provided, use business hours for current date
    let effectiveDayStart, effectiveDayEnd;
    
    if (dayStart && dayEnd) {
      effectiveDayStart = new Date(dayStart);
      effectiveDayEnd = new Date(dayEnd);
    } else {
      // Use current date with business hours
      const today = new Date().toISOString().split('T')[0];
      const startTime = businessHoursStart || '09:00';
      const endTime = businessHoursEnd || '18:00';
      
      effectiveDayStart = new Date(`${today}T${startTime}:00Z`);
      effectiveDayEnd = new Date(`${today}T${endTime}:00Z`);
    }

    logger.info('BookingController availability request', {
      userId,
      dayStart: effectiveDayStart.toISOString(),
      dayEnd: effectiveDayEnd.toISOString(),
      businessHoursStart,
      businessHoursEnd,
      timezone,
      slotMinutes
    });

    const slots = await bookingService.getAvailability({
      userId,
      dayStart: effectiveDayStart,
      dayEnd: effectiveDayEnd,
      slotMinutes: Number(slotMinutes),
      timezone,
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

// DELETE /api/deals-pipeline/bookings/:id/followup
exports.deleteFollowup = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'Booking ID is required'
      });
    }

    logger.info('BookingController deleting followup booking', {
      bookingId: id,
      tenantId: tenant_id,
      schema
    });

    const deletedBooking = await bookingService.deleteFollowup(id, tenant_id, schema);

    logger.info('BookingController followup booking deleted successfully', {
      bookingId: id,
      tenantId: tenant_id
    });

    res.json({
      success: true,
      message: 'Followup booking deleted successfully',
      data: deletedBooking
    });
  } catch (error) {
    logger.error('Delete followup booking error', {
      error: error.message,
      bookingId: req.params.id,
      stack: error.stack
    });
    
    if (error.code === 'TENANT_CONTEXT_MISSING') {
      const { response, status } = ERROR_RESPONSES.TENANT_ACCESS_DENIED();
      return res.status(status).json(response);
    }
    
    if (error.message.includes('not found or tenant mismatch')) {
      return res.status(404).json({
        error: 'Followup booking not found'
      });
    }
    
    const { response, status } = ERROR_RESPONSES.DATABASE_ERROR('Failed to delete followup booking');
    res.status(status).json(response);
  }
};
