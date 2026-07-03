// backend/config/db.js

const mysql = require("mysql2");
require("dotenv").config();
const logger = require("../utils/logger");

// ==================== CONFIGURATION ====================
const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];

requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    logger.error(`Missing environment variable: ${key}`);
    process.exit(1);
  }
});

// Enable TLS when DB_SSL=true (required by TiDB Cloud and most managed MySQL hosts)
const useSSL = process.env.DB_SSL === "true";

const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: useSSL ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT) || 10000,
  charset: "utf8mb4",
  supportBigNumbers: true,
  multipleStatements: false,
  // Additional configs
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  acquireTimeout: Number(process.env.DB_ACQUIRE_TIMEOUT) || 30000,
  timeout: Number(process.env.DB_QUERY_TIMEOUT) || 30000,
  dateStrings: true,
};

// ==================== RETRY CONFIGURATION ====================
const RETRY_CONFIG = {
  maxRetries: Number(process.env.DB_MAX_RETRIES) || 10,
  initialDelay: Number(process.env.DB_INITIAL_DELAY) || 1000,
  maxDelay: Number(process.env.DB_MAX_DELAY) || 30000,
  factor: 2 // Exponential backoff factor
};

// ==================== POOL STATE ====================
let pool = null;
let promisePool = null;
let dbConnected = false;
let isShuttingDown = false;
let pendingQueries = 0;
let queryHistory = [];
const MAX_QUERY_HISTORY = 100;
let lastHealthCheck = null;
let healthCheckStatus = 'unknown';
let connectionAttempts = 0;

// ==================== CREATE POOL ====================
function createPool() {
  pool = mysql.createPool(DB_CONFIG);
  promisePool = pool.promise();
  return { pool, promisePool };
}

// Initialize pool
createPool();

// ==================== POOL EVENTS ====================
function setupPoolEvents() {
  if (!pool) return;

  // Connection acquisition
  pool.on('acquire', (connection) => {
    logger.debug(`Connection acquired: ${connection.threadId}`);
  });

  // Connection release
  pool.on('release', (connection) => {
    logger.debug(`Connection released: ${connection.threadId}`);
  });

  // Connection creation
  pool.on('connection', (connection) => {
    logger.debug(`New connection created: ${connection.threadId}`);
    
    // Set connection timeouts
    connection.query('SET SESSION wait_timeout = 28800');
    connection.query('SET SESSION interactive_timeout = 28800');
  });

  // Connection error
  pool.on('error', (error) => {
    logger.error(`MySQL Pool Error: ${error.message}`);
    logger.error(`Error Code: ${error.code}`);
    logger.error(`Error Number: ${error.errno}`);

    if (error.code === "PROTOCOL_CONNECTION_LOST") {
      logger.error("Database connection lost.");
      dbConnected = false;
      healthCheckStatus = 'unhealthy';
      reconnectPool();
    }
    if (error.code === "ER_CON_COUNT_ERROR") {
      logger.error("Database has too many connections.");
    }
    if (error.code === "ECONNREFUSED") {
      logger.error("Database connection refused.");
      dbConnected = false;
      healthCheckStatus = 'unhealthy';
      reconnectPool();
    }
    if (error.code === "ETIMEDOUT") {
      logger.error("Database connection timeout.");
      dbConnected = false;
      healthCheckStatus = 'unhealthy';
      reconnectPool();
    }
  });

  // Pool exhausted
  pool.on('enqueue', () => {
    logger.warn('Connection pool exhausted. Request queued.');
  });
}

// Setup pool events
setupPoolEvents();

