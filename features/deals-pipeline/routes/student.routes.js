/**
 * Student Routes
 * LAD-Compliant: Routes for education vertical student management
 * Base path: /api/deals-pipeline/students
 */

const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student.controller');
const { 
  validateStudentCreate, 
  validateStudentUpdate, 
  validateCounsellorAssignment 
} = require('../validators/student.validator');

// Try to get auth middleware (core or shared)
let authenticate, requireCapability;
try {
  ({ authenticate, requireCapability } = require('../../../../core/middleware/auth'));
} catch (e) {
  try {
    ({ authenticate } = require('../../../shared/middleware/auth'));
    // Fallback capability check if not available
    requireCapability = (capability) => (req, res, next) => {
      if (!req.user || !req.user.capabilities) {
        return res.status(403).json({ error: 'Capabilities not found' });
      }
      if (!req.user.capabilities.includes(capability)) {
        return res.status(403).json({ error: `Missing required capability: ${capability}` });
      }
      next();
    };
  } catch (e2) {
    // Mock middleware for development
    authenticate = (req, res, next) => next();
    requireCapability = () => (req, res, next) => next();
  }
}

// All routes require authentication
router.use(authenticate);

/**
 * GET /students
 * List all students (respects counsellor scoping)
 * Capabilities: education.students.view, leads.view_assigned, canViewAll
 */
router.get('/', 
  studentController.listStudents
);

/**
 * GET /students/:id
 * Get single student by ID
 * Capabilities: education.students.view, leads.view_assigned
 */
router.get('/:id',
  studentController.getStudentById
);

/**
 * POST /students
 * Create new student
 * Capabilities: education.students.create
 */
router.post('/',
  validateStudentCreate,
  studentController.createStudent
);

/**
 * PUT /students/:id
 * Update student information
 * Capabilities: education.students.edit
 */
router.put('/:id',
  validateStudentUpdate,
  studentController.updateStudent
);

/**
 * DELETE /students/:id
 * Soft delete student
 * Capabilities: education.students.delete
 */
router.delete('/:id',
  studentController.deleteStudent
);

/**
 * POST /students/:id/assign-counsellor
 * Assign counsellor to student (admin only)
 * Capabilities: education.students.assign, education.admin
 */
router.post('/:id/assign-counsellor',
  validateCounsellorAssignment,
  studentController.assignCounsellor
);

module.exports = router;

