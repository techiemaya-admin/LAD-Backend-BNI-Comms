/**
 * Student Repository - LAD Architecture Compliant
 * Data access layer for education students
 */

const { query } = require('../../../shared/database/connection');
const { getSchema } = require('../../../core/utils/schemaHelper');
const logger = require('../../../core/utils/logger');

class StudentRepository {
  /**
   * Get base SELECT query for students with dynamic schema
   */
  static getBaseSelect(schema) {
    return `
      SELECT
        es.*,
        COALESCE(l.first_name || ' ' || l.last_name, l.first_name, l.last_name) AS student_name,
        l.email,
        l.phone,
        l.stage,
        l.status,
        l.assigned_user_id AS counsellor_id,
        ec.designation,
        ec.specialization,
        u.first_name AS counsellor_first_name,
        u.last_name AS counsellor_last_name
      FROM ${schema}.education_students es
      JOIN ${schema}.leads l ON l.id = es.lead_id
      LEFT JOIN ${schema}.education_counsellors ec ON ec.user_id = l.assigned_user_id
      LEFT JOIN ${schema}.users u ON u.id = l.assigned_user_id
      WHERE es.is_deleted = FALSE
    `;
  }

  /**
   * Get all students for a tenant (ADMIN access)
   */
  static async getStudentsByTenant(tenantId, schema) {
    const resolvedSchema = schema || getSchema();
    const baseSelect = this.getBaseSelect(resolvedSchema);
    const sql = `${baseSelect} AND es.tenant_id = $1 ORDER BY es.created_at DESC`;
    
    logger.debug('[StudentRepository] Getting students by tenant', { tenantId, schema: resolvedSchema });
    
    const result = await query(sql, [tenantId]);
    return result.rows;
  }

  /**
   * Get students by user (counsellor access - only their assigned students)
   */
  static async getStudentsByUser(tenantId, userId, schema) {
    const resolvedSchema = schema || getSchema();
    const baseSelect = this.getBaseSelect(resolvedSchema);
    const sql = `
      ${baseSelect}
      AND es.tenant_id = $1
      AND l.assigned_user_id = $2
      ORDER BY es.created_at DESC
    `;
    
    logger.debug('[StudentRepository] Getting students by user', { tenantId, userId, schema: resolvedSchema });
    
    const result = await query(sql, [tenantId, userId]);
    return result.rows;
  }

  /**
   * Get counsellor ID for a user
   */
  static async getCounsellorIdByUser(userId, tenantId, schema) {
    const resolvedSchema = schema || getSchema();
    const sql = `
      SELECT id, user_id, name, email 
      FROM ${resolvedSchema}.education_counsellors 
      WHERE user_id = $1 AND tenant_id = $2
      LIMIT 1
    `;
    
    logger.debug('[StudentRepository] Getting counsellor ID by user', { userId, tenantId, schema: resolvedSchema });
    
    const result = await query(sql, [userId, tenantId]);
    const counsellorId = result.rows[0]?.id;
    
    logger.debug('[StudentRepository] Counsellor lookup result', { userId, tenantId, counsellorId });
    
    return counsellorId;
  }

  /**
   * Get students for a specific counsellor
   */
  static async getStudentsByCounsellor(tenantId, userId, schema) {
    const resolvedSchema = schema || getSchema();
    
    logger.debug('[StudentRepository] Getting students by counsellor', { tenantId, userId });
    
    const baseSelect = this.getBaseSelect(resolvedSchema);
    const sql = `
      ${baseSelect}
      AND es.tenant_id = $1
      AND l.assigned_user_id = $2
      ORDER BY es.created_at DESC
    `;
    
    const result = await query(sql, [tenantId, userId]);
    
    logger.debug('[StudentRepository] Students by counsellor result', { 
      tenantId, 
      userId, 
      studentCount: result.rows.length 
    });
    
    return result.rows;
  }

  /**
   * Get student by ID with access control
   */
  static async getStudentById(studentId, tenantId, userId = null, userRole = null, schema) {
    const resolvedSchema = schema || getSchema();
    const baseSelect = this.getBaseSelect(resolvedSchema);
    let sql = `${baseSelect} AND es.id = $1 AND es.tenant_id = $2`;
    const params = [studentId, tenantId];

    // If not admin, restrict to counsellor's own students
    if (userRole !== 'admin' && userId) {
      sql += ' AND l.assigned_user_id = $3';
      params.push(userId);
    }

    logger.debug('[StudentRepository] Getting student by ID', { studentId, tenantId, userId, userRole });

    const result = await query(sql, params);
    return result.rows[0];
  }

