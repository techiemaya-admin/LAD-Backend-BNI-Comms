#!/usr/bin/env node
/**
 * Enable Campaigns Feature for Specific User
 * 
 * This script enables the campaigns feature for a specific user_id within their tenant.
 * Usage: node enable-campaigns-for-all-tenants.js <user_id>
 *    or: node enable-campaigns-for-all-tenants.js <email>
 */

require('dotenv').config();
const { query } = require('../shared/database/connection');

async function enableCampaignsForUser(userIdentifier) {
  try {
    console.log('🚀 Starting campaigns feature enablement...\n');

    // Determine if input is UUID or email
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userIdentifier);
    
    // Get user details
    const userQuery = isUUID 
      ? 'SELECT id, email, primary_tenant_id FROM users WHERE id = $1'
      : 'SELECT id, email, primary_tenant_id FROM users WHERE email = $1';
    
    const userResult = await query(userQuery, [userIdentifier]);

    if (userResult.rows.length === 0) {
      console.error(`❌ User not found: ${userIdentifier}`);
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log(`👤 User found:`);
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Tenant ID: ${user.primary_tenant_id}\n`);

    // Check if campaigns feature is already enabled for this user
    const checkResult = await query(
      `SELECT id, is_enabled FROM feature_flags 
       WHERE feature_key = 'campaigns' AND user_id = $1`,
      [user.id]
    );

    if (checkResult.rows.length > 0 && checkResult.rows[0].is_enabled) {
      console.log(`✅ Campaigns feature already enabled for user ${user.email}`);
    } else if (checkResult.rows.length > 0) {
      // Update to enable
      await query(
        `UPDATE feature_flags 
         SET is_enabled = true, updated_at = NOW() 
         WHERE feature_key = 'campaigns' AND user_id = $1`,
        [user.id]
      );
      console.log(`✅ Campaigns feature enabled for user ${user.email}`);
    } else {
      // Insert new record for this specific user
      await query(
        `INSERT INTO feature_flags (feature_key, tenant_id, user_id, is_enabled, config, created_at, updated_at)
         VALUES ('campaigns', $1, $2, true, '{}'::jsonb, NOW(), NOW())`,
        [user.primary_tenant_id, user.id]
      );
      console.log(`✅ Campaigns feature enabled (new) for user ${user.email}`);
    }

    console.log('\n✅ Done! User can now access campaigns feature.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Get user_id or email from command line argument
const userIdentifier = process.argv[2];

if (!userIdentifier) {
  console.error('❌ Error: Missing user identifier');
  console.log('\nUsage:');
  console.log('  node enable-campaigns-for-all-tenants.js <user_id>');
  console.log('  node enable-campaigns-for-all-tenants.js <email>');
  console.log('\nExamples:');
  console.log('  node enable-campaigns-for-all-tenants.js f8613293-0bef-4e4b-a76e-b826eb231b7a');
  console.log('  node enable-campaigns-for-all-tenants.js admin@demo.com');
  process.exit(1);
}

enableCampaignsForUser(userIdentifier);
