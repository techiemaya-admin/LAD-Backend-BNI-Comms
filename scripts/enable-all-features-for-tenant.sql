-- Enable all features and capabilities for a tenant in one go
-- Usage: Replace TENANT_ID with actual UUID

-- Set the tenant ID here
\set TENANT_ID 'YOUR_TENANT_ID_HERE'

BEGIN;

\echo '================================================'
\echo 'Enabling all features for tenant'
\echo '================================================'
\echo ''
\echo 'Tenant ID: ' :TENANT_ID
\echo ''

-- ================================================
-- 1. Enable ALL feature flags
-- ================================================
\echo 'Enabling all feature flags...'

WITH all_features AS (
    SELECT unnest(ARRAY[
        'ai-icp-assistant',
        'apollo-leads',
        'campaigns',
        'dashboard',
        'deals-pipeline',
        'education-counsellors',
        'education-students',
        'lead-enrichment',
        'social-integration',
        'voice-agent'
    ]) AS feature_key
)
INSERT INTO lad_dev.feature_flags (
    id,
    tenant_id,
    feature_key,
    is_enabled,
    config,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    :TENANT_ID::uuid,
    feature_key,
    true,
    '{}'::jsonb,
    NOW(),
    NOW()
FROM all_features
ON CONFLICT (feature_key, tenant_id, user_id)
DO UPDATE SET
    is_enabled = true,
    updated_at = NOW();

\echo '✓ Feature flags enabled'

-- ================================================
-- 2. Enable ALL user capabilities
-- ================================================
\echo 'Enabling all user capabilities...'

WITH all_capabilities AS (
    SELECT unnest(ARRAY[
        'view_dashboard',
        'manage_campaigns',
        'manage_leads',
        'make_calls',
        'view_analytics',
        'manage_team',
        'manage_integrations',
        'manage_billing',
        'admin_access',
        'voice_agent_access',
        'apollo_search',
        'lead_enrichment',
        'ai_assistant',
        'social_media_integration',
        'deals_pipeline_access',
        'education_features'
    ]) AS capability_key
),
tenant_users AS (
    SELECT DISTINCT u.id as user_id
    FROM lad_dev.users u
    WHERE u.tenant_id = :TENANT_ID::uuid
    AND u.is_deleted = false
)
INSERT INTO lad_dev.user_capabilities (
    id,
    user_id,
    tenant_id,
    capability_key,
    is_enabled,
    granted_at,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    tu.user_id,
    :TENANT_ID::uuid,
    ac.capability_key,
    true,
    NOW(),
    NOW(),
    NOW()
FROM all_capabilities ac
CROSS JOIN tenant_users tu
ON CONFLICT (user_id, capability_key)
DO UPDATE SET
    is_enabled = true,
    granted_at = NOW(),
    updated_at = NOW();

\echo '✓ User capabilities enabled'

-- ================================================
-- 3. Summary
-- ================================================
\echo ''
\echo '================================================'
\echo 'Summary'
\echo '================================================'

SELECT 
    'Feature Flags' as type,
    COUNT(*) as enabled_count
FROM lad_dev.feature_flags
WHERE tenant_id = :TENANT_ID::uuid
  AND is_enabled = true
UNION ALL
SELECT 
    'User Capabilities' as type,
    COUNT(DISTINCT capability_key) as enabled_count
FROM lad_dev.user_capabilities
WHERE tenant_id = :TENANT_ID::uuid
  AND is_enabled = true;

\echo ''
\echo 'Enabled Feature Flags:'
SELECT feature_key, is_enabled, updated_at
FROM lad_dev.feature_flags
WHERE tenant_id = :TENANT_ID::uuid
ORDER BY feature_key;

\echo ''
\echo 'Enabled User Capabilities (by user):'
SELECT 
    u.email,
    COUNT(DISTINCT uc.capability_key) as capability_count
FROM lad_dev.users u
LEFT JOIN lad_dev.user_capabilities uc ON uc.user_id = u.id AND uc.is_enabled = true
WHERE u.tenant_id = :TENANT_ID::uuid
  AND u.is_deleted = false
GROUP BY u.id, u.email
ORDER BY u.email;

\echo ''
\echo '✅ All features and capabilities enabled successfully!'
\echo ''

COMMIT;
