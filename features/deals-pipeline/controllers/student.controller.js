/**
 * Student Controller
 */

const studentService = require('../services/students.service');

// Try core paths first, fallback to local shared
let getTenantContext, logger;
try {
  ({ getTenantContext } = require('../../../../core/utils/schemaHelper'));
  logger = require('../../../../core/utils/logger');
} catch (e) {
  ({ getTenantContext } = require('../../../shared/utils/schemaHelper'));
  logger = require('../../../shared/utils/logger');
}

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
    
    logger.info(`Returning ${students.length} students for tenant ${tenant_id}`);
    res.json(students);
  } catch (err) {
    logger.error('listStudents error', err, { userId: req.user?.id });
    if (err.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ 
      error: 'Failed to fetch students',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

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

    res.json(student);
  } catch (err) {
    logger.error('getStudentById error', err, { studentId: req.params.id });
    if (err.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to fetch student', details: err.message });
  }
};

exports.createStudent = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    const student = await studentService.createStudent(
      tenant_id,
      schema,
      req.user,
      req.body
    );
    res.status(201).json(student);
  } catch (err) {
    logger.error('createStudent error', err, { userId: req.user?.id });
    if (err.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create student', details: err.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    const student = await studentService.updateStudent(
      req.params.id,
      tenant_id,
      schema,
      req.user,
      req.body
    );
    res.json(student);
  } catch (err) {
    logger.error('updateStudent error', err, { studentId: req.params.id });
    if (err.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to update student', details: err.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    await studentService.deleteStudent(req.params.id, tenant_id, schema, req.user);
    res.status(204).send();
  } catch (err) {
    logger.error('deleteStudent error', err, { studentId: req.params.id });
    if (err.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to delete student', details: err.message });
  }
};


exports.assignCounsellor = async (req, res) => {
  try {
    const { tenant_id, schema } = getTenantContext(req);
    
    const student = await studentService.assignCounsellor({
      studentId: req.params.id,
      counsellorId: req.body.counsellor_id,
      tenant_id,
      schema,
      user: req.user
    });
    res.json(student);
  } catch (err) {
    logger.error('assignCounsellor error', err, { studentId: req.params.id, counsellorId: req.body.counsellor_id });
    if (err.code === 'TENANT_CONTEXT_MISSING') {
      return res.status(403).json({ error: err.message });
    }
    res.status(403).json({ error: err.message });
  }
};
