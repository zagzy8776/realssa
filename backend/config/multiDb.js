const { Pool } = require('pg');

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Database Pool Manager — Plan 7 (consolidated).
//
// CONTEXT (see DB_CAPACITY_PLAN.md): the 10 Neon "databases" are actually
// branches inside ONE Neon project, so they share ONE 100 CU-hr compute meter.
// Spreading writes across them did NOT add quota — it just woke more computes
// and drained the shared budget ~10× faster, which is what took the site off.
//
// Plan 7 fix:
//   • Point ALL news categories at the single real news DB (snowy-field, the
//     branch you call "realssa bb") via process.env.DATABASE_URL.
//   • Stop the cross-pool failover / cleanup wake-storm that kept pinging dead
//     (green-butterfly) and empty (icy-glitter/long-mode) branches.
//   • Keep the AI brain pool (sweet-brook) separate — it's tiny and only used
//     by the AI subsystem.
//
// Net effect: every category now writes AND reads from snowy-field (so all
// categories show on the site), the other branches go idle and auto-suspend,
// and the shared meter stops draining. Credentials come from env vars only.
// ─────────────────────────────────────────────────────────────────────────────

// The single source of truth for all news content = snowy-field ("realssa bb").
const PRIMARY_URL = process.env.DATABASE_URL || '';

// Every category routes to the primary (snowy-field) pool. We keep the category
// lists purely for reference/labelling — they all resolve to the same pool now.
const DB_CONFIGS = [
  {
    id: 1,
    name: 'Primary News (snowy-field / "realssa bb")',
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

const AI_DB_CONFIG = {
  id: 5,
  name: 'DB5 (Sweet Brook - AI & Models Brain)',
  url: process.env.DATABASE_URL_AI || '',
  categories: ['ai-models', 'embeddings', 'entities', 'memory']
};

// Initialize the single content pool.
const contentPools = DB_CONFIGS.map(cfg => {
  const rawUrl = cfg.url || process.env.DATABASE_URL || '';
  const cleanUrl = rawUrl ? rawUrl.split('?')[0] : '';
  const p = new Pool({
    connectionString: cleanUrl,
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

// Dedicated AI Pool for Vector Embeddings, Model Training & Bot Memory.
// Falls back to the primary news DB if no dedicated AI URL is configured, so
// the AI subsystem never crashes on a missing env var.
const aiPoolInstance = new Pool({
  connectionString: (AI_DB_CONFIG.url || PRIMARY_URL).split('?')[0],
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

// The primary content pool — the only one that serves news.
const primaryPool = contentPools[0];

/**
 * Get the primary read pool. With Plan 7 consolidation there is only one news
 * pool (snowy-field), so round-robin collapses to always returning it.
 */
function getNextReadPool() {
  return primaryPool;
}

/**
 * Get the database pool for a specific news category. All categories now live
 * in snowy-field, so this always returns the primary pool.
 */
function getPoolForCategory(_category) {
  return primaryPool;
}

/**
 * Get dedicated AI & Model Database Pool (DB5).
 */
function getAiPool() {
  return aiPoolInstance;
}

/**
 * Execute a query on the primary news DB (snowy-field).
 *
 * Plan 7: we intentionally do NOT fail over across other pools anymore. The old
 * failover looped every pool on error, which woke dead/empty branches and burned
 * the shared compute meter. A genuine error now surfaces instead of triggering a
 * wake-storm.
 */
async function queryMultiDb(text, params) {
  return primaryPool.pool.query(text, params);
}

/**
 * Execute a query on all *news* pools. With consolidation this is just the
 * primary pool — the AI pool is deliberately excluded so news maintenance
 * (e.g. the 48h self-trim DELETE) never pings the AI branch or any dead branch.
 */
async function queryAllDbs(text, params) {
  return primaryPool.pool.query(text, params);
}

/**
 * Get array of all database pools (content + AI). Callers that iterate this for
 * news maintenance should prefer `pools`/`getNextReadPool()` so they don't touch
 * the AI branch.
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
