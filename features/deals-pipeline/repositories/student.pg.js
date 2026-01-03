/**
 * Student PG Model - LAD Architecture Compliant
 */

const { query } = require('../../../shared/database/connection');

// Try core paths first, fallback to local shared
let DEFAULT_SCHEMA, logger;
try {
  ({ DEFAULT_SCHEMA } = require('../../../../core/utils/schemaHelper'));
  logger = require('../../../../core/utils/logger');
} catch (e) {
  ({ DEFAULT_SCHEMA } = require('../../../shared/utils/schemaHelper'));
  logger = require('../../../shared/utils/logger');
}

// 🔹 Base SELECT function (returns query based on schema)
const getBaseSelect = (schema) => `
  SELECT
    es.lead_id AS id,
    es.tenant_id,
    es.lead_id,
    es.program_interested_in,
    es.country_interested,
    es.intake_year,
    es.intake_month,
    es.metadata,
    es.created_at,
    es.updated_at,
    l.first_name AS student_name,
    l.email,
    l.phone,
    l.assigned_user_id,
    l.stage,
    l.status,
    ec.user_id AS counsellor_id,
    ec.designation,
    ec.specialization,
    u.first_name AS counsellor_first_name,
    u.last_name AS counsellor_last_name
  FROM ${schema}.education_students es
  JOIN ${schema}.leads l ON l.id = es.lead_id AND l.tenant_id = es.tenant_id
  LEFT JOIN ${schema}.education_counsellors ec ON l.assigned_user_id = ec.user_id AND ec.tenant_id = es.tenant_id
  LEFT JOIN ${schema}.users u ON u.id = ec.user_id
  WHERE es.is_deleted = FALSE
`;


// ADMIN: all students in tenant
exports.getStudentsByTenant = async (tenantId, schema = DEFAULT_SCHEMA) => {
  if (!tenantId) {
    throw new Error('tenant_id is required for getStudentsByTenant');
  }

  const sql = `${getBaseSelect(schema)} AND es.tenant_id = $1 ORDER BY es.created_at DESC`;
  const result = await query(sql, [tenantId]);
  return result.rows;
};

// USER/COUNSELLOR: only own students (scoped via counsellor.user_id)
exports.getStudentsByUser = async (tenantId, userId, schema = DEFAULT_SCHEMA) => {
  if (!tenantId) {
    throw new Error('tenant_id is required for getStudentsByUser');
  }

  const sql = `
    ${getBaseSelect(schema)}
    AND es.tenant_id = $1
    AND ec.user_id = $2
    ORDER BY es.created_at DESC
  `;
  const result = await query(sql, [tenantId, userId]);
  return result.rows;
};

// Get counsellor ID for a user
exports.getCounsellorIdByUser = async (userId, tenantId, schema = DEFAULT_SCHEMA) => {
  if (!tenantId) {
    throw new Error('tenant_id is required for getCounsellorIdByUser');
  }

  logger.debug('Getting counsellor ID by user', { userId, tenantId });
  
  const sql = `
    SELECT id, user_id, name, email 
    FROM ${schema}.education_counsellors 
    WHERE user_id = $1 AND tenant_id = $2
    LIMIT 1
  `;
  
  const result = await query(sql, [userId, tenantId]);
  logger.debug('Found counsellor', { counsellor: result.rows[0] || null });
  
  return result.rows[0]?.id;
};

// Get students for a counsellor (by counsellor user_id)
exports.getStudentsByCounsellor = async (tenantId, userId, schema = DEFAULT_SCHEMA) => {
  if (!tenantId) {
    throw new Error('tenant_id is required for getStudentsByCounsellor');
  }

  logger.debug('Getting students by counsellor', { tenantId, userId });
  
  // First, get the counsellor ID for this user
  const counsellorId = await exports.getCounsellorIdByUser(userId, tenantId, schema);
  
  if (!counsellorId) {
    logger.debug('No counsellor found for user', { userId });
    return []; // No counsellor found for this user
  }
  
  const sql = `
    ${getBaseSelect(schema)}
    AND es.tenant_id = $1
    AND l.assigned_user_id = $2
    ORDER BY es.created_at DESC
  `;
  
  const result = await query(sql, [tenantId, counsellorId]);
  logger.debug('Query returned students', { count: result.rows.length });
  
  return result.rows;
};

