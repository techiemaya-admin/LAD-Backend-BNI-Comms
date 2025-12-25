/**
 * Student Service
 */

const studentModel = require('../models/student.pg');

exports.listStudents = async ({ tenantId, userId, role, capabilities = [] }) => {
  console.log(`[students.service] listStudents - tenantId: ${tenantId}, userId: ${userId}, role: ${role}, capabilities:`, capabilities);
  
  // Owners/admins can always see all students regardless of capabilities
  if (role === 'owner' || role === 'admin') {
    console.log('[students.service] Role is owner/admin - returning all students for tenant');
    return studentModel.getStudentsByTenant(tenantId);
  }

  const canViewAll = capabilities.includes('canViewAll');
  const canViewAssigned = capabilities.includes('leads.view_assigned');

  if (canViewAll) {
    console.log('[students.service] User has canViewAll capability - returning all students');
    return studentModel.getStudentsByTenant(tenantId);
  }
  
  if (canViewAssigned || role === 'counsellor') {
    console.log(`[students.service] User has leads.view_assigned or is counsellor - returning assigned students`);
    return studentModel.getStudentsByUser(tenantId, userId);
  }

  console.log('[students.service] No access - returning empty array');
  return [];
};

exports.getStudentById = async (studentId, user) => {
  return studentModel.getStudentById(studentId, user);
};

exports.createStudent = async (user, data) => {
  return studentModel.createLeadAndStudent(user, data);
};

exports.updateStudent = async (studentId, user, data) => {
  return studentModel.updateStudent(studentId, user, data);
};

exports.deleteStudent = async (studentId, user) => {
  return studentModel.softDeleteStudent(studentId, user);
};

exports.assignCounsellor = async ({ studentId, counsellorId, user }) => {
  if (user.role !== 'admin') {
    throw new Error('Only admin can assign counsellors');
  }
  return studentModel.assignCounsellor(
    studentId,
    user.tenantId,
    counsellorId
  );
};

