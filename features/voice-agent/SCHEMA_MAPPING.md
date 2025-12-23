# Database Schema Mapping Guide

## Current State Analysis (salesmaya_agent.voice_agent)

### Existing Tables Summary
- **39 users** across **6 organizations**
- **23 agents** configured
- **30 voices** available
- **5 phone numbers**
- **742 call logs**
- **63 leads**

### Current Architecture
- ✅ **Organization-based multi-tenancy** via `organization_id` in `users_voiceagent`
- ✅ **Resource permissions** via `org_permissions_voiceagent`
- ❌ **No tenant_id on resource tables** (agents, voices, numbers, calls)
- ❌ **User-based foreign keys** instead of organization-based
- ❌ **Feature-prefixed table names** (e.g., `agents_voiceagent`)

---

## Old Schema → New Schema Mapping

### 1. Call Logs Table

**OLD:** `voice_agent.call_logs_voiceagent`
```sql
Column              | Type                     | Notes
--------------------|--------------------------|---------------------------
id                  | uuid                     | Primary key
initiated_by        | integer                  | FK → users_voiceagent.id
target              | bigint                   | FK → leads_voiceagent.id
agent               | bigint                   | FK → agents_voiceagent.id
status              | text                     | Call status
call_recording_url  | text                     | Recording URL
transcriptions      | jsonb                    | Transcriptions
started_at          | timestamp with time zone | Call start
ended_at            | timestamp with time zone | Call end
call_type           | text                     | 'inbound' or 'outbound'
cost                | numeric                  | Call cost
voice               | uuid                     | FK → voices_voiceagent.id
job_id              | varchar(255)             | Job identifier
room_name           | varchar(255)             | Room name
from_number_id      | bigint                   | FK → numbers_voiceagent.id
added_context       | text                     | Additional context
vapi_call_id        | varchar(255)             | VAPI call ID
vapi_data           | jsonb                    | VAPI response data
call_duration       | numeric                  | Duration in seconds
batch_id            | uuid                     | FK → batch_logs_voiceagent.id
cost_breakdown      | jsonb                    | Cost details
```

**NEW:** `voice_calls`
```sql
Column              | Type                     | Mapping
--------------------|--------------------------|---------------------------
id                  | uuid                     | ← id
tenant_id           | uuid                     | ← JOIN users_voiceagent.organization_id via initiated_by
voice_id            | varchar(255)             | ← voice
agent_id            | integer                  | ← agent
from_number         | varchar(50)              | ← JOIN numbers_voiceagent.phone_number via from_number_id
to_number           | varchar(50)              | ← JOIN leads_voiceagent.lead_number via target
status              | varchar(50)              | ← status
added_context       | text                     | ← added_context
lead_id             | uuid                     | ← target (reference to main leads table)
initiated_by        | varchar(255)             | ← JOIN users_voiceagent.user_id via initiated_by
recording_url       | text                     | ← call_recording_url
started_at          | timestamp                | ← started_at
ended_at            | timestamp                | ← ended_at
created_at          | timestamp                | ← started_at
updated_at          | timestamp                | NOW()

-- Extended fields (keep in metadata/separate tables):
metadata.vapi_call_id       ← vapi_call_id
metadata.vapi_data          ← vapi_data
metadata.call_type          ← call_type
metadata.cost               ← cost
metadata.cost_breakdown     ← cost_breakdown
metadata.call_duration      ← call_duration
metadata.job_id             ← job_id
metadata.room_name          ← room_name
metadata.batch_id           ← batch_id
metadata.transcriptions     ← transcriptions
```

**Migration Query:**
```sql
INSERT INTO voice_calls (
  id, tenant_id, voice_id, agent_id, 
  from_number, to_number, status, added_context,
  lead_id, initiated_by, recording_url,
  started_at, ended_at, created_at, updated_at
)
SELECT 
  cl.id,
  u.organization_id as tenant_id,
  cl.voice::varchar as voice_id,
  cl.agent as agent_id,
  n.phone_number as from_number,
  l.lead_number as to_number,
  cl.status,
  cl.added_context,
  cl.target::uuid as lead_id,
  u.user_id as initiated_by,
  cl.call_recording_url as recording_url,
  cl.started_at,
  cl.ended_at,
  cl.started_at as created_at,
  NOW() as updated_at
FROM voice_agent.call_logs_voiceagent cl
LEFT JOIN voice_agent.users_voiceagent u ON cl.initiated_by = u.id
LEFT JOIN voice_agent.numbers_voiceagent n ON cl.from_number_id = n.id
LEFT JOIN voice_agent.leads_voiceagent l ON cl.target = l.id
WHERE u.organization_id IS NOT NULL;
```

