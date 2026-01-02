/**
 * Student Validators - LAD Architecture Compliant
 * Input validation for student-related operations
 */

const { isValidEmail, isValidPhone, sanitizeString } = require('./common.validator');

/**
 * Validate student creation payload
 */
const validateStudentCreate = (req, res, next) => {
  const { name, email, phone, course, enrollment_date } = req.body;
  const errors = [];

  // Required fields
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Name is required and must be a non-empty string');
  } else if (name.length > 255) {
    errors.push('Name must be less than 255 characters');
  }

  if (!email || !isValidEmail(email)) {
    errors.push('Valid email is required');
  }

  // Optional phone validation
  if (phone && !isValidPhone(phone)) {
    errors.push('Invalid phone format (min 10 digits)');
  }

  // Optional course validation
  if (course && course.length > 255) {
    errors.push('Course must be less than 255 characters');
  }

  // Optional enrollment_date validation
  if (enrollment_date && !/^\d{4}-\d{2}-\d{2}$/.test(enrollment_date)) {
    errors.push('enrollment_date must be in YYYY-MM-DD format');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  // Sanitize inputs
  req.body.name = sanitizeString(name);
  req.body.email = sanitizeString(email);
  if (course) req.body.course = sanitizeString(course);

  next();
};

module.exports = {
  validateStudentCreate
};
