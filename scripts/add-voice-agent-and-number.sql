-- SQL Script to Add New Voice Agent and Phone Number
-- This will make them appear on the make-call page
-- 
-- Database: salesmaya_agent
-- Schema: lad_dev
-- Tenant ID: 00000000-0000-0000-0000-000000000001

-- ============================================
-- STEP 1: Add a Voice (if not exists)
-- ============================================
-- First, check if you want to use an existing voice or create a new one
-- To use existing voice, skip this step and use the voice_id in STEP 2

INSERT INTO lad_dev.voice_agent_voices (
    id,
    tenant_id,
    description,
    voice_sample_url,
    provider,
    accent,
    gender,
    provider_voice_id,  -- REQUIRED: Unique identifier from voice provider
    provider_config,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),  -- Auto-generate UUID
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Professional Sales Voice',  -- Description
    'https://example.com/samples/professional-sales.mp3',  -- Sample URL (optional)
    'elevenlabs',  -- Provider: elevenlabs, openai, custom, etc.
    'american',  -- Accent: american, british, australian, etc.
    'male',  -- Gender: male, female, neutral
    'elevenlabs_voice_004',  -- REQUIRED: Provider's voice ID
    '{}'::jsonb,  -- Additional provider config (JSON)
    NOW(),
    NOW()
)
ON CONFLICT DO NOTHING
RETURNING id as voice_id, description;

-- ============================================
-- STEP 2: Add a Voice Agent (linked to voice)
-- ============================================
-- Replace <VOICE_ID_FROM_STEP_1> with the actual voice_id UUID from STEP 1
-- Or use an existing voice_id from the database

INSERT INTO lad_dev.voice_agents (
    tenant_id,
    name,
    gender,
    language,
    agent_instructions,  -- Instructions for the AI agent
    system_instructions,  -- System-level instructions
    voice_id,  -- Link to voice from STEP 1
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Sales Agent - Professional',  -- Agent name
    'male',  -- Gender (should match voice)
    'en',  -- Language code: en, es, fr, etc.
    'You are a professional sales agent. Be confident, clear, and goal-oriented. Focus on understanding customer needs and providing solutions.',  -- Agent instructions
    'Keep calls concise. Focus on customer needs. Follow up appropriately. Maintain a professional tone throughout the conversation.',  -- System instructions
    (SELECT id FROM lad_dev.voice_agent_voices 
     WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid 
     ORDER BY created_at DESC LIMIT 1),  -- Use the most recently created voice
    NOW(),
    NOW()
)
RETURNING id as agent_id, name;

-- ============================================
-- STEP 3: Add Phone Numbers (linked to agent)
-- ============================================
-- Replace <AGENT_ID_FROM_STEP_2> with the actual agent_id from STEP 2
-- Or use the most recently created agent

INSERT INTO lad_dev.voice_agent_numbers (
    id,
    tenant_id,
    country_code,  -- Country code (e.g., '1' for US, '44' for UK)
    base_number,  -- Phone number without country code
    provider,  -- Provider: twilio, vapi, vonage, etc.
    status,  -- Status: 'active' or 'inactive'
    rules,  -- JSON object with capabilities and rules
    default_agent_id,  -- Link to agent from STEP 2
    created_at,
    updated_at
) VALUES 
-- Phone Number 1
(
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001'::uuid,
    '1',  -- US country code
    5550103,  -- Base number (will be formatted as +15550103)
    'twilio',  -- Provider
    'active',  -- Status
    jsonb_build_object(
        'capabilities', jsonb_build_array('voice', 'sms'),  -- What this number can do
        'region', 'us-east-1'  -- Optional: region info
    ),
    (SELECT id FROM lad_dev.voice_agents 
     WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid 
     ORDER BY created_at DESC LIMIT 1),  -- Use the most recently created agent
    NOW(),
    NOW()
),
-- Phone Number 2 (optional - add more if needed)
(
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001'::uuid,
    '1',  -- US country code
    5550104,  -- Base number (will be formatted as +15550104)
    'twilio',
    'active',
    jsonb_build_object(
        'capabilities', jsonb_build_array('voice', 'sms')
    ),
    (SELECT id FROM lad_dev.voice_agents 
     WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid 
     ORDER BY created_at DESC LIMIT 1),
    NOW(),
    NOW()
)
RETURNING 
    id,
    CONCAT('+', country_code, base_number) as phone_number,
    provider,
    status;

-- ============================================
-- VERIFICATION: Check what was created
-- ============================================
-- Run these queries to verify the data was inserted correctly

-- Check voices
SELECT 
    id as voice_id,
    description,
    provider,
    gender,
    accent
FROM lad_dev.voice_agent_voices
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
ORDER BY created_at DESC
LIMIT 5;

-- Check agents
SELECT 
    id as agent_id,
    name,
    language,
    gender,
    voice_id
FROM lad_dev.voice_agents
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
ORDER BY created_at DESC
LIMIT 5;

-- Check phone numbers
SELECT 
    id,
    CONCAT('+', country_code, base_number) as phone_number,
    provider,
    status,
    default_agent_id
FROM lad_dev.voice_agent_numbers
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
ORDER BY created_at DESC
LIMIT 5;

-- Check the view (what the API will return)
SELECT 
    agent_id,
    agent_name,
    voice_id,
    phone_number,
    phone_status
FROM lad_dev.voice_agent_config_view
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
ORDER BY agent_id DESC
LIMIT 10;

