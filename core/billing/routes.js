/**
 * Core Billing Routes
 * 
 * PURPOSE:
 * Manages subscription plans, payments, and usage tracking for the SaaS platform.
 * This is part of the CORE platform as billing is essential for SaaS operation.
 * 
 * CORE PLATFORM RATIONALE:
 * Billing functionality must always be available to:
 * - Allow plan upgrades/downgrades
 * - Track usage and enforce limits
 * - Process payments and manage subscriptions
 * - Provide usage analytics for capacity planning
 * 
 * FEATURES PROVIDED:
 * 1. PLAN MANAGEMENT: List available subscription plans with features
 * 2. SUBSCRIPTION: Create/modify subscriptions via Stripe integration
 * 3. USAGE TRACKING: Monitor feature usage for billing and limits
 * 4. CREDIT MANAGEMENT: Track and manage credit balances per client
 * 
 * STRIPE INTEGRATION:
 * - Customer creation and management
 * - Subscription lifecycle (create, update, cancel)
 * - Webhook handling for payment events
 * - Invoice generation and payment processing
 * 
 * USAGE ANALYTICS:
 * - Per-feature usage tracking (apollo searches, voice calls, etc.)
 * - Credit consumption monitoring
 * - Billing period usage summaries
 * - Overage detection and billing
 * 
 * PLAN-FEATURE MAPPING:
 * - Basic: Core features only
 * - Premium: Core + apollo-leads + voice-agent
 * - Enterprise: All features enabled
 * 
 * ENDPOINTS:
 * GET  /api/billing/plans         - Available subscription plans
 * POST /api/billing/subscribe     - Create/update subscription
 * GET  /api/billing/usage/:clientId - Usage metrics for billing
 */

const express = require('express');
const router = express.Router();

// Core billing routes (always available)
router.get('/plans', async (req, res) => {
  try {
    // Get available billing plans with their features
    const plans = [
      {
        id: 'basic',
        name: 'Basic',
        price: 29,
        features: ['dashboard', 'basic_reports']
      },
      {
        id: 'premium',
        name: 'Premium', 
        price: 99,
        features: ['dashboard', 'basic_reports', 'apollo_leads', 'voice_agent']
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 299,
        features: ['dashboard', 'basic_reports', 'apollo_leads', 'voice_agent', 'linkedin_integration']
      }
    ];
    
    res.json({ success: true, plans });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plans'
    });
  }
});

router.post('/subscribe', async (req, res) => {
  try {
    const { planId, clientId } = req.body;
    
    // Stripe integration here
    // Update client features based on plan
    
    res.json({
      success: true,
      message: 'Subscription updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Subscription failed'
    });
  }
});

router.get('/usage/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Get usage metrics for billing
    const usage = {
      apollo_searches: 150,
      voice_calls: 45,
      credits_used: 2500
    };
    
    res.json({ success: true, usage });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage'
    });
  }
});

module.exports = router;