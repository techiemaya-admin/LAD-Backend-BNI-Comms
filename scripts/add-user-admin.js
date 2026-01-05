/**
 * Add new admin user for Sasya Spaces tenant
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

const schema = process.env.POSTGRES_SCHEMA || 'lad_dev';
const tenantId = '734cd516-e252-4728-9c52-4663ee552653';
const email = 'admin@sasyaspaces.com';
const password = 'TechieMaya';
const firstName = 'Sasya';
const lastName = 'Spaces';

async function addUser() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`\n🔧 Adding user: ${email}`);
    console.log(`📋 Tenant ID: ${tenantId}\n`);
    
    // Check if tenant exists
    const tenantCheck = await client.query(
      `SELECT id, name FROM ${schema}.tenants WHERE id = $1`,
      [tenantId]
    );
    
    if (tenantCheck.rows.length === 0) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    
    console.log(`✅ Tenant found: ${tenantCheck.rows[0].name}\n`);
    
    // Check if user already exists
    const userCheck = await client.query(
      `SELECT id, email FROM ${schema}.users WHERE email = $1`,
      [email]
    );
    
    if (userCheck.rows.length > 0) {
      console.log(`⚠️  User ${email} already exists with ID: ${userCheck.rows[0].id}`);
      console.log(`   Checking membership...\n`);
      
      const membershipCheck = await client.query(
        `SELECT role FROM ${schema}.memberships WHERE user_id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [userCheck.rows[0].id, tenantId]
      );
      
      if (membershipCheck.rows.length > 0) {
        console.log(`✅ User is already a member of this tenant with role: ${membershipCheck.rows[0].role}\n`);
        await client.query('ROLLBACK');
        await pool.end();
        return;
      }
      
      console.log(`📝 Adding membership for existing user...\n`);
      
      // Add membership for existing user
      await client.query(
        `INSERT INTO ${schema}.memberships (user_id, tenant_id, role, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [userCheck.rows[0].id, tenantId, 'admin']
      );
      
      console.log(`✅ Membership added successfully!\n`);
      await client.query('COMMIT');
      await pool.end();
      return;
    }
    
    // Hash password
    console.log(`🔐 Hashing password...`);
    const passwordHash = await bcrypt.hash(password, 10);
    console.log(`✅ Password hashed\n`);
    
    // Generate user ID
    const userId = uuidv4();
    
    // Create user
    console.log(`👤 Creating user...`);
    await client.query(
      `INSERT INTO ${schema}.users (
        id, email, password_hash, first_name, last_name,
        primary_tenant_id, is_active, email_verified, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, true, NOW())`,
      [userId, email, passwordHash, firstName, lastName, tenantId]
    );
    console.log(`✅ User created with ID: ${userId}\n`);
    
    // Create membership
    console.log(`🔗 Creating membership...`);
    await client.query(
      `INSERT INTO ${schema}.memberships (user_id, tenant_id, role, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [userId, tenantId, 'admin']
    );
    console.log(`✅ Membership created with role: admin\n`);
    
    // Initialize credits
    console.log(`💰 Initializing credits...`);
    await client.query(
      `INSERT INTO ${schema}.user_credits (user_id, tenant_id, balance, created_at)
       VALUES ($1, $2, 0, NOW())`,
      [userId, tenantId]
    );
    console.log(`✅ Credits initialized (balance: 0)\n`);
    
    // Add default capabilities (overview access)
    console.log(`🔑 Adding default capabilities...`);
    const defaultCapabilities = [
      'view_overview',
      'view_call_logs',
      'view_make_call',
      'view_pipeline'
    ];
    
    for (const capability of defaultCapabilities) {
      await client.query(
        `INSERT INTO ${schema}.user_capabilities (user_id, tenant_id, capability_key, enabled, created_at)
         VALUES ($1, $2, $3, true, NOW())
         ON CONFLICT (user_id, capability_key, tenant_id) DO NOTHING`,
        [userId, tenantId, capability]
      );
    }
    console.log(`✅ Added ${defaultCapabilities.length} default capabilities\n`);
    
    await client.query('COMMIT');
    
    console.log(`\n🎉 SUCCESS!\n`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`🏢 Tenant ID: ${tenantId}`);
    console.log(`👑 Role: admin\n`);
    console.log(`You can now log in with these credentials.\n`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

addUser();