---

### 2. Voice Agents Table

**OLD:** `voice_agent.agents_voiceagent`
```sql
Column                  | Type                     | Notes
------------------------|--------------------------|---------------------------
id                      | bigint                   | Primary key (auto-increment)
name                    | text                     | Agent name
gender                  | text                     | Gender
agent_instructions      | text                     | Instructions
created_by              | integer                  | FK → users_voiceagent.id
created_at              | timestamp with time zone | Created timestamp
default_number          | bigint                   | FK → numbers_voiceagent.id
language                | text                     | Language code (default 'en')
voice_id                | uuid                     | FK → voices_voiceagent.id
system_instructions     | text                     | System instructions
outbound_starter_prompt | text                     | Outbound prompt
inbound_starter_prompt  | text                     | Inbound prompt
```

**NEW:** `voice_agents`
```sql
Column              | Type                     | Mapping
--------------------|--------------------------|---------------------------
id                  | serial                   | ← id
tenant_id           | uuid                     | ← JOIN users_voiceagent.organization_id via created_by
agent_name          | varchar(255)             | ← name
agent_language      | varchar(10)              | ← language
voice_id            | varchar(255)             | ← voice_id
is_active           | boolean                  | TRUE (default)
metadata            | jsonb                    | Store extended fields
created_at          | timestamp                | ← created_at
updated_at          | timestamp                | NOW()

-- Store in metadata:
metadata.gender                  ← gender
metadata.agent_instructions      ← agent_instructions
metadata.system_instructions     ← system_instructions
metadata.outbound_starter_prompt ← outbound_starter_prompt
metadata.inbound_starter_prompt  ← inbound_starter_prompt
metadata.default_number_id       ← default_number
metadata.created_by_user_id      ← JOIN users_voiceagent.user_id via created_by
```

**Migration Query:**
```sql
INSERT INTO voice_agents (
  id, tenant_id, agent_name, agent_language, 
  voice_id, is_active, metadata, created_at, updated_at
)
SELECT 
  a.id,
  u.organization_id as tenant_id,
  a.name as agent_name,
  COALESCE(a.language, 'en') as agent_language,
  a.voice_id::varchar,
  true as is_active,
  jsonb_build_object(
    'gender', a.gender,
    'agent_instructions', a.agent_instructions,
    'system_instructions', a.system_instructions,
    'outbound_starter_prompt', a.outbound_starter_prompt,
    'inbound_starter_prompt', a.inbound_starter_prompt,
    'default_number_id', a.default_number,
    'created_by_user_id', u.user_id
  ) as metadata,
  a.created_at,
  NOW() as updated_at
FROM voice_agent.agents_voiceagent a
LEFT JOIN voice_agent.users_voiceagent u ON a.created_by = u.id
WHERE u.organization_id IS NOT NULL;
```

---

### 3. Voices Table

**OLD:** `voice_agent.voices_voiceagent`
```sql
Column             | Type  | Notes
-------------------|-------|---------------------------
id                 | uuid  | Primary key
description        | text  | Voice description
gender             | text  | 'male' or 'female'
accent             | text  | Accent
provider           | text  | Provider name
voice_sample_url   | text  | Sample URL
provider_voice_id  | text  | Provider's voice ID
provider_config    | jsonb | Provider configuration
```

**NEW:** `voices`
```sql
Column              | Type                     | Mapping
--------------------|--------------------------|---------------------------
id                  | varchar(255)             | ← id
tenant_id           | uuid                     | SHARED (for system voices) or organization-specific
voice_name          | varchar(255)             | ← provider_voice_id or description
description         | text                     | ← description
voice_sample_url    | text                     | ← voice_sample_url
provider            | varchar(50)              | ← provider
language            | varchar(10)              | 'en' (default)
gender              | varchar(20)              | ← gender
is_active           | boolean                  | TRUE
metadata            | jsonb                    | Store provider_config
created_at          | timestamp                | NOW()
updated_at          | timestamp                | NOW()

-- Store in metadata:
metadata.accent          ← accent
metadata.provider_config ← provider_config
metadata.provider_voice_id ← provider_voice_id
```

