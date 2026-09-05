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

// Reuse one pg pool per normalized DATABASE_URL inside a Vercel function
// instance. Multiple backend modules previously created independent pools for
// the same Neon endpoint, multiplying idle connections and cold-start work.
const pg = require('pg');
const NativePool = pg.Pool;
const poolCache = new Map();

class SharedVercelPool extends NativePool {
  constructor(config = {}) {
    const rawConnectionString = typeof config === 'string'
      ? config
      : config.connectionString;
    const cacheKey = rawConnectionString
      ? String(rawConnectionString).split('?')[0]
      : null;

    if (cacheKey && poolCache.has(cacheKey)) {
      return poolCache.get(cacheKey);
    }

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

// worker.js creates PostgreSQL pools as soon as it is imported, even though
// Vercel never runs its migration/worker path. Avoid loading those pools.
const vercelWorker = {
  runMigrations: async () => {
    console.log('[Vercel] Worker migrations skipped; migrations belong to the external worker/cron path.');
  }
};

// authService historically initialized its database tables at module import.
// Lazy-load it only when an auth request actually needs it.
let realAuthService;
let authParent = null;
const loadRealAuthService = (request, parent) => {
  if (!realAuthService) {
    realAuthService = originalLoad.call(Module, request, parent, false);
  }
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
  if (request === './services/streamHealthMonitor' || request.endsWith('/services/streamHealthMonitor')) {
    return persistentOnly.streamHealthMonitor;
  }
  if (request === './services/whatsappBots' || request.endsWith('/services/whatsappBots')) {
    return persistentOnly.whatsappBots;
  }
  if (request === './worker' || request.endsWith('/worker')) {
    return vercelWorker;
  }
  if (request === './services/authService' || request.endsWith('/services/authService')) {
    authParent = parent;
    return lazyAuthService;
  }
  return originalLoad.call(this, request, parent, isMain);
};

// server.js still contains a legacy startup setInterval for stream health.
// Suppress timers only during app construction. Request-time timers remain
// available after initialization.
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

// External cron-job.org is the scheduler for ingestion. The old Express route
// sent HTTP 200 and then used setImmediate(), which is not a durable background
// execution mechanism on Vercel: the function can be frozen after the response.
// Handle ingestion synchronously here so a green cron event means the job really
// completed, rather than merely being accepted.
const originalHandle = app.handle.bind(app);
const Parser = require('rss-parser');
const { ingestAllFeeds } = require('../backend/services/ingestion');

app.handle = function realssaVercelHandle(req, res, out) {
  let parsed;
  try {
    parsed = new URL(req.url || '/', 'https://realssa.internal');
  } catch {
    return originalHandle(req, res, out);
  }

  if ((req.method === 'GET' || req.method === 'POST') && parsed.pathname === '/api/cron/ingest') {
    const configuredSecret = process.env.CRON_SECRET;
    const suppliedSecret = parsed.searchParams.get('secret') || req.headers['x-cron-secret'];

    if (!configuredSecret || suppliedSecret !== configuredSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const category = parsed.searchParams.get('category') || null;
    const pool = app.get('pool');

    (async () => {
      try {
        const parser = new Parser({
          customFields: {
            item: [
              ['media:content', 'media:content'],
              ['media:thumbnail', 'media:thumbnail'],
              ['enclosure', 'enclosure'],
              ['content:encoded', 'content:encoded'],
              ['description', 'description']
            ]
          }
        });

        const result = await ingestAllFeeds(pool, parser, category);
        if (!res.headersSent) {
          return res.status(200).json({
            success: true,
            completed: true,
            category: category || 'all',
            newCount: result?.newCount || 0,
            summaryCount: result?.summaryCount || 0,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('[Vercel Cron] Ingestion failed:', error.message);
        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            completed: false,
            category: category || 'all',
            error: 'Ingestion failed'
          });
        }
      }
    })();

    return;
  }

  return originalHandle(req, res, out);
};

module.exports = app;
