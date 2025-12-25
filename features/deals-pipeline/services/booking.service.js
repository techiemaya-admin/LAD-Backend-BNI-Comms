const BookingModel = require('../models/booking.pg');

exports.create = async (data) => {
  return await BookingModel.createBooking(data);
};

exports.getByCounsellor = async (counsellorId) => {
  return await BookingsModel.getBookingsByCounsellor(counsellorId);
};

exports.getByStudent = async (studentId) => {
  return await BookingsModel.getStudentBookings(studentId);
};

exports.getInRange = async (dayStart, dayEnd) => {
  return await BookingsModel.getAllBookingsInRange(dayStart, dayEnd);
};
exports.getAvailability = async (params) => {
  return await BookingModel.calculateAvailability(params);
};
