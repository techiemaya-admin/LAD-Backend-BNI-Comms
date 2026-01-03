/**
 * Student Controller
 * LAD-Compliant: Request/response handling for student endpoints
 */

const studentService = require('../services/students.service');
const { validateCreate, validateUpdate, validateCounsellorAssign } = require('../validators/student.validator');
const { studentToApi } = require('../dtos/studentDto');

// Try core paths first, fallback to local shared
let getTenantContext, logger;
try {
  ({ getTenantContext } = require('../../../../core/utils/schemaHelper'));
  logger = require('../../../../core/utils/logger');
} catch (e) {
  ({ getTenantContext } = require('../../../shared/utils/schemaHelper'));
  logger = require('../../../shared/utils/logger');
}

/**
 * List all students for tenant (respects counsellor scoping)
 * GET /api/deals-pipeline/students
 */
exports.listStudents = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    logger.debug('listStudents - user context', {
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role,
      tenant_id,
      capabilities: req.user.capabilities
    });
    
    const students = await studentService.listStudents({
      tenant_id,
      schema,
      userId: req.user.id,
      role: req.user.role,
      capabilities: req.user.capabilities || []
    });
    
    // Transform to API format
    const apiStudents = students.map(studentToApi);
    
    logger.info(`Returning ${apiStudents.length} students for tenant ${tenant_id}`);
    res.json(apiStudents);
  } catch (err) {
    logger.error('listStudents error', { userId: req.user?.id, error: err.message });
    
    if (err.code === 'TENANT_CONTEXT_MISSING' || err.code === 'EDUCATION_NOT_ENABLED') {
      return res.status(403).json({ error: err.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch students',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * Get single student by ID
 * GET /api/deals-pipeline/students/:id
 */
exports.getStudentById = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    const student = await studentService.getStudentById(
      req.params.id,
      tenant_id,
      schema,
      req.user
    );

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(studentToApi(student));
  } catch (err) {
    logger.error('getStudentById error', { studentId: req.params.id, error: err.message });
    
    const statusCode = err.statusCode || 500;
    
    if (err.code === 'TENANT_CONTEXT_MISSING' || err.code === 'EDUCATION_NOT_ENABLED') {
      return res.status(403).json({ error: err.message });
    }
    
    if (err.code === 'STUDENT_NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(statusCode).json({ 
      error: 'Failed to fetch student', 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * Create new student
 * POST /api/deals-pipeline/students
 */
exports.createStudent = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = validateCreate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    const { tenant_id, schema } = getTenantContext(req);
    
    const student = await studentService.createStudent(
      tenant_id,
      schema,
      req.user,
      value // Use validated data
    );
    
    res.status(201).json(studentToApi(student));
  } catch (err) {
    logger.error('createStudent error', { userId: req.user?.id, error: err.message });
    
    if (err.code === 'TENANT_CONTEXT_MISSING' || err.code === 'EDUCATION_NOT_ENABLED') {
      return res.status(403).json({ error: err.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to create student', 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * Update student information
 * PUT /api/deals-pipeline/students/:id
 */
exports.updateStudent = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = validateUpdate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    const { tenant_id, schema } = getTenantContext(req);
    
    const student = await studentService.updateStudent(
      req.params.id,
      tenant_id,
      schema,
      req.user,
      value // Use validated data
    );
    
    res.json(studentToApi(student));
  } catch (err) {
    logger.error('updateStudent error', { studentId: req.params.id, error: err.message });
    
    if (err.code === 'TENANT_CONTEXT_MISSING' || err.code === 'EDUCATION_NOT_ENABLED') {
      return res.status(403).json({ error: err.message });
    }
    
    if (err.code === 'STUDENT_NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to update student', 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * Soft delete student
 * DELETE /api/deals-pipeline/students/:id
 */
exports.deleteStudent = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    await studentService.deleteStudent(req.params.id, tenant_id, schema, req.user);
    
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    logger.error('deleteStudent error', { studentId: req.params.id, error: err.message });
    
    if (err.code === 'TENANT_CONTEXT_MISSING' || err.code === 'EDUCATION_NOT_ENABLED') {
      return res.status(403).json({ error: err.message });
    }
    
    if (err.code === 'STUDENT_NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to delete student', 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * Assign counsellor to student (admin only)
 * POST /api/deals-pipeline/students/:id/assign-counsellor
 */
exports.assignCounsellor = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = validateCounsellorAssign(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    const { tenant_id, schema } = getTenantContext(req);
    
    const student = await studentService.assignCounsellor({
      studentId: req.params.id,
      counsellorId: value.counsellor_id,
      tenant_id,
      schema,
      user: req.user
    });
    
    res.json(studentToApi(student));
  } catch (err) {
    logger.error('assignCounsellor error', { 
      studentId: req.params.id, 
      counsellorId: req.body.counsellor_id,
      error: err.message 
    });
    
    if (err.code === 'TENANT_CONTEXT_MISSING' || err.code === 'EDUCATION_NOT_ENABLED') {
      return res.status(403).json({ error: err.message });
    }
    
    if (err.code === 'INSUFFICIENT_PERMISSIONS') {
      return res.status(403).json({ error: err.message });
    }
    
    if (err.code === 'RESOURCE_NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to assign counsellor', 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

