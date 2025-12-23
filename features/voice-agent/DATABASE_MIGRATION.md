# Database Schema Migration Guide

## Overview
This document outlines the database schema changes needed for the multi-tenant voice agent feature migration.

## Design Principles

✅ **Followed Recommendations:**
1. **Tenant-based multi-tenancy** - Every table has `tenant_id` column
2. **Business entity naming** - Tables represent business entities, not features
3. **No feature prefixes** - Tables use clean names (e.g., `voice_calls` not `voice_calls_voag`)
4. **Shared database** - Single database for all tenants
5. **Row-level isolation** - All queries filter by `tenant_id`
6. **Feature flags** - Behavior controlled by flags, not schema

## Tables to Create

### 1. Tenants Table (if not exists)

```sql
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(50) DEFAULT 'free',
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tenants_name ON tenants(name);
CREATE INDEX idx_tenants_plan ON tenants(plan);
```

### 2. Voice Calls Table

**Business Entity:** Records of voice calls made through the system

```sql
CREATE TABLE voice_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Call details
  voice_id VARCHAR(255),
  agent_id INTEGER,
  from_number VARCHAR(50) NOT NULL,
  to_number VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'calling',
  
  -- Call context
  added_context TEXT,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  initiated_by VARCHAR(255),
  
  -- Recording
  recording_url TEXT,
  
  -- Timestamps
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for tenant isolation
  CONSTRAINT voice_calls_tenant_id_key UNIQUE (tenant_id, id)
);

-- Indexes
CREATE INDEX idx_voice_calls_tenant_id ON voice_calls(tenant_id);
CREATE INDEX idx_voice_calls_lead_id ON voice_calls(lead_id);
CREATE INDEX idx_voice_calls_status ON voice_calls(tenant_id, status);
CREATE INDEX idx_voice_calls_started_at ON voice_calls(tenant_id, started_at DESC);
CREATE INDEX idx_voice_calls_agent_id ON voice_calls(tenant_id, agent_id);

-- Row Level Security (Optional but Recommended)
ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_voice_calls
ON voice_calls
USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 3. Voice Agents Table

**Business Entity:** AI voice assistants with configured voices

```sql
CREATE TABLE voice_agents (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Agent details
  agent_name VARCHAR(255) NOT NULL,
  agent_language VARCHAR(10) DEFAULT 'en',
  voice_id VARCHAR(255),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Additional data
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT voice_agents_tenant_name_key UNIQUE (tenant_id, agent_name)
);

-- Indexes
CREATE INDEX idx_voice_agents_tenant_id ON voice_agents(tenant_id);
CREATE INDEX idx_voice_agents_name ON voice_agents(tenant_id, agent_name);
CREATE INDEX idx_voice_agents_is_active ON voice_agents(tenant_id, is_active);

-- Row Level Security
ALTER TABLE voice_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_voice_agents
ON voice_agents
USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 4. Voices Table

**Business Entity:** Voice profiles/samples for TTS

```sql
CREATE TABLE voices (
  id VARCHAR(255) PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Voice details
  voice_name VARCHAR(255) NOT NULL,
  description TEXT,
  voice_sample_url TEXT,
  
  -- Provider info
  provider VARCHAR(50) DEFAULT 'custom',
  language VARCHAR(10) DEFAULT 'en',
  gender VARCHAR(20) DEFAULT 'neutral',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Additional data
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT voices_tenant_id_key UNIQUE (tenant_id, id)
);

-- Indexes
CREATE INDEX idx_voices_tenant_id ON voices(tenant_id);
CREATE INDEX idx_voices_language ON voices(tenant_id, language);
CREATE INDEX idx_voices_provider ON voices(tenant_id, provider);
CREATE INDEX idx_voices_is_active ON voices(tenant_id, is_active);

-- Row Level Security
ALTER TABLE voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_voices
ON voices
USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 5. Phone Numbers Table

**Business Entity:** Phone numbers available for outbound calling

```sql
CREATE TABLE phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Number details
  phone_number VARCHAR(50) NOT NULL,
  provider VARCHAR(50) DEFAULT 'custom',
  number_type VARCHAR(50) DEFAULT 'local',
  
  -- Capabilities
  capabilities JSONB DEFAULT '["voice"]',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Additional data
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT phone_numbers_tenant_number_key UNIQUE (tenant_id, phone_number)
);