// ==================== RECONNECT LOGIC ====================
async function reconnectPool() {
  if (isShuttingDown) {
    logger.info('Shutdown in progress. Skipping reconnection.');
    return false;
  }

  let attempts = 0;
  let delay = RETRY_CONFIG.initialDelay;
  
  logger.warn('Attempting to reconnect database pool...');
  
  while (attempts < RETRY_CONFIG.maxRetries) {
    try {
      attempts++;
      connectionAttempts++;
      logger.info(`Reconnection attempt ${attempts}/${RETRY_CONFIG.maxRetries}`);
      
      // Close existing pool if exists
      if (pool) {
        try {
          await promisePool.end();
        } catch (err) {
          logger.warn(`Error closing pool: ${err.message}`);
        }
      }
      
      // Create new pool
      createPool();
      setupPoolEvents();
      
      // Test connection
      const connection = await promisePool.getConnection();
      await connection.query('SELECT 1');
      connection.release();
      
      dbConnected = true;
      healthCheckStatus = 'healthy';
      lastHealthCheck = new Date();
      
      // Check database version
      await checkDatabaseVersion();
      
      logger.info('Database pool reconnected successfully');
      
      // Get pool stats
      const stats = getPoolStats();
      logger.info(`Pool stats after reconnection: ${JSON.stringify(stats)}`);
      
      return true;
    } catch (error) {
      logger.error(`Reconnection attempt ${attempts} failed: ${error.message}`);
      
      if (attempts >= RETRY_CONFIG.maxRetries) {
        logger.error('Max retries reached. Could not reconnect to database.');
        healthCheckStatus = 'failed';
        return false;
      }
      
      // Exponential backoff with jitter
      const jitter = Math.random() * 0.3 + 0.85;
      const waitTime = Math.min(delay * RETRY_CONFIG.factor, RETRY_CONFIG.maxDelay) * jitter;
      
      logger.info(`Waiting ${Math.round(waitTime)}ms before next attempt...`);
      await sleep(waitTime);
      delay = Math.min(delay * RETRY_CONFIG.factor, RETRY_CONFIG.maxDelay);
    }
  }
  
  return false;
}

// ==================== SLEEP UTILITY ====================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== TEST CONNECTION ====================
async function testConnection(retryInterval = 5000) {
  try {
    const connection = await promisePool.getConnection();
    logger.info("MySQL Connected Successfully");
    
    // Check database version
    await checkDatabaseVersion();
    
    // Get pool stats
    const stats = getPoolStats();
    logger.info(`Pool stats: ${JSON.stringify(stats)}`);
    
    connection.release();
    dbConnected = true;
    healthCheckStatus = 'healthy';
    lastHealthCheck = new Date();
    connectionAttempts = 0;
    
    return true;
  } catch (error) {
    dbConnected = false;
    healthCheckStatus = 'unhealthy';
    logger.error("Database Connection Failed:");
    logger.error(error.message);
    logger.error(`Error Code: ${error.code}`);
    
    if (error.code === 'PROTOCOL_CONNECTION_LOST' || 
        error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT') {
      logger.error(`Retrying DB connection in ${retryInterval / 1000}s...`);
      setTimeout(
        () => testConnection(Math.min(retryInterval * 2, 30000)),
        retryInterval,
      );
    } else {
      // For other errors, retry with longer delay
      logger.error(`Will retry in ${(retryInterval * 2) / 1000}s...`);
      setTimeout(
        () => testConnection(Math.min(retryInterval * 2, 30000)),
        retryInterval * 2
      );
    }
    
    return false;
  }
}

// ==================== DATABASE VERSION CHECK ====================
async function checkDatabaseVersion() {
  try {
    const [rows] = await promisePool.query('SELECT VERSION() as version, DATABASE() as database_name');
    const version = rows[0]?.version || 'unknown';
    const dbName = rows[0]?.database_name || DB_CONFIG.database;
    logger.info(`Connected to MySQL version: ${version}`);
    logger.info(`Using database: ${dbName}`);
    return { version, database: dbName };
  } catch (error) {
    logger.error(`Failed to check database version: ${error.message}`);
    return null;
  }
}

