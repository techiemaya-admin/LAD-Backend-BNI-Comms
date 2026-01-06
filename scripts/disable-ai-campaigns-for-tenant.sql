-- Disable AI Assistant and Campaigns pages for specific tenant
-- Tenant ID: 926070b5-189b-4682-9279-ea10ca090b84
-- This will hide these pages from the sidebar for all users in this tenant

-- Update user_capabilities to disable view_ai_assistant and view_campaigns
-- for all users belonging to the specified tenant

UPDATE lad_dev.user_capabilities
SET 
  enabled = false,
  updated_at = NOW()
WHERE 
  tenant_id = '926070b5-189b-4682-9279-ea10ca090b84'::uuid
  AND capability_key IN ('view_ai_assistant', 'view_campaigns');

-- Verify the changes
SELECT 
  uc.user_id,
  u.email,
  uc.capability_key,
  uc.enabled,
  uc.updated_at
FROM lad_dev.user_capabilities uc
JOIN lad_dev.users u ON u.id = uc.user_id
WHERE 
  uc.tenant_id = '926070b5-189b-4682-9279-ea10ca090b84'::uuid
  AND uc.capability_key IN ('view_ai_assistant', 'view_campaigns')
ORDER BY u.email, uc.capability_key;
