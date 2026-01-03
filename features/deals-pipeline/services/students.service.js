/**
 * Student Service
 * LAD-Compliant: Business logic for student management in education vertical
 */

const studentModel = require('../repositories/student.pg');
const { requireEducationTenant, isEducationTenant } = require('../utils/tenantHelpers');

// Try core paths first, fallback to local shared
let logger;
try {
  logger = require('../../../../core/utils/logger');
} catch (e) {
  logger = require('../../../shared/utils/logger');
}

/**
 * List students with role-based access control
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} List of students
 */
exports.listStudents = async ({ tenant_id, schema, userId, role, capabilities = [] }) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for listStudents');
  }
  
  // Validate tenant has education vertical enabled
  await requireEducationTenant(tenant_id, schema);
  
  logger.debug('listStudents', { tenant_id, userId, role, capabilities });
  
  // Development mode: allow full access
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Development mode - returning all students for tenant');
    return studentModel.getStudentsByTenant(tenant_id, schema);
  }
  
  // Owners/admins can always see all students regardless of capabilities
  if (role === 'owner' || role === 'admin') {
    logger.debug('Role is owner/admin - returning all students for tenant');
    return studentModel.getStudentsByTenant(tenant_id, schema);
  }

  const canViewAll = capabilities.includes('canViewAll');
  const canViewAssigned = capabilities.includes('leads.view_assigned');

  if (canViewAll) {
    logger.debug('User has canViewAll capability - returning all students');
    return studentModel.getStudentsByTenant(tenant_id, schema);
  }
  
  if (canViewAssigned || role === 'counsellor') {
    logger.debug('User has leads.view_assigned or is counsellor - returning assigned students');
    return studentModel.getStudentsByUser(tenant_id, userId, schema);
  }

  logger.debug('No access - returning empty array');
  return [];
};

/**
 * Get student by ID with access control
 * @param {string} studentId - Student ID
 * @param {string} tenant_id - Tenant ID
 * @param {string} schema - Database schema
 * @param {Object} user - User object with role and capabilities
 * @returns {Promise<Object>} Student object
 */
exports.getStudentById = async (studentId, tenant_id, schema, user) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getStudentById');
  }
  
  // Validate tenant has education vertical enabled
  await requireEducationTenant(tenant_id, schema);
  
  const student = await studentModel.getStudentById(studentId, tenant_id, schema, user);
  
  if (!student) {
    const error = new Error('Student not found');
    error.code = 'STUDENT_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }
  
  return student;
};

/**
 * Create a new student
 * @param {string} tenant_id - Tenant ID
 * @param {string} schema - Database schema
 * @param {Object} user - User object
 * @param {Object} data - Student data
 * @returns {Promise<Object>} Created student
 */
exports.createStudent = async (tenant_id, schema, user, data) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for createStudent');
  }
  
  // Validate tenant has education vertical enabled
  await requireEducationTenant(tenant_id, schema);
  
  logger.info('Creating student', { tenant_id, userId: user.id, studentName: data.name });
  
  try {
    // Ensure user object has tenantId for repository
    const userWithTenant = { ...user, tenantId: tenant_id };
    
    const student = await studentModel.createLeadAndStudent(userWithTenant, data, schema);
    
    logger.info('Student created successfully', { 
      tenant_id, 
      userId: user.id,
      leadId: student.lead_id,
      studentId: student.id 
    });
    
    return student;
  } catch (error) {
    logger.error('Failed to create student', { 
      tenant_id, 
      userId: user.id, 
      error: error.message 
    });
    throw error;
  }
};

/**
 * Update student information
 * @param {string} studentId - Student ID
 * @param {string} tenant_id - Tenant ID
 * @param {string} schema - Database schema
 * @param {Object} user - User object
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated student
 */
exports.updateStudent = async (studentId, tenant_id, schema, user, data) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for updateStudent');
  }
  
  // Validate tenant has education vertical enabled
  await requireEducationTenant(tenant_id, schema);
  
  logger.info('Updating student', { tenant_id, userId: user.id, studentId });
  
  try {
    const student = await studentModel.updateStudent(studentId, tenant_id, schema, user, data);
    
    if (!student) {
      const error = new Error('Student not found or access denied');
      error.code = 'STUDENT_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }
    
    logger.info('Student updated successfully', { tenant_id, userId: user.id, studentId });
    return student;
  } catch (error) {
    logger.error('Failed to update student', { 
      tenant_id, 
      userId: user.id, 
      studentId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Soft delete a student
 * @param {string} studentId - Student ID
 * @param {string} tenant_id - Tenant ID
 * @param {string} schema - Database schema
 * @param {Object} user - User object
 * @returns {Promise<Object>} Deletion result
 */
exports.deleteStudent = async (studentId, tenant_id, schema, user) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for deleteStudent');
  }
  
  // Validate tenant has education vertical enabled
  await requireEducationTenant(tenant_id, schema);
  
  logger.info('Deleting student', { tenant_id, userId: user.id, studentId });
  
  try {
    const result = await studentModel.softDeleteStudent(studentId, tenant_id, schema, user);
    
    if (!result) {
      const error = new Error('Student not found or access denied');
      error.code = 'STUDENT_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }
    
    logger.info('Student deleted successfully', { tenant_id, userId: user.id, studentId });
    return result;
  } catch (error) {
    logger.error('Failed to delete student', { 
      tenant_id, 
      userId: user.id, 
      studentId,
      error: error.message 
    });
    throw error;
  }
};

/**
 * Assign counsellor to student (admin only)
 * @param {Object} params - Assignment parameters
 * @returns {Promise<Object>} Updated student
 */
exports.assignCounsellor = async ({ studentId, counsellorId, tenant_id, schema, user }) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for assignCounsellor');
  }
  
  // Validate tenant has education vertical enabled
  await requireEducationTenant(tenant_id, schema);
  
  // Check admin permission
  if (user.role !== 'admin' && user.role !== 'owner') {
    const error = new Error('Only administrators can assign counsellors');
    error.code = 'INSUFFICIENT_PERMISSIONS';
    error.statusCode = 403;
    throw error;
  }
  
  logger.info('Assigning counsellor to student', { 
    tenant_id, 
    userId: user.id, 
    studentId, 
    counsellorId 
  });
  
  try {
    const student = await studentModel.assignCounsellor(
      studentId,
      tenant_id,
      schema,
      counsellorId
    );
    
    if (!student) {
      const error = new Error('Student or counsellor not found');
      error.code = 'RESOURCE_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }
    
    logger.info('Counsellor assigned successfully', { 
      tenant_id, 
      userId: user.id, 
      studentId, 
      counsellorId 
    });
    
    return student;
  } catch (error) {
    logger.error('Failed to assign counsellor', { 
      tenant_id, 
      userId: user.id, 
      studentId,
      counsellorId,
      error: error.message 
    });
    throw error;
  }
};


