#!/usr/bin/env node
/**
 * Database Schema Migration Script
 * Executes the setup_schema.sql file to create lad_LAD schema
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function migrateSchema() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    console.log(`   Host: ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}`);
    console.log(`   Database: ${process.env.POSTGRES_DB}`);
    console.log('');
    
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'setup_schema.sql');
    console.log('📄 Reading migration file:', sqlPath);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('🚀 Executing schema migration...\n');
    
    // Execute the SQL
    const result = await client.query(sql);
    
    console.log('\n✅ Schema migration completed successfully!');
    console.log('');
    
    // Verify the schema was created
    const schemaCheck = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'lad_LAD'
    `);
    
    if (schemaCheck.rows.length > 0) {
      console.log('✓ Schema "lad_LAD" exists');
      
      // Count tables
      const tableCount = await client.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = 'lad_LAD'
      `);
      
      console.log(`✓ Created ${tableCount.rows[0].count} tables`);
      
      // List tables
      const tables = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'lad_LAD'
        ORDER BY table_name
      `);
      
      console.log('\n📋 Tables in lad_LAD schema:');
      tables.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
      
      // Count test data
      const userCount = await client.query('SELECT COUNT(*) as count FROM lad_LAD.users');
      const orgCount = await client.query('SELECT COUNT(*) as count FROM lad_LAD.organizations');
      const flagCount = await client.query('SELECT COUNT(*) as count FROM lad_LAD.feature_flags');
      
      console.log('\n📊 Test Data:');
      console.log(`   - ${userCount.rows[0].count} test users`);
      console.log(`   - ${orgCount.rows[0].count} test organizations`);
      console.log(`   - ${flagCount.rows[0].count} feature flags`);
      
      // Show test user credentials
      const users = await client.query(`
        SELECT u.email, u.name, o.name as org_name, o.plan, c.balance
        FROM lad_LAD.users u
        JOIN lad_LAD.organizations o ON u.organization_id = o.id
        LEFT JOIN lad_LAD.user_credits c ON c.user_id = u.id
        ORDER BY u.email
      `);
      
      console.log('\n👤 Test User Accounts:');
      users.rows.forEach(user => {
        console.log(`   ${user.email}`);
        console.log(`      Name: ${user.name}`);
        console.log(`      Organization: ${user.org_name} (${user.plan})`);
        console.log(`      Credits: ${user.balance || 0}`);
      });
      
      console.log('\n🔑 Password for all test users: password123');
      console.log('');
      console.log('🎉 Database setup complete! You can now start the backend server.');
      console.log('   Run: npm run dev');
      console.log('');
      
    } else {
      console.error('❌ Schema was not created properly');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrateSchema();
