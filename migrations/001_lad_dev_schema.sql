-- ============================================================================
-- LAD Fresh Schema Migration - lad_dev
-- ============================================================================
-- Creates a clean database schema with modern SaaS architecture best practices
-- Includes: Multi-tenancy, RBAC, soft deletes, audit trails, external auth
-- ============================================================================

-- Drop and recreate schema
DROP SCHEMA IF EXISTS lad_dev CASCADE;
CREATE SCHEMA lad_dev;
SET search_path TO lad_dev, public;

-- ============================================================================
-- ENUMS & TYPES
-- ============================================================================

CREATE TYPE tenant_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE plan_tier AS ENUM ('free', 'starter', 'professional', 'enterprise');
CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'trial', 'cancelled');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TENANTS (Organizations)
-- ----------------------------------------------------------------------------
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE,
  status tenant_status DEFAULT 'trial',
  plan_tier plan_tier DEFAULT 'free',
  
  -- Contact & metadata
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  
  -- Constraints
  CONSTRAINT tenants_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Indexes
CREATE UNIQUE INDEX idx_tenants_name_lower ON tenants(LOWER(name)) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_plan_tier ON tenants(plan_tier);
CREATE INDEX idx_tenants_created_at ON tenants(created_at DESC);
CREATE INDEX idx_tenants_deleted_at ON tenants(deleted_at) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2. USERS (Global users across all tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  
  -- Profile
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url TEXT,
  phone VARCHAR(50),
  
  -- Primary tenant (ownership anchor)
  primary_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  
  -- Status & flags
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  phone_verified BOOLEAN DEFAULT false,
  
  -- Security
  last_login_at TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Indexes
CREATE UNIQUE INDEX idx_users_email_lower ON users(LOWER(email)) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_primary_tenant ON users(primary_tenant_id);
CREATE INDEX idx_users_is_active ON users(is_active) WHERE is_active = true;
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3. USER_IDENTITIES (External auth providers)
-- ----------------------------------------------------------------------------
CREATE TABLE user_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Provider info
  provider VARCHAR(50) NOT NULL, -- 'clerk', 'google', 'github', etc.
  provider_user_id VARCHAR(255) NOT NULL,
  
  -- OAuth tokens (encrypted in production)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Provider metadata
  provider_data JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT user_identities_provider_user_unique UNIQUE(provider, provider_user_id),
  CONSTRAINT user_identities_user_provider_unique UNIQUE(user_id, provider)
);

-- Indexes
CREATE INDEX idx_user_identities_user_id ON user_identities(user_id);
CREATE INDEX idx_user_identities_provider ON user_identities(provider, provider_user_id);

-- ----------------------------------------------------------------------------
-- 4. MEMBERSHIPS (User-Tenant junction with roles)
-- ----------------------------------------------------------------------------
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Role
  role tenant_role DEFAULT 'member',
  
  -- Audit trail
  invited_by UUID REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  
  -- Constraints
  CONSTRAINT memberships_user_tenant_unique UNIQUE(user_id, tenant_id)
);

