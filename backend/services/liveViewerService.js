/**
 * Live Viewer Service — "Phantom Live Feed" synthetic social proof
 *
 * Tracks real-time viewer counts per article/category/global using telemetry
 * beacon data + synthetic baseline boost so numbers always look "alive."
 * Exposes:
 *   - trackView(scopeType, scopeId, deviceId) : record a real viewer
 *   - getViewerCount(scopeType, scopeId) : get display count (real + synthetic)
 *   - getAllViewerCounts() : get all active viewer counts
 *   - start() : background process that decays real counts and recomputes display
 */

const { pgRun, pgSelect } = require('./pg');

const LOG = {
  info: (m) => console.log(`[LiveViewer] ${m}`),
  warn: (m) => console.warn(`[LiveViewer] ${m}`),
  error: (m) => console.error(`[LiveViewer] ${m}`),
};

// In-memory cache of viewer counts: { `${scopeType}:${scopeId}`: { real, synthetic, display, lastSeen } }
const viewerCache = new Map();

// Synthetic baseline per category (so quiet categories still look active)
const SYNTHETIC_BASELINE = {
  'breaking': 12,
  'nigerian-news': 8,
  'sports': 15,
  'politics': 6,
  'crypto': 10,
  'business': 7,
  'tech': 5,
  'entertainment': 9,
  'world': 4,
  'culture': 3,
  general: 6,
};

// Real viewer TTL (seconds) — a viewer is "live" if seen within this window
const VIEWER_TTL_SEC = 120;

// Decay interval (ms)
const DECAY_INTERVAL_MS = 30 * 1000;

/**
 * Get synthetic baseline for a scope.
 */
function getSyntheticBoost(scopeType, scopeId) {
  if (scopeType === 'global') return 25;
  if (scopeType === 'category') return SYNTHETIC_BASELINE[scopeId] || 5;
  // Article-level: derive from category if possible, else small baseline
  return 3;
}

/**
 * Track a real viewer for an article/category/global scope.
 */
async function trackView(scopeType, scopeId, deviceId) {
  if (!scopeType || !scopeId) return;

  const key = `${scopeType}:${scopeId}`;
  const now = Date.now();

  let entry = viewerCache.get(key);
  if (!entry) {
    entry = { real: new Set(), synthetic: getSyntheticBoost(scopeType, scopeId), lastSeen: now };
    viewerCache.set(key, entry);
  }

  // Add device to real viewers set
  entry.real.add(deviceId);
  entry.lastSeen = now;

  // Recompute display count
  const realCount = entry.real.size;
  entry.display = realCount + entry.synthetic;

  // Persist to DB (fail-soft)
  try {
    await pgRun(
      `INSERT INTO live_viewer_counts (scope_type, scope_id, real_count, synthetic_boost, display_count, computed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (scope_type, scope_id)
       DO UPDATE SET real_count = $3, synthetic_boost = $4, display_count = $5, computed_at = NOW()`,
      [scopeType, scopeId, realCount, entry.synthetic, entry.display]
    );
  } catch (e) {
    // Table may not exist yet — fail soft
  }

  return entry.display;
}

/**
 * Get current viewer count for a scope.
 */
function getViewerCount(scopeType, scopeId) {
  const key = `${scopeType}:${scopeId}`;
  const entry = viewerCache.get(key);
  if (!entry) {
    // Return synthetic baseline only
    return { real: 0, synthetic: getSyntheticBoost(scopeType, scopeId), display: getSyntheticBoost(scopeType, scopeId) };
  }

  // Decay real viewers older than TTL
  const now = Date.now();
  if (now - entry.lastSeen > VIEWER_TTL_SEC * 1000) {
    entry.real.clear();
    entry.display = entry.synthetic;
  }

  return { real: entry.real.size, synthetic: entry.synthetic, display: entry.display };
}

/**
 * Get all active viewer counts.
 */
function getAllViewerCounts() {
  const now = Date.now();
  const result = {};
  for (const [key, entry] of viewerCache.entries()) {
    // Decay stale
    if (now - entry.lastSeen > VIEWER_TTL_SEC * 1000) {
      entry.real.clear();
      entry.display = entry.synthetic;
    }
    result[key] = { real: entry.real.size, synthetic: entry.synthetic, display: entry.display };
  }
  return result;
}

/**
 * Background decay: periodically clear stale viewers and recompute.
 */
function startDecay() {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of viewerCache.entries()) {
      if (now - entry.lastSeen > VIEWER_TTL_SEC * 1000) {
        entry.real.clear();
        entry.display = entry.synthetic;
      }
    }
  }, DECAY_INTERVAL_MS);
  LOG.info('Viewer count decay started (30s interval)');
}

/**
 * Start the live viewer service.
 */
function start() {
  startDecay();
  LOG.info('Live Viewer Service started — synthetic social proof active.');
}

module.exports = {
  start,
  trackView,
  getViewerCount,
  getAllViewerCounts,
  viewerCache,
};
