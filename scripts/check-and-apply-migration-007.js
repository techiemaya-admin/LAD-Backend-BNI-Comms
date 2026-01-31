#!/usr/bin/env node
/**
 * Script to check if migration 007 has been applied and apply it if needed
 * This adds the lead_data, snapshot, and is_deleted columns to campaign_leads table
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function checkAndApplyMigration() {
  // Use production database URL
  const connectionConfig = {
    connectionString: 'postgresql://dbadmin:TechieMaya@165.22.221.77:5432/salesmaya_agent?schema=lad_dev',
    ssl: false
  };

  const client = new Client(connectionConfig);

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    console.log('   Database: salesmaya_agent @ 165.22.221.77:5432');
    console.log('   Schema: lad_dev');
    console.log('');
    
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Set search path to lad_dev schema
    const schema = 'lad_dev';
    await client.query(`SET search_path TO ${schema}, public`);
    console.log(`📋 Using schema: ${schema}\n`);

    // Check if campaign_leads table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1
        AND table_name = 'campaign_leads'
      ) as exists
    `, [schema]);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ campaign_leads table does not exist in schema', schema);
      console.log('   Please run migration 006 first to create the campaigns tables');
      process.exit(1);
    }

    console.log('✅ campaign_leads table exists\n');

    // Check which columns are missing
    const columnsCheck = await client.query(`
      SELECT 
        column_name,
        data_type
      FROM information_schema.columns 
      WHERE table_schema = $1
      AND table_name = 'campaign_leads'
      AND column_name IN ('lead_data', 'snapshot', 'is_deleted')
      ORDER BY column_name
    `, [schema]);

    const existingColumns = columnsCheck.rows.map(r => r.column_name);
    const requiredColumns = ['lead_data', 'snapshot', 'is_deleted'];
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    console.log('📊 Column Status:');
    requiredColumns.forEach(col => {
      const exists = existingColumns.includes(col);
      const status = exists ? '✅' : '❌';
      const type = exists ? columnsCheck.rows.find(r => r.column_name === col)?.data_type : 'missing';
      console.log(`   ${status} ${col} (${type})`);
    });
    console.log('');

    if (missingColumns.length === 0) {
      console.log('✅ All required columns already exist! Migration 007 has been applied.');
      
      // Show index status
      const indexCheck = await client.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = $1
        AND tablename = 'campaign_leads'
        AND indexname = 'idx_campaign_leads_apollo_person'
      `, [schema]);

      if (indexCheck.rows.length > 0) {
        console.log('✅ Index idx_campaign_leads_apollo_person exists');
      } else {
        console.log('⚠️  Index idx_campaign_leads_apollo_person is missing');
        console.log('   Creating index...');
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_campaign_leads_apollo_person 
          ON ${schema}.campaign_leads USING gin ((lead_data->'apollo_person_id'))
        `);
        console.log('✅ Index created successfully');
      }
      
      process.exit(0);
    }

    console.log(`⚠️  Missing columns: ${missingColumns.join(', ')}`);
    console.log('\n🚀 Applying migration 007...\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/007_add_missing_campaign_leads_columns.sql');
    if (!fs.existsSync(migrationPath)) {
      console.log('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Apply migration
    await client.query('BEGIN');
    
    try {
      await client.query(migrationSQL);
      await client.query('COMMIT');
      
      console.log('✅ Migration 007 applied successfully!\n');
      
      // Verify columns were added
      const verifyCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns 
        WHERE table_schema = $1
        AND table_name = 'campaign_leads'
        AND column_name IN ('lead_data', 'snapshot', 'is_deleted')
        ORDER BY column_name
      `, [schema]);
      
      console.log('📊 Verification:');
      verifyCheck.rows.forEach(row => {
        console.log(`   ✅ ${row.column_name}`);
      });
      
      // Count existing rows and check if data needs migration
      const rowCount = await client.query(`
        SELECT COUNT(*) as count FROM ${schema}.campaign_leads
      `);
      
      console.log(`\n📈 Existing campaign_leads rows: ${rowCount.rows[0].count}`);
      
      if (rowCount.rows[0].count > 0) {
        console.log('ℹ️  Note: Existing rows have been migrated by the SQL script');
        console.log('   - Individual fields copied to lead_data JSONB');
        console.log('   - Individual fields copied to snapshot JSONB');
      }
      
    } catch (migrationError) {
      await client.query('ROLLBACK');
      console.error('❌ Migration failed:', migrationError.message);
      throw migrationError;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Connection closed');
  }
}

// Run the migration check
checkAndApplyMigration();
