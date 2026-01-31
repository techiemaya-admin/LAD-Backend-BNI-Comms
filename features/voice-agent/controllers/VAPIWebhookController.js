/**
 * VAPI Webhook Controller
 * 
 * Handles webhooks from VAPI for call status updates and billing
 * When a call completes, VAPI sends usage data and we charge credits accordingly
 */

const { pool } = require('../../../shared/database/connection');
let logger;
try {
  logger = require('../../../core/utils/logger');
} catch (e) {
  const loggerAdapter = require('../utils/logger');
  logger = loggerAdapter.getLogger();
}

let getSchema;
try {
  ({ getSchema } = require('../../../core/utils/schemaHelper'));
} catch (e) {
  ({ getSchema } = require('../utils/schemaHelper'));
}

class VAPIWebhookController {
  constructor(db = pool) {
    this.db = db;
  }

  /**
   * POST /api/voice-agent/webhook/vapi
   * Handle VAPI webhook events
   * 
   * VAPI sends webhooks for:
   * - call.started
   * - call.ended
   * - call.failed
   * 
   * When call ends, we:
   * 1. Update call log with final status, duration, recording URL
   * 2. Calculate cost based on duration
   * 3. Deduct credits from tenant balance
   */
  async handleVAPIWebhook(req, res) {
    try {
      const payload = req.body;
      
      logger.info('[VAPI Webhook] Received event', {
        event: payload.event || payload.type,
        callId: payload.callId || payload.id,
        status: payload.status
      });

      // Extract event type
      const eventType = payload.event || payload.type;
      const callData = payload.call || payload;

      switch (eventType) {
        case 'call.started':
        case 'assistant-request':
          await this.handleCallStarted(callData);
          break;

        case 'call.ended':
        case 'end-of-call-report':
          await this.handleCallEnded(callData);
          break;

        case 'call.failed':
          await this.handleCallFailed(callData);
          break;

        default:
          logger.warn('[VAPI Webhook] Unknown event type', { eventType });
      }

      // Always respond with 200 OK for webhooks
      return res.status(200).json({ success: true, received: true });

    } catch (error) {
      logger.error('[VAPI Webhook] Error processing webhook', {
        error: error.message,
        stack: error.stack,
        body: req.body
      });

      // Still return 200 to prevent VAPI from retrying
      return res.status(200).json({ 
        success: false, 
        error: 'Internal processing error',
        received: true 
      });
    }
  }

  /**
   * Handle call started event
   */
  async handleCallStarted(callData) {
    logger.info('[VAPI Webhook] Call started', {
      callId: callData.id,
      customerNumber: callData.customer?.number,
      status: callData.status
    });

    // Optional: Update call status to "in-progress"
    // This is useful for real-time UI updates
  }

  /**
   * Handle call ended event and charge credits
   */
  async handleCallEnded(callData) {
    const vapiCallId = callData.id;
    const duration = callData.duration || callData.endedReason?.duration || 0; // in seconds
    const status = callData.status || 'ended';
    const recordingUrl = callData.recordingUrl || callData.artifact?.recordingUrl;

    logger.info('[VAPI Webhook] Call ended', {
      vapiCallId,
      duration,
      status,
      hasRecording: !!recordingUrl
    });

    try {
      // Find the call log by VAPI call ID
      const callLog = await this.findCallByVAPIId(vapiCallId);

      if (!callLog) {
        logger.warn('[VAPI Webhook] Call log not found', { vapiCallId });
        return;
      }

      // Calculate cost based on duration
      // Voice calls charge per minute (rounded up)
      const durationMinutes = Math.ceil(duration / 60);
      const costPerMinute = parseFloat(process.env.VOICE_COST_PER_MINUTE || '0.05'); // $0.05 per minute default
      const totalCost = durationMinutes * costPerMinute;

      // Convert cost to credits (assuming $0.01 = 1 credit)
      const creditsPerDollar = 100;
      const creditsToDeduct = Math.ceil(totalCost * creditsPerDollar);

      logger.info('[VAPI Webhook] Calculated call cost', {
        callId: callLog.id,
        duration: `${duration}s`,
        durationMinutes,
        costPerMinute,
        totalCost: `$${totalCost.toFixed(4)}`,
        creditsToDeduct
      });

      const schema = getSchema({ user: { tenant_id: callLog.tenant_id } });

      // Update call log with final status, duration, cost, recording
      await this.db.query(
        `UPDATE ${schema}.voice_call_logs 
         SET 
           status = $1,
           ended_at = NOW(),
           duration_seconds = $2,
           cost = $3,
           recording_url = $4,
           cost_breakdown = $5,
           updated_at = NOW()
         WHERE id = $6 AND tenant_id = $7`,
        [
          status,
          duration,
          totalCost,
          recordingUrl,
          JSON.stringify({
            duration_seconds: duration,
            duration_minutes: durationMinutes,
            cost_per_minute: costPerMinute,
            total_cost: totalCost,
            credits_deducted: creditsToDeduct,
            calculation_time: new Date().toISOString()
          }),
          callLog.id,
          callLog.tenant_id
        ]
      );

      // Deduct credits from tenant balance
      if (creditsToDeduct > 0) {
        await this.deductCallCredits(
          callLog.tenant_id,
          creditsToDeduct,
          callLog.id,
          {
            duration,
            durationMinutes,
            cost: totalCost,
            vapiCallId
          }
        );
      }

      logger.info('[VAPI Webhook] Call processing completed', {
        callId: callLog.id,
        status,
        creditsDeducted: creditsToDeduct
      });

    } catch (error) {
      logger.error('[VAPI Webhook] Error processing call ended', {
        error: error.message,
        vapiCallId
      });
      throw error;
    }
  }

