#!/usr/bin/env node
/**
 * Onboard New Tenant with Admin User
 * 
 * This script creates a new tenant and admin user, and enables specified features.
 * Usage: node onboard-tenant.js <tenant_name> <admin_email> <password> <features_comma_separated>
 */

require('dotenv').config();
const { query } = require('../shared/database/connection');
const crypto = require('crypto');

// Simple password hashing function
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'salt').digest('hex');
}

async function onboardTenant(tenantName, adminEmail, password, features) {
  try {
    console.log('🚀 Starting tenant onboarding...\n');

    // Check if user already exists
    const existingUser = await query('SELECT id, email FROM users WHERE email = $1', [adminEmail]);
    if (existingUser.rows.length > 0) {
      console.error(`❌ User with email ${adminEmail} already exists!`);
      process.exit(1);
    }

    // Create tenant
    const tenantResult = await query(
      `INSERT INTO tenants (name, created_at, updated_at)
       VALUES ($1, NOW(), NOW())
       RETURNING id, name`,
      [tenantName]
    );
    
    const tenant = tenantResult.rows[0];
    console.log('✅ Tenant created:');
    console.log(`   - ID: ${tenant.id}`);
    console.log(`   - Name: ${tenant.name}\n`);

    // Hash password
    const hashedPassword = hashPassword(password);

    // Create admin user
    const userId = crypto.randomUUID();
    const userResult = await query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, primary_tenant_id, role, plan, is_active, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'owner', 'enterprise', true, true, NOW(), NOW())
       RETURNING id, email, role`,
      [userId, adminEmail, hashedPassword, tenantName, 'Admin', tenant.id]
    );

    console.log('✅ Admin user created:');
    console.log(`   - ID: ${userResult.rows[0].id}`);
    console.log(`   - Email: ${userResult.rows[0].email}`);
    console.log(`   - Role: ${userResult.rows[0].role}\n`);

    // Create membership
    await query(
      `INSERT INTO memberships (user_id, tenant_id, role)
       VALUES ($1, $2, 'owner')`,
      [userId, tenant.id]
    );

    // Enable features
    if (features && features.length > 0) {
      console.log(`🔧 Enabling features: ${features.join(', ')}\n`);
      
      for (const featureKey of features) {
        await query(
          `INSERT INTO feature_flags (feature_key, tenant_id, user_id, is_enabled, config, created_at, updated_at)
           VALUES ($1, $2, $3, true, '{}'::jsonb, NOW(), NOW())`,
          [featureKey, tenant.id, userId]
        );
        console.log(`   ✅ ${featureKey} enabled`);
      }
    }

    console.log('\n🎉 Tenant onboarding complete!');
    console.log('\nLogin Details:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${password}`);
    console.log(`   Tenant: ${tenantName}`);
    console.log(`   Tenant ID: ${tenant.id}`);
    console.log(`   User ID: ${userId}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const tenantName = process.argv[2];
const adminEmail = process.argv[3];
const password = process.argv[4];
const featuresArg = process.argv[5];
const features = featuresArg ? featuresArg.split(',').map(f => f.trim()) : [];

if (!tenantName || !adminEmail || !password) {
  console.error('❌ Error: Missing required arguments');
  console.log('\nUsage:');
  console.log('  node onboard-tenant.js <tenant_name> <admin_email> <password> [features]');
  console.log('\nExample:');
  console.log('  node onboard-tenant.js "Acme Corp" admin@acme.com "Pass123!" "voice-agent,deals-pipeline"');
  process.exit(1);
}

onboardTenant(tenantName, adminEmail, password, features);
