require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function check() {
  const result = await pool.query(`
    SELECT id, name, email, linkedin_url, 
           lead_data->>'apollo_person_id' as apollo_id,
           created_at
    FROM lad_dev.campaign_leads
    WHERE campaign_id = 'b7e7942c-5629-4b7d-af0e-10be7bf0ee45'
    ORDER BY created_at DESC
    LIMIT 5
  `);
  
  console.log('Campaign Leads:');
  result.rows.forEach(r => {
    console.log(`- ${r.name}: email=${r.email || 'NULL'}, apollo_id=${r.apollo_id || 'NULL'}`);
  });
  
  await pool.end();
}

check().catch(console.error);