  /**
   * Handle call failed event
   */
  async handleCallFailed(callData) {
    const vapiCallId = callData.id;

    logger.info('[VAPI Webhook] Call failed', {
      vapiCallId,
      status: callData.status,
      reason: callData.endedReason
    });

    try {
      const callLog = await this.findCallByVAPIId(vapiCallId);

      if (!callLog) {
        logger.warn('[VAPI Webhook] Call log not found for failed call', { vapiCallId });
        return;
      }

      const schema = getSchema({ user: { tenant_id: callLog.tenant_id } });

      // Update call log status to failed
      await this.db.query(
        `UPDATE ${schema}.voice_call_logs 
         SET 
           status = $1,
           ended_at = NOW(),
           updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        ['failed', callLog.id, callLog.tenant_id]
      );

      // Refund the initial 1 credit that was deducted at call initiation
      await this.refundCallCredits(callLog.tenant_id, 1, callLog.id, 'Call failed');

      logger.info('[VAPI Webhook] Failed call processed and refunded', {
        callId: callLog.id
      });

    } catch (error) {
      logger.error('[VAPI Webhook] Error processing call failed', {
        error: error.message,
        vapiCallId
      });
      throw error;
    }
  }

  /**
   * Find call log by VAPI call ID
   */
  async findCallByVAPIId(vapiCallId) {
    const schema = process.env.DB_SCHEMA || 'lad_dev';

    const result = await this.db.query(
      `SELECT id, tenant_id, status, created_at
       FROM ${schema}.voice_call_logs
       WHERE provider_call_id = $1 OR metadata->>'vapiCallId' = $1
       LIMIT 1`,
      [vapiCallId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Deduct credits from tenant balance for completed call
   */
  async deductCallCredits(tenantId, credits, callId, metadata = {}) {
    const schema = process.env.DB_SCHEMA || 'lad_dev';
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Deduct from user balance
      await client.query(
        `UPDATE ${schema}.user_credits 
         SET balance = balance - $1, updated_at = NOW() 
         WHERE tenant_id = $2`,
        [credits, tenantId]
      );

      // Log transaction
      await client.query(
        `INSERT INTO ${schema}.credit_transactions (
          user_id,
          tenant_id,
          amount,
          transaction_type,
          description,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          tenantId,
          tenantId,
          -credits,
          'deduction',
          `Voice call ${callId} - ${metadata.durationMinutes || 0} minutes`,
          {
            feature: 'voice-agent',
            usage_type: 'voice_call_duration',
            call_id: callId,
            ...metadata,
            timestamp: new Date().toISOString()
          }
        ]
      );

      await client.query('COMMIT');

      logger.info('[VAPI Webhook] Credits deducted', {
        tenantId,
        credits,
        callId
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[VAPI Webhook] Error deducting credits', {
        error: error.message,
        tenantId,
        credits,
        callId
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Refund credits when call fails
   */
  async refundCallCredits(tenantId, credits, callId, reason = '') {
    const schema = process.env.DB_SCHEMA || 'lad_dev';
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Add credits back to balance
      await client.query(
        `UPDATE ${schema}.user_credits 
         SET balance = balance + $1, updated_at = NOW() 
         WHERE tenant_id = $2`,
        [credits, tenantId]
      );

      // Log refund transaction
      await client.query(
        `INSERT INTO ${schema}.credit_transactions (
          user_id,
          tenant_id,
          amount,
          transaction_type,
          description,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          tenantId,
          tenantId,
          credits,
          'refund',
          `Voice call ${callId} refund - ${reason}`,
          {
            feature: 'voice-agent',
            usage_type: 'voice_call_refund',
            call_id: callId,
            reason,
            timestamp: new Date().toISOString()
          }
        ]
      );

      await client.query('COMMIT');

      logger.info('[VAPI Webhook] Credits refunded', {
        tenantId,
        credits,
        callId,
        reason
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[VAPI Webhook] Error refunding credits', {
        error: error.message,
        tenantId,
        credits,
        callId
      });
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = VAPIWebhookController;
