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
  connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT) || 10000, // Increased for cloud environments
  acquireTimeoutMillis: parseInt(process.env.POSTGRES_ACQUIRE_TIMEOUT) || 60000, // Time to wait for connection from pool
  // Set default schema - dynamic based on environment
  options: `-c search_path=${process.env.POSTGRES_SCHEMA || process.env.DB_SCHEMA || 'lad_dev'},public`,
  // Add retry logic for cloud environments
  statement_timeout: parseInt(process.env.POSTGRES_STATEMENT_TIMEOUT) || 30000, // 30 second query timeout
  query_timeout: parseInt(process.env.POSTGRES_QUERY_TIMEOUT) || 30000,
};

const pool = new Pool(dbConfig);

// Handle pool errors with retry logic
pool.on('error', (err) => {
  logger.error('[Database] Unexpected pool error', { 
    error: err.message, 
    code: err.code,
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database
  });
  
  // Log connection details for debugging (without password)
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    logger.error('[Database] Connection failure details', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      connectionTimeout: dbConfig.connectionTimeoutMillis
    });
  }
});

// Test connection with better logging
pool.on('connect', (client) => {
  logger.info('[Database] Connection established', {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    processId: client.processID
  });
});

// Add connection health check
const healthCheck = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    return true;
  } catch (error) {
    logger.error('[Database] Health check failed', { error: error.message });
    return false;
  }
};

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
  testConnection,
  healthCheck
};