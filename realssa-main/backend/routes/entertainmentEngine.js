'use strict';

/**
 * Entertainment Engine API
 * ========================
 * Mounted at /api/ai/entertainment.
 *
 *   GET  /trends        public ranked entertainment signals
 *   GET  /trends/:id    one signal
 *   POST /scan          cron-protected refresh
 *   POST /angles        rate-limited grounded brief for one story
 *   GET  /health        feed health + configuration
 */

const express = require('express');
const router = express.Router();

const trigger = require('../services/entertainmentTrigger.service');
const { generateBrief } = require('../services/angleFactory.service');
const { requireCron } = require('../services/cronAuth');
const { fetchArticleText } = require('../services/articleText.service');

const ANGLE_WINDOW_MS = 60 * 60 * 1000;
const ANGLE_MAX_PER_WINDOW = 8;
const angleHits = new Map();

function clientIp(req) {
  return String(
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['cf-connecting-ip'] ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown'
  );
}

function allowAngle(ip) {
  const now = Date.now();
  const recent = (angleHits.get(ip) || []).filter((ts) => now - ts < ANGLE_WINDOW_MS);
  if (recent.length >= ANGLE_MAX_PER_WINDOW) {
    return { allowed: false, retryAfterMs: ANGLE_WINDOW_MS - (now - recent[0]) };
  }
  recent.push(now);
  angleHits.set(ip, recent);

  if (angleHits.size > 2000) {
    for (const [key, hits] of angleHits) {
      if (!hits.some((ts) => now - ts < ANGLE_WINDOW_MS)) angleHits.delete(key);
    }
  }

  return { allowed: true };
}

function publicTrend(trend) {
  if (!trend) return null;
  const rest = { ...trend };
  delete rest.coverage;
  delete rest.sources;
  return rest;
}

// ── Trends ──────────────────────────────────────────────────────────────────

router.get('/trends', async (req, res) => {
  try {
    const snapshot = await trigger.ensureFresh();

    let includeCoverage = false;
    if (req.headers['x-cron-secret'] || req.headers.authorization) {
      includeCoverage = Boolean(requireCron(req, res));
      if (res.headersSent) return;
    }

    const limit = Number(req.query.limit) || 12;
    const region = String(req.query.region || '').toLowerCase();
    const minHeat = Number(req.query.minHeat) || 0;

    const result = trigger.getTrends({ limit, region, minHeat, includeCoverage });

    if (includeCoverage) {
      res.setHeader('Cache-Control', 'no-store');
    } else {
      res.setHeader('Cache-Control', 'public, s-maxage=90, stale-while-revalidate=300');
    }

    return res.json({
      ok: true,
      ...result,
      sourcePolicy: trigger.sourcePolicy,
    });
  } catch (error) {
    console.error('[EntertainmentAPI] /trends failed:', error.message);
    return res.status(200).json({
      ok: false,
      trends: [],
      scannedAt: null,
      error: 'Entertainment trends temporarily unavailable',
      sourcePolicy: trigger.sourcePolicy,
    });
  }
});

router.get('/trends/:id', async (req, res) => {
  try {
    const snapshot = await trigger.ensureFresh();
    const trend = trigger.getTrend(req.params.id);

    if (!trend) {
      return res.status(404).json({ ok: false, error: 'Trend not found' });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=90, stale-while-revalidate=300');
    return res.json({
      ok: true,
      trend: publicTrend(trend),
      scannedAt: snapshot.scannedAt,
    });
  } catch (error) {
    console.error('[EntertainmentAPI] /trends/:id failed:', error.message);
    return res.status(500).json({ ok: false, error: 'Trend lookup failed' });
  }
});

// ── Refresh ─────────────────────────────────────────────────────────────────

router.post('/scan', async (req, res) => {
  if (!requireCron(req, res)) return;

  try {
    const result = await trigger.scan({ persist: true, reason: 'http' });
    return res.json({
      ok: true,
      scannedAt: result.scannedAt,
      stats: result.stats,
      count: result.trends.length,
      top: result.trends.slice(0, 10).map((trend) => ({
        id: trend.id,
        title: trend.title,
        heat: trend.heat,
        sourceCount: trend.sourceCount,
      })),
    });
  } catch (error) {
    console.error('[EntertainmentAPI] /scan failed:', error.message);
    return res.status(500).json({ ok: false, error: 'Scan failed' });
  }
});

// ── Grounded angles ─────────────────────────────────────────────────────────

router.post('/angles', async (req, res) => {
  const gate = allowAngle(clientIp(req));
  if (!gate.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(gate.retryAfterMs / 1000)));
    return res.status(429).json({
      ok: false,
      error: 'Too many angle requests. Try again later.',
      retryAfterMs: gate.retryAfterMs,
    });
  }

  const body = req.body || {};
  const trendId = String(body.trendId || '').trim();
  const trend = trendId ? trigger.getTrend(trendId) : null;

  if (trendId && !trend) {
    return res.status(404).json({ ok: false, error: 'Trend not found' });
  }

  let sourceText = String(body.sourceText || body.text || '').trim();
  const sourceUrl = String(body.sourceUrl || trend?.coverage?.[0]?.url || '').trim();

  if (!sourceText && sourceUrl) {
    try {
      sourceText = await fetchArticleText(sourceUrl);
    } catch (error) {
      console.warn('[EntertainmentAPI] source fetch failed:', error.message);
    }
  }

  if (!sourceText && trend) {
    sourceText = `${trend.title}. ${trend.snippet || ''}`.trim();
  }

  const result = await generateBrief({
    title: body.title || trend?.title || '',
    sourceText,
    sourceUrl,
    sourceName: body.sourceName || trend?.coverage?.[0]?.source || '',
    region: body.region || trend?.region || 'global',
  });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ...result,
    trend: trend ? publicTrend(trend) : null,
  });
});

// ── Health ──────────────────────────────────────────────────────────────────

router.get('/health', (req, res) => {
  const snapshot = trigger.getSnapshot();
  return res.json({
    ok: true,
    scannedAt: snapshot.scannedAt,
    stats: snapshot.stats,
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
    keys: {
      youtube: Boolean(process.env.YOUTUBE_API_KEY),
      x: Boolean(process.env.X_BEARER_TOKEN),
    },
    persistence: process.env.ENTERTAINMENT_TRENDS_PERSIST === '1',
    sourcePolicy: trigger.sourcePolicy,
  });
});

module.exports = router;
