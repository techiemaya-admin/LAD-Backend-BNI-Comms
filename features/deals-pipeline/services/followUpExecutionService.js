/**
 * Follow-Up Execution Service
 * 
 * Business logic for executing scheduled follow-up calls
 * Enforces idempotency, validates tenant ownership, and triggers voice calls
 * Handles retry logic and failure tracking
 * 
 * Multi-tenant safe - no SQL in this layer
 */

const voiceAgentClient = require('../../../shared/clients/voiceAgentClient');
const BookingsRepository = require('../repositories/bookingsRepository');

let logger;
let getSchema;
try {
  logger = require('../../../core/utils/logger');
  ({ getSchema } = require('../../../core/utils/schemaHelper'));
} catch (e) {
  logger = {
    info: (...args) => console.log('[FollowUpExecution INFO]', ...args),
    error: (...args) => console.error('[FollowUpExecution ERROR]', ...args),
    warn: (...args) => console.warn('[FollowUpExecution WARN]', ...args)
  };
  // Fallback schema helper
  getSchema = (req) => {
    if (req?.user?.schema) return req.user.schema;
    if (req?.user?.tenant_id) return `tenant_${req.user.tenant_id}`;
    return process.env.DEFAULT_SCHEMA || 'lad_dev';
  };
}

class FollowUpExecutionService {
  constructor(db) {
    this.bookingsRepo = new BookingsRepository(db);
    this.pool = db;
  }

