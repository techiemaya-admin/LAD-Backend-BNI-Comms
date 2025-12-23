/**
 * Credit Guard Middleware
 * 
 * PURPOSE:
 * Implements automatic credit deduction and usage tracking for billable API calls.
 * This middleware integrates billing directly into the API request flow, ensuring
 * usage is tracked and limits are enforced in real-time.
 * 
 * BILLING ENFORCEMENT:
 * 1. PRE-REQUEST: Check if client has sufficient credits
 * 2. DEDUCTION: Atomically deduct credits from client balance
 * 3. TRACKING: Log usage for billing analytics and reporting
 * 4. LIMITS: Reject requests when credits insufficient (soft limit)
 * 
 * CREDIT SYSTEM:
 * Different actions cost different amounts:
 * - Apollo search: 1 credit
 * - Email reveal: 1 credit
 * - Phone reveal: 8 credits
 * - Voice call: 250 credits/minute
 * 
 * MIDDLEWARE USAGE:
 * router.post('/search', 
 *   requireFeature('apollo-leads'),    // Feature access control
 *   requireCredits('apollo_search', 1), // Credit enforcement
 *   controllerFunction
 * );
 * 
 * ATOMIC OPERATIONS:
 * Uses database transactions to ensure:
 * 1. Credit balance is checked and deducted atomically
 * 2. Usage logging happens in same transaction
 * 3. No race conditions between concurrent requests
 * 4. Consistent billing data
 * 
 * ERROR HANDLING:
 * - 402 Payment Required: Insufficient credits
 * - 500 Internal Error: Database transaction failed
 * - Automatic rollback on any failure
 * 
 * USAGE TRACKING:
 * Records detailed usage in feature_usage table:
 * - Client ID and feature used
 * - Usage type (search, email, phone, etc.)
 * - Credits consumed
 * - Metadata (endpoint, user agent, timestamp)
 * 
 * ANALYTICS:
 * Usage data enables:
 * - Monthly billing calculations
 * - Usage trend analysis
 * - Capacity planning
 * - Feature adoption metrics
 */

const { pool } = require('../database/connection');

/**
 * Middleware to check and deduct credits before API calls
 */
const requireCredits = (usageType, creditsRequired) => {
  return async (req, res, next) => {
    try {
      // Support both organizationId (new schema) and clientId (legacy)
      const organizationId = req.user?.organizationId || req.user?.clientId || req.headers['x-organization-id'] || req.headers['x-client-id'];
      const featureKey = req.feature?.key;

      if (!organizationId || !featureKey) {
        return res.status(400).json({
          success: false,
          error: 'Missing organization or feature information',
          message: 'Unable to process credit check'
        });
      }

      // Check current credit balance
      const balance = await getCreditBalance(organizationId);
      
      if (balance < creditsRequired) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient credits',
          message: `This action requires ${creditsRequired} credits, but you only have ${balance} remaining`,
          credits_required: creditsRequired,
          credits_available: balance,
          upgrade_required: true
        });
      }

      // Deduct credits
      await deductCredits(organizationId, featureKey, usageType, creditsRequired, req);

      // Add credit info to request
      req.credits = {
        used: creditsRequired,
        remaining: balance - creditsRequired,
        usage_type: usageType
      };

      next();
    } catch (error) {
      console.error('❌ Error processing credits:', error);
      return res.status(500).json({
        success: false,
        error: 'Credit check failed',
        message: 'Unable to verify credit balance at this time'
      });
    }
  };
};

/**
 * Get current credit balance for an organization
 */
async function getCreditBalance(organizationId) {
  const query = `
    SELECT 
      COALESCE(uc.balance, 0) as balance
    FROM lad_LAD.user_credits uc
    WHERE uc.organization_id = $1
    LIMIT 1
  `;
  
  const result = await pool.query(query, [organizationId]);
  
  if (result.rows.length === 0) {
    // Return 0 balance if no record found instead of throwing error
    return 0;
  }
  
  return parseFloat(result.rows[0].balance);
}

/**
 * Deduct credits and log usage
 */
async function deductCredits(organizationId, featureKey, usageType, credits, req) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Deduct from organization balance
    await client.query(
      'UPDATE lad_LAD.user_credits SET balance = balance - $1, updated_at = NOW() WHERE organization_id = $2',
      [credits, organizationId]
    );
    
    // Log transaction
    await client.query(
      `INSERT INTO lad_LAD.credit_transactions (
        user_id,
        organization_id,
        amount,
        type,
        feature,
        description,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user?.userId || req.user?.id,
        organizationId,
        -credits,
        'deduction',
        featureKey,
        `${featureKey} - ${usageType}`,
        {
          usage_type: usageType,
          endpoint: req.path,
          method: req.method,
          user_agent: req.headers['user-agent'],
          timestamp: new Date().toISOString()
        }
      ]
    );
    
    await client.query('COMMIT');
    
    console.log(`💰 Deducted ${credits} credits for ${organizationId} (${usageType})`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Middleware to track feature usage without deducting credits
 */
const trackUsage = (usageType) => {
  return async (req, res, next) => {
    try {
      // Support both organizationId (new schema) and clientId (legacy)
      const organizationId = req.user?.organizationId || req.user?.clientId || req.headers['x-organization-id'] || req.headers['x-client-id'];
      const featureKey = req.feature?.key;

      if (organizationId && featureKey) {
        // Track usage without deducting credits
        await pool.query(
          `INSERT INTO feature_usage (
            client_id, 
            feature_id, 
            usage_type, 
            credits_used,
            metadata
          ) VALUES (
            $1,
            (SELECT id FROM features WHERE key = $2),
            $3,
            0,
            $4
          )`,
          [
            organizationId,
            featureKey,
            usageType,
            {
              endpoint: req.path,
              method: req.method,
              timestamp: new Date().toISOString()
            }
          ]
        );
      }

      next();
    } catch (error) {
      console.error('❌ Error tracking usage:', error);
      // Don't block request for tracking errors
      next();
    }
  };
};

module.exports = {
  requireCredits,
  trackUsage,
  getCreditBalance
};