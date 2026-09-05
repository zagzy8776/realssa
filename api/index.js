/*
 * Vercel entrypoint for RealSSA.
 *
 * Vercel handles request/response traffic. External cron and the persistent
 * worker handle scheduled/background work. Keep those concerns isolated so a
 * background service cannot take the API down during a cold start.
 */

process.env.VERCEL = process.env.VERCEL || '1';
process.env.VERCEL_ENV = process.env.VERCEL_ENV || 'production';

const Module = require('module');
const originalLoad = Module._load;
const originalSetInterval = global.setInterval;

const pg = require('pg');
const NativePool = pg.Pool;
const poolCache = new Map();

class SharedVercelPool extends NativePool {
  constructor(config = {}) {
    const rawConnectionString = typeof config === 'string' ? config : config.connectionString;
    const cacheKey = rawConnectionString ? String(rawConnectionString).split('?')[0] : null;
    if (cacheKey && poolCache.has(cacheKey)) return poolCache.get(cacheKey);
    super(config);
    if (cacheKey) poolCache.set(cacheKey, this);
  }
}

pg.Pool = SharedVercelPool;

const persistentOnly = {
  streamHealthMonitor: {
    runStreamHealthCheck: async () => ({}),
    getServerHealthStatus: async () => ({}),
    SERVERS: []
  },
  whatsappBots: {
    initWhatsAppBots: () => {
      console.log('[Vercel] WhatsApp background worker disabled; external/Fly worker owns it.');
    }
  }
};

const vercelWorker = {
  runMigrations: async () => {
    console.log('[Vercel] Worker migrations skipped; migrations belong to the external worker/cron path.');
  }
};

let realAuthService;
let authParent = null;
const loadRealAuthService = (request, parent) => {
  if (!realAuthService) realAuthService = originalLoad.call(Module, request, parent, false);
  return realAuthService;
};

const lazyAuthService = {
  registerWithEmail: (...args) => loadRealAuthService('./services/authService', authParent).registerWithEmail(...args),
  verifyEmailToken: (...args) => loadRealAuthService('./services/authService', authParent).verifyEmailToken(...args),
  sendPhoneOtp: (...args) => loadRealAuthService('./services/authService', authParent).sendPhoneOtp(...args),
  verifyPhoneOtp: (...args) => loadRealAuthService('./services/authService', authParent).verifyPhoneOtp(...args),
  loginWithEmail: (...args) => loadRealAuthService('./services/authService', authParent).loginWithEmail(...args),
  getAllUsersAdmin: (...args) => loadRealAuthService('./services/authService', authParent).getAllUsersAdmin(...args)
};

Module._load = function patchedModuleLoad(request, parent, isMain) {
  if (request === './services/streamHealthMonitor' || request.endsWith('/services/streamHealthMonitor')) return persistentOnly.streamHealthMonitor;
  if (request === './services/whatsappBots' || request.endsWith('/services/whatsappBots')) return persistentOnly.whatsappBots;
  if (request === './worker' || request.endsWith('/worker')) return vercelWorker;
  if (request === './services/authService' || request.endsWith('/services/authService')) {
    authParent = parent;
    return lazyAuthService;
  }
  return originalLoad.call(this, request, parent, isMain);
};

global.setInterval = function vercelNoStartupIntervals() {
  return { __realssaVercelStartupTimer: true };
};

let app;
try {
  app = require('../backend/server.js');
} finally {
  global.setInterval = originalSetInterval;
  Module._load = originalLoad;
}

