/**
 * User Service
 * Business logic for user operations
 */

const { UserRepository } = require('../repositories');

class UserService {
  constructor(db) {
    this.userRepository = new UserRepository(db);
  }

  /**
   * Get all users for a tenant
   * @param {string} schema - Database schema
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Array>} List of users
   */
  async getTenantUsers(schema, tenantId) {
    return this.userRepository.getTenantUsers(schema, tenantId);
  }
}

module.exports = UserService;
