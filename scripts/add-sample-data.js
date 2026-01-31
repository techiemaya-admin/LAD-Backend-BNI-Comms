const { Pool } = require('pg');

const tenantId = '00000000-0000-0000-0000-000000000001';

async function addSampleData() {
  // Connect to salesmaya_agent database (lad_dev is a schema within it)
  const pool = new Pool({
    connectionString: 'postgresql://dbadmin:TechieMaya@165.22.221.77:5432/salesmaya_agent'
  });
  
  try {
    console.log('Connecting to database...');
    // Set the search path to lad_dev schema
    await pool.query('SET search_path TO lad_dev, public');
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to database (schema: lad_dev)');

    console.log('\n📝 Adding sample voices...');
    const voiceResult = await pool.query(`
      INSERT INTO lad_dev.voice_agent_voices (
        id, tenant_id, description, voice_sample_url, provider,
        accent, gender, provider_voice_id, provider_config, created_at, updated_at
      ) VALUES
      (gen_random_uuid(), $1::uuid, 'Deep Male Voice - Professional', 
       'https://example.com/samples/male-professional.mp3', 'elevenlabs', 
       'american', 'male', 'elevenlabs_voice_001', '{}'::jsonb, NOW(), NOW()),
      (gen_random_uuid(), $1::uuid, 'Warm Female Voice - Friendly', 
       'https://example.com/samples/female-friendly.mp3', 'elevenlabs', 
       'british', 'female', 'elevenlabs_voice_002', '{}'::jsonb, NOW(), NOW()),
      (gen_random_uuid(), $1::uuid, 'Neutral Voice - Conversational', 
       'https://example.com/samples/neutral-conversational.mp3', 'elevenlabs', 
       'american', 'neutral', 'elevenlabs_voice_003', '{}'::jsonb, NOW(), NOW())
      ON CONFLICT DO NOTHING
    `, [tenantId]);
    console.log(`✅ Added voices (may have been skipped if already exist)`);

    console.log('\n📝 Adding sample agents...');
    const agentResult = await pool.query(`
      WITH voice_ids AS (
        SELECT id, gender
        FROM lad_dev.voice_agent_voices
        WHERE tenant_id = $1::uuid
        ORDER BY created_at
        LIMIT 3
      )
      INSERT INTO lad_dev.voice_agents (
        tenant_id, name, gender, language, agent_instructions,
        system_instructions, voice_id, created_at, updated_at
      )
      SELECT
        $1::uuid,
        CASE 
          WHEN v.gender = 'male' THEN 'Sales Agent - Professional'
          WHEN v.gender = 'female' THEN 'Support Agent - Friendly'
          ELSE 'General Agent - Conversational'
        END,
        v.gender,
        'en',
        CASE 
          WHEN v.gender = 'male' THEN 'You are a professional sales agent. Be confident, clear, and goal-oriented.'
          WHEN v.gender = 'female' THEN 'You are a friendly support agent. Be helpful, empathetic, and solution-focused.'
          ELSE 'You are a conversational agent. Be natural, engaging, and adaptive.'
        END,
        'Keep calls concise. Focus on customer needs. Follow up appropriately.',
        v.id,
        NOW(),
        NOW()
      FROM voice_ids v
      ON CONFLICT DO NOTHING
    `, [tenantId]);
    console.log(`✅ Added agents`);

    console.log('\n📝 Adding sample phone numbers...');
    const phoneResult = await pool.query(`
      WITH agent_ids AS (
        SELECT id
        FROM lad_dev.voice_agents
        WHERE tenant_id = $1::uuid
        ORDER BY created_at
        LIMIT 1
      )
      INSERT INTO lad_dev.voice_agent_numbers (
        id, tenant_id, country_code, base_number, provider,
        status, rules, default_agent_id, created_at, updated_at
      )
      SELECT
        gen_random_uuid(),
        $1::uuid,
        '1',
        5550100 + row_number() OVER (),
        'twilio',
        'active',
        jsonb_build_object('capabilities', jsonb_build_array('voice', 'sms')),
        (SELECT id FROM agent_ids),
        NOW(),
        NOW()
      FROM generate_series(1, 2)
      WHERE EXISTS (SELECT 1 FROM agent_ids)
      ON CONFLICT DO NOTHING
    `, [tenantId]);
    console.log(`✅ Added phone numbers`);

    console.log('\n📊 Verifying data...');
    const counts = await pool.query(`
      SELECT 
        'agents' as type, COUNT(*)::int as count
      FROM lad_dev.voice_agents WHERE tenant_id = $1::uuid
      UNION ALL
      SELECT 'voices', COUNT(*)::int
      FROM lad_dev.voice_agent_voices WHERE tenant_id = $1::uuid
      UNION ALL
      SELECT 'numbers', COUNT(*)::int
      FROM lad_dev.voice_agent_numbers WHERE tenant_id = $1::uuid
      UNION ALL
      SELECT 'view', COUNT(*)::int
      FROM lad_dev.voice_agent_config_view WHERE tenant_id = $1::uuid
    `, [tenantId]);
    
    console.log('\n📈 Summary:');
    counts.rows.forEach(row => {
      console.log(`   ${row.type}: ${row.count}`);
    });

    console.log('\n✅ Sample data added successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addSampleData();