// ==================== POOL STATS ====================
function getPoolStats() {
  if (!pool) {
    return {
      active: 0,
      idle: 0,
      total: 0,
      pendingQueries: pendingQueries,
      status: 'not_initialized',
      connectionAttempts: connectionAttempts
    };
  }

  try {
    const poolState = pool._pool || pool.pool || {};
    const active = poolState._allConnections ? poolState._allConnections.length : 0;
    const idle = poolState._freeConnections ? poolState._freeConnections.length : 0;
    const total = active + idle;

    return {
      active: active,
      idle: idle,
      total: total,
      pendingQueries: pendingQueries,
      status: healthCheckStatus,
      isConnected: dbConnected,
      lastHealthCheck: lastHealthCheck,
      limit: DB_CONFIG.connectionLimit,
      utilization: total > 0 ? Math.round((active / total) * 100) : 0,
      connectionAttempts: connectionAttempts
    };
  } catch (error) {
    logger.error(`Error getting pool stats: ${error.message}`);
    return {
      active: 0,
      idle: 0,
      total: 0,
      pendingQueries: pendingQueries,
      status: 'error',
      error: error.message,
      connectionAttempts: connectionAttempts
    };
  }
}

// ==================== QUERY LOGGING ====================
function logQuery(sql, params, startTime, error = null) {
  const duration = Date.now() - startTime;
  const isSlow = duration > 1000; // > 1 second
  
  const queryLog = {
    timestamp: new Date().toISOString(),
    query: sql ? sql.substring(0, 200) : 'unknown',
    params: params ? JSON.stringify(params).substring(0, 100) : null,
    duration: duration,
    isSlow: isSlow,
    error: error ? error.message : null
  };
  
  // Store in history
  queryHistory.push(queryLog);
  if (queryHistory.length > MAX_QUERY_HISTORY) {
    queryHistory.shift();
  }
  
  if (isSlow) {
    logger.warn(`Slow query detected (${duration}ms): ${sql ? sql.substring(0, 100) : 'unknown'}...`);
  }
  
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`Query executed in ${duration}ms: ${sql ? sql.substring(0, 200) : 'unknown'}...`);
  }
}

// ==================== WRAPPED QUERY FUNCTION ====================
async function query(sql, params = []) {
  if (!promisePool) {
    throw new Error('Database pool not initialized');
  }
  
  if (isShuttingDown) {
    throw new Error('Database is shutting down. Cannot execute query.');
  }
  
  const startTime = Date.now();
  pendingQueries++;
  
  try {
    const [results] = await promisePool.query(sql, params);
    logQuery(sql, params, startTime);
    return [results, null];
  } catch (error) {
    logger.error(`Query error: ${error.message}`);
    logQuery(sql, params, startTime, error);
    
    // Reconnect on connection errors
    if (error.code === 'PROTOCOL_CONNECTION_LOST' || 
        error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT') {
      logger.warn('Connection lost during query. Attempting to reconnect...');
      dbConnected = false;
      healthCheckStatus = 'unhealthy';
      await reconnectPool();
    }
    
    throw error;
  } finally {
    pendingQueries--;
  }
}

// ==================== HEALTH CHECK ====================
async function checkDatabaseHealth() {
  try {
    if (!promisePool) {
      return { 
        healthy: false, 
        error: 'Pool not initialized',
        timestamp: new Date().toISOString()
      };
    }

    const connection = await promisePool.getConnection();
    try {
      const [rows] = await connection.query('SELECT 1 as health_check, NOW() as server_time, VERSION() as version, DATABASE() as current_db');
      
      lastHealthCheck = new Date();
      healthCheckStatus = 'healthy';
      dbConnected = true;
      
      const stats = getPoolStats();
      
      return {
        healthy: true,
        poolStats: stats,
        serverTime: rows[0]?.server_time || new Date(),
        version: rows[0]?.version || 'unknown',
        database: rows[0]?.current_db || DB_CONFIG.database,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      };
    } finally {
      connection.release();
    }
  } catch (error) {
    healthCheckStatus = 'unhealthy';
    dbConnected = false;
    logger.error(`Health check failed: ${error.message}`);
    
    // Attempt to reconnect if unhealthy
    if (pool) {
      await reconnectPool();
    }
    
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      poolStats: getPoolStats()
    };
  }
}

