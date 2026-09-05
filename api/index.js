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
// instance. server.js, multiDb.js and authService.js historically created
// separate pools for the same Neon endpoint. That multiplies idle connections
// and makes every cold start heavier than it needs to be.
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

    if (cacheKey) {
      poolCache.set(cacheKey, this);
    }
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

module.exports = app;
