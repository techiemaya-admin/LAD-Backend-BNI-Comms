-- Script to add sample voice agent data for tenant_id: 00000000-0000-0000-0000-000000000001
-- This includes sample voices, agents, and phone numbers

-- Set the tenant_id
\set tenant_id '00000000-0000-0000-0000-000000000001'

-- Step 1: Add sample voices (voice_agent_voices table)
-- Note: voices can be shared or tenant-specific
-- provider_voice_id is REQUIRED (NOT NULL)
INSERT INTO lad_dev.voice_agent_voices (
    id,
    tenant_id,
    description,
    voice_sample_url,
    provider,
    accent,
    gender,
    provider_voice_id,
    provider_config,
    created_at,
    updated_at
) VALUES
-- Voice 1: Male, American accent
(
    gen_random_uuid(),
    :'tenant_id'::uuid,
    'Deep Male Voice - Professional',
    'https://example.com/samples/male-professional.mp3',
    'elevenlabs',
    'american',
    'male',
    'elevenlabs_voice_001', -- provider_voice_id (required)
    '{}'::jsonb,
    NOW(),
    NOW()
),
-- Voice 2: Female, British accent
(
    gen_random_uuid(),
    :'tenant_id'::uuid,
    'Warm Female Voice - Friendly',
    'https://example.com/samples/female-friendly.mp3',
    'elevenlabs',
    'british',
    'female',
    'elevenlabs_voice_002', -- provider_voice_id (required)
    '{}'::jsonb,
    NOW(),
    NOW()
),
-- Voice 3: Neutral, American accent
(
    gen_random_uuid(),
    :'tenant_id'::uuid,
    'Neutral Voice - Conversational',
    'https://example.com/samples/neutral-conversational.mp3',
    'elevenlabs',
    'american',
    'neutral',
    'elevenlabs_voice_003', -- provider_voice_id (required)
    '{}'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT DO NOTHING;

-- Step 2: Add sample voice agents (voice_agents table)
-- First, get the voice IDs we just created
WITH voice_ids AS (
    SELECT id, gender, accent
    FROM lad_dev.voice_agent_voices
    WHERE tenant_id = :'tenant_id'::uuid
    ORDER BY created_at
    LIMIT 3
)
INSERT INTO lad_dev.voice_agents (
    id,
    tenant_id,
    name,
    gender,
    language,
    agent_instructions,
    system_instructions,
    voice_id,
    created_at,
    updated_at
)
SELECT
    nextval('lad_dev.voice_agents_id_seq1'::regclass), -- Use correct sequence name
    :'tenant_id'::uuid,
    CASE 
        WHEN v.gender = 'male' THEN 'Sales Agent - Professional'
        WHEN v.gender = 'female' THEN 'Support Agent - Friendly'
        ELSE 'General Agent - Conversational'
    END as name,
    v.gender,
    'en' as language,
    CASE 
        WHEN v.gender = 'male' THEN 'You are a professional sales agent. Be confident, clear, and goal-oriented.'
        WHEN v.gender = 'female' THEN 'You are a friendly support agent. Be helpful, empathetic, and solution-focused.'
        ELSE 'You are a conversational agent. Be natural, engaging, and adaptive.'
    END as agent_instructions,
    'Keep calls concise. Focus on customer needs. Follow up appropriately.' as system_instructions,
    v.id as voice_id,
    NOW(),
    NOW()
FROM voice_ids v
ON CONFLICT DO NOTHING;

-- Step 3: Add sample phone numbers (voice_agent_numbers table)
-- Link to the first agent we created
WITH agent_ids AS (
    SELECT id
    FROM lad_dev.voice_agents
    WHERE tenant_id = :'tenant_id'::uuid
    ORDER BY created_at
    LIMIT 1
)
INSERT INTO lad_dev.voice_agent_numbers (
    id,
    tenant_id,
    country_code,
    base_number,
    provider,
    status,
    rules,
    default_agent_id,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    :'tenant_id'::uuid,
    '1' as country_code, -- US country code
    5550100 + row_number() OVER () as base_number, -- Generate unique numbers: 5550101, 5550102
    'twilio' as provider,
    'active' as status,
    jsonb_build_object('capabilities', jsonb_build_array('voice', 'sms')) as rules,
    (SELECT id FROM agent_ids) as default_agent_id,
    NOW(),
    NOW()
FROM generate_series(1, 2) -- Create 2 phone numbers
WHERE EXISTS (SELECT 1 FROM agent_ids) -- Only insert if we have an agent
ON CONFLICT DO NOTHING;

-- Step 4: Verify the data was inserted
SELECT 'Voice Agents Created:' as info, COUNT(*) as count
FROM lad_dev.voice_agents
WHERE tenant_id = :'tenant_id'::uuid
UNION ALL
SELECT 'Voices Created:', COUNT(*)
FROM lad_dev.voice_agent_voices
WHERE tenant_id = :'tenant_id'::uuid
UNION ALL
SELECT 'Phone Numbers Created:', COUNT(*)
FROM lad_dev.voice_agent_numbers
WHERE tenant_id = :'tenant_id'::uuid;

-- Step 5: Show the view data (what the API will return)
SELECT 
    'voice_agent_config_view data:' as info,
    COUNT(*) as count
FROM lad_dev.voice_agent_config_view
WHERE tenant_id = :'tenant_id'::uuid;

-- Step 6: Show sample records
SELECT '=== Sample Voice Agents ===' as section;
SELECT 
    id,
    name,
    language,
    gender,
    voice_id
FROM lad_dev.voice_agents
WHERE tenant_id = :'tenant_id'::uuid
LIMIT 5;

SELECT '=== Sample Phone Numbers ===' as section;
SELECT 
    id,
    country_code,
    base_number,
    CONCAT('+', country_code, base_number) as phone_number,
    provider,
    status,
    default_agent_id
FROM lad_dev.voice_agent_numbers
WHERE tenant_id = :'tenant_id'::uuid
LIMIT 5;