**Migration Query:**
```sql
-- For shared/system voices, use a default system tenant
INSERT INTO voices (
  id, tenant_id, voice_name, description, 
  voice_sample_url, provider, language, gender,
  is_active, metadata, created_at, updated_at
)
SELECT 
  v.id::varchar,
  '00000000-0000-0000-0000-000000000000'::uuid as tenant_id, -- System tenant for shared voices
  COALESCE(v.provider_voice_id, v.description, 'Voice ' || v.id::text) as voice_name,
  v.description,
  v.voice_sample_url,
  COALESCE(v.provider, 'custom') as provider,
  'en' as language,
  COALESCE(v.gender, 'neutral') as gender,
  true as is_active,
  jsonb_build_object(
    'accent', v.accent,
    'provider_config', v.provider_config,
    'provider_voice_id', v.provider_voice_id
  ) as metadata,
  NOW() as created_at,
  NOW() as updated_at
FROM voice_agent.voices_voiceagent v;
```

---

### 4. Phone Numbers Table

**OLD:** `voice_agent.numbers_voiceagent`
```sql
Column        | Type                     | Notes
--------------|--------------------------|---------------------------
id            | bigint                   | Primary key (auto-increment)
phone_number  | text                     | Phone number
provider      | text                     | Provider
type          | text                     | Number type
created_at    | timestamp with time zone | Created timestamp
status        | text                     | Status
default_agent | bigint                   | FK → agents_voiceagent.id
```

**NEW:** `phone_numbers`
```sql
Column              | Type                     | Mapping
--------------------|--------------------------|---------------------------
id                  | uuid                     | gen_random_uuid() (new IDs)
tenant_id           | uuid                     | SHARED (for system numbers) or organization-specific
phone_number        | varchar(50)              | ← phone_number
provider            | varchar(50)              | ← provider
number_type         | varchar(50)              | ← type
capabilities        | jsonb                    | ['voice'] default
is_active           | boolean                  | ← (status = 'active')
metadata            | jsonb                    | Store extended fields
created_at          | timestamp                | ← created_at
updated_at          | timestamp                | NOW()

-- Store in metadata:
metadata.old_id         ← id
metadata.status         ← status
metadata.default_agent  ← default_agent
```

**Migration Query:**
```sql
-- For shared/system numbers, use system tenant
INSERT INTO phone_numbers (
  tenant_id, phone_number, provider, number_type,
  capabilities, is_active, metadata, created_at, updated_at
)
SELECT 
  '00000000-0000-0000-0000-000000000000'::uuid as tenant_id, -- System tenant
  n.phone_number,
  COALESCE(n.provider, 'custom') as provider,
  COALESCE(n.type, 'local') as number_type,
  '["voice"]'::jsonb as capabilities,
  CASE WHEN n.status = 'active' THEN true ELSE false END as is_active,
  jsonb_build_object(
    'old_id', n.id,
    'status', n.status,
    'default_agent', n.default_agent
  ) as metadata,
  n.created_at,
  NOW() as updated_at
FROM voice_agent.numbers_voiceagent n;
```

---

### 5. Leads Table

**OLD:** `voice_agent.leads_voiceagent`
```sql
Column      | Type   | Notes
------------|--------|---------------------------
id          | bigint | Primary key (auto-increment)
name        | text   | Lead name
lead_number | text   | Phone number
added_by    | integer| FK → users_voiceagent.id
notes       | text   | Notes
```

**NEW:** Reference main `leads` table (public schema)
```sql
-- Assuming main leads table exists with tenant_id
-- voice_agent.leads_voiceagent should reference public.leads

-- Migration: Create leads in main table if needed
INSERT INTO leads (
  tenant_id, name, phone, source, status, metadata
)
SELECT 
  u.organization_id as tenant_id,
  l.name,
  l.lead_number as phone,
  'voice_agent' as source,
  'active' as status,
  jsonb_build_object(
    'old_voice_agent_id', l.id,
    'notes', l.notes,
    'added_by_user_id', u.user_id
  ) as metadata
FROM voice_agent.leads_voiceagent l
LEFT JOIN voice_agent.users_voiceagent u ON l.added_by = u.id
WHERE u.organization_id IS NOT NULL
ON CONFLICT (tenant_id, phone) DO NOTHING;
```

---

## Organization → Tenant Mapping

### Current Organization Structure

```sql
-- Organizations currently in system (6 total)
organization_id                      | user_count
-------------------------------------|------------
5abb0a93-f59f-48fc-9c5a-2b549b4f8367 | 14 users
a60fac7a-eb17-4964-b4a2-2311db582fc4 | 6 users
cd49e5a8-401d-46dc-b216-dd0f2bd8e363 | 1 user
98e7ff43-33f9-4802-9d40-b9642e38acce | 1 user
f6de7991-df4f-43de-9f40-298fcda5f723 | 1 user
(Plus 1 more)
```

### Create Tenants from Organizations

