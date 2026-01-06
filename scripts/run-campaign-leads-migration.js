#!/usr/bin/env node
/**
 * Run Campaign Leads Column Migration (007)
 * Adds lead_data, snapshot, and is_deleted columns to campaign_leads table
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Running campaign_leads column migration (007)...\n');
    console.log(`📍 Database: ${process.env.POSTGRES_HOST}/${process.env.POSTGRES_DB}`);
    console.log(`📍 Schema: ${process.env.POSTGRES_SCHEMA || 'lad_dev'}\n`);
    
    // Set search_path to correct schema
    const schema = process.env.POSTGRES_SCHEMA || process.env.DB_SCHEMA || 'lad_dev';
    await client.query(`SET search_path TO ${schema}`);
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/007_add_missing_campaign_leads_columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executing migration SQL...');
    
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify columns were added
    console.log('🔍 Verifying campaign_leads table structure...');
    const columnCheck = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = $1
        AND table_name = 'campaign_leads' 
        AND column_name IN ('lead_data', 'snapshot', 'is_deleted')
      ORDER BY column_name
    `, [schema]);
    
    console.log('📋 Column status:');
    const requiredColumns = ['lead_data', 'snapshot', 'is_deleted'];
    requiredColumns.forEach(colName => {
      const col = columnCheck.rows.find(r => r.column_name === colName);
      if (col) {
        console.log(`   ✓ ${col.column_name} (${col.data_type})`);
      } else {
        console.log(`   ✗ ${colName} - MISSING!`);
      }
    });
    
    // Check if there's data to migrate
    const leadCount = await client.query(`
      SELECT COUNT(*) as total,
        COUNT(*) FILTER (WHERE lead_data IS NOT NULL AND lead_data != '{}') as with_lead_data,
        COUNT(*) FILTER (WHERE snapshot IS NOT NULL AND snapshot != '{}') as with_snapshot
      FROM campaign_leads
    `);
    
    console.log(`\n📊 Campaign Leads Data:`);
    console.log(`   Total leads: ${leadCount.rows[0].total}`);
    console.log(`   With lead_data: ${leadCount.rows[0].with_lead_data}`);
    console.log(`   With snapshot: ${leadCount.rows[0].with_snapshot}`);
    
    // Check for indexes
    const indexCheck = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = $1
        AND tablename = 'campaign_leads'
        AND indexname LIKE '%apollo%'
    `, [schema]);
    
    if (indexCheck.rows.length > 0) {
      console.log(`\n🔑 Apollo indexes:`);
      indexCheck.rows.forEach(idx => {
        console.log(`   ✓ ${idx.indexname}`);
      });
    }
    
    console.log('\n✅ Campaign leads table is ready!\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
