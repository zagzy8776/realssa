/*
 * Vercel entrypoint for RealSSA.
 *
 * The main backend is also used by the persistent Fly.io worker.  Vercel must
 * not start persistent/background processes such as WhatsApp Web, stream
 * monitors, or setInterval-based workers while loading the request handler.
 *
 * Keep the production API on the same Express application, but isolate the
 * persistent-only modules at the Vercel boundary.  The Fly worker continues
 * to load the real implementations.
 */

process.env.VERCEL = process.env.VERCEL || '1';
process.env.VERCEL_ENV = process.env.VERCEL_ENV || 'production';

const Module = require('module');
const originalLoad = Module._load;
const originalSetInterval = global.setInterval;

// These modules are persistent daemons on Fly/Docker, not request-time
// dependencies for Vercel.  Returning inert implementations here prevents
// Puppeteer/WhatsApp and external stream-health probes from being started by
// every Vercel function instance.
const persistentOnly = {
  streamHealthMonitor: {
    runStreamHealthCheck: async () => ({}),
    getServerHealthStatus: async () => ({}),
    SERVERS: []
  },
  whatsappBots: {
    initWhatsAppBots: () => {
      console.log('[Vercel] WhatsApp background worker disabled; running on Fly.io worker.');
    }
  }
};

Module._load = function patchedModuleLoad(request, parent, isMain) {
  if (request === './services/streamHealthMonitor' || request.endsWith('/services/streamHealthMonitor')) {
    return persistentOnly.streamHealthMonitor;
  }
  if (request === './services/whatsappBots' || request.endsWith('/services/whatsappBots')) {
    return persistentOnly.whatsappBots;
  }
  return originalLoad.call(this, request, parent, isMain);
};

// server.js contains a few legacy timers outside its Fly-only startup block.
// Suppress those timers only while the Express app is being constructed.
// Normal request-time timers remain available after initialization.
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
