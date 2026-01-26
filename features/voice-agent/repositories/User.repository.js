/**
 * User Repository
 * Handles database queries for user data
 */

class UserRepository {
  constructor(db) {
    this.pool = db;
  }

  /**
   * Get all users for a tenant
   * @param {string} schema - Database schema
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Array>} List of users
   */
  async getTenantUsers(schema, tenantId) {
    const query = `
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.phone,
        u.is_active as status,
        u.created_at,
        CASE 
          WHEN u.primary_tenant_id = $1 THEN 'owner'
          ELSE 'member'
        END as role
      FROM ${schema}.users u
      WHERE u.primary_tenant_id = $1
         OR u.id IN (
           SELECT DISTINCT user_id 
           FROM ${schema}.user_capabilities 
           WHERE tenant_id = $1
         )
      ORDER BY u.created_at DESC
    `;

    const result = await this.pool.query(query, [tenantId]);
    return result.rows;
  }
}

module.exports = UserRepository;
