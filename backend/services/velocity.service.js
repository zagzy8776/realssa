/**
 * Velocity Engine — real-time view velocity tracking
 *
 * Instead of ranking by total views, this service tracks how FAST an article
 * is gaining views. Every 60 seconds it recomputes rolling windows:
 *   - velocity_1min  = views in last 60s  / 60
 *   - velocity_5min  = views in last 5min / 300
 *   - velocity_15min = views in last 15min/ 900
 *
 * Articles whose velocity_1min exceeds the rolling threshold are marked
 * "spiking" and promoted to the top of the trending feed.
 */

const { pgRun } = require('./pg');

// Lightweight namespaced logger (project logger.js is a static metrics class)
const LOG = {
  info: (m) => console.log(`[VelocityEngine] ${m}`),
  warn: (m) => console.warn(`[VelocityEngine] ${m}`),
  error: (m) => console.error(`[VelocityEngine] ${m}`),
};

const STATE_KEY = 'velocity:rolling_views';

/**
 * In-memory rolling view windows.
 * Format: { [articleId]: [{ ts, count }] } — buckets of view increments.
 */
let viewBuckets = new Map();

/**
 * Record a view (or view burst) for an article.
 * Called from the view-tracking beacon endpoint and article open events.
 */
function recordViews(articles) {
  const now = Date.now();
  const cutoff = now - 15 * 60 * 1000; // keep 15 min of buckets
  if (Array.isArray(articles)) {
    for (const a of articles) {
      const id = String(a.article_id || a.id || '');
      const count = Math.max(1, Math.min(50, parseInt(a.count || 1, 10) || 1));
      if (!id) continue;
      let buckets = viewBuckets.get(id);
      if (!buckets) {
        buckets = [];
        viewBuckets.set(id, buckets);
      }
      const last = buckets[buckets.length - 1];
      if (last && last.ts === now) {
        last.count += count;
      } else {
        buckets.push({ ts: now, count });
      }
      // Prune old buckets
      while (buckets.length && buckets[0].ts < cutoff) buckets.shift();
    }
  }
  return viewBuckets.size;
}

/**
 * Compute velocity for a single article from its in-memory buckets.
 */
function computeForArticle(id) {
  const buckets = viewBuckets.get(id) || [];
  const now = Date.now();
  const win = (secs) => {
    const t = now - secs * 1000;
    return buckets.reduce((sum, b) => (b.ts >= t ? sum + b.count : sum), 0);
  };
  const v1 = win(60) / 60;
  const v5 = win(300) / 300;
  const v15 = win(900) / 900;
  return {
    views_1min: Math.round(win(60) * 100) / 100,
    views_5min: Math.round(win(300) * 100) / 100,
    views_15min: Math.round(win(900) * 100) / 100,
    velocity_1min: Math.round(v1 * 1000) / 1000,
    velocity_5min: Math.round(v5 * 1000) / 1000,
    velocity_15min: Math.round(v15 * 1000) / 1000,
  };
}

/**
 * Recompute all active articles and persist a snapshot to the DB
 * (rss_articles.velocity_score) so the public API can rank by velocity.
 */
async function recompute() {
  try {
    if (!viewBuckets.size) return 0;
    const nowIso = new Date().toISOString();
    let updated = 0;
    for (const id of viewBuckets.keys()) {
      const v = computeForArticle(id);
      if (v.views_15min === 0) continue;
      // Composite score: 60-second velocity weighted heavily, decayed by
      // momentum (velocity_1min > velocity_15min = still accelerating)
      const momentum = v.velocity_1min >= v.velocity_15min ? 1.5 : 1.0;
      const score = v.velocity_1min * momentum + v.velocity_5min * 0.4;
      try {
        await pgRun(
          `UPDATE rss_articles SET velocity_score = $1, view_count = COALESCE(view_count,0) + $2
           WHERE id = $3`,
          [score, v.views_1min, id]
        );
        updated++;
      } catch (e) {
        // Table column may not exist yet if schema extension not applied — fail soft
        LOG.warn(`Failed to persist velocity for article ${id}: ${e.message}`);
      }
    }
    LOG.info(`Velocity recomputed for ${updated} articles at ${nowIso}`);
    return updated;
  } catch (err) {
    LOG.error(`Velocity recompute error: ${err.message}`);
    return 0;
  }
}

/**
 * Start the 60-second velocity loop.
 */
let timer = null;
function start() {
  if (timer) return;
  timer = setInterval(() => {
    recompute().catch(() => {});
  }, 60 * 1000);
  if (timer.unref) timer.unref();
  LOG.info('Velocity engine started (60s recompute loop)');
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * Get current velocity snapshots for the top N articles by velocity_1min.
 */
function topSpiking(n = 20) {
  const now = Date.now();
  const arr = [];
  for (const [id, buckets] of viewBuckets.entries()) {
    const recent = buckets.filter((b) => b.ts > now - 60 * 1000);
    if (!recent.length) continue;
    arr.push({ article_id: id, ...computeForArticle(id) });
  }
  arr.sort((a, b) => b.velocity_1min - a.velocity_1min);
  return arr.slice(0, n);
}

module.exports = {
  recordViews,
  recompute,
  start,
  stop,
  topSpiking,
  computeForArticle,
  _getState: () => ({ tracked: viewBuckets.size }),
};