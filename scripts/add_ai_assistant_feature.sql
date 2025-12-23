-- Enable AI ICP Assistant feature for enterprise and professional plans

INSERT INTO lad_LAD.feature_flags (feature_key, organization_id, is_enabled, config)
VALUES 
    ('ai-icp-assistant', '00000000-0000-0000-0000-000000000001'::uuid, true, '{"credits_per_message": 0.1}'::jsonb),
    ('ai-icp-assistant', '00000000-0000-0000-0000-000000000003'::uuid, true, '{"credits_per_message": 0.1}'::jsonb)
ON CONFLICT (feature_key, organization_id, user_id) DO UPDATE SET is_enabled = true;

-- Add AI assistant capabilities to users
INSERT INTO lad_LAD.user_capabilities (user_id, capability_key)
VALUES 
    ('00000000-0000-0000-0000-000000000001'::uuid, 'chat_with_ai'),
    ('00000000-0000-0000-0000-000000000001'::uuid, 'define_icp'),
    ('00000000-0000-0000-0000-000000000001'::uuid, 'trigger_apollo_search'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'chat_with_ai'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'define_icp'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'trigger_apollo_search'),
    ('00000000-0000-0000-0000-000000000004'::uuid, 'chat_with_ai'),
    ('00000000-0000-0000-0000-000000000004'::uuid, 'define_icp'),
    ('00000000-0000-0000-0000-000000000004'::uuid, 'trigger_apollo_search')
ON CONFLICT (user_id, capability_key) DO NOTHING;
