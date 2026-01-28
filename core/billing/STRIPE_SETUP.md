# Stripe Integration Setup Guide

## Overview
This guide explains how to set up Stripe payment processing for credit purchases in the LAD platform.

## Prerequisites
- Stripe account (sign up at https://stripe.com)
- Backend server with environment variables configured

## Setup Steps

### 1. Get Stripe API Keys

1. Log in to your Stripe Dashboard: https://dashboard.stripe.com/
2. Go to **Developers** → **API keys**
3. Copy your keys:
   - **Secret key** (starts with `sk_test_` for test mode or `sk_live_` for live mode)
   - **Publishable key** (starts with `pk_test_` or `pk_live_`) - needed for frontend

### 2. Configure Backend Environment Variables

Add these to your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

**Note:** Start with test mode keys (`sk_test_...`) during development.

### 3. Set Up Webhook Endpoint

Stripe needs to notify your backend when payments succeed. Here's how to set it up:

#### For Local Development (using Stripe CLI):

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Run: `stripe listen --forward-to http://localhost:8080/api/stripe/webhook`
3. Copy the webhook signing secret (starts with `whsec_`) to your `.env` file

#### For Production:

1. Go to **Developers** → **Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. Enter your webhook URL: `https://your-backend-url.com/api/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed` (required)
   - `payment_intent.succeeded` (optional)
   - `payment_intent.payment_failed` (optional)
5. Copy the webhook signing secret and add it to your production environment variables

### 4. Test the Integration

#### Backend Test (create checkout session):

```bash
curl -X POST http://localhost:8080/api/stripe/create-credits-checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": 100,
    "successUrl": "http://localhost:3000/settings?tab=credits&payment=success",
    "cancelUrl": "http://localhost:3000/settings?tab=credits&payment=cancelled"
  }'
```

Expected response:
```json
{
  "success": true,
  "url": "https://checkout.stripe.com/c/pay/...",
  "sessionId": "cs_test_..."
}
```

#### Test Payment Flow:

1. Click "Add Credits" in the settings page
2. Select or enter an amount
3. Click "Proceed to Payment"
4. You'll be redirected to Stripe Checkout
5. Use test card: `4242 4242 4242 4242`, any future expiry, any CVC
6. Complete payment
7. You'll be redirected back to your app
8. Credits should be added to your wallet

### 5. Pricing Configuration

The current pricing model is:
- **$1 USD = 100 credits**
- Users purchase dollar amounts which are converted to credits
- Example: $99 purchase = 9,900 credits

To change this, modify the conversion in:
- Frontend: `/frontend/web/src/components/settings/CreditsSettings.tsx`
- Backend: `/backend/core/billing/routes/stripe.routes.js`

## API Endpoints

### POST /api/stripe/create-credits-checkout
Creates a Stripe Checkout session for purchasing credits.

**Request:**
```json
{
  "amount": 99,
  "successUrl": "https://yourapp.com/settings?payment=success",
  "cancelUrl": "https://yourapp.com/settings?payment=cancelled",
  "metadata": {
    "credits": 99
  }
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://checkout.stripe.com/...",
  "sessionId": "cs_test_..."
}
```

### POST /api/stripe/webhook
Handles Stripe webhook events (payment confirmations).

**Events Handled:**
- `checkout.session.completed` - Adds credits to user's wallet after successful payment
- `payment_intent.succeeded` - Logs successful payment
- `payment_intent.payment_failed` - Logs failed payment

## Security Notes

1. **Never commit API keys** to version control
2. Use **test mode** keys for development
3. Use **live mode** keys only in production
4. Validate webhook signatures to prevent fraud
5. Store webhook secrets securely in environment variables

## Troubleshooting

### Error: "Payment processing not configured"
- Check that `STRIPE_SECRET_KEY` is set in your environment variables
- Verify the key starts with `sk_test_` (test mode) or `sk_live_` (production)

### Error: "Webhook signature verification failed"
- Verify `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint secret
- For local development, use Stripe CLI's webhook secret
- For production, use the secret from your webhook endpoint configuration

### Credits not added after payment
- Check backend logs for webhook events
- Verify webhook endpoint is accessible from Stripe
- Ensure `checkout.session.completed` event is selected in webhook configuration
- Check that metadata contains `tenantId` and `credits`

## Production Checklist

- [ ] Switch to live mode API keys (`sk_live_...`)
- [ ] Configure production webhook endpoint in Stripe Dashboard
- [ ] Update `STRIPE_WEBHOOK_SECRET` with production webhook secret
- [ ] Set proper `FRONTEND_URL` in environment variables
- [ ] Test complete payment flow in production
- [ ] Enable proper error monitoring/logging
- [ ] Set up Stripe Dashboard notifications
- [ ] Configure tax settings if required
- [ ] Review and comply with PCI DSS requirements

## Additional Resources

- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Stripe Dashboard](https://dashboard.stripe.com/)
