# Education Features Setup

## Overview

Student and counsellor features in the deals-pipeline are controlled by feature flags, not hardcoded tenant IDs. This allows flexible enabling/disabling of these features for any tenant.

## Feature Flags

### education-students
Enables student management features:
- `/api/deal-pipeline/students` - All student CRUD operations
- Student listing, creation, updates, deletion
- Student-counsellor assignment

### education-counsellors
Enables counsellor management features:
- `/api/deal-pipeline/counsellors` - List all counsellors for the tenant
- Counsellor availability and assignment

## Enabling Features for a Tenant

### Method 1: SQL Script (Recommended)

Run the migration script for the specific tenant:

```sql
-- Replace TENANT_ID with the actual tenant UUID
INSERT INTO feature_flags (
  id,
  tenant_id,
  feature_key,
  is_enabled,
  config,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'TENANT_ID'::uuid,
  'education-students',
  true,
  '{"description": "Student management features"}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (tenant_id, feature_key) 
DO UPDATE SET 
  is_enabled = true,
  updated_at = NOW();

-- Repeat for education-counsellors
INSERT INTO feature_flags (
  id,
  tenant_id,
  feature_key,
  is_enabled,
  config,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'TENANT_ID'::uuid,
  'education-counsellors',
  true,
  '{"description": "Counsellor management features"}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (tenant_id, feature_key) 
DO UPDATE SET 
  is_enabled = true,
  updated_at = NOW();
```

### Method 2: API (if admin endpoints are available)

```bash
# Enable students feature
curl -X POST http://your-api/api/admin/feature-flags \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "TENANT_ID",
    "featureKey": "education-students",
    "isEnabled": true
  }'

# Enable counsellors feature
curl -X POST http://your-api/api/admin/feature-flags \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "TENANT_ID",
    "featureKey": "education-counsellors",
    "isEnabled": true
  }'
```

## Current Setup

The education vertical tenant (`926070b5-189b-4682-9279-ea10ca090b84`) has both features enabled via the migration script:
- `backend/migrations/enable-education-features.sql`

## Disabling Features

To disable features for a tenant:

```sql
UPDATE feature_flags
SET is_enabled = false, updated_at = NOW()
WHERE tenant_id = 'TENANT_ID'::uuid
  AND feature_key IN ('education-students', 'education-counsellors');
```

## Architecture Benefits

1. **No Hardcoded Values**: Tenant IDs are not in the codebase
2. **Flexible Management**: Enable/disable via database without code changes
3. **Cached for Performance**: Feature flags are cached for 5 minutes
4. **Audit Trail**: Changes tracked with timestamps
5. **Multi-tenant Safe**: Each tenant has independent feature access

## Troubleshooting

### 403 Errors on Student/Counsellor Endpoints

If users get 403 "Feature not available" errors:

1. Check if feature flags are enabled:
```sql
SELECT * FROM feature_flags
WHERE tenant_id = 'TENANT_ID'::uuid
  AND feature_key IN ('education-students', 'education-counsellors');
```

2. Clear feature flag cache (if needed):
```bash
# Restart the backend service to clear cache
# Or implement a cache-clear endpoint
```

3. Verify user's tenant_id matches the enabled tenant

### Adding New Education Tenants

1. Get the tenant UUID from the tenants/organizations table
2. Run the SQL insert statements with the new tenant ID
3. Verify with a test API call
4. Cache will automatically update within 5 minutes
