const { Pool } = require('pg');
const logger = require('../../core/utils/logger');

// Database connection configuration
const dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'salesmaya_agent',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  max: parseInt(process.env.POSTGRES_MAX_CLIENTS) || 20,
  idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: 2000,
  // Set default schema - dynamic based on environment
  options: `-c search_path=${process.env.POSTGRES_SCHEMA || process.env.DB_SCHEMA || 'lad_dev'},public`,
};

const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  logger.error('[Database] Unexpected pool error', { error: err.message, stack: err.stack });
});

// Test connection
pool.on('connect', () => {
  logger.info('[Database] Connection established');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT. Graceful shutdown...');
  pool.end(() => {
    console.log('✅ Database pool closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM. Graceful shutdown...');
  pool.end(() => {
    console.log('✅ Database pool closed');
    process.exit(0);
  });
});

/**
 * Execute a query with error handling
 */
async function query(text, params = []) {
  try {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      console.warn(`⚠️  Slow query executed in ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Database query error:', error.message);
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
async function getClient() {
  return await pool.connect();
}

/**
 * Test database connectivity
 */
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connection test successful:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
}

module.exports = {
  pool,
  query,
  getClient,
  testConnection
};