// GET by ID with access check
exports.getStudentById = async (studentId, user, schema = DEFAULT_SCHEMA) => {
  if (!user.tenantId) {
    throw new Error('tenant_id is required for getStudentById');
  }

  let sql = `${getBaseSelect(schema)} AND es.lead_id = $1 AND es.tenant_id = $2`;
  const params = [studentId, user.tenantId];

  if (user.role !== 'admin') {
    sql += ' AND ec.user_id = $3';
    params.push(user.id);
  }

  const result = await query(sql, params);
  return result.rows[0];
};

// CREATE
exports.createStudent = async (user, data, schema = DEFAULT_SCHEMA) => {
  if (!user.tenantId) {
    throw new Error('tenant_id is required for createStudent');
  }

  const sql = `
    INSERT INTO ${schema}.education_students (
      tenant_id,
      lead_id,
      country_of_residence,
      counsellor_meeting_link,
      program_interested_in,
      country_interested,
      intake_year,
      metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
  `;

  const params = [
    user.tenantId,
    data.lead_id,
    data.country_of_residence,
    data.counsellor_meeting_link,
    data.program_interested_in || null,
    data.country_interested || null,
    data.intake_year || null,
    data.metadata || {}
  ];

  const result = await query(sql, params);
  return result.rows[0];
};

// UPDATE
exports.updateStudent = async (studentId, tenant_id, schema = DEFAULT_SCHEMA, user, data) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for updateStudent');
  }

  try {
    await query('BEGIN');

    // 1️⃣ Get the lead_id
    console.log("[UPDATE DEBUG] Searching for student:", { studentId, tenant_id, schema });
    const studentResult = await query(
      `SELECT lead_id FROM ${schema}.education_students WHERE lead_id = $1 AND tenant_id = $2`,
      [studentId, tenant_id]
    );

    if (!studentResult.rows.length) {
      throw new Error('Student not found');
    }

    const leadId = studentResult.rows[0].lead_id;

    // 2️⃣ UPDATE LEAD
    const leadFields = [];
    const leadValues = [];
    let leadIdx = 1;

    if (data.name !== undefined) {
      leadFields.push(`first_name = $${leadIdx++}`);
      leadValues.push(data.name);
    }
    if (data.email !== undefined) {
      leadFields.push(`email = $${leadIdx++}`);
      leadValues.push(data.email);
    }
    if (data.phone !== undefined) {
      leadFields.push(`phone = $${leadIdx++}`);
      leadValues.push(data.phone);
    }
    if (data.source !== undefined) {
      leadFields.push(`source = $${leadIdx++}`);
      leadValues.push(data.source);
    }

    if (leadFields.length > 0) {
      leadValues.push(leadId, tenant_id);
      await query(
        `UPDATE ${schema}.leads SET ${leadFields.join(', ')}, updated_at = NOW() WHERE id = $${leadIdx} AND tenant_id = $${leadIdx + 1}`,
        leadValues
      );
    }

    // 3️⃣ UPDATE EDUCATION_STUDENTS
    const studentFields = [];
    const studentValues = [];
    let studentIdx = 1;

    if (data.target_degree !== undefined || data.target_major !== undefined) {
      studentFields.push(`program_interested_in = $${studentIdx++}`);
      studentValues.push(data.target_degree || data.target_major);
    }
    if (data.target_countries !== undefined) {
      studentFields.push(`country_interested = $${studentIdx++}`);
      studentValues.push(Array.isArray(data.target_countries) ? data.target_countries[0] : data.target_countries);
    }
    if (data.preferred_intake !== undefined) {
      studentFields.push(`intake_year = $${studentIdx++}`);
      studentValues.push(data.preferred_intake ? parseInt(data.preferred_intake.split('_')[1]) : null);
    }

    // Build metadata JSONB
    const metadata = {};
    const metadataFields = ['counsellor_id', 'current_education_level', 'current_institution', 'gpa', 'graduation_year', 'target_degree', 'target_major', 'target_universities', 'target_countries', 'sat_score', 'act_score', 'toefl_score', 'ielts_score', 'gre_score', 'gmat_score', 'budget_range', 'preferred_intake', 'scholarship_interest'];
    metadataFields.forEach(field => {
      if (data[field] !== undefined) metadata[field] = data[field];
    });

    if (Object.keys(metadata).length > 0) {
      studentFields.push(`metadata = metadata || $${studentIdx++}::jsonb`);
      studentValues.push(JSON.stringify(metadata));
    }

    if (studentFields.length > 0) {
      studentValues.push(studentId, tenant_id);
      await query(
        `UPDATE ${schema}.education_students SET ${studentFields.join(', ')}, updated_at = NOW() WHERE lead_id = $${studentIdx} AND tenant_id = $${studentIdx + 1}`,
        studentValues
      );
    }

    await query('COMMIT');

    // Return updated student
    const userWithTenant = { ...user, tenantId: tenant_id, role: 'admin' };
    const updated = await exports.getStudentById(studentId, userWithTenant, schema);
    return updated;
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
};

