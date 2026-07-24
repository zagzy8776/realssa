const { Pool } = require('pg');

// Multi-Database Pool Manager for Load Balancing across 5 Neon Databases
const DB_CONFIGS = [
  {
    id: 1,
    name: 'DB1 (Royal Dream)',
    url: process.env.DATABASE_URL_1 || 'postgresql://neondb_owner:npg_LPkdn2vhR6zs@ep-royal-dream-azab2rs9.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
    categories: ['nigerian-news', 'sports', 'business', 'politics']
  },
  {
    id: 2,
    name: 'DB2 (Sweet Field)',
    url: process.env.DATABASE_URL_2 || 'postgresql://neondb_owner:npg_LXS6rJEbRCl2@ep-sweet-field-azj0x1ei.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
    categories: ['crypto', 'entertainment', 'culture', 'movies', 'lifestyle']
  },
  {
    id: 3,
    name: 'DB3 (Green Butterfly)',
    url: process.env.DATABASE_URL_3 || 'postgresql://neondb_owner:npg_gQl3RcnC8MWS@ep-green-butterfly-azlp8ez4.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
    categories: ['world', 'usa', 'uk', 'africa']
  },
  {
    id: 4,
    name: 'DB4 (Icy Glitter)',
    url: process.env.DATABASE_URL_4 || 'postgresql://neondb_owner:npg_PLk86fymaGsx@ep-icy-glitter-az3nsoqd.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
    categories: ['ghana', 'kenya', 'south-africa', 'jobs', 'tech']
  }
];

const AI_DB_CONFIG = {
  id: 5,
  name: 'DB5 (Sweet Brook - AI & Models Brain)',
  url: process.env.DATABASE_URL_AI || 'postgresql://neondb_owner:npg_ESj7doa4hVMW@ep-sweet-brook-az3jbxv3.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  categories: ['ai-models', 'embeddings', 'entities', 'memory']
};

// Initialize pool instances with error handling
const contentPools = DB_CONFIGS.map(cfg => {
  const p = new Pool({
    connectionString: cfg.url,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  });

  p.on('error', (err) => {
    console.warn(`[MultiDb Idle Error on ${cfg.name}]: ${err.message}`);
  });

  return {
    ...cfg,
    pool: p
  };
});

// Dedicated AI Pool for Vector Embeddings, Model Training & Bot Memory
const aiPoolInstance = new Pool({
  connectionString: AI_DB_CONFIG.url,
  ssl: { rejectUnauthorized: false },
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

aiPoolInstance.on('error', (err) => {
  console.warn(`[MultiDb Idle Error on DB5 AI Brain]: ${err.message}`);
});

const aiPoolWrapper = {
  ...AI_DB_CONFIG,
  pool: aiPoolInstance
};

const allPools = [...contentPools, aiPoolWrapper];

let rrIndex = 0;

/**
 * Get next database pool in round-robin order for general read load balancing
 */
function getNextReadPool() {
  const selected = contentPools[rrIndex % contentPools.length];
  rrIndex = (rrIndex + 1) % contentPools.length;
  return selected;
}

/**
 * Get assigned database pool for a specific news category
 */
function getPoolForCategory(category) {
  if (!category) return getNextReadPool();
  const normalized = category.toLowerCase().trim();
  const matched = contentPools.find(p => p.categories.includes(normalized));
  return matched || getNextReadPool();
}

/**
 * Get dedicated AI & Model Database Pool (DB5)
 */
function getAiPool() {
  return aiPoolInstance;
}

/**
 * Execute query across pools using round-robin and automatic failover across all 5 databases
 */
async function queryMultiDb(text, params) {
  const startIndex = rrIndex;
  let lastError = null;

  for (let i = 0; i < allPools.length; i++) {
    const target = allPools[(startIndex + i) % allPools.length];
    try {
      const res = await target.pool.query(text, params);
      return res;
    } catch (err) {
      console.warn(`[MultiDb Failover] Query failed on ${target.name}: ${err.message}. Retrying next pool...`);
      lastError = err;
    }
  }

  throw lastError || new Error('All 5 database pools failed to execute query.');
}

/**
 * Execute query on ALL database pools in parallel
 */
async function queryAllDbs(text, params) {
  const results = await Promise.allSettled(
    allPools.map(p => p.pool.query(text, params))
  );
  
  const fulfilled = results.filter(r => r.status === 'fulfilled');
  if (fulfilled.length === 0) {
    const firstErr = results.find(r => r.status === 'rejected')?.reason;
    throw firstErr || new Error('Failed to execute query on any database pool.');
  }

  return fulfilled[0].value;
}

/**
 * Get array of all database pools
 */
function getAllPools() {
  return allPools;
}

module.exports = {
  pools: contentPools,
  aiPool: aiPoolInstance,
  getNextReadPool,
  getPoolForCategory,
  getAiPool,
  queryMultiDb,
  queryAllDbs,
  getAllPools
};
