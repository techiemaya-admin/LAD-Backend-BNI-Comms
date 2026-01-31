-- Add UI navigation capabilities to all users

INSERT INTO lad_LAD.user_capabilities (user_id, capability_key)
VALUES 
    -- Admin user capabilities
    ('00000000-0000-0000-0000-000000000001'::uuid, 'view_overview'),
    ('00000000-0000-0000-0000-000000000001'::uuid, 'view_scraper'),
    ('00000000-0000-0000-0000-000000000001'::uuid, 'view_make_call'),
    ('00000000-0000-0000-0000-000000000001'::uuid, 'view_call_logs'),
    ('00000000-0000-0000-0000-000000000001'::uuid, 'view_pipeline'),
    
    -- Demo user capabilities
    ('00000000-0000-0000-0000-000000000002'::uuid, 'view_overview'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'view_scraper'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'view_make_call'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'view_call_logs'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'view_pipeline'),
    
    -- Free user capabilities (limited)
    ('00000000-0000-0000-0000-000000000003'::uuid, 'view_overview'),
    ('00000000-0000-0000-0000-000000000003'::uuid, 'view_scraper'),
    
    -- Premium user capabilities
    ('00000000-0000-0000-0000-000000000004'::uuid, 'view_overview'),
    ('00000000-0000-0000-0000-000000000004'::uuid, 'view_scraper'),
    ('00000000-0000-0000-0000-000000000004'::uuid, 'view_make_call'),
    ('00000000-0000-0000-0000-000000000004'::uuid, 'view_call_logs'),
    ('00000000-0000-0000-0000-000000000004'::uuid, 'view_pipeline')
ON CONFLICT (user_id, capability_key) DO NOTHING;
