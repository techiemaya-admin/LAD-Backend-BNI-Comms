/**
 * Lead Booking Controller
 * Handles HTTP requests for lead bookings
 */

const LeadBookingService = require('../services/LeadBooking.service');

const logger = require('../../../core/utils/logger');

const { getSchema } = require('../../../core/utils/schemaHelper');

class LeadBookingController {
  constructor(db) {
    this.leadBookingService = new LeadBookingService(db);
  }

  /**
   * GET /bookings
   * Get lead bookings with role-based filtering
   * Owner/Admin can filter by user_id, regular users see only their bookings
   * 
   * Query params:
   * - user_id (owner/admin only): Filter by assigned user
   * - status: Filter by booking status
   * - bookingType: Filter by booking type
   * - bookingSource: Filter by booking source
   * - leadId: Filter by lead ID
   * - startDate: Filter bookings scheduled from this date
   * - endDate: Filter bookings scheduled until this date
   * - callResult: Filter by call result
   * - limit: Result limit (default: 50 for regular users, 999999 for owner/admin)
   */
  async getLeadBookings(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const userRole = req.user.role || 'user';
      const schema = getSchema(req);

      logger.info(
        `Fetching lead bookings for tenant: ${tenantId}, user: ${userId}, role: ${userRole}, schema: ${schema}`
      );

      // For owner/admin selecting a user, return all data by default (999999)
      // For regular users, default to 50
      const defaultLimit = (userRole === 'owner' || userRole === 'admin') ? 999999 : 50;
      
      const params = {
        user_id: req.query.user_id,
        status: req.query.status,
        bookingType: req.query.bookingType,
        bookingSource: req.query.bookingSource,
        leadId: req.query.leadId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        callResult: req.query.callResult,
        limit: req.query.limit ? parseInt(req.query.limit) : defaultLimit
      };

      logger.debug('[LeadBookingController] Query params received:', params);

      const bookings = await this.leadBookingService.getLeadBookings(
        tenantId,
        userId,
        userRole,
        params
      );

      res.json({
        success: true,
        data: bookings,
        count: bookings.length
      });
    } catch (error) {
      logger.error('Get lead bookings error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch lead bookings',
        message: error.message
      });
    }
  }

  /**
   * GET /bookings/:id
   * Get a single lead booking by ID
   */
  async getLeadBookingById(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const bookingId = req.params.id;
      const schema = getSchema(req);

      logger.info(
        `Fetching lead booking ID: ${bookingId}, tenant: ${tenantId}, schema: ${schema}`
      );

      const booking = await this.leadBookingService.getLeadBookingById(
        tenantId,
        bookingId
      );

      if (!booking) {
        return res.status(404).json({
          success: false,
          error: 'Lead booking not found'
        });
      }

      res.json({
        success: true,
        data: booking
      });
    } catch (error) {
      logger.error('Get lead booking by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch lead booking',
        message: error.message
      });
    }
  }

  /**
   * POST /bookings
   * Create a new lead booking
   * 
   * Body:
   * - leadId (required)
   * - assignedUserId (required)
   * - bookingType (required)
   * - bookingSource (required)
   * - scheduledAt (required)
   * - timezone (required)
   * - notes (optional)
   * - metadata (optional)
   */
  async createLeadBooking(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const schema = getSchema(req);

      const {
        leadId,
        assignedUserId,
        bookingType,
        bookingSource,
        scheduledAt,
        timezone,
        notes,
        metadata
      } = req.body;

      // Validation
      if (!leadId || !assignedUserId || !bookingType || !bookingSource || !scheduledAt || !timezone) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: leadId, assignedUserId, bookingType, bookingSource, scheduledAt, timezone'
        });
      }

      logger.info(
        `Creating lead booking - tenant: ${tenantId}, lead: ${leadId}, assigned to: ${assignedUserId}, schema: ${schema}`
      );

      const newBooking = await this.leadBookingService.createLeadBooking(
        tenantId,
        {
          leadId,
          assignedUserId,
          bookingType,
          bookingSource,
          scheduledAt,
          timezone,
          notes,
          metadata,
          createdBy: userId
        }
      );

      res.status(201).json({
        success: true,
        data: newBooking,
        message: 'Lead booking created successfully'
      });
    } catch (error) {
      logger.error('Create lead booking error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create lead booking',
        message: error.message
      });
    }
  }

  /**
   * PUT /bookings/:id
   * Update a lead booking
   * 
   * Body: Any updatable fields
   * - status
   * - call_result
   * - retry_count
   * - notes
   * - metadata
   * - task_name
   * - task_scheduled_at
   * - task_status
   * - executed_at
   * - execution_attempts
   * - last_execution_error
   */
  async updateLeadBooking(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const bookingId = req.params.id;
      const schema = getSchema(req);

      logger.info(
        `Updating lead booking ID: ${bookingId}, tenant: ${tenantId}, schema: ${schema}`
      );

      const updatedBooking = await this.leadBookingService.updateLeadBooking(
        tenantId,
        bookingId,
        req.body
      );

      if (!updatedBooking) {
        return res.status(404).json({
          success: false,
          error: 'Lead booking not found'
        });
      }

      res.json({
        success: true,
        data: updatedBooking,
        message: 'Lead booking updated successfully'
      });
    } catch (error) {
      logger.error('Update lead booking error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update lead booking',
        message: error.message
      });
    }
  }

  /**
   * GET /users
   * Get all users for a tenant
   * Owner role only
   */
  async getTenantUsers(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userRole = req.user.role || 'user';
      const schema = getSchema(req);

      // Check if user is owner
      if (userRole !== 'owner' && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Only owner can access this endpoint'
        });
      }

      logger.info(
        `Fetching tenant users - tenant: ${tenantId}, schema: ${schema}`
      );

      const users = await this.leadBookingService.getTenantUsers(tenantId);

      res.json({
        success: true,
        data: users,
        count: users.length
      });
    } catch (error) {
      logger.error('Get tenant users error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tenant users',
        message: error.message
      });
    }
  }
}

module.exports = LeadBookingController;