  /**
   * Execute a follow-up call for a booking
   * Idempotent - safe to call multiple times
   * 
   * @param {Object} params - Execution parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.bookingId - Booking ID
   * @param {string} params.leadId - Lead ID
   * @param {string} params.assignedUserId - Assigned user ID (optional)
   * @param {string} params.idempotencyKey - Idempotency key for deduplication
   * @param {string} params.schema - Schema name
   * @returns {Promise<Object>} Execution result
   */
  async executeFollowUpCall({
    tenantId,
    bookingId,
    leadId,
    assignedUserId,
    idempotencyKey,
    schema
  }) {
    // Validate required parameters
    if (!tenantId || !bookingId || !leadId) {
      throw new Error('tenantId, bookingId, and leadId are required');
    }

    logger.info('Executing follow-up call:', {
      tenantId,
      bookingId,
      leadId,
      idempotencyKey
    });

    // Use database transaction for atomic operations
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Lock booking for update (prevents concurrent execution)
      const booking = await this.bookingsRepo.lockBookingForExecution(
        schema,
        bookingId,
        tenantId,
        client
      );

      if (!booking) {
        await client.query('ROLLBACK');
        throw new Error('Booking not found or tenant mismatch');
      }

      // IDEMPOTENCY CHECK: If already executed, return success
      if (booking.task_status === 'executed') {
        await client.query('COMMIT');
        
        logger.info('Follow-up call already executed (idempotent):', {
          tenantId,
          bookingId,
          executedAt: booking.executed_at
        });

        return {
          success: true,
          alreadyExecuted: true,
          executedAt: booking.executed_at,
          message: 'Call already executed'
        };
      }

      // Verify idempotency key matches (if provided)
      if (idempotencyKey && booking.idempotency_key !== idempotencyKey) {
        await client.query('ROLLBACK');
        throw new Error('Idempotency key mismatch');
      }

      // Check if booking is cancelled
      if (booking.task_status === 'cancelled') {
        await client.query('COMMIT');
        
        logger.info('Follow-up call cancelled, skipping:', {
          tenantId,
          bookingId
        });

        return {
          success: true,
          skipped: true,
          reason: 'Booking cancelled'
        };
      }

      // Get lead and agent information for the call
      const callParams = await this.prepareCallParameters(
        schema,
        booking,
        tenantId,
        client
      );

      // Initiate voice call via voice agent client
      const callResult = await voiceAgentClient.startCall({
        tenantId,
        leadId,
        bookingId,
        agentId: callParams.agentId,
        phoneNumber: callParams.phoneNumber,
        leadName: callParams.leadName,
        initiatedByUserId: assignedUserId || 'system',
        fromNumberId: callParams.fromNumberId,
        addedContext: callParams.addedContext
      });

      if (!callResult.success) {
        // Call failed - mark as failed
        await this.bookingsRepo.markFailed(
          schema,
          bookingId,
          tenantId,
          callResult.error,
          client
        );

        await client.query('COMMIT');

        logger.error('Follow-up call initiation failed:', {
          tenantId,
          bookingId,
          error: callResult.error
        });

        return {
          success: false,
          error: callResult.error,
          attempt: booking.execution_attempts + 1
        };
      }

      // Call succeeded - mark as executed
      await this.bookingsRepo.markExecuted(
        schema,
        bookingId,
        tenantId,
        client
      );

      await client.query('COMMIT');

      logger.info('Follow-up call executed successfully:', {
        tenantId,
        bookingId,
        callId: callResult.callId
      });

      return {
        success: true,
        callId: callResult.callId,
        executedAt: new Date().toISOString()
      };

    } catch (error) {
      await client.query('ROLLBACK');

      logger.error('Follow-up call execution error:', {
        tenantId,
        bookingId,
        error: error.message,
        stack: error.stack
      });

      // Attempt to mark as failed (outside transaction)
      try {
        await this.bookingsRepo.markFailed(
          schema,
          bookingId,
          tenantId,
          error.message
        );
      } catch (markError) {
        logger.error('Failed to mark booking as failed:', {
          tenantId,
          bookingId,
          error: markError.message
        });
      }

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Prepare call parameters by fetching lead and agent info
   * 
   * @param {string} schema - Schema name
   * @param {Object} booking - Booking object
   * @param {string} tenantId - Tenant ID
   * @param {Object} client - Database client
   * @returns {Promise<Object>} Call parameters
   */
  async prepareCallParameters(schema, booking, tenantId, client) {
    try {
      logger.info('[FollowUpExecution] Preparing call parameters:', {
        tenantId,
        bookingId: booking.id,
        bookingLeadId: booking.lead_id,
        schema
      });

      // Fetch lead information
      const leadQuery = `
        SELECT 
          id,
          first_name,
          last_name,
          phone,
          email
        FROM ${schema}.leads
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
      `;
      
      const leadResult = await client.query(leadQuery, [booking.lead_id, tenantId]);
      const lead = leadResult.rows[0];

      if (!lead) {
        throw new Error('Lead not found for booking');
      }

      logger.info('[FollowUpExecution] Lead found:', {
        tenantId,
        bookingId: booking.id,
        leadId: lead.id,
        leadName: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
        phoneNumber: this.maskPhoneNumber(lead.phone)
      });

      // Get default agent ID (could be from booking metadata or tenant settings)
      // For now, use a configurable default or fetch from tenant settings
      const agentId = process.env.DEFAULT_FOLLOW_UP_AGENT_ID || '24'; // VAPI agent

      // Get phone number from lead
      const phoneNumber = lead.phone;
      if (!phoneNumber) {
        throw new Error('Lead has no phone number');
      }

      // Build additional context - fetch from lead_notes if available
      let addedContext = `This is a follow-up call for a scheduled booking at ${booking.scheduled_at}, try to access earlier conversation for student's response and don't ask any answered repeated questions`;
      
      try {
        const leadNotesQuery = `
          SELECT content
          FROM ${schema}.lead_notes
          WHERE lead_id = $1 AND tenant_id = $2 AND is_deleted = false
          ORDER BY created_at DESC
          LIMIT 1
        `;
        
        const leadNotesResult = await client.query(leadNotesQuery, [booking.lead_id, tenantId]);
        
        if (leadNotesResult.rows.length > 0 && leadNotesResult.rows[0].content) {
          addedContext = leadNotesResult.rows[0].content;
          
          logger.info('[FollowUpExecution] Using lead notes as context:', {
            tenantId,
            bookingId: booking.id,
            leadId: booking.lead_id,
            contentLength: addedContext.length
          });
        }
      } catch (notesError) {
        logger.warn('[FollowUpExecution] Failed to fetch lead notes, using default context:', {
          tenantId,
          bookingId: booking.id,
          error: notesError.message
        });
        // Continue with default context if lead_notes query fails
      }

      // Use phone number as fallback if no name available
      const leadName = lead.first_name || lead.last_name || phoneNumber || 'there';

      return {
        agentId,
        phoneNumber,
        leadName,
        fromNumberId: null, // Use default from voice agent
        addedContext
      };
    } catch (error) {
      logger.error('Failed to prepare call parameters:', {
        bookingId: booking.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Mask phone number for logging (show only last 4 digits)
   */
  maskPhoneNumber(phoneNumber) {
    if (!phoneNumber || phoneNumber.length < 4) return '***';
    return '***' + phoneNumber.slice(-4);
  }

  /**
   * Get execution status for a booking
   * 
   * @param {string} schema - Schema name
   * @param {string} bookingId - Booking ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Execution status
   */
  async getExecutionStatus(schema, bookingId, tenantId) {
    const booking = await this.bookingsRepo.getBookingById(
      schema,
      bookingId,
      tenantId
    );

    if (!booking) {
      throw new Error('Booking not found');
    }

    return {
      bookingId: booking.id,
      taskStatus: booking.task_status,
      executedAt: booking.executed_at,
      executionAttempts: booking.execution_attempts,
      lastError: booking.last_execution_error,
      scheduledAt: booking.scheduled_at,
      taskScheduledAt: booking.task_scheduled_at
    };
  }

  /**
   * Retry a failed follow-up call execution
   * 
   * @param {string} schema - Schema name
   * @param {string} bookingId - Booking ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Retry result
   */
  async retryExecution(schema, bookingId, tenantId) {
    const booking = await this.bookingsRepo.getBookingById(
      schema,
      bookingId,
      tenantId
    );

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.task_status === 'executed') {
      return {
        success: true,
        skipped: true,
        reason: 'Already executed'
      };
    }

    // Execute the follow-up call
    return this.executeFollowUpCall({
      tenantId,
      bookingId,
      leadId: booking.lead_id,
      assignedUserId: booking.assigned_user_id,
      idempotencyKey: booking.idempotency_key,
      schema
    });
  }
}

module.exports = FollowUpExecutionService;
