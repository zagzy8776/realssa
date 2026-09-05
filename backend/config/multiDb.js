const { Pool } = require('pg');

// RealSSA uses one primary news database on the web/API path. The external
// cron/Fly workers own scheduled/background work. Keep this module deliberately
// small so importing the API does not create a fleet of Neon connections.
const PRIMARY_URL = process.env.DATABASE_URL || '';

const DB_CONFIGS = [
  {
    id: 1,
    name: 'Primary News',
    url: PRIMARY_URL,
    categories: [
      'nigerian-news', 'sports', 'business', 'politics',
      'crypto', 'entertainment', 'culture', 'lifestyle',
      'world', 'usa', 'uk', 'africa',
      'ghana', 'kenya', 'south-africa', 'jobs', 'tech',
      'movies', 'cinema-movies', 'shows', 'series', 'episodes',
      'video_sources', 'stream_links'
    ]
  }
];

const AI_URL = process.env.DATABASE_URL_AI || '';
const AI_DB_CONFIG = {
  id: 5,
  name: 'AI & Models Brain',
  url: AI_URL,
  categories: ['ai-models', 'embeddings', 'entities', 'memory']
};

function createPool(connectionString, name, options = {}) {
  if (!connectionString) return null;

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    // These are request/worker pools, not long-lived application servers.
    // Keep the ceiling conservative so a burst cannot create a large number
    // of Neon connections.
    max: options.max || 5,
    idleTimeoutMillis: options.idleTimeoutMillis || 10000,
    connectionTimeoutMillis: options.connectionTimeoutMillis || 8000,
  });

  pool.on('error', (err) => {
    console.warn(`[MultiDb Pool Error on ${name}]: ${err.message}`);
  });

  return pool;
}

const contentPools = DB_CONFIGS
  .map(cfg => ({
    ...cfg,
    pool: createPool(cfg.url, cfg.name, { max: 5 })
  }))
  .filter(item => item.pool);

// IMPORTANT: do not create a second pool to DATABASE_URL when
// DATABASE_URL_AI is absent. The Vercel entrypoint also deduplicates pg pools,
// but keeping this module correct by itself prevents accidental duplication on
// Fly/local workers too.
const primaryPool = contentPools[0] || null;
const aiPoolInstance = AI_URL
  ? createPool(AI_URL, AI_DB_CONFIG.name, { max: 4 })
  : primaryPool?.pool || null;

const aiPoolWrapper = aiPoolInstance
  ? { ...AI_DB_CONFIG, pool: aiPoolInstance }
  : null;

const allPools = [
  ...contentPools,
  ...(aiPoolWrapper && aiPoolWrapper.pool !== primaryPool?.pool ? [aiPoolWrapper] : [])
];

function getNextReadPool() {
  return primaryPool;
}

function getPoolForCategory(_category) {
  return primaryPool;
}

function getAiPool() {
  return aiPoolInstance;
}

async function queryMultiDb(text, params) {
  if (!primaryPool?.pool) throw new Error('Primary news database is not configured');
  return primaryPool.pool.query(text, params);
}

async function queryAllDbs(text, params) {
  if (!primaryPool?.pool) throw new Error('Primary news database is not configured');
  return primaryPool.pool.query(text, params);
}

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
