#!/usr/bin/env node
/**
 * Run Billing System Migration
 * Applies all billing tables and seeds default pricing
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
  ssl: false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Running billing system migration...\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/20251227_001_create_billing_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executing migration SQL...');
    
    // Set search_path to lad_dev schema
    await client.query('SET search_path TO lad_dev');
    
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'billing_%'
      ORDER BY table_name
    `);
    
    console.log('📋 Created tables:');
    tableCheck.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    // Check pricing catalog
    const pricingCount = await client.query('SELECT COUNT(*) FROM billing_pricing_catalog');
    console.log(`\n💰 Pricing catalog entries: ${pricingCount.rows[0].count}`);
    
    if (pricingCount.rows[0].count > 0) {
      const samplePrices = await client.query(`
        SELECT category, provider, model, unit, unit_price 
        FROM billing_pricing_catalog 
        WHERE tenant_id IS NULL 
        ORDER BY category, provider 
        LIMIT 5
      `);
      
      console.log('\n📊 Sample pricing (global defaults):');
      samplePrices.rows.forEach(price => {
        console.log(`   ${price.category}/${price.provider}/${price.model}: $${price.unit_price}/${price.unit}`);
      });
    }
    
    console.log('\n✅ Billing system is ready!\n');
    
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
