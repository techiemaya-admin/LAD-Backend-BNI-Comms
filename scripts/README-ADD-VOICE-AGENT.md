# How to Add Voice Agents and Phone Numbers

This guide shows you how to add new voice agents and phone numbers that will appear on the make-call page.

## Quick Start

### Option 1: Simple One-Liner (Recommended)

Use the simple SQL script that does everything in one go:

```bash
psql postgresql://dbadmin:TechieMaya@165.22.221.77:5432/salesmaya_agent -f scripts/add-voice-agent-simple.sql
```

Or copy-paste the SQL from `add-voice-agent-simple.sql` into your SQL client.

### Option 2: Step-by-Step

Use the detailed script `add-voice-agent-and-number.sql` which has comments explaining each step.

## What Gets Created

1. **Voice** - A voice profile (e.g., "Professional Sales Voice")
2. **Agent** - An AI agent linked to that voice (e.g., "Sales Agent - Professional")
3. **Phone Number** - A phone number linked to that agent (e.g., "+15550105")

## Customization

### Change the Voice

Edit the voice INSERT statement:

```sql
INSERT INTO lad_dev.voice_agent_voices (
    ...
    description,  -- Change this
    provider,     -- Change: elevenlabs, openai, custom
    accent,       -- Change: american, british, australian
    gender,       -- Change: male, female, neutral
    provider_voice_id,  -- REQUIRED: Must be unique
    ...
)
```

### Change the Agent

Edit the agent INSERT statement:

```sql
INSERT INTO lad_dev.voice_agents (
    ...
    name,  -- Change the agent name
    agent_instructions,  -- Change AI behavior
    system_instructions,  -- Change system behavior
    ...
)
```

### Change the Phone Number

Edit the phone number INSERT statement:

```sql
INSERT INTO lad_dev.voice_agent_numbers (
    ...
    country_code,  -- Change: '1' for US, '44' for UK, etc.
    base_number,   -- Change: 5550105, 5550106, etc.
    provider,      -- Change: twilio, vapi, vonage
    ...
)
```

## Important Fields

### Voice Table (`voice_agent_voices`)

- **`provider_voice_id`** - REQUIRED: Must be unique. This is the voice ID from your provider (ElevenLabs, OpenAI, etc.)
- **`description`** - Human-readable description
- **`provider`** - Voice provider: `elevenlabs`, `openai`, `custom`, etc.
- **`gender`** - `male`, `female`, or `neutral`
- **`accent`** - `american`, `british`, `australian`, etc.

### Agent Table (`voice_agents`)

- **`name`** - Agent name (shown in UI)
- **`voice_id`** - MUST link to an existing voice
- **`agent_instructions`** - Instructions for the AI agent behavior
- **`system_instructions`** - System-level instructions
- **`language`** - Language code: `en`, `es`, `fr`, etc.

### Phone Number Table (`voice_agent_numbers`)

- **`country_code`** - Country code as string: `'1'`, `'44'`, etc.
- **`base_number`** - Phone number without country code: `5550105`
- **`status`** - MUST be `'active'` to appear in UI
- **`default_agent_id`** - MUST link to an existing agent
- **`rules`** - JSON object with capabilities: `{"capabilities": ["voice", "sms"]}`

## Example: Adding Multiple Agents

```sql
-- Add Voice 1
INSERT INTO lad_dev.voice_agent_voices (...) VALUES (...);

-- Add Agent 1 (linked to Voice 1)
INSERT INTO lad_dev.voice_agents (...) VALUES (...);

-- Add Phone 1 (linked to Agent 1)
INSERT INTO lad_dev.voice_agent_numbers (...) VALUES (...);

-- Add Voice 2
INSERT INTO lad_dev.voice_agent_voices (...) VALUES (...);

-- Add Agent 2 (linked to Voice 2)
INSERT INTO lad_dev.voice_agents (...) VALUES (...);

-- Add Phone 2 (linked to Agent 2)
INSERT INTO lad_dev.voice_agent_numbers (...) VALUES (...);
```

## Verification

After running the SQL, verify the data:

```sql
-- Check if data appears in the view (what API returns)
SELECT 
    agent_id,
    agent_name,
    phone_number,
    phone_status
FROM lad_dev.voice_agent_config_view
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
ORDER BY agent_id DESC;
```

## Testing in UI

1. Run the SQL script
2. Wait a few seconds for the database to update
3. Refresh the make-call page
4. You should see:
   - The new agent in the agent dropdown
   - The new phone number in the phone number dropdown

## Troubleshooting

### Agent doesn't appear in UI

- Check `status = 'active'` in `voice_agent_numbers`
- Verify `tenant_id` matches your JWT token
- Check the view: `SELECT * FROM lad_dev.voice_agent_config_view WHERE tenant_id = '...'`

### Phone number doesn't appear

- Ensure `status = 'active'`
- Verify `default_agent_id` links to a valid agent
- Check the phone number format: `CONCAT('+', country_code, base_number)`

### Voice doesn't link to agent

- Verify `voice_id` in `voice_agents` matches an existing `id` in `voice_agent_voices`
- Check that the voice has the correct `tenant_id`

## Database Connection

```bash
# Using psql
psql postgresql://dbadmin:TechieMaya@165.22.221.77:5432/salesmaya_agent

# Then set schema
SET search_path TO lad_dev, public;
```

## Quick Reference

**Tables:**
- `lad_dev.voice_agent_voices` - Voice profiles
- `lad_dev.voice_agents` - AI agents
- `lad_dev.voice_agent_numbers` - Phone numbers

**View:**
- `lad_dev.voice_agent_config_view` - Joined view (what API uses)

**Required Links:**
- Agent → Voice (via `voice_id`)
- Phone Number → Agent (via `default_agent_id`)

