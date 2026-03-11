const { LeadBookingService, UserService } = require('../services');

class LeadBookingController {
  constructor(db) {
    this.db = db;
    this.leadBookingService = new LeadBookingService(db);
    this.userService = new UserService(db);
  }

  /**
   * GET /bookings
   * Get lead bookings with role-based filtering
   */
  async getLeadBookings(req, res) {
    try {
      const { tenant_id, role, id: userId } = req.user;
      const {
        selectedUserId,
        status,
        bookingType,
        bookingSource,
        leadId,
        startDate,
        endDate,
        callResult,
        limit = 50
      } = req.query;

      const filters = {
        selectedUserId,
        status,
        bookingType,
        bookingSource,
        leadId,
        startDate,
        endDate,
        callResult,
        limit: parseInt(limit)
      };

      const bookings = await this.leadBookingService.getLeadBookings(
        tenant_id,
        userId,
        role,
        filters
      );

      res.json({ bookings });
    } catch (error) {
      console.error('Error fetching lead bookings:', error);
      res.status(500).json({
        error: 'Internal server error',
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
      const { tenant_id } = req.user;
      const { id } = req.params;

      const booking = await this.leadBookingService.getLeadBookingById(
        tenant_id,
        id
      );

      if (!booking) {
        return res.status(404).json({
          error: 'Not found',
          message: `Booking with ID ${id} not found`
        });
      }

      res.json({ booking });
    } catch (error) {
      console.error('Error fetching lead booking:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * POST /bookings
   * Create a new lead booking
   */
  async createLeadBooking(req, res) {
    try {
      const { tenant_id } = req.user;
      const bookingData = req.body;

      const booking = await this.leadBookingService.createLeadBooking(
        tenant_id,
        bookingData
      );

      res.status(201).json({ booking });
    } catch (error) {
      console.error('Error creating lead booking:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * PUT /bookings/:id
   * Update a lead booking
   */
  async updateLeadBooking(req, res) {
    try {
      const { tenant_id } = req.user;
      const { id } = req.params;
      const updates = req.body;

      const booking = await this.leadBookingService.updateLeadBooking(
        tenant_id,
        id,
        updates
      );

      if (!booking) {
        return res.status(404).json({
          error: 'Not found',
          message: `Booking with ID ${id} not found`
        });
      }

      res.json({ booking });
    } catch (error) {
      console.error('Error updating lead booking:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * GET /users
   * Get all users for the tenant (Owner role only)
   */
  async getTenantUsers(req, res) {
    try {
      const { tenant_id, role } = req.user;
      const schema = req.schema || req.user.schema;

      if (role !== 'owner') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Insufficient permissions. Owner role required.'
        });
      }

      // Delegate to service layer (no SQL in controller)
      const users = await this.userService.getTenantUsers(schema, tenant_id);

      res.json({ users });
    } catch (error) {
      console.error('Error fetching tenant users:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}

module.exports = LeadBookingController;