const waitForDatabasePool = async (timeoutMs = 10000) => {
  if (!process.env.DATABASE_URL) return null;
  const started = Date.now();
  while (!app.get('pool') && Date.now() - started < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return app.get('pool') || null;
};

const sendJson = (res, statusCode, payload) => {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const originalHandle = app.handle.bind(app);
const { ingestCronCategory } = require('../backend/services/cronIngestionFast');

// Vercel-side compatibility routes. These keep the web app usable even when
// legacy Express handlers expect columns/tables from an older schema.
const handleStableApi = async (parsed, req, res, pool) => {
  if (!pool || req.method !== 'GET') return false;

  if (parsed.pathname === '/api/sports/matches') {
    try {
      const result = await pool.query(`
        SELECT
          match_id AS provider_match_id,
          competition AS competition_name,
          home_team AS home_team_name,
          home_team_crest,
          away_team AS away_team_name,
          away_team_crest,
          status,
          COALESCE(match_minute::text, '') AS minute,
          home_score,
          away_score,
          kickoff_at,
          updated_at,
          match_url
        FROM live_matches
        WHERE status IN ('live', 'scheduled', 'finished')
          AND (status = 'live' OR kickoff_at > NOW() - INTERVAL '3 days')
        ORDER BY
          CASE status WHEN 'live' THEN 1 WHEN 'scheduled' THEN 2 ELSE 3 END,
          kickoff_at ASC NULLS LAST
        LIMIT 100
      `);
      return sendJson(res, 200, { matches: Array.isArray(result.rows) ? result.rows : [] }), true;
    } catch (error) {
      console.warn('[Vercel Sports] Stable match query failed:', error.message);
      return sendJson(res, 200, { matches: [] }), true;
    }
  }

  if (parsed.pathname === '/api/rates') {
    try {
      const result = await pool.query(`
        SELECT currency, buy_rate, sell_rate, source, updated_at AS created_at
        FROM parallel_rates
        ORDER BY currency
      `);
      return sendJson(res, 200, Array.isArray(result.rows) ? result.rows : []), true;
    } catch (error) {
      console.warn('[Vercel Market] Rates query failed:', error.message);
      return sendJson(res, 200, []), true;
    }
  }

  if (parsed.pathname === '/api/prices') {
    try {
      const result = await pool.query(`
        SELECT item_name, price, location, unit, updated_at AS created_at
        FROM market_prices
        ORDER BY updated_at DESC, item_name ASC
        LIMIT 200
      `);
      return sendJson(res, 200, Array.isArray(result.rows) ? result.rows : []), true;
    } catch (error) {
      console.warn('[Vercel Market] Prices query failed:', error.message);
      return sendJson(res, 200, []), true;
    }
  }

  return false;
};

app.handle = async function realssaVercelHandle(req, res, out) {
  let parsed;
  try {
    parsed = new URL(req.url || '/', 'https://realssa.internal');
  } catch {
    return originalHandle(req, res, out);
  }

  const isApiRequest = parsed.pathname.startsWith('/api/');
  const isRssRequest = parsed.pathname === '/rss.xml' || parsed.pathname.startsWith('/rss/');
  const isCronIngest = parsed.pathname === '/api/cron/ingest';

  if ((req.method === 'GET' || req.method === 'POST') && isCronIngest) {
    const configuredSecret = process.env.CRON_SECRET;
    const suppliedSecret = parsed.searchParams.get('secret') || req.headers['x-cron-secret'];
    if (!configuredSecret || suppliedSecret !== configuredSecret) return sendJson(res, 401, { error: 'Unauthorized' });

    const category = parsed.searchParams.get('category');
    if (!category) return sendJson(res, 400, { error: 'category is required' });

    try {
      const result = await ingestCronCategory(category);
      return sendJson(res, 200, {
        success: true,
        completed: true,
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Vercel Fast Cron] Ingestion failed:', error.message);
      return sendJson(res, 500, {
        success: false,
        completed: false,
        category,
        error: 'Ingestion failed'
      });
    }
  }

  if (process.env.DATABASE_URL && (isApiRequest || isRssRequest)) {
    const readyPool = await waitForDatabasePool();
    if (!readyPool) {
      return sendJson(res, 503, { error: 'Database temporarily unavailable', retryable: true });
    }

    const stableHandled = await handleStableApi(parsed, req, res, readyPool);
    if (stableHandled) return;
  }

  return originalHandle(req, res, out);
};

module.exports = app;
