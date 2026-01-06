/**
 * Reference Repository - LAD Architecture Compliant
 * Data access layer for deals-pipeline reference data
 */

const { pool } = require('../../../shared/database/connection');
const { getSchema } = require('../../../core/utils/schemaHelper');
const logger = require('../../../core/utils/logger');

class ReferenceRepository {
  /**
   * Get all pipeline statuses for a tenant
   */
  static async getPipelineStatuses(tenantId, schema) {
    const resolvedSchema = schema || getSchema();
    
    // For now, return static statuses since the table might not exist
    // In production, this would query the database
    const staticStatuses = [
      { id: 1, key: 'active', label: 'Active', color: '#10B981' },
      { id: 2, key: 'on_hold', label: 'On Hold', color: '#F59E0B' },
      { id: 3, key: 'closed_won', label: 'Closed Won', color: '#059669' },
      { id: 4, key: 'closed_lost', label: 'Closed Lost', color: '#EF4444' },
      { id: 5, key: 'archived', label: 'Archived', color: '#6B7280' },
      { id: 6, key: 'inactive', label: 'InActive', color: '#9CA3AF' },
    ];

    logger.debug('[ReferenceRepository] Getting pipeline statuses', { tenantId, schema: resolvedSchema });
    
    try {
      // First check if pool is available
      if (!pool) {
        logger.warn('[ReferenceRepository] No database pool available, using static statuses');
        return staticStatuses;
      }

      const sql = `
        SELECT 
          id,
          key,
          label,
          color,
          created_at,
          updated_at
        FROM ${resolvedSchema}.lead_statuses 
        WHERE tenant_id = $1 OR tenant_id IS NULL
        ORDER BY label ASC
      `;

      const result = await pool.query(sql, [tenantId]);
      
      logger.debug('[ReferenceRepository] Pipeline statuses result', { 
        tenantId, 
        statusCount: result.rows.length 
      });

      return result.rows.length > 0 ? result.rows : staticStatuses;
    } catch (error) {
      logger.error('[ReferenceRepository] Database error, using static statuses', { 
        error: error.message,
        stack: error.stack,
        tenantId 
      });
      return staticStatuses;
    }
  }

  /**
   * Get pipeline board configuration for a tenant
   */
  static async getPipelineBoard(tenantId, schema) {
    const resolvedSchema = schema || getSchema();
    const sql = `
      SELECT 
        ls.id,
        ls.key,
        ls.label,
        ls.display_order,
        ls.tenant_id,
        ls.created_at,
        ls.updated_at
      FROM ${resolvedSchema}.lead_stages ls
      WHERE ls.tenant_id = $1
      ORDER BY ls.display_order ASC, ls.label ASC
    `;

    logger.debug('[ReferenceRepository] Getting pipeline board', { tenantId, schema: resolvedSchema });

    const result = await query(sql, [tenantId]);
    
    logger.debug('[ReferenceRepository] Pipeline board result', { 
      tenantId, 
      boardItemCount: result.rows.length 
    });

    return result.rows;
  }

  /**
   * Get education reference data (levels, specializations, etc.)
   */
  static async getEducationReferences(tenantId, schema) {
    const resolvedSchema = schema || getSchema();
    
    const educationLevelsQuery = `
      SELECT 'education_levels' as type, name, description, display_order
      FROM ${resolvedSchema}.education_levels
      WHERE tenant_id = $1 AND is_active = TRUE
      ORDER BY display_order ASC
    `;

    const specializationsQuery = `
      SELECT 'specializations' as type, name, description, display_order
      FROM ${resolvedSchema}.education_specializations
      WHERE tenant_id = $1 AND is_active = TRUE
      ORDER BY display_order ASC
    `;

    logger.debug('[ReferenceRepository] Getting education references', { tenantId, schema: resolvedSchema });

    const [educationLevels, specializations] = await Promise.all([
      query(educationLevelsQuery, [tenantId]),
      query(specializationsQuery, [tenantId])
    ]);

    const result = {
      education_levels: educationLevels.rows,
      specializations: specializations.rows
    };

    logger.debug('[ReferenceRepository] Education references result', { 
      tenantId,
      educationLevelsCount: result.education_levels.length,
      specializationsCount: result.specializations.length
    });

    return result;
  }

  /**
   * Get countries reference data
   */
  static async getCountries(tenantId, schema) {
    const resolvedSchema = schema || getSchema();
    const sql = `
      SELECT 
        code,
        name,
        region,
        is_popular,
        display_order
      FROM ${resolvedSchema}.countries
      WHERE is_active = TRUE
      ORDER BY is_popular DESC, display_order ASC, name ASC
    `;

    logger.debug('[ReferenceRepository] Getting countries', { tenantId, schema: resolvedSchema });

    const result = await query(sql, []);
    
    logger.debug('[ReferenceRepository] Countries result', { 
      tenantId,
      countriesCount: result.rows.length 
    });

    return result.rows;
  }

  /**
   * Get all reference data in a single call
   */
  static async getAllReferences(tenantId, schema) {
    logger.debug('[ReferenceRepository] Getting all reference data', { tenantId });

    const [statuses, board, education, countries] = await Promise.all([
      this.getPipelineStatuses(tenantId, schema),
      this.getPipelineBoard(tenantId, schema),
      this.getEducationReferences(tenantId, schema),
      this.getCountries(tenantId, schema)
    ]);

    const result = {
      pipeline_statuses: statuses,
      pipeline_board: board,
      education_levels: education.education_levels,
      specializations: education.specializations,
      countries
    };

    logger.debug('[ReferenceRepository] All references result', { 
      tenantId,
      statusCount: result.pipeline_statuses.length,
      boardItemCount: result.pipeline_board.length,
      educationLevelsCount: result.education_levels.length,
      specializationsCount: result.specializations.length,
      countriesCount: result.countries.length
    });

    return result;
  }
}

module.exports = ReferenceRepository;