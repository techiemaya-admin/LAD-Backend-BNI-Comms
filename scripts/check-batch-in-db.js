require('dotenv').config();
const { Pool } = require('pg');

const batchId = 'batch-48f74660f9f148718611ca11a45ced29';
const schema = process.env.POSTGRES_SCHEMA || 'lad_dev';

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

async function checkBatch() {
  try {
    console.log(`\nSearching for batch: ${batchId} in schema: ${schema}\n`);
    
    const result = await pool.query(`
      SELECT id, tenant_id, status, total_calls, completed_calls, created_at
      FROM ${schema}.voice_call_batches
      WHERE id::text = $1 OR id::text LIKE $2
      LIMIT 5
    `, [batchId, `%${batchId}%`]);
    
    if (result.rows.length > 0) {
      console.log('✅ Found batch(es):');
      result.rows.forEach(row => {
        console.log(JSON.stringify(row, null, 2));
      });
    } else {
      console.log('❌ No batches found with that ID');
      
      // Show recent batches
      const recent = await pool.query(`
        SELECT id, tenant_id, status, total_calls, created_at
        FROM ${schema}.voice_call_batches
        ORDER BY created_at DESC
        LIMIT 5
      `);
      
      console.log('\n📋 Recent batches:');
      recent.rows.forEach(row => {
        console.log(`  - ${row.id} (${row.status}, ${row.total_calls} calls) - ${row.created_at}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkBatch();
