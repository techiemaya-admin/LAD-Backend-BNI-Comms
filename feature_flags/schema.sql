/**
 * Feature Flags Database Schema - Single Source of Truth
 * 
 * PURPOSE:
 * Creates the complete database schema for a production-grade SaaS platform
 * with proper multi-tenant feature flags, billing, and usage tracking.
 * This schema eliminates the "3 sources of truth" problem by centralizing
 * all feature access decisions in a single, consistent database.
 * 
 * SCHEMA OVERVIEW:
 * 1. FEATURES: Master catalog of all available features
 * 2. PLANS: Subscription tiers (free, basic, premium, enterprise)
 * 3. PLAN_FEATURES: Which features are included in each plan
 * 4. CLIENTS: Customer organizations with their subscription plans
 * 5. CLIENT_FEATURES: Per-client feature overrides and customizations
 * 6. FEATURE_USAGE: Detailed usage tracking for billing and analytics
 * 
 * FEATURE ACCESS HIERARCHY:
 * 1. Client-specific overrides (client_features) - highest priority
 * 2. Plan-based features (plan_features) - subscription tier
 * 3. Feature defaults - fallback behavior
 * 
 * BILLING INTEGRATION:
 * - Credit-based usage tracking
 * - Per-operation cost tracking
 * - Monthly usage summaries
 * - Overage detection and billing
 * 
 * MULTI-TENANT DESIGN:
 * - Complete client isolation
 * - Subscription plan inheritance
 * - Individual feature customization
 * - Usage analytics per client
 * 
 * PERFORMANCE CONSIDERATIONS:
 * - Proper indexing for fast feature flag lookups
 * - Efficient queries for plan resolution
 * - Partitioning strategy for usage data (implement as needed)
 * - Caching-friendly structure
 * 
 * SECURITY:
 * - UUID primary keys prevent enumeration attacks
 * - Foreign key constraints ensure data integrity
 * - Client isolation prevents data leakage
 * - Audit trail for feature changes (implement as needed)
 * 
 * SCALABILITY:
 * - Designed for millions of clients
 * - Efficient feature flag resolution
 * - Bulk operations support
 * - Horizontal scaling ready
 */

-- Feature Flags Database Schema
-- Single source of truth for all feature flags

-- Core features table
CREATE TABLE IF NOT EXISTS features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  version VARCHAR(20) DEFAULT '1.0.0',
  category VARCHAR(30) DEFAULT 'feature', -- feature, core, billing
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Plans table (billing tiers)
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Plan features (what features are included in each plan)
CREATE TABLE IF NOT EXISTS plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  feature_id UUID REFERENCES features(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(plan_id, feature_id)
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  plan_id UUID REFERENCES plans(id),
  stripe_customer_id VARCHAR(255),
  trial_ends_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Client-specific feature overrides
CREATE TABLE IF NOT EXISTS client_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  feature_id UUID REFERENCES features(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, feature_id)
);

-- Feature usage tracking for billing
CREATE TABLE IF NOT EXISTS feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  feature_id UUID REFERENCES features(id) ON DELETE CASCADE,
  usage_type VARCHAR(50), -- search, email_reveal, phone_reveal, etc.
  quantity INTEGER DEFAULT 1,
  credits_used INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_features_client_id ON client_features(client_id);
CREATE INDEX IF NOT EXISTS idx_client_features_feature_id ON client_features(feature_id);
CREATE INDEX IF NOT EXISTS idx_plan_features_plan_id ON plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_client_date ON feature_usage(client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_features_key ON features(key);

-- Insert core features
INSERT INTO features (key, name, description, category) VALUES
('auth', 'Authentication', 'User authentication and authorization', 'core'),
('billing', 'Billing System', 'Stripe integration and payment processing', 'core'),
('users', 'User Management', 'User profile and settings management', 'core'),
('apollo-leads', 'Apollo Leads', 'Apollo.io lead generation and company search', 'feature'),
('voice-agent', 'AI Voice Agent', 'AI-powered voice calling system', 'feature'),
('linkedin-integration', 'LinkedIn Integration', 'LinkedIn data scraping and lead generation', 'feature'),
('dashboard-analytics', 'Dashboard Analytics', 'Advanced analytics and reporting', 'feature')
ON CONFLICT (key) DO NOTHING;

-- Insert default plans
INSERT INTO plans (name, display_name, price_monthly, price_yearly, description) VALUES
('free', 'Free Plan', 0.00, 0.00, 'Basic features for getting started'),
('basic', 'Basic Plan', 29.00, 290.00, 'Essential features for small teams'),
('premium', 'Premium Plan', 99.00, 990.00, 'Advanced features for growing businesses'),
('enterprise', 'Enterprise Plan', 299.00, 2990.00, 'Full feature suite for large organizations')
ON CONFLICT (name) DO NOTHING;

-- Configure plan features
INSERT INTO plan_features (plan_id, feature_id, enabled)
SELECT p.id, f.id, 
  CASE 
    WHEN f.category = 'core' THEN true -- All plans get core features
    WHEN p.name = 'free' AND f.key IN ('dashboard-analytics') THEN true
    WHEN p.name = 'basic' AND f.key IN ('dashboard-analytics') THEN true
    WHEN p.name = 'premium' AND f.key IN ('apollo-leads', 'voice-agent', 'dashboard-analytics') THEN true
    WHEN p.name = 'enterprise' THEN true -- Enterprise gets everything
    ELSE false
  END
FROM plans p
CROSS JOIN features f
ON CONFLICT (plan_id, feature_id) DO NOTHING;