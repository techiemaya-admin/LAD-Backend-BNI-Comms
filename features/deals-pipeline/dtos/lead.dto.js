/**
 * Lead DTO - LAD Architecture Compliant
 * Data Transfer Object for lead field mapping
 * Handles conversion between API fields and database columns
 */

const { PRIORITY_TO_INT, INT_TO_PRIORITY } = require('../constants/priority');

// Field mapping: API field names → Database column names
const FIELD_MAPPING = {
  name: 'first_name',
  company: 'company_name',
  value: 'estimated_value'
};

/**
 * Map API fields to database columns
 * @param {Object} data - API request data
 * @returns {Object} Database-formatted data
 */
function toDatabase(data) {
  const mapped = {};
  Object.keys(data).forEach(key => {
    const dbField = FIELD_MAPPING[key] || key;
    let value = data[key];
    
    // Convert priority string to integer for DB
    if (key === 'priority' && typeof value === 'string') {
      value = PRIORITY_TO_INT[value] || 2; // default to medium
    }
    
    mapped[dbField] = value;
  });
  return mapped;
}

/**
 * Map database columns to API fields
 * @param {Object} data - Database row data
 * @returns {Object} API-formatted data
 */
function fromDatabase(data) {
  if (!data) return null;
  const mapped = { ...data };
  
  // Combine first_name and last_name into name
  if (data.first_name || data.last_name) {
    mapped.name = [data.first_name, data.last_name].filter(Boolean).join(' ');
  }
  
  // Map company_name → company
  if (data.company_name) {
    mapped.company = data.company_name;
  }
  
  // Map estimated_value → value
  if (data.estimated_value !== undefined) {
    mapped.value = data.estimated_value;
  }
  
  // Convert priority integer to string
  if (typeof data.priority === 'number') {
    mapped.priority = INT_TO_PRIORITY[data.priority] || 'medium';
  }
  
  return mapped;
}

module.exports = {
  toDatabase,
  fromDatabase,
  FIELD_MAPPING
};
