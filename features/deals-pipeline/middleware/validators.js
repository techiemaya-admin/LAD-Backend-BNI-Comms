/**
 * Validation Middleware for Deals Pipeline
 * Provides input validation for API requests
 */

/**
 * Validate UUID format
 */
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone format (basic international format)
 */
const isValidPhone = (phone) => {
  const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
  return phoneRegex.test(phone);
};

/**
 * Sanitize string input (prevent XSS)
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
};

/**
 * Validate lead creation payload
 */
const validateLeadCreate = (req, res, next) => {
  const { name, email, phone, company, value, stage, status, source, priority } = req.body;
  const errors = [];

  // Required fields
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Name is required and must be a non-empty string');
  } else if (name.length > 255) {
    errors.push('Name must be less than 255 characters');
  }

  // Optional email validation
  if (email && !isValidEmail(email)) {
    errors.push('Invalid email format');
  }

  // Optional phone validation
  if (phone && !isValidPhone(phone)) {
    errors.push('Invalid phone format (min 10 digits)');
  }

  // Optional value validation
  if (value !== undefined && value !== null) {
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 0) {
      errors.push('Value must be a positive number');
    }
  }

  // Stage validation (required)
  if (!stage || typeof stage !== 'string' || stage.trim().length === 0) {
    errors.push('Stage is required');
  }

  // Status validation (required)
  if (!status || typeof status !== 'string' || status.trim().length === 0) {
    errors.push('Status is required');
  }

  // Optional string length validations
  if (company && company.length > 255) {
    errors.push('Company name must be less than 255 characters');
  }
  if (source && source.length > 100) {
    errors.push('Source must be less than 100 characters');
  }
  if (priority && priority.length > 100) {
    errors.push('Priority must be less than 100 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  // Sanitize string inputs
  req.body.name = sanitizeString(name);
  if (email) req.body.email = sanitizeString(email);
  if (company) req.body.company = sanitizeString(company);
  if (stage) req.body.stage = sanitizeString(stage);
  if (status) req.body.status = sanitizeString(status);
  if (source) req.body.source = sanitizeString(source);
  if (priority) req.body.priority = sanitizeString(priority);

  next();
};

/**
 * Validate lead update payload
 */
const validateLeadUpdate = (req, res, next) => {
  const { name, email, phone, company, value, stage, status, source, priority } = req.body;
  const errors = [];

  // At least one field must be provided
  if (!name && !email && !phone && !company && value === undefined && !stage && !status && !source && !priority) {
    errors.push('At least one field must be provided for update');
  }

  // Validate provided fields
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      errors.push('Name must be a non-empty string');
    } else if (name.length > 255) {
      errors.push('Name must be less than 255 characters');
    }
  }

  if (email !== undefined && email !== null && !isValidEmail(email)) {
    errors.push('Invalid email format');
  }

  if (phone !== undefined && phone !== null && !isValidPhone(phone)) {
    errors.push('Invalid phone format (min 10 digits)');
  }

  if (value !== undefined && value !== null) {
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 0) {
      errors.push('Value must be a positive number');
    }
  }

  if (company !== undefined && company.length > 255) {
    errors.push('Company name must be less than 255 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  // Sanitize string inputs if present
  if (name) req.body.name = sanitizeString(name);
  if (email) req.body.email = sanitizeString(email);
  if (company) req.body.company = sanitizeString(company);
  if (stage) req.body.stage = sanitizeString(stage);
  if (status) req.body.status = sanitizeString(status);
  if (source) req.body.source = sanitizeString(source);
  if (priority) req.body.priority = sanitizeString(priority);

  next();
};

/**
 * Validate stage creation payload
 */
const validateStageCreate = (req, res, next) => {
  const { key, label, color, display_order } = req.body;
  const errors = [];

  // Required fields
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    errors.push('Key is required and must be a non-empty string');
  } else if (key.length > 100) {
    errors.push('Key must be less than 100 characters');
  } else if (!/^[a-z0-9_-]+$/.test(key)) {
    errors.push('Key must contain only lowercase letters, numbers, hyphens, and underscores');
  }

  if (!label || typeof label !== 'string' || label.trim().length === 0) {
    errors.push('Label is required and must be a non-empty string');
  } else if (label.length > 255) {
    errors.push('Label must be less than 255 characters');
  }

  // Optional color validation (hex format)
  if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
    errors.push('Color must be a valid hex color code (e.g., #FF5733)');
  }

  // Optional display_order validation
  if (display_order !== undefined && display_order !== null) {
    const numOrder = Number(display_order);
    if (isNaN(numOrder) || numOrder < 0 || !Number.isInteger(numOrder)) {
      errors.push('Display order must be a non-negative integer');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  // Sanitize inputs
  req.body.key = sanitizeString(key.toLowerCase());
  req.body.label = sanitizeString(label);
  if (color) req.body.color = color.toUpperCase();

  next();
};

/**
 * Validate stage update payload
 */
const validateStageUpdate = (req, res, next) => {
  const { label, color, display_order } = req.body;
  const errors = [];

  // At least one field must be provided
  if (!label && !color && display_order === undefined) {
    errors.push('At least one field must be provided for update');
  }

  // Validate provided fields
  if (label !== undefined) {
    if (typeof label !== 'string' || label.trim().length === 0) {
      errors.push('Label must be a non-empty string');
    } else if (label.length > 255) {
      errors.push('Label must be less than 255 characters');
    }
  }

  if (color !== undefined && color !== null && !/^#[0-9A-F]{6}$/i.test(color)) {
    errors.push('Color must be a valid hex color code (e.g., #FF5733)');
  }

  if (display_order !== undefined && display_order !== null) {
    const numOrder = Number(display_order);
    if (isNaN(numOrder) || numOrder < 0 || !Number.isInteger(numOrder)) {
      errors.push('Display order must be a non-negative integer');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  // Sanitize inputs
  if (label) req.body.label = sanitizeString(label);
  if (color) req.body.color = color.toUpperCase();

  next();
};

/**
 * Validate UUID parameter (for :id routes)
 */
const validateUUIDParam = (paramName = 'id') => {
  return (req, res, next) => {
    const uuid = req.params[paramName];
    
    if (!uuid || !isValidUUID(uuid)) {
      return res.status(400).json({
        success: false,
        error: `Invalid ${paramName} format. Must be a valid UUID.`
      });
    }
    
    next();
  };
};

/**
 * Validate booking creation payload
 */
const validateBookingCreate = (req, res, next) => {
  const { student_id, counsellor_id, booking_date, booking_time, duration_minutes, status } = req.body;
  const errors = [];

  // Required fields
  if (!student_id || !isValidUUID(student_id)) {
    errors.push('Valid student_id (UUID) is required');
  }

  if (!counsellor_id || !isValidUUID(counsellor_id)) {
    errors.push('Valid counsellor_id (UUID) is required');
  }

  if (!booking_date || !/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) {
    errors.push('booking_date is required in YYYY-MM-DD format');
  }

  if (!booking_time || !/^\d{2}:\d{2}$/.test(booking_time)) {
    errors.push('booking_time is required in HH:MM format');
  }

  if (duration_minutes !== undefined) {
    const duration = Number(duration_minutes);
    if (isNaN(duration) || duration <= 0 || duration > 480) {
      errors.push('duration_minutes must be between 1 and 480 (8 hours)');
    }
  }

  if (status && !['scheduled', 'completed', 'cancelled'].includes(status)) {
    errors.push('status must be one of: scheduled, completed, cancelled');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

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

/**
 * Validate query parameters for pagination
 */
const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;
  const errors = [];

  if (page !== undefined) {
    const pageNum = Number(page);
    if (isNaN(pageNum) || pageNum < 1 || !Number.isInteger(pageNum)) {
      errors.push('Page must be a positive integer');
    }
  }

  if (limit !== undefined) {
    const limitNum = Number(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100 || !Number.isInteger(limitNum)) {
      errors.push('Limit must be an integer between 1 and 100');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

module.exports = {
  validateLeadCreate,
  validateLeadUpdate,
  validateStageCreate,
  validateStageUpdate,
  validateUUIDParam,
  validateBookingCreate,
  validateStudentCreate,
  validatePagination,
  // Export utility functions for custom validations
  isValidUUID,
  isValidEmail,
  isValidPhone,
  sanitizeString
};
