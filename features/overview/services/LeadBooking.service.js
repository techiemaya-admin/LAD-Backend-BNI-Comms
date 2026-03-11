/**
 * Lead Booking Service
 * Business logic for lead booking operations
 */

const LeadBookingRepository = require('../repositories/LeadBooking.repository');

const { getSchema } = require('../../../core/utils/schemaHelper');

class LeadBookingService {
  constructor(db) {
    this.leadBookingRepository = new LeadBookingRepository(db);
  }

  /**
   * Get lead bookings with role-based access control
   * 
   * @param {string} tenantId - Tenant ID
   * @param {string} userId - Current user ID
   * @param {string} userRole - User role
   * @param {object} params - Query parameters
   * @returns {Promise<Array>} Lead bookings
   */
  async getLeadBookings(tenantId, userId, userRole = 'user', params = {}) {
    const schema = getSchema({ user: { tenant_id: tenantId } });
    
    const filters = {
      user_id: params.user_id,
      status: params.status,
      bookingType: params.bookingType,
      bookingSource: params.bookingSource,
      leadId: params.leadId,
      startDate: params.startDate,
      endDate: params.endDate,
      callResult: params.callResult,
      includeDeleted: params.includeDeleted
    };

    const limit = params.limit ? parseInt(params.limit) : 50;

    return this.leadBookingRepository.getLeadBookings(
      schema,
      tenantId,
      userId,
      userRole,
      null,
      filters,
      limit
    );
  }

  /**
   * Get a single lead booking
   * 
   * @param {string} tenantId - Tenant ID
   * @param {string} bookingId - Booking ID
   * @returns {Promise<object>} Lead booking
   */
  async getLeadBookingById(tenantId, bookingId) {
    const schema = getSchema({ user: { tenant_id: tenantId } });
    return this.leadBookingRepository.getLeadBookingById(schema, bookingId, tenantId);
  }

  /**
   * Create a new lead booking
   * 
   * @param {string} tenantId - Tenant ID
   * @param {object} bookingData - Booking data
   * @returns {Promise<object>} Created booking
   */
  async createLeadBooking(tenantId, bookingData) {
    const schema = getSchema({ user: { tenant_id: tenantId } });
    
    const newBooking = {
      tenantId,
      ...bookingData
    };

    return this.leadBookingRepository.createLeadBooking(schema, newBooking);
  }

  /**
   * Update a lead booking
   * 
   * @param {string} tenantId - Tenant ID
   * @param {string} bookingId - Booking ID
   * @param {object} updateData - Data to update
   * @returns {Promise<object>} Updated booking
   */
  async updateLeadBooking(tenantId, bookingId, updateData) {
    const schema = getSchema({ user: { tenant_id: tenantId } });
    return this.leadBookingRepository.updateLeadBooking(schema, bookingId, tenantId, updateData);
  }

  /**
   * Get all users for a tenant (Owner role only)
   * 
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Array>} Users list
   */
  async getTenantUsers(tenantId) {
    const schema = getSchema({ user: { tenant_id: tenantId } });
    return this.leadBookingRepository.getTenantUsers(schema, tenantId);
  }
}

module.exports = LeadBookingService;
