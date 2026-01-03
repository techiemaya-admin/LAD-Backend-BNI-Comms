/**
 * Student DTO (Data Transfer Object)
 * LAD-Compliant: Transforms between API and Database formats
 */

/**
 * Transform student from DB format to API format
 * @param {Object} dbStudent - Student data from database (joined with lead)
 * @returns {Object} API format student
 */
function studentToApi(dbStudent) {
  if (!dbStudent) {
    return null;
  }

  return {
    // Lead fields (from leads table)
    id: dbStudent.id,
    lead_id: dbStudent.lead_id,
    name: dbStudent.student_name || dbStudent.name,
    email: dbStudent.email,
    phone: dbStudent.phone,
    stage: dbStudent.stage,
    status: dbStudent.status,
    assigned_user_id: dbStudent.assigned_user_id,
    tenant_id: dbStudent.tenant_id,
    created_at: dbStudent.created_at,
    updated_at: dbStudent.updated_at,

    // Education-specific fields (from education_students table)
    student: {
      id: dbStudent.id,
      lead_id: dbStudent.lead_id,
      counsellor_id: dbStudent.counsellor_id,
      
      // Current education
      current_education_level: dbStudent.current_education_level,
      current_institution: dbStudent.current_institution,
      gpa: dbStudent.gpa,
      graduation_year: dbStudent.graduation_year,
      
      // Target education
      target_degree: dbStudent.target_degree,
      target_major: dbStudent.target_major,
      target_universities: dbStudent.target_universities,
      target_countries: dbStudent.target_countries,
      
      // Test scores
      sat_score: dbStudent.sat_score,
      act_score: dbStudent.act_score,
      toefl_score: dbStudent.toefl_score,
      ielts_score: dbStudent.ielts_score,
      gre_score: dbStudent.gre_score,
      gmat_score: dbStudent.gmat_score,
      
      // Financial & timeline
      budget_range: dbStudent.budget_range,
      preferred_intake: dbStudent.preferred_intake,
      scholarship_interest: dbStudent.scholarship_interest,
      
      // Counsellor info (if assigned)
      counsellor: dbStudent.counsellor_id ? {
        id: dbStudent.counsellor_id,
        name: dbStudent.counsellor_first_name && dbStudent.counsellor_last_name
          ? `${dbStudent.counsellor_first_name} ${dbStudent.counsellor_last_name}`
          : null,
        designation: dbStudent.designation,
        specialization: dbStudent.specialization,
      } : null,
      
      // Metadata
      created_at: dbStudent.created_at,
      updated_at: dbStudent.updated_at,
    },
  };
}

/**
 * Transform from API format to DB format (for create/update)
 * Separates lead data from student-specific data
 * @param {Object} apiStudent - Student from API request
 * @returns {Object} Object with leadData and studentData
 */
function studentFromApi(apiStudent) {
  return {
    // Lead table fields
    leadData: {
      first_name: apiStudent.name,
      email: apiStudent.email,
      phone: apiStudent.phone,
      company_name: apiStudent.company || null,
      estimated_value: apiStudent.value || null,
      stage: apiStudent.stage || 'inquiry',
      status: apiStudent.status || 'active',
      source: apiStudent.source || null,
      priority: apiStudent.priority || 'medium',
      assigned_user_id: apiStudent.assigned_user_id || null,
    },
    
    // Education_students table fields
    studentData: {
      counsellor_id: apiStudent.counsellor_id || null,
      
      // Current education
      current_education_level: apiStudent.current_education_level || null,
      current_institution: apiStudent.current_institution || null,
      gpa: apiStudent.gpa || null,
      graduation_year: apiStudent.graduation_year || null,
      
      // Target education
      target_degree: apiStudent.target_degree || null,
      target_major: apiStudent.target_major || null,
      target_universities: apiStudent.target_universities || null,
      target_countries: apiStudent.target_countries || null,
      
      // Test scores
      sat_score: apiStudent.sat_score || null,
      act_score: apiStudent.act_score || null,
      toefl_score: apiStudent.toefl_score || null,
      ielts_score: apiStudent.ielts_score || null,
      gre_score: apiStudent.gre_score || null,
      gmat_score: apiStudent.gmat_score || null,
      
      // Financial & timeline
      budget_range: apiStudent.budget_range || null,
      preferred_intake: apiStudent.preferred_intake || null,
      scholarship_interest: apiStudent.scholarship_interest || false,
    },
  };
}

/**
 * Transform lead from DB to API format
 * @param {Object} dbLead - Lead data from database
 * @returns {Object} API format lead
 */
function leadToApi(dbLead) {
  if (!dbLead) {
    return null;
  }

  return {
    id: dbLead.id,
    name: dbLead.first_name || dbLead.name,
    email: dbLead.email,
    phone: dbLead.phone,
    company: dbLead.company_name || dbLead.company,
    value: dbLead.estimated_value || dbLead.value,
    stage: dbLead.stage,
    status: dbLead.status,
    source: dbLead.source,
    priority: dbLead.priority,
    assigned_user_id: dbLead.assigned_user_id,
    tenant_id: dbLead.tenant_id,
    created_at: dbLead.created_at,
    updated_at: dbLead.updated_at,
    created_by: dbLead.created_by,
    is_deleted: dbLead.is_deleted,
  };
}

/**
 * Transform lead from API to DB format
 * @param {Object} apiLead - Lead from API request
 * @returns {Object} DB format lead
 */
function leadFromApi(apiLead) {
  return {
    first_name: apiLead.name,
    email: apiLead.email,
    phone: apiLead.phone,
    company_name: apiLead.company,
    estimated_value: apiLead.value,
    stage: apiLead.stage,
    status: apiLead.status,
    source: apiLead.source,
    priority: apiLead.priority,
    assigned_user_id: apiLead.assigned_user_id,
  };
}

module.exports = {
  studentToApi,
  studentFromApi,
  leadToApi,
  leadFromApi,
};