// DELETE (soft)
exports.softDeleteStudent = async (studentId, tenant_id, schema = DEFAULT_SCHEMA, user) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for softDeleteStudent');
  }

  const sql = `
    UPDATE ${schema}.education_students
    SET is_deleted = TRUE, updated_at = NOW()
    WHERE lead_id = $1 AND tenant_id = $2
    RETURNING lead_id
  `;
  const result = await query(sql, [studentId, tenant_id]);
  return result.rows[0]; // Returns the deleted student's lead_id or undefined if not found
};


exports.createLeadAndStudent = async (user, data, schema = DEFAULT_SCHEMA) => {
  if (!user.tenantId) {
    throw new Error('tenant_id is required for createLeadAndStudent');
  }

  try {
    await query('BEGIN');

    // 1️⃣ INSERT LEAD
    const leadResult = await query(
      `
      INSERT INTO ${schema}.leads (
        tenant_id,
        first_name,
        email,
        phone,
        source,
        stage,
        status
      )
      VALUES ($1,$2,$3,$4,$5,'new','new')
      RETURNING *
      `,
      [
        user.tenantId,
        data.name,
        data.email || null,
        data.phone || null,
        data.source || 'Student Form'
      ]
    );

    const lead = leadResult.rows[0];

    // 2️⃣ INSERT EDUCATION STUDENT
    // Map to existing columns + store rest in metadata JSONB
    const metadata = {
      counsellor_id: data.counsellor_id || null,
      current_education_level: data.current_education_level || null,
      current_institution: data.current_institution || null,
      gpa: data.gpa || null,
      graduation_year: data.graduation_year || null,
      target_degree: data.target_degree || null,
      target_major: data.target_major || null,
      target_universities: data.target_universities || null,
      target_countries: data.target_countries || null,
      sat_score: data.sat_score || null,
      act_score: data.act_score || null,
      toefl_score: data.toefl_score || null,
      ielts_score: data.ielts_score || null,
      gre_score: data.gre_score || null,
      gmat_score: data.gmat_score || null,
      budget_range: data.budget_range || null,
      preferred_intake: data.preferred_intake || null,
      scholarship_interest: data.scholarship_interest || false,
    };
    
    const studentResult = await query(
      `
      INSERT INTO ${schema}.education_students (
        tenant_id,
        lead_id,
        program_interested_in,
        country_interested,
        intake_year,
        metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [
        user.tenantId,
        lead.id,
        data.target_degree || data.target_major || null,
        Array.isArray(data.target_countries) ? data.target_countries[0] : null,
        data.preferred_intake ? parseInt(data.preferred_intake.split('_')[1]) : null,
        JSON.stringify(metadata)
      ]
    );

    await query('COMMIT');

    return {
      lead,
      student: studentResult.rows[0]
    };
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }
};


// 🔹 Base SELECT (joined)
const BASE_SELECT = `
  SELECT
    es.lead_id AS id,
    es.tenant_id,
    es.lead_id,
    es.program_interested_in,
    es.country_interested,
    es.intake_year,
    es.intake_month,
    es.metadata,
    es.created_at,
    es.updated_at,
    l.first_name AS student_name,
    l.email,
    l.phone,
    l.assigned_user_id,
    l.stage,
    l.status,
    ec.user_id AS counsellor_id,
    ec.designation,
    ec.specialization,
    u.first_name AS counsellor_first_name,
    u.last_name AS counsellor_last_name
  FROM lad_dev.education_students es
  JOIN lad_dev.leads l ON l.id = es.lead_id AND l.tenant_id = es.tenant_id
  LEFT JOIN lad_dev.education_counsellors ec ON l.assigned_user_id = ec.user_id AND ec.tenant_id = es.tenant_id
  LEFT JOIN lad_dev.users u ON u.id = ec.user_id
  WHERE es.is_deleted = FALSE
`;


// ADMIN: all students in tenant
exports.getStudentsByTenant = async (tenantId) => {
  const sql = `${BASE_SELECT} AND es.tenant_id = $1 ORDER BY es.created_at DESC`;
  const result = await query(sql, [tenantId]);
  return result.rows;
};

// USER/COUNSELLOR: only own students (scoped via counsellor.user_id)
exports.getStudentsByUser = async (tenantId, userId) => {
  const sql = `
    ${BASE_SELECT}
    AND es.tenant_id = $1
    AND ec.user_id = $2
    ORDER BY es.created_at DESC
  `;
  const result = await query(sql, [tenantId, userId]);
  return result.rows;
};

// Get counsellor ID for a user
exports.getCounsellorIdByUser = async (userId) => {
  console.log(`[student.model] getCounsellorIdByUser - userId: ${userId}`);
  
  const sql = `
    SELECT id, user_id, name, email 
    FROM lad_dev.education_counsellors 
    WHERE user_id = $1 
    LIMIT 1
  `;
  
  console.log('[student.model] Executing SQL:', sql);
  console.log('[student.model] With params:', [userId]);
  
  const result = await query(sql, [userId]);
  console.log(`[student.model] Found counsellor:`, result.rows[0] || 'None');
  
  return result.rows[0]?.id;
};

// Get students for a counsellor (by counsellor user_id)
exports.getStudentsByCounsellor = async (tenantId, userId) => {
  console.log(`[student.model] getStudentsByCounsellor - tenantId: ${tenantId}, userId: ${userId}`);
  
  // First, get the counsellor ID for this user
  const counsellorId = await exports.getCounsellorIdByUser(userId);
  console.log(`[student.model] Found counsellorId: ${counsellorId} for userId: ${userId}`);
  
  if (!counsellorId) {
    console.log('[student.model] No counsellor found for user, returning empty array');
    return []; // No counsellor found for this user
  }
  
  const sql = `
    ${BASE_SELECT}
    AND es.tenant_id = $1
    AND l.assigned_user_id = $2
    ORDER BY es.created_at DESC
  `;
  
  console.log('[student.model] Executing SQL:', sql);
  console.log('[student.model] With params:', [tenantId, counsellorId]);
  
  const result = await query(sql, [tenantId, counsellorId]);
  console.log(`[student.model] Query returned ${result.rows.length} rows`);
  
  return result.rows;
};

// GET by ID with access check
exports.getStudentById = async (studentId, tenant_id, schema = DEFAULT_SCHEMA, user) => {
  // Build query with tenant_id from parameter, not user object
  const baseSelect = getBaseSelect(schema);
  let sql = `${baseSelect} AND es.lead_id = $1 AND es.tenant_id = $2`;
  const params = [studentId, tenant_id];

  // In development, bypass role check, or if user has admin role
  if (user && user.role !== 'admin' && process.env.NODE_ENV !== 'development') {
    sql += ' AND ec.user_id = $3';
    params.push(user.id);
  }

  const result = await query(sql, params);
  return result.rows[0];
};

// CREATE
exports.createStudent = async (user, data) => {
  const sql = `
    INSERT INTO lad_dev.education_students (
      tenant_id,
      lead_id,
      country_of_residence,
      counsellor_meeting_link,
      program_interested_in,
      country_interested,
      intake_year,
      metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
  `;

  const params = [
    user.tenantId,
    data.lead_id,
    data.country_of_residence,
    data.counsellor_meeting_link,
    data.program_interested_in || null,
    data.country_interested || null,
    data.intake_year || null,
    data.metadata || {}
  ];

  const result = await query(sql, params);
  return result.rows[0];
};

// UPDATE
exports.updateStudent = async (studentId, tenant_id, schema = DEFAULT_SCHEMA, user, data) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for updateStudent');
  }

  try {
    await query('BEGIN');

    // 1️⃣ Get the lead_id
    console.log("[UPDATE DEBUG] Searching for student:", { studentId, tenant_id, schema });
    const studentResult = await query(
      `SELECT lead_id FROM ${schema}.education_students WHERE lead_id = $1 AND tenant_id = $2`,
      [studentId, tenant_id]
    );
    console.log("[UPDATE DEBUG] Query result:", { found: studentResult.rows.length, rows: studentResult.rows });

    if (!studentResult.rows.length) {
      throw new Error('Student not found');
    }

    const leadId = studentResult.rows[0].lead_id;

    // 2️⃣ UPDATE LEAD
    const leadFields = [];
    const leadValues = [];
    let leadIdx = 1;

    if (data.name !== undefined) {
      leadFields.push(`first_name = $${leadIdx++}`);
      leadValues.push(data.name);
    }
    if (data.email !== undefined) {
      leadFields.push(`email = $${leadIdx++}`);
      leadValues.push(data.email);
    }
    if (data.phone !== undefined) {
      leadFields.push(`phone = $${leadIdx++}`);
      leadValues.push(data.phone);
    }
    if (data.source !== undefined) {
      leadFields.push(`source = $${leadIdx++}`);
      leadValues.push(data.source);
    }

    if (leadFields.length > 0) {
      leadValues.push(leadId, tenant_id);
      await query(
        `UPDATE ${schema}.leads SET ${leadFields.join(', ')}, updated_at = NOW() WHERE id = $${leadIdx} AND tenant_id = $${leadIdx + 1}`,
        leadValues
      );
    }

    // 3️⃣ UPDATE EDUCATION_STUDENTS
    const studentFields = [];
    const studentValues = [];
    let studentIdx = 1;

    if (data.target_degree !== undefined || data.target_major !== undefined) {
      studentFields.push(`program_interested_in = $${studentIdx++}`);
      studentValues.push(data.target_degree || data.target_major);
    }
    if (data.target_countries !== undefined) {
      studentFields.push(`country_interested = $${studentIdx++}`);
      studentValues.push(Array.isArray(data.target_countries) ? data.target_countries[0] : data.target_countries);
    }
    if (data.preferred_intake !== undefined) {
      studentFields.push(`intake_year = $${studentIdx++}`);
      studentValues.push(data.preferred_intake ? parseInt(data.preferred_intake.split('_')[1]) : null);
    }

    // Build metadata JSONB
    const metadata = {};
    const metadataFields = ['counsellor_id', 'current_education_level', 'current_institution', 'gpa', 'graduation_year', 'target_degree', 'target_major', 'target_universities', 'target_countries', 'sat_score', 'act_score', 'toefl_score', 'ielts_score', 'gre_score', 'gmat_score', 'budget_range', 'preferred_intake', 'scholarship_interest'];
    metadataFields.forEach(field => {
      if (data[field] !== undefined) metadata[field] = data[field];
    });

    if (Object.keys(metadata).length > 0) {
      studentFields.push(`metadata = metadata || $${studentIdx++}::jsonb`);
      studentValues.push(JSON.stringify(metadata));
    }

    if (studentFields.length > 0) {
      studentValues.push(studentId, tenant_id);
      await query(
        `UPDATE ${schema}.education_students SET ${studentFields.join(', ')}, updated_at = NOW() WHERE lead_id = $${studentIdx} AND tenant_id = $${studentIdx + 1}`,
        studentValues
      );
    }

    await query('COMMIT');

    // Return updated student
    const userWithTenant = { ...user, tenantId: tenant_id, role: 'admin' };
    const updated = await exports.getStudentById(studentId, userWithTenant, schema);
    return updated;
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
};

// DELETE (soft)
exports.softDeleteStudent = async (studentId, tenant_id, schema = DEFAULT_SCHEMA, user) => {
  if (!tenant_id) {
    throw new Error('tenant_id is required for softDeleteStudent');
  }

  const sql = `
    UPDATE ${schema}.education_students
    SET is_deleted = TRUE, updated_at = NOW()
    WHERE lead_id = $1 AND tenant_id = $2
    RETURNING lead_id
  `;
  const result = await query(sql, [studentId, tenant_id]);
  return result.rows[0]; // Returns the deleted student's lead_id or undefined if not found
};


exports.createLeadAndStudent = async (user, data) => {
  try {
    await query('BEGIN');

    // 1️⃣ INSERT LEAD
    const leadResult = await query(
      `
      INSERT INTO lad_dev.leads (
        tenant_id,
        first_name,
        email,
        phone,
        source,
        stage,
        status
      )
      VALUES ($1,$2,$3,$4,$5,'new','new')
      RETURNING *
      `,
      [
        user.tenantId,
        data.name,
        data.email || null,
        data.phone || null,
        data.source || 'Student Form'
      ]
    );

    const lead = leadResult.rows[0];

    // 2️⃣ INSERT EDUCATION STUDENT
    // Map to existing columns + store rest in metadata JSONB
    const metadata = {
      counsellor_id: data.counsellor_id || null,
      current_education_level: data.current_education_level || null,
      current_institution: data.current_institution || null,
      gpa: data.gpa || null,
      graduation_year: data.graduation_year || null,
      target_degree: data.target_degree || null,
      target_major: data.target_major || null,
      target_universities: data.target_universities || null,
      target_countries: data.target_countries || null,
      sat_score: data.sat_score || null,
      act_score: data.act_score || null,
      toefl_score: data.toefl_score || null,
      ielts_score: data.ielts_score || null,
      gre_score: data.gre_score || null,
      gmat_score: data.gmat_score || null,
      budget_range: data.budget_range || null,
      preferred_intake: data.preferred_intake || null,
      scholarship_interest: data.scholarship_interest || false,
    };
    
    const studentResult = await query(
      `
      INSERT INTO lad_dev.education_students (
        tenant_id,
        lead_id,
        program_interested_in,
        country_interested,
        intake_year,
        metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [
        user.tenantId,
        lead.id,
        data.target_degree || data.target_major || null,
        Array.isArray(data.target_countries) ? data.target_countries[0] : null,
        data.preferred_intake ? parseInt(data.preferred_intake.split('_')[1]) : null,
        JSON.stringify(metadata)
      ]
    );

    await query('COMMIT');

    return {
      lead,
      student: studentResult.rows[0]
    };
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }
};
