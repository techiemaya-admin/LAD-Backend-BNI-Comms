# Core Database Tables Schema

## Overview
Core infrastructure tables that support multi-tenant SaaS architecture.
These tables are referenced by all feature modules.

---

## 1. Tenants Table

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tenants_name ON tenants(name);
CREATE INDEX idx_tenants_plan_id ON tenants(plan_id);
CREATE INDEX idx_tenants_is_active ON tenants(is_active);
CREATE INDEX idx_tenants_created_at ON tenants(created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Purpose:** Represents organizations/companies using the platform

**Fields:**
- `id` - Unique tenant identifier
- `name` - Organization name
- `plan_id` - Reference to subscription plan
- `is_active` - Tenant status (for soft delete)
- `metadata` - JSON field for extensibility (e.g., settings, preferences)
- `created_at` - Account creation timestamp
- `updated_at` - Last update timestamp

---

## 2. Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(LOWER(email));
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_metadata_external_id ON users((metadata->>'external_id'));

-- Trigger for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Purpose:** Represents individual users across all tenants

**Fields:**
- `id` - Unique user identifier
- `email` - User email (unique across platform)
- `first_name` - First name
- `last_name` - Last name
- `is_active` - User status
- `metadata` - JSON field for extensibility
  - `external_id` - External auth provider ID (e.g., Clerk user_id)
  - `provider` - Auth provider (e.g., 'clerk', 'auth0')
  - `avatar_url` - Profile picture URL
  - Any custom fields
- `created_at` - Account creation timestamp
- `updated_at` - Last update timestamp

---

## 3. Memberships Table (Junction)

```sql
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_tenant_id ON memberships(tenant_id);
CREATE INDEX idx_memberships_role ON memberships(role);
CREATE INDEX idx_memberships_created_at ON memberships(created_at DESC);

-- Check constraint for valid roles
ALTER TABLE memberships
ADD CONSTRAINT memberships_role_check
CHECK (role IN ('owner', 'admin', 'member', 'viewer'));
```

**Purpose:** Maps users to tenants with roles (many-to-many)

**Fields:**
- `id` - Unique membership identifier
- `user_id` - Reference to user
- `tenant_id` - Reference to tenant
- `role` - User's role in the tenant
  - `owner` - Full control (can delete tenant, manage billing)
  - `admin` - Manage users, configure features
  - `member` - Use features, limited configuration
  - `viewer` - Read-only access
- `created_at` - When user joined tenant

**Constraints:**
- Unique constraint on (user_id, tenant_id) - user can only have one role per tenant
- Cascade delete on both user and tenant

---

## 4. Plans Table

```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  billing_cycle VARCHAR(20) DEFAULT 'monthly',
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_plans_name ON plans(name);
CREATE INDEX idx_plans_is_active ON plans(is_active);

-- Trigger for updated_at
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Purpose:** Subscription plans (Free, Pro, Enterprise, etc.)

**Fields:**
- `id` - Unique plan identifier
- `name` - Plan name (e.g., 'Free', 'Pro', 'Enterprise')
- `description` - Plan description
- `price` - Monthly/yearly price
- `billing_cycle` - 'monthly', 'yearly', 'one-time'
- `is_active` - Whether plan is available for new signups
- `metadata` - JSON field for extensibility
  - `features_summary` - Quick list of features
  - `stripe_price_id` - Payment provider ID
  - `limits` - Usage limits
- `created_at` - Plan creation timestamp
- `updated_at` - Last update timestamp

---

## 5. Features Table

```sql
CREATE TABLE features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  feature_type VARCHAR(50) DEFAULT 'boolean',
  default_value JSONB DEFAULT 'false',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_features_feature_key ON features(feature_key);
CREATE INDEX idx_features_feature_type ON features(feature_type);

-- Trigger for updated_at
CREATE TRIGGER update_features_updated_at
  BEFORE UPDATE ON features
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Purpose:** Feature flags/capabilities available in the system

**Fields:**
- `id` - Unique feature identifier
- `feature_key` - Unique key (e.g., 'voice_calls', 'ai_icp', 'apollo_search')
- `name` - Display name
- `description` - Feature description
- `feature_type` - Type of feature:
  - `boolean` - Simple on/off
  - `limit` - Numeric limit (e.g., max calls per month)
  - `addon` - Add-on feature
- `default_value` - Default value (JSON)
  - For boolean: `true` or `false`
  - For limit: `{"limit": 1000}`
  - For addon: `{"enabled": false, "price": 10}`
- `metadata` - Additional configuration
- `created_at` - Feature creation timestamp
- `updated_at` - Last update timestamp

---

## 6. Plan Features Table (Junction)

```sql
CREATE TABLE plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  feature_value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(plan_id, feature_id)
);

CREATE INDEX idx_plan_features_plan_id ON plan_features(plan_id);
CREATE INDEX idx_plan_features_feature_id ON plan_features(feature_id);
```

**Purpose:** Maps features to plans with specific values

**Fields:**
- `id` - Unique mapping identifier
- `plan_id` - Reference to plan
- `feature_id` - Reference to feature
- `feature_value` - Feature configuration for this plan (JSON)
  - For boolean: `{"enabled": true}`
  - For limit: `{"enabled": true, "limit": 5000}`
  - For addon: `{"enabled": true, "price": 0}` (included in plan)
- `created_at` - Mapping creation timestamp

**Example Data:**
```sql
-- Free plan gets 100 calls/month
INSERT INTO plan_features (plan_id, feature_id, feature_value)
VALUES (
  'free-plan-uuid',
  'voice_calls-feature-uuid',
  '{"enabled": true, "limit": 100}'
);

-- Pro plan gets unlimited calls
INSERT INTO plan_features (plan_id, feature_id, feature_value)
VALUES (
  'pro-plan-uuid',
  'voice_calls-feature-uuid',
  '{"enabled": true, "limit": null}'
);
```

---

## 7. Tenant Features Table (Overrides)

```sql
CREATE TABLE tenant_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  feature_value JSONB NOT NULL,
  enabled_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  notes TEXT,
  UNIQUE(tenant_id, feature_id)
);

CREATE INDEX idx_tenant_features_tenant_id ON tenant_features(tenant_id);
CREATE INDEX idx_tenant_features_feature_id ON tenant_features(feature_id);
CREATE INDEX idx_tenant_features_expires_at ON tenant_features(expires_at);
```

**Purpose:** Tenant-specific feature overrides (e.g., trials, custom limits)

**Fields:**
- `id` - Unique override identifier
- `tenant_id` - Reference to tenant
- `feature_id` - Reference to feature
- `feature_value` - Override value (JSON)
  - Overrides plan default
  - Same format as plan_features
- `enabled_at` - When override was enabled
- `expires_at` - Optional expiration (for trials)
- `notes` - Admin notes (e.g., "Trial period", "Custom agreement")

**Use Cases:**
- Free trial of premium features
- Custom limits for enterprise customers
- Temporary feature access
- Beta testing new features

**Example:**
```sql
-- Give tenant a 30-day trial of unlimited calls
INSERT INTO tenant_features (tenant_id, feature_id, feature_value, expires_at, notes)
VALUES (
  'tenant-uuid',
  'voice_calls-feature-uuid',
  '{"enabled": true, "limit": null}',
  NOW() + INTERVAL '30 days',
  'Pro trial - 30 days'
);
```

---

## Feature Resolution Logic

When checking if a tenant has access to a feature:

1. **Check tenant_features** - If override exists, use it
2. **Check plan_features** - If tenant has a plan, use plan value
3. **Use feature default** - Fall back to feature.default_value

```sql
-- Query to resolve feature for a tenant
SELECT 
  f.feature_key,
  COALESCE(
    tf.feature_value,     -- Tenant override (highest priority)
    pf.feature_value,     -- Plan value
    f.default_value       -- Default value (lowest priority)
  ) as resolved_value
FROM features f
LEFT JOIN tenants t ON t.id = $1
LEFT JOIN plan_features pf ON pf.plan_id = t.plan_id AND pf.feature_id = f.id
LEFT JOIN tenant_features tf ON tf.tenant_id = t.id 
  AND tf.feature_id = f.id
  AND (tf.expires_at IS NULL OR tf.expires_at > NOW())
WHERE f.feature_key = $2;
```

---

## Seed Data

### Initial Plans
```sql
INSERT INTO plans (id, name, description, price, billing_cycle) VALUES
('00000000-0000-0000-0000-000000000001', 'Free', 'For individuals and small teams', 0, 'monthly'),
('00000000-0000-0000-0000-000000000002', 'Pro', 'For growing businesses', 49, 'monthly'),
('00000000-0000-0000-0000-000000000003', 'Enterprise', 'For large organizations', NULL, 'custom');
```

### Core Features
```sql
INSERT INTO features (feature_key, name, feature_type, default_value) VALUES
('voice_calls', 'Voice Calls', 'limit', '{"enabled": true, "limit": 100}'),
('ai_icp', 'AI ICP Builder', 'boolean', 'false'),
('apollo_search', 'Apollo Search', 'limit', '{"enabled": false, "limit": 0}'),
('linkedin_scraping', 'LinkedIn Scraping', 'boolean', 'false'),
('team_members', 'Team Members', 'limit', '{"enabled": true, "limit": 1}');
```

### Map Features to Plans
```sql
-- Free plan: Limited features
INSERT INTO plan_features (plan_id, feature_id, feature_value)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  id,
  CASE feature_key
    WHEN 'voice_calls' THEN '{"enabled": true, "limit": 100}'
    WHEN 'team_members' THEN '{"enabled": true, "limit": 1}'
    ELSE '{"enabled": false}'
  END
FROM features
WHERE feature_key IN ('voice_calls', 'team_members');

-- Pro plan: Most features enabled
INSERT INTO plan_features (plan_id, feature_id, feature_value)
SELECT 
  '00000000-0000-0000-0000-000000000002',
  id,
  CASE feature_key
    WHEN 'voice_calls' THEN '{"enabled": true, "limit": 5000}'
    WHEN 'ai_icp' THEN '{"enabled": true}'
    WHEN 'apollo_search' THEN '{"enabled": true, "limit": 1000}'
    WHEN 'team_members' THEN '{"enabled": true, "limit": 10}'
    ELSE '{"enabled": true}'
  END
FROM features;
```

---

## Migration from Existing Schema

### Map organizations to tenants
```sql
INSERT INTO tenants (id, name, plan_id, metadata)
SELECT 
  organization_id as id,
  'Organization ' || organization_id as name,
  '00000000-0000-0000-0000-000000000002' as plan_id, -- Default to Pro
  jsonb_build_object('source', 'voice_agent_migration')
FROM voice_agent.users_voiceagent
WHERE organization_id IS NOT NULL
GROUP BY organization_id;
```

### Migrate users
```sql
INSERT INTO users (id, email, first_name, last_name, metadata)
SELECT 
  gen_random_uuid(),
  email,
  first_name,
  last_name,
  jsonb_build_object(
    'external_id', user_id,
    'provider', platform,
    'source', 'voice_agent_migration'
  )
FROM voice_agent.users_voiceagent
ON CONFLICT (email) DO NOTHING;
```

### Create memberships
```sql
INSERT INTO memberships (user_id, tenant_id, role)
SELECT 
  u.id as user_id,
  vu.organization_id as tenant_id,
  COALESCE(vu.role, 'member') as role
FROM voice_agent.users_voiceagent vu
INNER JOIN users u ON u.metadata->>'external_id' = vu.user_id
WHERE vu.organization_id IS NOT NULL
ON CONFLICT (user_id, tenant_id) DO NOTHING;
```

