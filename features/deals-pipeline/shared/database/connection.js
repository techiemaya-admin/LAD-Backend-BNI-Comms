/**
 * Shared Database Connection
 * Mock implementation for isolated development
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'lad_dev_mock',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

pool.on('error', (err) => {
  console.error('[Database] Unexpected error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
