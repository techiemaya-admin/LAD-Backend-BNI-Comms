# Adding Sample Voice Agent Data

This guide explains how to add sample data for voice agent tables and views.

## Files

1. **`add-sample-voice-agent-data.sql`** - Uses psql variables (`\set`)
2. **`add-sample-voice-agent-data-simple.sql`** - Direct SQL (works with any SQL client)

## What the Script Does

1. **Inserts 3 sample voices** into `lad_dev.voice_agent_voices`:
   - Male, American accent (Professional)
   - Female, British accent (Friendly)
   - Neutral, American accent (Conversational)

2. **Inserts 3 sample agents** into `lad_dev.voice_agents`:
   - Each agent is linked to one of the voices
   - Includes agent instructions and system instructions

3. **Inserts 2 sample phone numbers** into `lad_dev.voice_agent_numbers`:
   - Both linked to the first agent
   - Status: 'active'
   - Phone numbers: +15550101, +15550102

## How to Run

### Option 1: Using psql (Recommended)

```bash
cd backend
psql $DATABASE_URL -f scripts/add-sample-voice-agent-data.sql
```

Or with explicit database URL:
```bash
psql postgresql://user:password@host:port/database -f scripts/add-sample-voice-agent-data.sql
```

### Option 2: Using Simple SQL (Works with any SQL client)

```bash
cd backend
psql $DATABASE_URL -f scripts/add-sample-voice-agent-data-simple.sql
```

Or copy-paste the SQL into your database admin tool (pgAdmin, DBeaver, etc.)

### Option 3: Using psql interactively

```bash
psql $DATABASE_URL
\i scripts/add-sample-voice-agent-data.sql
```

## Verification

After running the script, verify the data:

```sql
-- Check counts
SELECT 'Voice Agents' as table_name, COUNT(*) as count
FROM lad_dev.voice_agents
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
UNION ALL
SELECT 'Voices', COUNT(*)
FROM lad_dev.voice_agent_voices
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
UNION ALL
SELECT 'Phone Numbers', COUNT(*)
FROM lad_dev.voice_agent_numbers
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Check view data (what the API will return)
SELECT COUNT(*) as view_count
FROM lad_dev.voice_agent_config_view
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- See sample records
SELECT * FROM lad_dev.voice_agents
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
LIMIT 3;

SELECT 
    id,
    country_code,
    base_number,
    CONCAT('+', country_code, base_number) as phone_number,
    provider,
    status
FROM lad_dev.voice_agent_numbers
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid;
```

## Expected Results

After running the script, you should see:
- ✅ 3 voice records in `voice_agent_voices`
- ✅ 3 agent records in `voice_agents`
- ✅ 2 phone number records in `voice_agent_numbers`
- ✅ View `voice_agent_config_view` will show the joined data

## Testing the API

After adding the data, test the endpoints:

```bash
# Login to get token
TOKEN=$(curl -s -X POST "http://localhost:3004/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"password123"}' | jq -r '.token')

# Test available agents
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3004/api/voice-agent/user/available-agents" | jq

# Test available numbers
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3004/api/voice-agent/user/available-numbers" | jq
```

You should now see data in the responses!

## Notes

- The script uses `ON CONFLICT DO NOTHING` so it's safe to run multiple times
- Tenant ID is hardcoded to `00000000-0000-0000-0000-000000000001`
- Phone numbers are dummy numbers (555-0101, 555-0102) - not real numbers
- Voice sample URLs are placeholder URLs

