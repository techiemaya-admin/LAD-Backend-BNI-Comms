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
    es.*,
    l.name AS student_name,
    l.email,
    l.phone,
    l.stage,
    l.status,
    ec.id AS counsellor_id,
    ec.designation,
    ec.specialization,
    u.first_name AS counsellor_first_name,
    u.last_name AS counsellor_last_name
  FROM ${schema}.education_students es
  JOIN ${schema}.leads l ON l.id = es.lead_id AND l.tenant_id = es.tenant_id
  LEFT JOIN ${schema}.education_counsellors ec ON ec.id = es.counsellor_id AND ec.tenant_id = es.tenant_id
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
    AND es.counsellor_id = $2
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

  let sql = `${getBaseSelect(schema)} AND es.id = $1 AND es.tenant_id = $2`;
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
exports.updateStudent = async (studentId, user, data, schema = DEFAULT_SCHEMA) => {
  if (!user.tenantId) {
    throw new Error('tenant_id is required for updateStudent');
  }

  const fields = [];
  const values = [];
  let idx = 1;

  Object.entries(data).forEach(([key, val]) => {
    fields.push(`${key} = $${idx++}`);
    values.push(val);
  });

  if (!fields.length) throw new Error('No fields to update');

  const sql = `
    UPDATE ${schema}.education_students
    SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${idx} AND tenant_id = $${idx + 1}
    RETURNING *
  `;

  values.push(studentId, user.tenantId);
  const result = await query(sql, values);
  return result.rows[0];
};

// DELETE (soft)
exports.softDeleteStudent = async (studentId, user, schema = DEFAULT_SCHEMA) => {
  if (!user.tenantId) {
    throw new Error('tenant_id is required for softDeleteStudent');
  }

  const sql = `
    UPDATE ${schema}.education_students
    SET is_deleted = TRUE, updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
  `;
  await query(sql, [studentId, user.tenantId]);
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
        name,
        email,
        phone,
        source,
        stage,
        status,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,'new','new',$6)
      RETURNING *
      `,
      [
        user.tenantId,
        data.name,
        data.email || null,
        data.phone || null,
        data.source || 'Student Form',
        user.id
      ]
    );

    const lead = leadResult.rows[0];

    // 2️⃣ INSERT EDUCATION STUDENT
    const studentResult = await query(
      `
      INSERT INTO ${schema}.education_students (
        tenant_id,
        lead_id,
        country_of_residence,
        counsellor_meeting_link,
        program_interested_in,
        country_interested,
        intake_year,
        metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
      `,
      [
        user.tenantId,
        lead.id,
        data.country_of_residence,
        data.counsellor_meeting_link,
        data.program_interested_in || null,
        data.country_interested || null,
        data.intake_year || null,
        data.metadata || {}
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
    es.*,
    l.name AS student_name,
    l.email,
    l.phone,
    l.stage,
    l.status,
    ec.id AS counsellor_id,
    ec.designation,
    ec.specialization,
    u.first_name AS counsellor_first_name,
    u.last_name AS counsellor_last_name
  FROM lad_dev.education_students es
  JOIN lad_dev.leads l ON l.id = es.lead_id
  LEFT JOIN lad_dev.education_counsellors ec ON ec.id = es.counsellor_id
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
    AND es.counsellor_id = $2
    ORDER BY es.created_at DESC
  `;
  
  console.log('[student.model] Executing SQL:', sql);
  console.log('[student.model] With params:', [tenantId, counsellorId]);
  
  const result = await query(sql, [tenantId, counsellorId]);
  console.log(`[student.model] Query returned ${result.rows.length} rows`);
  
  return result.rows;
};

// GET by ID with access check
exports.getStudentById = async (studentId, user) => {
  let sql = `${BASE_SELECT} AND es.id = $1 AND es.tenant_id = $2`;
  const params = [studentId, user.tenantId];

  if (user.role !== 'admin') {
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
exports.updateStudent = async (studentId, user, data) => {
  const fields = [];
  const values = [];
  let idx = 1;

  Object.entries(data).forEach(([key, val]) => {
    fields.push(`${key} = $${idx++}`);
    values.push(val);
  });

  if (!fields.length) throw new Error('No fields to update');

  const sql = `
    UPDATE lad_dev.education_students
    SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${idx} AND tenant_id = $${idx + 1}
    RETURNING *
  `;

  values.push(studentId, user.tenantId);
  const result = await query(sql, values);
  return result.rows[0];
};

// DELETE (soft)
exports.softDeleteStudent = async (studentId, user) => {
  const sql = `
    UPDATE lad_dev.education_students
    SET is_deleted = TRUE, updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
  `;
  await query(sql, [studentId, user.tenantId]);
};


exports.createLeadAndStudent = async (user, data) => {
  try {
    await query('BEGIN');

    // 1️⃣ INSERT LEAD
    const leadResult = await query(
      `
      INSERT INTO lad_dev.leads (
        tenant_id,
        name,
        email,
        phone,
        source,
        stage,
        status,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,'new','new',$6)
      RETURNING *
      `,
      [
        user.tenantId,
        data.name,
        data.email || null,
        data.phone || null,
        data.source || 'Student Form',
        user.id
      ]
    );

    const lead = leadResult.rows[0];

    // 2️⃣ INSERT EDUCATION STUDENT
    const studentResult = await query(
      `
      INSERT INTO lad_dev.education_students (
        tenant_id,
        lead_id,
        country_of_residence,
        counsellor_meeting_link,
        program_interested_in,
        country_interested,
        intake_year,
        metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
      `,
      [
        user.tenantId,
        lead.id,
        data.country_of_residence,
        data.counsellor_meeting_link,
        data.program_interested_in || null,
        data.country_interested || null,
        data.intake_year || null,
        data.metadata || {}
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
