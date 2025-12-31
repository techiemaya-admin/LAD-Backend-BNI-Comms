-- Enable education features for the education tenant
-- Run this script to enable student and counsellor features for the education vertical
-- Tenant ID: 926070b5-189b-4682-9279-ea10ca090b84

-- Enable education-students feature for education tenant
INSERT INTO lad_dev.feature_flags (
  id,
  tenant_id,
  feature_key,
  is_enabled,
  config,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '926070b5-189b-4682-9279-ea10ca090b84'::uuid,
  'education-students',
  true,
  '{"description": "Student management features for education vertical"}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (tenant_id, feature_key) 
DO UPDATE SET 
  is_enabled = true,
  updated_at = NOW();

-- Enable education-counsellors feature for education tenant
INSERT INTO lad_dev.feature_flags (
  id,
  tenant_id,
  feature_key,
  is_enabled,
  config,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '926070b5-189b-4682-9279-ea10ca090b84'::uuid,
  'education-counsellors',
  true,
  '{"description": "Counsellor management features for education vertical"}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (tenant_id, feature_key) 
DO UPDATE SET 
  is_enabled = true,
  updated_at = NOW();

-- Verify the feature flags were created
SELECT 
  feature_key,
  is_enabled,
  config,
  created_at
FROM lad_dev.feature_flags
WHERE tenant_id = '926070b5-189b-4682-9279-ea10ca090b84'::uuid
  AND feature_key IN ('education-students', 'education-counsellors');
