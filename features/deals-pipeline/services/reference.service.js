/**
 * Reference Data Service - LAD Architecture Compliant
 * Business logic for reference data (statuses, sources, priorities)
 * Controllers → Services → Models
 */

const ReferenceRepository = require('../repositories/ReferenceRepository');

/**
 * Get all lead statuses
 */
exports.getStatuses = async (tenant_id, schema) => {
  try {
    if (!tenant_id) {
      throw new Error('tenant_id is required for getStatuses');
    }
    
    const result = await ReferenceRepository.getPipelineStatuses(tenant_id, schema);
    return result || [];
  } catch (error) {
    // If all else fails, return basic static statuses
    const logger = require('../../../core/utils/logger');
    logger.error('[ReferenceService] Error getting statuses, returning fallback', { 
      error: error.message,
      tenant_id 
    });
    
    return [
      { id: 1, key: 'active', label: 'Active', color: '#10B981' },
      { id: 2, key: 'on_hold', label: 'On Hold', color: '#F59E0B' },
      { id: 3, key: 'closed_won', label: 'Closed Won', color: '#059669' },
      { id: 4, key: 'closed_lost', label: 'Closed Lost', color: '#EF4444' },
      { id: 5, key: 'archived', label: 'Archived', color: '#6B7280' },
      { id: 6, key: 'inactive', label: 'InActive', color: '#9CA3AF' },
    ];
  }
};

/**
 * Get all lead sources (static data - tenant-aware for future expansion)
 */
exports.getSources = (tenant_id, schema) => {
  // Static data for now, but tenant_id passed for future customization
  return [
    { key: 'website', label: 'Website' },
    { key: 'referral', label: 'Referral' },
    { key: 'event', label: 'Event' },
    { key: 'social', label: 'Social Media' },
    { key: 'cold_call', label: 'Cold Call' },
    { key: 'email', label: 'Email Campaign' }
  ];
};

/**
 * Get all lead priorities (static data - tenant-aware for future expansion)
 */
exports.getPriorities = (tenant_id, schema) => {
  // Static data for now, but tenant_id passed for future customization
  return [
    { key: 'low', label: 'Low' },
    { key: 'medium', label: 'Medium' },
    { key: 'high', label: 'High' },
    { key: 'urgent', label: 'Urgent' }
  ];
};
