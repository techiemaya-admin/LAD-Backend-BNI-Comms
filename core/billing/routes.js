/**
 * Core Billing Routes - Credit-Based Billing System
 * 
 * Re-exported from routes/billing.routes.js
 * This file maintains backward compatibility with existing imports
 */

const billingRoutes = require('./routes/billing.routes');
module.exports = billingRoutes;

    
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