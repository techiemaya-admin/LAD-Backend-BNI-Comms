/**
 * Student Validators - LAD Architecture Compliant
 * Input validation for student-related operations using Joi
 */

const Joi = require('joi');
const { EDUCATION_LEVELS, TEST_SCORE_RANGES } = require('../constants/educationConstants');

/**
 * Joi schema for student creation
 */
const studentCreateSchema = Joi.object({
  // Lead fields (required)
  name: Joi.string().required().max(255).trim(),
  email: Joi.string().email().required().trim(),
  phone: Joi.string().optional().max(50).trim(),
  
  // Lead fields (optional)
  company: Joi.string().optional().max(255).trim(),
  value: Joi.number().optional().min(0),
  stage: Joi.string().optional().max(50),
  status: Joi.string().optional().max(50),
  source: Joi.string().optional().max(50),
  priority: Joi.string().optional().valid('low', 'medium', 'high', 'urgent'),
  assigned_user_id: Joi.string().uuid().optional(),

  // Education-specific fields (optional)
  counsellor_id: Joi.string().uuid().optional(),
  current_education_level: Joi.string()
    .optional()
    .valid(...Object.values(EDUCATION_LEVELS)),
  current_institution: Joi.string().optional().max(255),
  gpa: Joi.number().optional().min(0).max(10),
  graduation_year: Joi.number().integer().optional().min(1950).max(2100),
  
  target_degree: Joi.string().optional().max(100),
  target_major: Joi.string().optional().max(100),
  target_universities: Joi.array().items(Joi.string()).optional().allow(null),
  target_countries: Joi.array().items(Joi.string()).optional().allow(null),
  
  // Test scores with proper ranges
  sat_score: Joi.number()
    .integer()
    .optional()
    .min(TEST_SCORE_RANGES.SAT.min)
    .max(TEST_SCORE_RANGES.SAT.max),
  act_score: Joi.number()
    .integer()
    .optional()
    .min(TEST_SCORE_RANGES.ACT.min)
    .max(TEST_SCORE_RANGES.ACT.max),
  toefl_score: Joi.number()
    .integer()
    .optional()
    .min(TEST_SCORE_RANGES.TOEFL.min)
    .max(TEST_SCORE_RANGES.TOEFL.max),
  ielts_score: Joi.number()
    .optional()
    .min(TEST_SCORE_RANGES.IELTS.min)
    .max(TEST_SCORE_RANGES.IELTS.max),
  gre_score: Joi.number()
    .integer()
    .optional()
    .min(TEST_SCORE_RANGES.GRE.min)
    .max(TEST_SCORE_RANGES.GRE.max),
  gmat_score: Joi.number()
    .integer()
    .optional()
    .min(TEST_SCORE_RANGES.GMAT.min)
    .max(TEST_SCORE_RANGES.GMAT.max),
  
  budget_range: Joi.string().optional().max(50),
  preferred_intake: Joi.string().optional().max(50),
  scholarship_interest: Joi.boolean().optional(),
});

/**
 * Joi schema for student update (all fields optional)
 */
const studentUpdateSchema = Joi.object({
  // Lead fields
  name: Joi.string().optional().max(255).trim(),
  email: Joi.string().email().optional().trim(),
  phone: Joi.string().optional().max(50).trim(),
  company: Joi.string().optional().max(255).trim(),
  value: Joi.number().optional().min(0),
  stage: Joi.string().optional().max(50),
  status: Joi.string().optional().max(50),
  source: Joi.string().optional().max(50),
  priority: Joi.string().optional().valid('low', 'medium', 'high', 'urgent'),
  assigned_user_id: Joi.string().uuid().optional().allow(null),

  // Education fields
  counsellor_id: Joi.string().uuid().optional().allow(null),
  current_education_level: Joi.string()
    .optional()
    .valid(...Object.values(EDUCATION_LEVELS)),
  current_institution: Joi.string().optional().max(255).allow(null),
  gpa: Joi.number().optional().min(0).max(10).allow(null),
  graduation_year: Joi.number().integer().optional().min(1950).max(2100).allow(null),
  
  target_degree: Joi.string().optional().max(100).allow(null),
  target_major: Joi.string().optional().max(100).allow(null),
  target_universities: Joi.array().items(Joi.string()).optional().allow(null),
  target_countries: Joi.array().items(Joi.string()).optional().allow(null),
  
  sat_score: Joi.number()
    .integer()
    .optional()
    .min(TEST_SCORE_RANGES.SAT.min)
    .max(TEST_SCORE_RANGES.SAT.max)
    .allow(null),
  act_score: Joi.number()
    .integer()
    .optional()
    .min(TEST_SCORE_RANGES.ACT.min)
    .max(TEST_SCORE_RANGES.ACT.max)
    .allow(null),
  toefl_score: Joi.number()
    .integer()
    .optional()
    .min(TEST_SCORE_RANGES.TOEFL.min)
    .max(TEST_SCORE_RANGES.TOEFL.max)
    .allow(null),
  ielts_score: Joi.number()
    .optional()
    .min(TEST_SCORE_RANGES.IELTS.min)
    .max(TEST_SCORE_RANGES.IELTS.max)
    .allow(null),
  gre_score: Joi.number()
    .integer()
    .optional()
    .min(TEST_SCORE_RANGES.GRE.min)
    .max(TEST_SCORE_RANGES.GRE.max)
    .allow(null),
  gmat_score: Joi.number()
    .integer()
    .optional()
    .min(TEST_SCORE_RANGES.GMAT.min)
    .max(TEST_SCORE_RANGES.GMAT.max)
    .allow(null),
  
  budget_range: Joi.string().optional().max(50).allow(null),
  preferred_intake: Joi.string().optional().max(50).allow(null),
  scholarship_interest: Joi.boolean().optional(),
}).min(1); // At least one field must be provided for update

/**
 * Joi schema for counsellor assignment
 */
const counsellorAssignSchema = Joi.object({
  counsellor_id: Joi.string().uuid().required(),
});

/**
 * Validate student creation
 * @param {Object} data - Student data to validate
 * @returns {Object} Validation result { error, value }
 */
function validateCreate(data) {
  return studentCreateSchema.validate(data, { abortEarly: false });
}

/**
 * Validate student update
 * @param {Object} data - Student data to validate
 * @returns {Object} Validation result { error, value }
 */
function validateUpdate(data) {
  return studentUpdateSchema.validate(data, { abortEarly: false });
}

/**
 * Validate counsellor assignment
 * @param {Object} data - Assignment data to validate
 * @returns {Object} Validation result { error, value }
 */
function validateCounsellorAssign(data) {
  return counsellorAssignSchema.validate(data, { abortEarly: false });
}

/**
 * Express middleware for validating student creation
 */
const validateStudentCreate = (req, res, next) => {
  const { error, value } = validateCreate(req.body);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(d => d.message),
    });
  }
  
  req.body = value; // Use validated and sanitized values
  next();
};

/**
 * Express middleware for validating student update
 */
const validateStudentUpdate = (req, res, next) => {
  const { error, value } = validateUpdate(req.body);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(d => d.message),
    });
  }
  
  req.body = value;
  next();
};

/**
 * Express middleware for validating counsellor assignment
 */
const validateCounsellorAssignment = (req, res, next) => {
  const { error, value } = validateCounsellorAssign(req.body);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(d => d.message),
    });
  }
  
  req.body = value;
  next();
};

module.exports = {
  validateCreate,
  validateUpdate,
  validateCounsellorAssign,
  validateStudentCreate,
  validateStudentUpdate,
  validateCounsellorAssignment,
};
