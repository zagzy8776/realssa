/**
 * SEO Bot Runner
 * ---------------
 * Single entry point for the new SEO bots:
 *
 *   areas        -> register/refresh every country, city, state and category hub
 *   suggestions  -> seed the autocomplete table with branded phrases
 *   index        -> submit due areas to IndexNow + ping sitemap directories
 *   traffic      -> walk areas with a dwell/"stay" session traffic bot
 *   brand        -> probe Google/Bing/DDG for RealSSA brand suggestions
 *
 * Runs are serialised with a PostgreSQL advisory lock, so an external cron and
 * the in-process scheduler can call this safely at the same time.
 *
 * Scheduling (persistent hosts only):
 *   traffic      every 20 minutes
 *   maintenance  every 3 hours (areas + suggestions + index)
 *   brand probe  every 6 hours
 */

const { ensureAreaSchema, syncAreas, pushAreas } = require('./areaExpansionBot');
const { ensureTrafficSchema, runTrafficCycle } = require('./trafficBot');
const { seedAutocomplete, probeBrandSuggestions } = require('./seoAutocomplete');

const LOCK = 91634022;
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS search_suggestions (
     id BIGSERIAL PRIMARY KEY,
     term TEXT NOT NULL,
     normalized TEXT NOT NULL UNIQUE,
     source TEXT NOT NULL,
     score NUMERIC(8,3) NOT NULL DEFAULT 0,
     impressions INTEGER NOT NULL DEFAULT 0,
     clicks INTEGER NOT NULL DEFAULT 0,
     brand_hits INTEGER NOT NULL DEFAULT 0,
     last_brand_check TIMESTAMPTZ,
     last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  'CREATE INDEX IF NOT EXISTS search_suggestions_score ON search_suggestions(score DESC)',
  'CREATE INDEX IF NOT EXISTS search_suggestions_normalized ON search_suggestions(normalized)',
  `CREATE TABLE IF NOT EXISTS seo_bot_runs (
     id BIGSERIAL PRIMARY KEY,
     started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     finished_at TIMESTAMPTZ,
     status TEXT NOT NULL DEFAULT 'running',
     report JSONB
   )`
].join(';');

async function prepare(pool) {
  if (!pool) return false;
  try {
    const { ensureRssSchema } = require('./ensureRssSchema');
    await ensureRssSchema(pool);
  } catch {
    // rss_articles may already exist; individual stages tolerate failure.
  }
  await pool.query(SCHEMA);
  await ensureAreaSchema(pool);
  await ensureTrafficSchema(pool);
  return true;
}

function buildStages(db, options = {}) {
  const {
    fetcher = globalThis.fetch,
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    trafficSessions = 6,
    indexLimit = 100
  } = options;

  return {
    areas: () => syncAreas(db),
    suggestions: () => seedAutocomplete(db),
    index: () => pushAreas(db, { limit: indexLimit, fetcher }),
    traffic: () => runTrafficCycle(db, { maxSessions: trafficSessions, fetcher, sleep }),
    brand: () => probeBrandSuggestions(db, { fetcher, limit: 10 })
  };
}

/**
 * Run the requested stages sequentially. Individual failures are captured in
 * the report so one broken integration never aborts the whole run.
 */
async function runSeoBots(pool, options = {}) {
  const {
    stages = ['areas', 'suggestions', 'index', 'traffic'],
    fetcher,
    sleep,
    trafficSessions,
    indexLimit
  } = options;

  if (!pool) {
    // Database-less mode still exercises the static registry + traffic bot.
    const stagesMap = buildStages(null, { fetcher, sleep, trafficSessions, indexLimit });
    const report = {};
    for (const name of stages) {
      if (!stagesMap[name]) continue;
      try {
        report[name] = await stagesMap[name]();
      } catch (err) {
        report[name] = { status: 'error', error: err.message };
      }
    }
    return { status: 'no_database', report };
  }

  await prepare(pool);
  const db = await pool.connect();
  let locked = false;
  let runId = null;
  try {
    locked = (await db.query('SELECT pg_try_advisory_lock($1) AS locked', [LOCK])).rows[0].locked;
    if (!locked) return { status: 'already_running' };

    runId = (await db.query('INSERT INTO seo_bot_runs DEFAULT VALUES RETURNING id')).rows[0].id;
    const stagesMap = buildStages(db, { fetcher, sleep, trafficSessions, indexLimit });
    const report = {};

    for (const name of stages) {
      if (!stagesMap[name]) continue;
      try {
        report[name] = await stagesMap[name]();
      } catch (err) {
        report[name] = { status: 'error', error: err.message };
      }
      await db.query('UPDATE seo_bot_runs SET report = $2::jsonb WHERE id = $1', [runId, JSON.stringify(report)]);
    }

    const degraded = value => value && typeof value === 'object' &&
      (value.status === 'error' || value.failed > 0 ||
        Object.values(value).some(child => typeof child === 'object' && degraded(child)));
    const status = degraded(report) ? 'partial' : 'complete';

    await db.query('UPDATE seo_bot_runs SET finished_at = NOW(), status = $2 WHERE id = $1', [runId, status]);
    await db.query("DELETE FROM seo_bot_runs WHERE started_at < NOW() - INTERVAL '30 days'");
    return { runId, status, report };
  } catch (err) {
    if (runId) {
      await db.query("UPDATE seo_bot_runs SET status = 'failed', finished_at = NOW() WHERE id = $1", [runId]).catch(() => {});
    }
    throw err;
  } finally {
    if (locked) await db.query('SELECT pg_advisory_unlock($1)', [LOCK]).catch(() => {});
    db.release();
  }
}

