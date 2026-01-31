#!/usr/bin/env node
/**
 * Database Inspector
 * Reviews existing salesmaya_agent.public schema and identifies tables needed for Apollo feature
 */

const { Client } = require('pg');
require('dotenv').config();

async function inspectDatabase() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    console.log(`📊 Database: ${process.env.POSTGRES_DB}`);
    console.log('📋 Inspecting public schema...\n');

    // Get all tables in public schema
    const tablesQuery = `
      SELECT 
        table_name,
        (
          SELECT COUNT(*) 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = t.table_name
        ) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const result = await client.query(tablesQuery);
    
    console.log(`Found ${result.rows.length} tables in public schema:\n`);
    
    // Tables needed for Apollo feature
    const apolloRelatedTables = [
      'users',
      'clients', 
      'subscriptions',
      'credit_transactions',
      'apollo_searches',
      'apollo_companies',
      'apollo_contacts',
      'leads',
      'user_capabilities'
    ];

    const foundTables = [];
    const missingTables = [];

    result.rows.forEach(row => {
      const isApolloRelated = apolloRelatedTables.some(t => 
        row.table_name.toLowerCase().includes(t) || 
        t.includes(row.table_name.toLowerCase())
      );
      
      console.log(`${isApolloRelated ? '✓' : ' '} ${row.table_name} (${row.column_count} columns)`);
      
      if (isApolloRelated) {
        foundTables.push(row.table_name);
      }
    });

    apolloRelatedTables.forEach(table => {
      if (!foundTables.some(ft => ft.toLowerCase().includes(table))) {
        missingTables.push(table);
      }
    });

    console.log('\n📦 Tables to copy for Apollo feature:');
    foundTables.forEach(table => console.log(`  - ${table}`));

    if (missingTables.length > 0) {
      console.log('\n⚠️  Tables that might need to be created:');
      missingTables.forEach(table => console.log(`  - ${table}`));
    }

    // Get detailed schema for found tables
    console.log('\n📝 Generating table schemas...\n');
    
    for (const tableName of foundTables.slice(0, 5)) { // First 5 tables for brevity
      const schemaQuery = `
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        ORDER BY ordinal_position;
      `;
      
      const schema = await client.query(schemaQuery, [tableName]);
      console.log(`\n--- ${tableName} ---`);
      schema.rows.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

inspectDatabase().catch(console.error);