// ==================== GET HEALTH STATUS ====================
async function getHealthStatus() {
  const poolStats = getPoolStats();
  
  // Check if database is actually healthy
  let healthy = dbConnected;
  if (healthy) {
    try {
      const [result] = await promisePool.query('SELECT 1');
      healthy = result && result.length > 0;
    } catch (error) {
      healthy = false;
      healthCheckStatus = 'unhealthy';
      logger.error(`Health check query failed: ${error.message}`);
    }
  }
  
  return {
    status: healthCheckStatus,
    connected: dbConnected,
    healthy: healthy,
    timestamp: new Date().toISOString(),
    poolStats: poolStats,
    queryHistory: queryHistory.slice(-10), // Last 10 queries
    serverInfo: {
      uptime: process.uptime(),
      nodeEnv: process.env.NODE_ENV || 'development',
      dbHost: DB_CONFIG.host,
      dbName: DB_CONFIG.database,
      connectionAttempts: connectionAttempts
    }
  };
}

// ==================== GET QUERY HISTORY ====================
function getQueryHistory(limit = 10) {
  return queryHistory.slice(-limit);
}

// ==================== GET SLOW QUERIES ====================
function getSlowQueries(threshold = 1000) {
  return queryHistory.filter(q => q.duration > threshold);
}

// ==================== GRACEFUL SHUTDOWN ====================
async function shutdown() {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress');
    return;
  }
  
  isShuttingDown = true;
  logger.info('\nInitiating graceful database shutdown...');
  
  try {
    // Wait for pending queries to complete
    if (pendingQueries > 0) {
      logger.info(`Waiting for ${pendingQueries} pending queries to complete...`);
      await sleep(2000);
    }
    
    // Close the pool
    if (promisePool) {
      await promisePool.end();
      logger.info('MySQL pool closed successfully');
    }
    
    // Clear resources
    pool = null;
    promisePool = null;
    dbConnected = false;
    healthCheckStatus = 'shutdown';
    
    logger.info('Database shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error(`Error closing MySQL pool: ${error.message}`);
    process.exit(1);
  }
}

// ==================== TRANSACTION HELPERS ====================
async function beginTransaction(connection) {
  await connection.query('START TRANSACTION');
  logger.debug('Transaction started');
}

async function commitTransaction(connection) {
  await connection.query('COMMIT');
  logger.debug('Transaction committed');
}

async function rollbackTransaction(connection) {
  await connection.query('ROLLBACK');
  logger.debug('Transaction rolled back');
}

// ==================== INITIALIZE DATABASE ====================
async function initializeDatabase() {
  logger.info('Initializing database connection...');
  const result = await testConnection();
  
  if (result) {
    logger.info('Database initialization successful');
  } else {
    logger.error('Database initialization failed. Will continue retrying in background.');
  }
  
  return result;
}

// ==================== EXPORTS ====================
module.exports = promisePool;
module.exports.rawPool = pool;
module.exports.isConnected = () => dbConnected;

// Additional exports for enhanced features
module.exports.query = query;
module.exports.getPoolStats = getPoolStats;
module.exports.checkDatabaseHealth = checkDatabaseHealth;
module.exports.getHealthStatus = getHealthStatus;
module.exports.getQueryHistory = getQueryHistory;
module.exports.getSlowQueries = getSlowQueries;
module.exports.reconnectPool = reconnectPool;
module.exports.initializeDatabase = initializeDatabase;
module.exports.shutdown = shutdown;
module.exports.beginTransaction = beginTransaction;
module.exports.commitTransaction = commitTransaction;
module.exports.rollbackTransaction = rollbackTransaction;
module.exports.DB_CONFIG = DB_CONFIG;
module.exports.RETRY_CONFIG = RETRY_CONFIG;

// ==================== PROCESS EVENT HANDLERS ====================
// SIGINT and SIGTERM already handled above

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
  logger.error(error.stack);
  await shutdown();
});

// Handle unhandled rejections
process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled rejection:');
  logger.error(reason);
  await shutdown();
});

// ==================== AUTO-INITIALIZATION ====================
// Initialize database connection on import if not in test mode
if (process.env.NODE_ENV !== 'test') {
  initializeDatabase()
    .then((success) => {
      if (!success) {
        logger.warn('Database initialization failed. Retrying in background...');
      }
    })
    .catch((error) => {
      logger.error(`Unexpected error during initialization: ${error.message}`);
    });
}