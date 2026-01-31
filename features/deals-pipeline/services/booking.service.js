const BookingModel = require('../repositories/booking.pg');
const FollowUpSchedulerService = require('./followUpSchedulerService');
const { pool } = require('../../../shared/database/connection');
const logger = require('../../../core/utils/logger');

exports.create = async (data) => {
  const { tenant_id, schema, booking_type, scheduled_at, lead_id, assigned_user_id } = data;
  if (!tenant_id) {
    throw new Error('tenant_id is required for create booking');
  }
  
  // Create the booking first
  const booking = await BookingModel.createBooking(data, schema);
  
  // Schedule follow-up cloud task if applicable
  try {
    const scheduler = new FollowUpSchedulerService(pool);
    const scheduleResult = await scheduler.scheduleFollowUpCall({
      tenantId: tenant_id,
      bookingId: booking.id,
      leadId: lead_id,
      assignedUserId: assigned_user_id,
      scheduledAt: scheduled_at,
      bookingType: booking_type,
      schema: schema
    });
    
    logger.info('BookingService follow-up scheduling completed', {
      bookingId: booking.id,
      leadId: lead_id,
      result: scheduleResult
    });
  } catch (error) {
    logger.error('BookingService failed to schedule follow-up call', {
      error: error.message,
      bookingId: booking.id,
      leadId: lead_id
    });
    // Don't fail booking creation if cloud task fails
  }
  
  return booking;
};

exports.getByCounsellor = async (counsellorId, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getByCounsellor');
  }
  return await BookingModel.getBookingsByCounsellor(counsellorId, tenant_id, schema);
};

exports.getByStudent = async (studentId, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getByStudent');
  }
  return await BookingModel.getStudentBookings(studentId, tenant_id, schema);
};

exports.getByLead = async (leadId, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getByLead');
  }
  return await BookingModel.getLeadBookings(leadId, tenant_id, schema);
};

exports.getByLeadAndDate = async (leadId, date, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getByLeadAndDate');
  }
  return await BookingModel.getLeadBookingsByDate(leadId, date, tenant_id, schema);
};

exports.getInRange = async (dayStart, dayEnd, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getInRange');
  }
  return await BookingModel.getAllBookingsInRange(dayStart, dayEnd, tenant_id, schema);
};

exports.getById = async (bookingId, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getById');
  }
  return await BookingModel.getBookingById(bookingId, tenant_id, schema);
};

exports.getAvailability = async (params) => {
  const { tenant_id, schema } = params;
  if (!tenant_id) {
    throw new Error('tenant_id is required for getAvailability');
  }
  return await BookingModel.calculateAvailability(params, schema);
};
