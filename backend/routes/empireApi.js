/**
 * Empire of Attention — API Routes
 *
 *   GET  /api/velocity           : top articles ranked by 60s view velocity
 *   POST /api/velocity/track     : record a view burst (called on card open)
 *   GET  /api/predictive-trending: social trend spikes (Reddit/Telegram scan)
 *   GET  /api/crypto-live        : live crypto snapshot + fear/greed
 *   GET  /api/crypto/correlated  : news correlated with moving coins
 *   GET  /api/image-scrape?url=  : scrape + re-host an article image to R2
 *   POST /api/behavior/report    : ingest behavior telemetry (beacon-safe)
 *   GET  /api/behavior/insights?deviceId= : live engagement recommendations
 *   GET  /api/empire/dashboard   : aggregate snapshot for the command center
 */

const express = require('express');
const router = express.Router();
const { pgSelect, pgRun } = require('../services/pg');
const velocity = require('../services/velocity.service');
const socialPredictive = require('../services/socialPredictive.service');
const cryptoLive = require('../services/cryptoLive.service');
const imagePipeline = require('../services/imagePipeline');
const behavior = require('../services/behaviorIntelligence.service');

// ── Velocity ──────────────────────────────────────────────────────────────
router.get('/velocity', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
  try {
    // DB-backed: articles with a computed velocity_score (schema extension)
    const dbRows = await pgSelect(
      `SELECT id, title, category, image, external_link, published_at,
              COALESCE(ai_summary, original_excerpt, '') AS excerpt,
              velocity_score, view_count
       FROM rss_articles
       WHERE velocity_score > 0
       ORDER BY velocity_score DESC, published_at DESC
       LIMIT ${limit}`,
      []
    );
    // In-memory live spiking (60s window, always fresh)
    const live = velocity.topSpiking(limit);
    const liveMap = new Map(live.map((v) => [String(v.article_id), v]));
    const articles = dbRows.map((r) => ({
      ...r,
      live: liveMap.get(String(r.id)) || null,
      spiking: (liveMap.get(String(r.id))?.velocity_1min || 0) >= 0.5,
    }));
    res.setHeader('Cache-Control', 'no-store');
    res.json({ articles, live: live.slice(0, 5), computedAt: new Date().toISOString() });
  } catch (err) {
    // velocity_score column may not exist yet — degrade to live spiking only
    res.json({ articles: [], live: velocity.topSpiking(limit), warning: err.message });
  }
});

router.post('/velocity/track', (req, res) => {
  const { article_id, articleId, count } = req.body || {};
  const id = article_id || articleId;
  if (!id) return res.status(400).json({ error: 'article_id is required' });
  velocity.recordViews([{ article_id: String(id), count: count || 1 }]);
  res.status(200).json({ ok: true, tracked: velocity._getState().tracked });
});

// ── Predictive (social) trending ──────────────────────────────────────────
router.get('/predictive-trending', (req, res) => {
  const snap = socialPredictive.getSnapshot();
  // Force a fresh poll on demand (throttled by the service's own timer)
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    trends: snap.trends,
    computedAt: snap.computedAt,
    sourcesScanned: snap.sourcesScanned,
    status: snap.trends.length ? 'active' : 'warming',
  });
});

// ── Crypto live ───────────────────────────────────────────────────────────
router.get('/crypto-live', (req, res) => {
  const snap = cryptoLive.getSnapshot();
  res.setHeader('Cache-Control', 'no-store');
  res.json(snap);
});

router.get('/crypto/correlated', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);
  try {
    const articles = await cryptoLive.getCorrelatedNews(limit);
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json({ articles });
  } catch (err) {
    res.json({ articles: [], warning: err.message });
  }
});

// ── Image scrape + R2 re-host ─────────────────────────────────────────────
router.get('/image-scrape', async (req, res) => {
  const url = String(req.query.url || '').trim();
  const category = String(req.query.category || 'general').slice(0, 40);
  const headline = String(req.query.headline || '').slice(0, 200);
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'url query param (http/https) is required' });
  }
  const started = Date.now();
  try {
    const result = await imagePipeline.scrapeAndRehost(url, { category, headline });
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({
      ...result,
      aiHeadline: imagePipeline.powerHeadline(headline, { sentiment: req.query.sentiment || 'neutral' }),
      tookMs: Date.now() - started,
      r2Available: !!result.r2Url,
    });
  } catch (err) {
    res.status(502).json({ r2Url: null, error: err.message });
  }
});

// ── Behavior telemetry + insights ─────────────────────────────────────────
// Beacon-safe: always returns 200 so navigator.sendBeacon never retries.
router.post('/behavior/report', (req, res) => {
  try {
    const payload = req.body || {};
    const deviceId = String(payload.deviceId || payload.device_id || 'anon').slice(0, 255);
    const rec = behavior.ingest({ ...payload, deviceId });
    if (rec) {
      // Best-effort persistence (user_behavior_patterns table, fail-soft)
      pgRun(
        `INSERT INTO user_behavior_patterns
           (device_id, session_id, scroll_speed_category, dwell_time_avg,
            category_affinities, optimal_content_type, optimal_ad_placement,
            time_of_day_category)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`,
        [
          deviceId,
          String(payload.sessionId || payload.session_id || '').slice(0, 255) || null,
          rec.scrollSpeed,
          rec.engagement.dwellTotal,
          JSON.stringify(rec.categoryAffinities),
          rec.optimalContentType,
          rec.optimalAdPlacement,
          timeOfDayCategory(),
        ]
      ).catch(() => {}); // table may not exist yet
    }
  } catch (e) { /* never fail a beacon */ }
  res.status(200).send('OK');
});

router.get('/behavior/insights', (req, res) => {
  const deviceId = String(req.query.deviceId || req.query.device_id || '').slice(0, 255);
  if (!deviceId) return res.status(400).json({ error: 'deviceId query param is required' });
  const rec = behavior.getRecommendation(deviceId);
  res.setHeader('Cache-Control', 'no-store');
  res.json(rec ? { available: true, ...rec } : { available: false, defaults: defaultInsights() });
});

// ── Aggregate dashboard for the Neural Command Center ─────────────────────
router.get('/empire/dashboard', async (req, res) => {
  const out = { computedAt: new Date().toISOString() };
  // Velocity
  try {
    const dbRows = await pgSelect(
      `SELECT id, title, category, image, velocity_score
       FROM rss_articles WHERE velocity_score > 0
       ORDER BY velocity_score DESC LIMIT 10`,
      []
    );
    out.velocityTop = dbRows.map((r) => ({
      id: r.id, title: r.title, category: r.category, image: r.image,
      velocityScore: r.velocity_score,
    }));
  } catch (e) { out.velocityTop = []; }
  out.liveSpiking = velocity.topSpiking(5);
  // Predictive
  const snap = socialPredictive.getSnapshot();
  out.socialTrends = snap.trends.slice(0, 10);
  out.socialStatus = snap.trends.length ? 'active' : 'warming';
  // Crypto
  out.crypto = cryptoLive.getSnapshot();
  res.setHeader('Cache-Control', 'no-store');
  res.json(out);
});

// ── helpers ───────────────────────────────────────────────────────────────
function timeOfDayCategory() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

function defaultInsights() {
  return {
    scrollSpeed: 'unknown',
    topCategory: 'general',
    categoryAffinities: {},
    optimalContentType: 'image_heavy',
    optimalAdPlacement: 'banner',
    microAdSuggestions: [],
  };
}

module.exports = router;