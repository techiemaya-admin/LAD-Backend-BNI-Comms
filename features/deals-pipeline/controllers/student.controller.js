/**
 * Student Controller
 */

const studentService = require('../services/students.service');

exports.listStudents = async (req, res) => {
  try {
    console.log('[student.controller] listStudents - user:', {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      tenantId: req.user.tenantId,
      capabilities: req.user.capabilities
    });
    
    const students = await studentService.listStudents({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      role: req.user.role,
      capabilities: req.user.capabilities || []
    });
    
    console.log(`[student.controller] Returning ${students.length} students`);
    res.json(students);
  } catch (err) {
    console.error('[Student Controller] listStudents error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch students',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getStudentById = async (req, res) => {
  try {
    const student = await studentService.getStudentById(
      req.params.id,
      req.user
    );

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(student);
  } catch (err) {
    console.error('[Student Controller] getStudentById', err);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
};

exports.createStudent = async (req, res) => {
  try {
    const student = await studentService.createStudent(
      req.user,
      req.body
    );
    res.status(201).json(student);
  } catch (err) {
    console.error('[Student Controller] createStudent', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const student = await studentService.updateStudent(
      req.params.id,
      req.user,
      req.body
    );
    res.json(student);
  } catch (err) {
    console.error('[Student Controller] updateStudent', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    await studentService.deleteStudent(req.params.id, req.user);
    res.status(204).send();
  } catch (err) {
    console.error('[Student Controller] deleteStudent', err);
    res.status(500).json({ error: err.message });
  }
};


exports.assignCounsellor = async (req, res) => {
  try {
    const student = await studentService.assignCounsellor({
      studentId: req.params.id,
      counsellorId: req.body.counsellor_id,
      user: req.user
    });
    res.json(student);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
};
