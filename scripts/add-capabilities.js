#!/usr/bin/env node
require('dotenv').config();
const { query } = require('../shared/database/connection');

async function addCapabilities(userId, capabilities) {
  try {
    console.log(`Adding capabilities for user ${userId}...\n`);
    
    for (const cap of capabilities) {
      // Check if exists first
      const existing = await query(
        'SELECT id FROM user_capabilities WHERE user_id = $1 AND capability_key = $2',
        [userId, cap]
      );
      
      if (existing.rows.length === 0) {
        await query(
          'INSERT INTO user_capabilities (user_id, capability_key) VALUES ($1, $2)',
          [userId, cap]
        );
        console.log(`✅ ${cap} (added)`);
      } else {
        console.log(`✅ ${cap} (already exists)`);
      }
    }
    
    console.log('\nVerifying...');
    const result = await query('SELECT capability_key FROM user_capabilities WHERE user_id = $1', [userId]);
    console.log('Total capabilities:', result.rows.length);
    result.rows.forEach(r => console.log(`  - ${r.capability_key}`));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

const userId = 'fe9d6368-ff1b-4133-952a-525d60d06cbe';
const capabilities = ['voice-agent', 'deals-pipeline', 'social-integration'];

addCapabilities(userId, capabilities);
