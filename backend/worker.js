const { Pool } = require('pg');
const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
  const migrations = [
    'ALTER TABLE feed_schedule ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0',
    'ALTER TABLE feed_schedule ADD COLUMN IF NOT EXISTS quarantined_until TIMESTAMP WITH TIME ZONE NULL',
    'ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_ai_starter BOOLEAN DEFAULT false',
    'CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, title TEXT, description TEXT, article_id INTEGER, created_at TIMESTAMP DEFAULT NOW())',
  ];
  for (const sql of migrations) {
    try {
      await p.query(sql);
      console.log('OK:', sql.substring(0, 60));
    } catch (e) {
      console.error('FAIL:', e.message);
    }
  }
  await p.end();
  console.log('All migrations complete.');
}

async function start() {
  console.log('====================================');
  console.log('🤖 Unified Worker Started on Fly.io');
  await runMigrations();

  console.log('👉 Running Sports Livescore Bot');
  const { initSportsBot } = require('./services/sportsBot');
  const notificationService = require('./services/notificationService');

  console.log('👉 Running RealSSA CountryBot');
  const { initCountryBot } = require('./services/countryBot');

  console.log('👉 Running RSS Feed Ingestion');
  const { ingestFeeds } = require('./services/ingestion');

  console.log('👉 Running AI Community Bot');
  const { initCommunityBot } = require('./services/aiCommunityBot');

  console.log('👉 Running Growth Services');
  const { initGrowthServices } = require('./services/growthWorker');

  // Start sports bot only on main feed cycle (every 15 minutes)
  let sportsBotInitialized = false;
  let countryBotInitialized = false;
  let communityBotInitialized = false;
  let growthServicesInitialized = false;

  setInterval(() => {
    if (!sportsBotInitialized) {
      console.log('[Worker] 15-minute tick: starting Sports Livescore');
      initSportsBot();
      sportsBotInitialized = true;
    } else {
      console.log('[Worker] Skipping sports bot (15-minute window)');
    }
  }, 15 * 60 * 1000); // Every 15 minutes

  // Country bot runs every 30 minutes
  setInterval(() => {
    if (!countryBotInitialized) {
      console.log('[Worker] 30-minute tick: starting CountryBot');
      initCountryBot();
      countryBotInitialized = true;
    } else {
      console.log('[Worker] Skipping CountryBot (30-minute window)');
    }
  }, 30 * 60 * 1000); // Every 30 minutes

  // Community bot runs every 45 minutes
  setInterval(() => {
    if (!communityBotInitialized) {
      console.log('[Worker] 45-minute tick: starting AI Community Bot');
      initCommunityBot();
      communityBotInitialized = true;
    } else {
      console.log('[Worker] Skipping AI Community Bot (45-minute window)');
    }
  }, 45 * 60 * 1000); // Every 45 minutes

  // Growth services run every 10 minutes
  setInterval(() => {
    if (!growthServicesInitialized) {
      console.log('[Worker] 10-minute tick: starting Growth Worker');
      initGrowthServices();
      growthServicesInitialized = true;
    } else {
      console.log('[Worker] Skipping Growth Worker (10-minute window)');
    }
  }, 10 * 60 * 1000); // Every 10 minutes

  // RSS ingestion runs every 5 minutes (to keep feed health fresh)
  setInterval(async () => {
    console.log('[Worker] Running RSS Feed Ingestion');
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectAuthorized: false }
      });
      await ingestFeeds(pool);
      await pool.end();
      console.log('[Worker] RSS Feed Ingestion complete');
    } catch (err) {
      console.error('[Worker] RSS Feed Ingestion failed:', err.message);
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  console.log('✅ Unified Worker schedules initialized');
  console.log('=========================WORKER_STOPPED=========================');
}

start();
module.exports = { start };