/**
 * Helper script to get LinkedIn account test data
 * Helps you find account IDs and connection provider IDs for testing
 * 
 * Usage: node get-linkedin-test-data.js <tenantId>
 */

require('dotenv').config();
const { pool } = require('./shared/database/connection');
const { getSchema } = require('./core/utils/schemaHelper');

async function getTestData() {
  const tenantId = process.argv[2];
  
  if (!tenantId) {
    console.error('❌ Missing tenant ID\n');
    console.log('Usage: node get-linkedin-test-data.js <tenantId>\n');
    process.exit(1);
  }
  
  try {
    const schema = process.env.DB_SCHEMA || 'lad_dev';
    
    console.log('\n🔍 LinkedIn Test Data for Tenant:', tenantId);
    console.log('Schema:', schema);
    console.log('=====================================\n');
    
    // Get LinkedIn accounts (using social_linkedin_accounts table directly)
    const accountsQuery = `
      SELECT 
        id,
        provider_account_id as unipile_account_id,
        account_name,
        metadata,
        status,
        created_at
      FROM ${schema}.social_linkedin_accounts
      WHERE tenant_id = $1
        AND provider = 'unipile'
        AND is_deleted = false
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    const accountsResult = await pool.query(accountsQuery, [tenantId]);
    
    if (accountsResult.rows.length === 0) {
      console.log('❌ No LinkedIn accounts found for this tenant\n');
      console.log('Connect a LinkedIn account first at: http://localhost:3000/settings');
      process.exit(0);
    }
    
    console.log('📋 LinkedIn Accounts:');
    console.log('=====================\n');
    
    accountsResult.rows.forEach((account, idx) => {
      const metadata = account.metadata || {};
      const isActive = account.status === 'active';
      console.log(`Account ${idx + 1}:`);
      console.log(`  Database ID: ${account.id}`);
      console.log(`  Unipile Account ID: ${account.unipile_account_id}`);
      console.log(`  Name: ${account.account_name || metadata.profile_name || 'N/A'}`);
      console.log(`  Email: ${metadata.email || 'N/A'}`);
      console.log(`  Profile: ${metadata.profile_url || 'N/A'}`);
      console.log(`  Status: ${account.status} (Active: ${isActive})`);
      console.log(`  Created: ${account.created_at}`);
      console.log('');
    });
    
    // Get recent connections (for provider IDs)
    console.log('🤝 Recent LinkedIn Connections:');
    console.log('================================\n');
    
    // Note: Connections may not be stored in database - they're fetched from Unipile
    console.log('💡 Connections are fetched from Unipile in real-time, not stored in DB.\n');
    console.log('To test messaging:');
    console.log('  1. Get a recipient provider ID from your LinkedIn connection');
    console.log('     (format: urn:li:member:123456789)');
    console.log('  2. Or check campaign logs for accepted connection member_ids\n');
    
    // Provide test command template
    const firstAccount = accountsResult.rows[0];
    
    console.log('🚀 Test Command Template:');
    console.log('=========================\n');
    console.log(`node test-first-linkedin-message.js \\`);
    console.log(`  "${firstAccount.unipile_account_id}" \\`);
    console.log(`  "urn:li:member:YOUR_RECIPIENT_ID" \\`);
    console.log(`  "Hi! Thanks for connecting."\n`);
    console.log('Replace YOUR_RECIPIENT_ID with actual LinkedIn member ID\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

getTestData();