```sql
-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(50) DEFAULT 'pro',
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Migrate organizations to tenants
INSERT INTO tenants (id, name, plan, is_active, metadata, created_at, updated_at)
SELECT 
  organization_id as id,
  'Organization ' || organization_id::text as name, -- Update with actual names if available
  'pro' as plan,
  true as is_active,
  jsonb_build_object(
    'user_count', COUNT(*),
    'source', 'voice_agent_migration'
  ) as metadata,
  MIN(created_at) as created_at,
  NOW() as updated_at
FROM voice_agent.users_voiceagent
WHERE organization_id IS NOT NULL
GROUP BY organization_id;

-- Add system tenant for shared resources
INSERT INTO tenants (id, name, plan, is_active, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'System (Shared Resources)',
  'system',
  true,
  '{"type": "system", "purpose": "shared_voices_and_numbers"}'::jsonb
);
```

---

## Permission System Mapping

### Current Permission System
```sql
-- org_permissions_voiceagent structure:
- organization_id → which organization
- resource_type → 'agent', 'voice', 'number'
- resource_id → ID of the resource
- access_level → 'view', 'use', 'admin'
```

### New Permission Strategy

**Option 1: Resource Ownership (Recommended)**
- Resources (agents, voices, numbers) have `tenant_id`
- No separate permissions table needed
- All resources owned by tenant_id are accessible by users in that tenant
- Simpler, more standard SaaS model

**Option 2: Maintain Permission System**
```sql
CREATE TABLE resource_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  resource_type VARCHAR(20) NOT NULL, -- 'agent', 'voice', 'number'
  resource_id VARCHAR(100) NOT NULL,
  access_level VARCHAR(20) DEFAULT 'use',
  granted_at TIMESTAMP DEFAULT NOW(),
  granted_by VARCHAR(100),
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Migrate permissions
INSERT INTO resource_permissions (
  tenant_id, resource_type, resource_id, 
  access_level, granted_at, granted_by, expires_at, is_active
)
SELECT 
  organization_id as tenant_id,
  resource_type,
  resource_id,
  access_level,
  granted_at,
  granted_by,
  expires_at,
  is_active
FROM voice_agent.org_permissions_voiceagent;
```

---

## Summary of Changes

### Tables to Create
1. ✅ `tenants` - Organization → Tenant mapping
2. ✅ `voice_calls` - Call logs with tenant_id
3. ✅ `voice_agents` - Agents with tenant_id
4. ✅ `voices` - Voice profiles with tenant_id (system tenant for shared)
5. ✅ `phone_numbers` - Phone numbers with tenant_id (system tenant for shared)

### Tables to Update
1. ✅ `leads` (public schema) - Add tenant_id if not exists
2. ✅ `company_search_cache` - Add tenant_id if not exists
3. ✅ `employees_cache` - Add tenant_id if not exists

### Data Migration Steps
1. Create `tenants` table and migrate organizations
2. Create system tenant for shared resources
3. Migrate `voices_voiceagent` → `voices` (system tenant)
4. Migrate `numbers_voiceagent` → `phone_numbers` (system tenant)
5. Migrate `agents_voiceagent` → `voice_agents` (with tenant_id)
6. Migrate `leads_voiceagent` → `leads` (main table)
7. Migrate `call_logs_voiceagent` → `voice_calls` (with tenant_id)

### Key Differences
| Aspect | Old Schema | New Schema |
|--------|------------|------------|
| **Multi-tenancy** | organization_id in users only | tenant_id on every resource |
| **Table names** | Feature-prefixed (_voiceagent) | Business entity names |
| **Resource sharing** | Permission table | Tenant-based + system tenant |
| **Leads** | Separate voice_agent leads | Reference main leads table |
| **Foreign keys** | User-based | Tenant-based |
| **Complexity** | 24 tables | 5 core tables + shared tables |

---

## Migration Validation Queries

```sql
-- Verify record counts
SELECT 
  'Old call_logs' as source, COUNT(*) FROM voice_agent.call_logs_voiceagent
UNION ALL
SELECT 'New voice_calls', COUNT(*) FROM voice_calls;

SELECT 
  'Old agents' as source, COUNT(*) FROM voice_agent.agents_voiceagent
UNION ALL
SELECT 'New voice_agents', COUNT(*) FROM voice_agents;

-- Verify tenant isolation
SELECT tenant_id, COUNT(*) as resource_count
FROM voice_calls
GROUP BY tenant_id;

-- Verify no orphaned records
SELECT COUNT(*) as orphaned_calls
FROM voice_calls
WHERE tenant_id NOT IN (SELECT id FROM tenants);
```

