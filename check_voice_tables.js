const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'lad_dev' 
      AND table_name LIKE '%voice%' OR table_name LIKE '%phone%' OR table_name LIKE '%call%'
      ORDER BY table_name;
    `);
    
    console.log('Voice/Phone/Call related tables in lad_dev:');
    result.rows.forEach(row => console.log('  -', row.table_name));
    
    // Check for specific tables
    const checkSpecific = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'lad_dev'
      AND table_name IN ('voice_agents', 'voice_agent_voices', 'voice_agent_numbers', 'phone_numbers', 'voice_calls')
      ORDER BY table_name, ordinal_position;
    `);
    
    console.log('\nColumns in voice-agent tables:');
    let currentTable = '';
    checkSpecific.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        console.log(`\n${row.table_name}:`);
      }
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();
