/**
 * Behavior Intelligence — the "Subconscious Suggestion" engine
 *
 * Consumes the same beacon telemetry the existing telemetryService buffers,
 * but maintains a LIVE in-memory profile per device so the frontend can
 * receive personalized layout/engagement recommendations in real time:
 *
 *   - scrollSpeedClass   : fast | medium | slow   (from scroll deltas)
 *   - categoryAffinities : per-category dwell share
 *   - optimalContentType : short_video | image_heavy | text_deep
 *   - optimalAdPlacement : pre_roll | mid_roll | banner | native
 *   - microAdSuggestions : ad placements triggered by behavior
 *
 * Profiles decay over time (half-life 30 min) so a user who switches from
 * crypto to sports gets re-targeted within a few sessions.
 */

// Lightweight namespaced logger (project logger.js is a static metrics class)
const LOG = {
  info: (m) => console.log(`[BehaviorIntelligence] ${m}`),
  warn: (m) => console.warn(`[BehaviorIntelligence] ${m}`),
  error: (m) => console.error(`[BehaviorIntelligence] ${m}`),
};
const HALF_LIFE_MS = 30 * 60 * 1000;
const MAX_DEVICES = 5000;

// deviceId -> live profile
const profiles = new Map();

function decayFactor(ageMs) {
  return Math.pow(0.5, ageMs / HALF_LIFE_MS);
}

function getProfile(deviceId, now = Date.now()) {
  let p = profiles.get(deviceId);
  if (!p) {
    p = {
      deviceId,
      affinities: {},        // category -> weighted dwell score
      scrollSamples: [],     // px/s samples
      dwellTotal: 0,
      lastSeen: now,
      videoPlays: 0,
      imageHovers: 0,
      priceLinger: 0,        // ms spent on price/crypto cards
      sessionStarted: now,
    };
    profiles.set(deviceId, p);
    // Simple eviction when at capacity
    if (profiles.size > MAX_DEVICES) {
      let oldest = null, oldestTs = Infinity;
      for (const [id, pp] of profiles) {
        if (pp.lastSeen < oldestTs) { oldestTs = pp.lastSeen; oldest = id; }
      }
      if (oldest) profiles.delete(oldest);
    }
  }
  p.lastSeen = now;
  return p;
}

/**
 * Ingest a parsed telemetry payload (same shape telemetryService receives):
 * { deviceId, events: [{type, category, dwellMs, scrollDelta, ...}] }
 */
function ingest(payload) {
  if (!payload || !payload.deviceId) return null;
  const now = Date.now();
  const p = getProfile(payload.deviceId, now);
  const events = Array.isArray(payload.events) ? payload.events : [];

  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const cat = String(ev.category || ev.categoryId || 'general').toLowerCase();
    const dwell = Math.max(0, Number(ev.dwellMs || ev.dwell_time || 0));

    if (ev.type === 'dwell' || dwell > 0) {
      p.affinities[cat] = (p.affinities[cat] || 0) + dwell;
      p.dwellTotal += dwell;
    }
    if (ev.type === 'scroll' && Number.isFinite(Number(ev.scrollDelta))) {
      p.scrollSamples.push(Number(ev.scrollDelta));
      if (p.scrollSamples.length > 60) p.scrollSamples.shift();
    }
    if (ev.type === 'video_play') p.videoPlays += 1;
    if (ev.type === 'image_hover') p.imageHovers += 1;
    if (ev.type === 'price_linger') p.priceLinger += dwell;
  }

  return buildRecommendation(p, now);
}

/**
 * Classify scroll speed from recent px/s samples.
 */
function scrollClass(p) {
  if (p.scrollSamples.length < 3) return 'unknown';
  const avg = p.scrollSamples.reduce((s, v) => s + Math.abs(v), 0) / p.scrollSamples.length;
  if (avg > 1200) return 'fast';
  if (avg > 300) return 'medium';
  return 'slow';
}

/**
 * Build the live recommendation payload for a device.
 */
function buildRecommendation(p, now = Date.now()) {
  const age = now - p.lastSeen;
  const f = decayFactor(Math.min(age, HALF_LIFE_MS * 4));
  const aff = {};
  for (const [cat, v] of Object.entries(p.affinities)) aff[cat] = v * f;
  const total = Object.values(aff).reduce((s, v) => s + v, 0) || 1;
  const ranked = Object.entries(aff).sort((a, b) => b[1] - a[1]);
  const topCategory = ranked.length ? ranked[0][0] : 'general';
  const dominant = ranked.length ? ranked[0][1] / total : 0;

  const sc = scrollClass(p);
  const cryptoScore = (aff.crypto || 0) / total;

  // Content-type model
  let optimalContentType = 'text_deep';
  if (p.videoPlays > 2 && sc === 'fast') optimalContentType = 'short_video';
  else if (p.imageHovers > 3 || sc === 'fast') optimalContentType = 'image_heavy';

  // Ad placement model
  let optimalAdPlacement = 'banner';
  if (optimalContentType === 'short_video') optimalAdPlacement = 'pre_roll';
  else if (optimalContentType === 'image_heavy' && sc === 'medium') optimalAdPlacement = 'mid_roll';
  else if (sc === 'slow' && dominant > 0.4) optimalAdPlacement = 'native';

  const microAds = [];
  if (cryptoScore > 0.3) microAds.push({ placement: 'native', context: 'crypto', trigger: 'price_linger', reason: 'high crypto dwell' });
  if (p.priceLinger > 8000) microAds.push({ placement: 'interstitial', context: 'markets', trigger: 'price_linger', reason: 'lingering on price data' });
  if (sc === 'fast') microAds.push({ placement: 'banner', context: topCategory, trigger: 'fast_scroll', reason: 'skim pattern' });
  if (sc === 'slow' && dominant > 0.5) microAds.push({ placement: 'native', context: topCategory, trigger: 'deep_read', reason: 'deep engagement in ' + topCategory });

  return {
    deviceId: p.deviceId,
    scrollSpeed: sc,
    topCategory,
    categoryAffinities: Object.fromEntries(ranked.slice(0, 5).map(([c, v]) => [c, Math.round((v / total) * 100) / 100])),
    optimalContentType,
    optimalAdPlacement,
    microAdSuggestions: microAds.slice(0, 3),
    engagement: {
      dwellTotal: Math.round(p.dwellTotal / 1000),
      videoPlays: p.videoPlays,
      imageHovers: p.imageHovers,
    },
    computedAt: new Date(now).toISOString(),
  };
}

/**
 * Fetch a recommendation (null if the device has never been seen).
 */
function getRecommendation(deviceId) {
  const p = profiles.get(deviceId);
  if (!p) return null;
  return buildRecommendation(p);
}

module.exports = { ingest, getRecommendation, scrollClass, _profiles: profiles };