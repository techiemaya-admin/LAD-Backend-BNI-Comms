-- Simple SQL to Add One Voice Agent + One Phone Number
-- Copy and paste this into your SQL client
-- Database: salesmaya_agent, Schema: lad_dev

-- 1. Add Voice
INSERT INTO lad_dev.voice_agent_voices (
    id, tenant_id, description, voice_sample_url, provider,
    accent, gender, provider_voice_id, provider_config, created_at, updated_at
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Professional Sales Voice',
    'https://example.com/samples/professional-sales.mp3',
    'elevenlabs',
    'american',
    'male',
    'elevenlabs_voice_004',
    '{}'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT DO NOTHING;

-- 2. Add Agent (uses the voice we just created)
INSERT INTO lad_dev.voice_agents (
    tenant_id, name, gender, language, agent_instructions,
    system_instructions, voice_id, created_at, updated_at
)
SELECT
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Sales Agent - Professional',
    'male',
    'en',
    'You are a professional sales agent. Be confident, clear, and goal-oriented.',
    'Keep calls concise. Focus on customer needs. Follow up appropriately.',
    id,  -- Use the voice_id from the voice we just created
    NOW(),
    NOW()
FROM lad_dev.voice_agent_voices
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND provider_voice_id = 'elevenlabs_voice_004'
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT DO NOTHING;

-- 3. Add Phone Number (uses the agent we just created)
INSERT INTO lad_dev.voice_agent_numbers (
    id, tenant_id, country_code, base_number, provider,
    status, rules, default_agent_id, created_at, updated_at
)
SELECT
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001'::uuid,
    '1',
    5550105,  -- Change this number if needed
    'twilio',
    'active',
    jsonb_build_object('capabilities', jsonb_build_array('voice', 'sms')),
    id,  -- Use the agent_id from the agent we just created
    NOW(),
    NOW()
FROM lad_dev.voice_agents
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND name = 'Sales Agent - Professional'
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT DO NOTHING;

-- Verify
SELECT 
    'Voice' as type,
    id::text as id,
    description as name
FROM lad_dev.voice_agent_voices
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND provider_voice_id = 'elevenlabs_voice_004'
UNION ALL
SELECT 
    'Agent',
    id::text,
    name
FROM lad_dev.voice_agents
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND name = 'Sales Agent - Professional'
UNION ALL
SELECT 
    'Phone',
    id::text,
    CONCAT('+', country_code, base_number)
FROM lad_dev.voice_agent_numbers
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND base_number = 5550105;

