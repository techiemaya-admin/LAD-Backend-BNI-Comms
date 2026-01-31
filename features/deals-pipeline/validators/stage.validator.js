/**
 * Stage Validators - LAD Architecture Compliant
 * Input validation for stage-related operations
 */

const { sanitizeString } = require('./common.validator');

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
  if (color && !/^#?[0-9A-F]{6}$/i.test(color)) {
    errors.push('Color must be a valid hex color code (e.g., #FF5733 or FF5733)');
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
  req.body.key = sanitizeString(key.trim().toLowerCase());
  req.body.label = sanitizeString(label); // Keep label as-is (can have spaces, uppercase, etc)
  if (color) {
    req.body.color = color.startsWith('#') ? color.toUpperCase() : '#' + color.toUpperCase();
  }

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

module.exports = {
  validateStageCreate,
  validateStageUpdate
};
