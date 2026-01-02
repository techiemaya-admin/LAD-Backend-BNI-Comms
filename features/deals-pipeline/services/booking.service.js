const BookingModel = require('../repositories/booking.pg');

exports.create = async (data) => {
  const { tenant_id, schema } = data;
  if (!tenant_id) {
    throw new Error('tenant_id is required for create booking');
  }
  return await BookingModel.createBooking(data, schema);
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

exports.getInRange = async (dayStart, dayEnd, tenant_id, schema) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getInRange');
  }
  return await BookingModel.getAllBookingsInRange(dayStart, dayEnd, tenant_id, schema);
};

exports.getAvailability = async (params) => {
  const { tenant_id, schema } = params;
  if (!tenant_id) {
    throw new Error('tenant_id is required for getAvailability');
  }
  return await BookingModel.calculateAvailability(params, schema);
};