-- Indexes
CREATE INDEX idx_memberships_user_id ON memberships(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_memberships_tenant_id ON memberships(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_memberships_role ON memberships(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_memberships_deleted_at ON memberships(deleted_at) WHERE deleted_at IS NULL;

-- One owner per tenant (enforces single ownership)
CREATE UNIQUE INDEX idx_memberships_one_owner_per_tenant 
ON memberships(tenant_id) 
WHERE role = 'owner' AND deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 5. USER_CREDITS (Wallet/Balance tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  
  -- Balance
  balance DECIMAL(10, 2) DEFAULT 0.00,
  
  -- Usage tracking
  monthly_usage DECIMAL(10, 2) DEFAULT 0.00,
  last_usage_reset TIMESTAMPTZ DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT user_credits_balance_positive CHECK (balance >= 0),
  CONSTRAINT user_credits_user_unique UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX idx_user_credits_tenant_id ON user_credits(tenant_id);

-- ----------------------------------------------------------------------------
-- 6. CREDIT_TRANSACTIONS (Audit trail for credit changes)
-- ----------------------------------------------------------------------------
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_credit_id UUID REFERENCES user_credits(id) ON DELETE SET NULL,
  
  -- Transaction details
  amount DECIMAL(10, 2) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'purchase', 'debit', 'refund', 'adjustment'
  description TEXT,
  
  -- Reference
  reference_type VARCHAR(50), -- 'campaign', 'call', 'api_request', etc.
  reference_id UUID,
  
  -- Balance snapshot
  balance_before DECIMAL(10, 2),
  balance_after DECIMAL(10, 2),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_tenant_id ON credit_transactions(tenant_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(transaction_type);

-- ----------------------------------------------------------------------------
-- 7. TENANT_FEATURES (Feature enablement per tenant)
-- ----------------------------------------------------------------------------
CREATE TABLE tenant_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Feature
  feature_key VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  
  -- Configuration
  config JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT tenant_features_unique UNIQUE(tenant_id, feature_key)
);

-- Indexes
CREATE INDEX idx_tenant_features_tenant_id ON tenant_features(tenant_id);
CREATE INDEX idx_tenant_features_key ON tenant_features(feature_key);
CREATE INDEX idx_tenant_features_enabled ON tenant_features(enabled) WHERE enabled = true;

-- ----------------------------------------------------------------------------
-- 8. USER_CAPABILITIES (Granular permissions linked to features)
-- ----------------------------------------------------------------------------
CREATE TABLE user_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Capability with optional feature boundary
  capability_key VARCHAR(100) NOT NULL,
  feature_key VARCHAR(100), -- Links to tenant_features for scoping
  enabled BOOLEAN DEFAULT true,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT user_capabilities_unique UNIQUE(user_id, capability_key, tenant_id)
);

-- Indexes
CREATE INDEX idx_user_capabilities_user_id ON user_capabilities(user_id);
CREATE INDEX idx_user_capabilities_tenant_id ON user_capabilities(tenant_id);
CREATE INDEX idx_user_capabilities_key ON user_capabilities(capability_key);
CREATE INDEX idx_user_capabilities_feature_key ON user_capabilities(feature_key);

-- ----------------------------------------------------------------------------
-- 9. TENANT_INVITATIONS (Invitation flow)
-- ----------------------------------------------------------------------------
CREATE TABLE tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Invitee
  email VARCHAR(255) NOT NULL,
  role tenant_role DEFAULT 'member',
  
  -- Invitation details
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitation_token VARCHAR(255) UNIQUE NOT NULL,
  
  -- Status
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Metadata
  message TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Indexes
CREATE INDEX idx_tenant_invitations_tenant_id ON tenant_invitations(tenant_id);
CREATE INDEX idx_tenant_invitations_email ON tenant_invitations(LOWER(email));
CREATE INDEX idx_tenant_invitations_token ON tenant_invitations(invitation_token);
CREATE INDEX idx_tenant_invitations_expires_at ON tenant_invitations(expires_at);

-- Unique index for pending invitations only
CREATE UNIQUE INDEX idx_tenant_invitations_pending 
ON tenant_invitations(tenant_id, LOWER(email)) 
WHERE accepted_at IS NULL AND deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 10. DOMAIN_EVENTS (Event sourcing / outbox pattern)
-- ----------------------------------------------------------------------------
CREATE TABLE domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Event details
  event_type VARCHAR(100) NOT NULL,
  aggregate_type VARCHAR(100), -- 'user', 'campaign', 'call', etc.
  aggregate_id UUID,
  
  -- Payload
  payload JSONB NOT NULL,
  
  -- Processing status
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  retry_count INT DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_domain_events_tenant_id ON domain_events(tenant_id);
CREATE INDEX idx_domain_events_type ON domain_events(event_type);
CREATE INDEX idx_domain_events_processed ON domain_events(processed, created_at) WHERE processed = false;
CREATE INDEX idx_domain_events_aggregate ON domain_events(aggregate_type, aggregate_id);
CREATE INDEX idx_domain_events_created_at ON domain_events(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_identities_updated_at BEFORE UPDATE ON user_identities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memberships_updated_at BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_credits_updated_at BEFORE UPDATE ON user_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_features_updated_at BEFORE UPDATE ON tenant_features
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_capabilities_updated_at BEFORE UPDATE ON user_capabilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_invitations_updated_at BEFORE UPDATE ON tenant_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Demo tenant
INSERT INTO tenants (id, name, slug, status, plan_tier, email, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'Demo Organization', 'demo-org', 'active', 'enterprise', 'admin@demo.com', NOW());

-- Demo user (password is 'password123')
INSERT INTO users (id, email, password_hash, first_name, last_name, primary_tenant_id, is_active, email_verified, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'admin@demo.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Demo', 'Admin', '00000000-0000-0000-0000-000000000001', true, true, NOW());

-- Demo membership
INSERT INTO memberships (user_id, tenant_id, role, created_at) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', NOW());

-- Demo credits
INSERT INTO user_credits (user_id, tenant_id, balance, created_at) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 10000.00, NOW());

-- Demo tenant features
INSERT INTO tenant_features (tenant_id, feature_key, enabled, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'apollo_leads', true, NOW()),
('00000000-0000-0000-0000-000000000001', 'voice_agent', true, NOW()),
('00000000-0000-0000-0000-000000000001', 'campaigns', true, NOW()),
('00000000-0000-0000-0000-000000000001', 'ai_assistant', true, NOW());

-- Demo capabilities
INSERT INTO user_capabilities (user_id, tenant_id, capability_key, feature_key, enabled, created_at) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'apollo.search', 'apollo_leads', true, NOW()),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'apollo.email_reveal', 'apollo_leads', true, NOW()),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'view_overview', NULL, true, NOW()),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'view_call_logs', 'voice_agent', true, NOW()),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'chat_with_ai', 'ai_assistant', true, NOW());

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON SCHEMA lad_dev IS 'LAD Development Schema - Multi-tenant SaaS platform';
COMMENT ON TABLE tenants IS 'Organizations/companies using the platform';
COMMENT ON TABLE users IS 'Global users - can belong to multiple tenants via memberships';
COMMENT ON TABLE user_identities IS 'External authentication provider identities (Clerk, Google, etc.)';
COMMENT ON TABLE memberships IS 'User-tenant relationships with roles and access control';
COMMENT ON TABLE user_credits IS 'Credit/wallet balance for usage-based billing';
COMMENT ON TABLE credit_transactions IS 'Audit trail for all credit changes - tenant scoped';
COMMENT ON TABLE tenant_features IS 'Feature enablement flags per tenant for subscription tiers';
COMMENT ON TABLE user_capabilities IS 'Granular permissions for RBAC linked to features';
COMMENT ON TABLE tenant_invitations IS 'Invitation flow for adding users to tenants';
COMMENT ON TABLE domain_events IS 'Event sourcing outbox for async processing and audit trail';

-- ============================================================================
-- COMPLETE
-- ============================================================================