-- Indexes
CREATE INDEX idx_phone_numbers_tenant_id ON phone_numbers(tenant_id);
CREATE INDEX idx_phone_numbers_provider ON phone_numbers(tenant_id, provider);
CREATE INDEX idx_phone_numbers_is_active ON phone_numbers(tenant_id, is_active);
CREATE INDEX idx_phone_numbers_capabilities ON phone_numbers USING GIN (capabilities);

-- Row Level Security
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_phone_numbers
ON phone_numbers
USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 6. Add tenant_id to Leads Table (if not exists)

**Existing Business Entity:** Update to support multi-tenancy

```sql
-- Only if leads table doesn't have tenant_id
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Add index
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);

-- Add RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_leads
ON leads
USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 7. Add tenant_id to Cache Tables (if not exists)

```sql
-- Company search cache
ALTER TABLE company_search_cache 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_company_search_cache_tenant_id 
ON company_search_cache(tenant_id);

-- Employees cache
ALTER TABLE employees_cache 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_employees_cache_tenant_id 
ON employees_cache(tenant_id);
```

## Migration Strategy

### Step 1: Backup
```bash
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_pre_voice_agent_migration.sql
```

### Step 2: Create Tenants Table
```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/001_create_tenants.sql
```

### Step 3: Create Voice Agent Tables
```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/002_create_voice_calls.sql
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/003_create_voice_agents.sql
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/004_create_voices.sql
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/005_create_phone_numbers.sql
```

### Step 4: Add tenant_id to Existing Tables
```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/006_add_tenant_id_to_leads.sql
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/007_add_tenant_id_to_caches.sql
```

### Step 5: Migrate Existing Data (if any)
```sql
-- Create a default tenant for existing data
INSERT INTO tenants (name, plan) VALUES ('Default Tenant', 'enterprise')
RETURNING id; -- Note this ID

-- Update existing records with tenant_id
UPDATE leads SET tenant_id = '<default-tenant-id>' WHERE tenant_id IS NULL;
UPDATE company_search_cache SET tenant_id = '<default-tenant-id>' WHERE tenant_id IS NULL;
UPDATE employees_cache SET tenant_id = '<default-tenant-id>' WHERE tenant_id IS NULL;
```

## Application Changes

### Setting Tenant Context (PostgreSQL RLS)

```javascript
// Middleware to set tenant context
async function setTenantContext(req, res, next) {
  const tenantId = req.user.tenantId; // From JWT
  await db.query('SET LOCAL app.tenant_id = $1', [tenantId]);
  next();
}
```

### Query Examples

```javascript
// All queries automatically filtered by tenant_id via RLS
const calls = await db.query('SELECT * FROM voice_calls WHERE status = $1', ['ended']);

// Or explicit filtering
const calls = await db.query(
  'SELECT * FROM voice_calls WHERE tenant_id = $1 AND status = $2',
  [tenantId, 'ended']
);
```

## Rollback Plan

```sql
-- Remove RLS policies
DROP POLICY IF EXISTS tenant_isolation_voice_calls ON voice_calls;
DROP POLICY IF EXISTS tenant_isolation_voice_agents ON voice_agents;
DROP POLICY IF EXISTS tenant_isolation_voices ON voices;
DROP POLICY IF EXISTS tenant_isolation_phone_numbers ON phone_numbers;
DROP POLICY IF EXISTS tenant_isolation_leads ON leads;

-- Drop tables
DROP TABLE IF EXISTS phone_numbers CASCADE;
DROP TABLE IF EXISTS voice_calls CASCADE;
DROP TABLE IF EXISTS voice_agents CASCADE;
DROP TABLE IF EXISTS voices CASCADE;
-- Note: Don't drop tenants, leads, or cache tables as they're shared
```

## Testing

```sql
-- Insert test tenant
INSERT INTO tenants (id, name, plan) VALUES 
('00000000-0000-0000-0000-000000000001', 'Test Tenant', 'pro');

-- Test RLS
SET app.tenant_id = '00000000-0000-0000-0000-000000000001';

-- Should only see tenant's data
SELECT * FROM voice_calls;
SELECT * FROM voice_agents;
```

## Notes

- ✅ All tables use `tenant_id` for isolation
- ✅ Business entity names (not feature-prefixed)
- ✅ RLS policies enforce tenant isolation
- ✅ Single database, multiple tenants
- ✅ Feature flags control behavior
- ✅ Clean migration path from old schema