  /**
   * Create a new student
   */
  static async createStudent(studentData, tenantId, schema) {
    const resolvedSchema = schema || getSchema();
    
    // First create the education_students record
    const sql = `
      INSERT INTO ${resolvedSchema}.education_students (
        tenant_id,
        lead_id,
        student_parent_name,
        parent_designation,
        program_interested_in,
        country_interested,
        intake_year,
        intake_month,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `;

    const params = [
      tenantId,
      studentData.lead_id,
      studentData.student_parent_name || null,
      studentData.parent_designation || null,
      studentData.program_interested_in || null,
      studentData.country_interested || null,
      studentData.intake_year || null,
      studentData.intake_month || null
    ];

    logger.debug('[StudentRepository] Creating student', { tenantId, leadId: studentData.lead_id });

    const result = await query(sql, params);
    
    // If counsellor_id is provided, update the leads table
    if (studentData.counsellor_id) {
      await query(
        `UPDATE ${resolvedSchema}.leads SET assigned_user_id = $1 WHERE id = $2`,
        [studentData.counsellor_id, studentData.lead_id]
      );
    }
    
    return result.rows[0];
  }

  /**
   * Update student information
   */
  static async updateStudent(studentId, studentData, tenantId, schema) {
    const resolvedSchema = schema || getSchema();
    const sql = `
      UPDATE ${resolvedSchema}.education_students
      SET
        country_of_residence = COALESCE($1, country_of_residence),
        country_of_interest = COALESCE($2, country_of_interest),
        education_level = COALESCE($3, education_level),
        field_of_interest = COALESCE($4, field_of_interest),
        financial_capacity = COALESCE($5, financial_capacity),
        timeline_to_start = COALESCE($6, timeline_to_start),
        counsellor_id = COALESCE($7, counsellor_id),
        metadata = COALESCE($8, metadata),
        updated_at = NOW()
      WHERE id = $9 AND tenant_id = $10 AND is_deleted = FALSE
      RETURNING *
    `;

    const params = [
      studentData.country_of_residence,
      studentData.country_of_interest,
      studentData.education_level,
      studentData.field_of_interest,
      studentData.financial_capacity,
      studentData.timeline_to_start,
      studentData.counsellor_id,
      studentData.metadata,
      studentId,
      tenantId
    ];

    logger.debug('[StudentRepository] Updating student', { studentId, tenantId });

    const result = await query(sql, params);
    return result.rows[0];
  }

  /**
   * Soft delete a student
   */
  static async deleteStudent(studentId, tenantId, schema) {
    const resolvedSchema = schema || getSchema();
    const sql = `
      UPDATE ${resolvedSchema}.education_students
      SET is_deleted = TRUE, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `;

    logger.debug('[StudentRepository] Deleting student', { studentId, tenantId });

    const result = await query(sql, [studentId, tenantId]);
    return result.rows[0];
  }

  /**
   * Assign counsellor to student
   */
  static async assignCounsellorToStudent(studentId, counsellorId, tenantId, schema) {
    const resolvedSchema = schema || getSchema();
    
    // Update the assigned_user_id in the leads table instead of education_students
    const sql = `
      UPDATE ${resolvedSchema}.leads 
      SET assigned_user_id = $1, updated_at = NOW()
      WHERE id = (
        SELECT lead_id FROM ${resolvedSchema}.education_students 
        WHERE id = $2 AND tenant_id = $3
      )
      RETURNING *
    `;

    logger.debug('[StudentRepository] Assigning counsellor to student', { studentId, counsellorId, tenantId });

    const result = await query(sql, [counsellorId, studentId, tenantId]);
    return result.rows[0];
  }

  /**
   * Get all counsellors for a tenant
   */
  static async getAllCounsellors(tenantId, schema) {
    const resolvedSchema = schema || getSchema();
    const sql = `
      SELECT 
        ec.id,
        ec.user_id,
        ec.display_name as name,
        ec.designation,
        ec.specialization,
        ec.timezone,
        ec.is_active,
        ec.max_sessions_per_day,
        ec.metadata,
        ec.created_at,
        ec.updated_at
      FROM ${resolvedSchema}.education_counsellors ec
      WHERE ec.tenant_id = $1 AND ec.is_deleted = FALSE
      ORDER BY ec.display_name ASC
    `;

    logger.debug('[StudentRepository] Getting all counsellors', { tenantId, schema: resolvedSchema });

    const result = await query(sql, [tenantId]);
    
    logger.debug('[StudentRepository] Counsellors query result', { 
      tenantId, 
      counsellorCount: result.rows.length 
    });

    return result.rows;
  }
}

module.exports = StudentRepository;