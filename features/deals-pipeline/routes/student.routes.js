/**
 * Student Routes
 * /api/students
 */

const express = require('express');
const router = express.Router();
const { validateStudentCreate, validateUUIDParam, validatePagination } = require('../middleware/validators');
const studentController = require('../controllers/student.controller');

// LIST
router.get('/', validatePagination, studentController.listStudents);

// GET BY ID
router.get('/:id', validateUUIDParam('id'), studentController.getStudentById);

// CREATE
router.post('/', validateStudentCreate, studentController.createStudent);

// UPDATE
router.put('/:id', validateUUIDParam('id'), studentController.updateStudent);

// DELETE (soft delete)
router.delete('/:id', validateUUIDParam('id'), studentController.deleteStudent);

// Assign counsellor (ADMIN only)
router.put('/:id/assign-counsellor', validateUUIDParam('id'), studentController.assignCounsellor);

module.exports = router;
