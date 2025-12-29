-- Simple version: Direct SQL without psql variables
-- Script to add sample voice agent data for tenant_id: 00000000-0000-0000-0000-000000000001

-- Step 1: Add sample voices (voice_agent_voices table)
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
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Deep Male Voice - Professional',
    'https://example.com/samples/male-professional.mp3',
    'elevenlabs',
    'american',
    'male',
    'elevenlabs_voice_001',
    '{}'::jsonb,
    NOW(),
    NOW()
),
-- Voice 2: Female, British accent
(
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Warm Female Voice - Friendly',
    'https://example.com/samples/female-friendly.mp3',
    'elevenlabs',
    'british',
    'female',
    'elevenlabs_voice_002',
    '{}'::jsonb,
    NOW(),
    NOW()
),
-- Voice 3: Neutral, American accent
(
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Neutral Voice - Conversational',
    'https://example.com/samples/neutral-conversational.mp3',
    'elevenlabs',
    'american',
    'neutral',
    'elevenlabs_voice_003',
    '{}'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT DO NOTHING;

-- Step 2: Add sample voice agents (voice_agents table)
WITH voice_ids AS (
    SELECT id, gender, accent
    FROM lad_dev.voice_agent_voices
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
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
    nextval('lad_dev.voice_agents_id_seq1'::regclass),
    '00000000-0000-0000-0000-000000000001'::uuid,
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
WITH agent_ids AS (
    SELECT id
    FROM lad_dev.voice_agents
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
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
    '00000000-0000-0000-0000-000000000001'::uuid,
    '1' as country_code,
    5550100 + row_number() OVER () as base_number,
    'twilio' as provider,
    'active' as status,
    jsonb_build_object('capabilities', jsonb_build_array('voice', 'sms')) as rules,
    (SELECT id FROM agent_ids) as default_agent_id,
    NOW(),
    NOW()
FROM generate_series(1, 2)
WHERE EXISTS (SELECT 1 FROM agent_ids)
ON CONFLICT DO NOTHING;

-- Step 4: Verify the data was inserted
SELECT 'Voice Agents Created:' as info, COUNT(*)::text as count
FROM lad_dev.voice_agents
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
UNION ALL
SELECT 'Voices Created:', COUNT(*)::text
FROM lad_dev.voice_agent_voices
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
UNION ALL
SELECT 'Phone Numbers Created:', COUNT(*)::text
FROM lad_dev.voice_agent_numbers
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid;