async function safeQuery(pool, sql, params = []) {
  try {
    return await pool.query(sql, params);
  } catch {
    return { rows: [] };
  }
}

/** Admin report: what the bots have done recently. */
async function seoBotsReport(pool) {
  if (!pool) {
    return { status: 'no_database', areas: { total: 0, kinds: {} }, suggestions: [], traffic: {}, runs: [] };
  }
  await prepare(pool);
  const [areaRows, suggestionRows, trafficRows, areaTrafficRows, runRows] = await Promise.all([
    safeQuery(pool,
      `SELECT kind, COUNT(*)::int AS total, COUNT(indexed_at)::int AS indexed
       FROM seo_areas GROUP BY kind ORDER BY kind`),
    safeQuery(pool,
      `SELECT term, source, score, clicks, brand_hits, last_brand_check
       FROM search_suggestions ORDER BY score DESC LIMIT 20`),
    safeQuery(pool,
      `SELECT COUNT(*)::int AS requests,
              COUNT(DISTINCT area)::int AS areas,
              COALESCE(SUM(dwell_ms), 0)::bigint AS dwell_ms,
              COUNT(*) FILTER (WHERE status >= 200 AND status < 400)::int AS ok
       FROM traffic_events WHERE created_at > NOW() - INTERVAL '24 hours'`),
    safeQuery(pool,
      `SELECT area, COUNT(*)::int AS requests, MAX(created_at) AS last_visit
       FROM traffic_events WHERE created_at > NOW() - INTERVAL '24 hours'
       GROUP BY area ORDER BY requests DESC LIMIT 15`),
    safeQuery(pool,
      `SELECT id, started_at, finished_at, status FROM seo_bot_runs
       ORDER BY started_at DESC LIMIT 5`)
  ]);

  const kinds = {};
  let total = 0;
  let indexed = 0;
  for (const row of areaRows.rows) {
    kinds[row.kind] = { total: row.total, indexed: row.indexed };
    total += row.total;
    indexed += row.indexed;
  }
  const traffic = trafficRows.rows[0] || { requests: 0, areas: 0, dwell_ms: 0, ok: 0 };

  return {
    status: 'ok',
    areas: { total, indexed, kinds },
    suggestions: suggestionRows.rows,
    traffic: {
      requests24h: traffic.requests,
      areas24h: traffic.areas,
      dwellMs24h: Number(traffic.dwell_ms) || 0,
      ok24h: traffic.ok,
      byArea: areaTrafficRows.rows
    },
    runs: runRows.rows
  };
}

const timers = { maintenance: null, traffic: null, brand: null };

async function runScheduled(pool, stages) {
  try {
    const result = await runSeoBots(pool, { stages });
    const summary = result.status === 'already_running'
      ? 'skipped (another run is active)'
      : `status=${result.status}`;
    console.log(`[SeoBots] ${stages.join('+')} ${summary}`);
    return result;
  } catch (err) {
    console.error(`[SeoBots] ${stages.join('+')} failed:`, err.message);
    return { status: 'error', error: err.message };
  }
}

/**
 * Start the in-process scheduler. Disabled when SEO_BOTS_ENABLED=false.
 * Timers are unref'd so they never block process shutdown.
 */
function startSeoBots(pool) {
  if (process.env.SEO_BOTS_ENABLED === 'false') {
    console.log('[SeoBots] Scheduler disabled via SEO_BOTS_ENABLED=false');
    return null;
  }
  if (timers.maintenance || timers.traffic || timers.brand) return timers;

  const every = (name, stages, intervalMs, initialDelayMs) => {
    const initial = setTimeout(() => { runScheduled(pool, stages); }, initialDelayMs);
    const timer = setInterval(() => { runScheduled(pool, stages); }, intervalMs);
    if (initial.unref) initial.unref();
    if (timer.unref) timer.unref();
    timers[name] = timer;
    return initial;
  };

  every('maintenance', ['areas', 'suggestions', 'index'], 3 * 60 * 60 * 1000, 45 * 1000);
  every('traffic', ['traffic'], 20 * 60 * 1000, 90 * 1000);
  every('brand', ['brand'], 6 * 60 * 60 * 1000, 5 * 60 * 1000);

  console.log('[SeoBots] Scheduler active (areas/suggestions/index 3h, traffic 20m, brand 6h)');
  return timers;
}

function stopSeoBots() {
  for (const name of Object.keys(timers)) {
    if (timers[name]) clearInterval(timers[name]);
    timers[name] = null;
  }
}

module.exports = {
  LOCK,
  prepare,
  runSeoBots,
  seoBotsReport,
  startSeoBots,
  stopSeoBots
};
