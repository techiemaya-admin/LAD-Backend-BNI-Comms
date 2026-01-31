/**
 * Lead Validators - LAD Architecture Compliant
 * Input validation for lead-related operations
 */

const { isValidEmail, isValidPhone, sanitizeString } = require('./common.validator');

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

module.exports = {
  validateLeadCreate,
  validateLeadUpdate
};
