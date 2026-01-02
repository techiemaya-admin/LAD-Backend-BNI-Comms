/**
 * Student Service
 */

const studentModel = require('../repositories/student.pg');

// Try core paths first, fallback to local shared
let logger;
try {
  logger = require('../../../../core/utils/logger');
} catch (e) {
  logger = require('../../../shared/utils/logger');
}

exports.listStudents = async ({ tenant_id, schema, userId, role, capabilities = [] }) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for listStudents');
  }
  
  logger.debug('listStudents', { tenant_id, userId, role, capabilities });
  
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

exports.getStudentById = async (studentId, tenant_id, schema, user) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for getStudentById');
  }
  return studentModel.getStudentById(studentId, tenant_id, schema, user);
};

exports.createStudent = async (tenant_id, schema, user, data) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for createStudent');
  }
  return studentModel.createLeadAndStudent(tenant_id, schema, user, data);
};

exports.updateStudent = async (studentId, tenant_id, schema, user, data) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for updateStudent');
  }
  return studentModel.updateStudent(studentId, tenant_id, schema, user, data);
};

exports.deleteStudent = async (studentId, tenant_id, schema, user) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for deleteStudent');
  }
  return studentModel.softDeleteStudent(studentId, tenant_id, schema, user);
};

exports.assignCounsellor = async ({ studentId, counsellorId, tenant_id, schema, user }) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for assignCounsellor');
  }
  if (user.role !== 'admin') {
    throw new Error('Only admin can assign counsellors');
  }
  return studentModel.assignCounsellor(
    studentId,
    tenant_id,
    schema,
    counsellorId
  );
};

