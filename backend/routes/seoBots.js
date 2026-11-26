/**
 * SEO Bots admin routes
 * ---------------------
 * Mounted at /api/seo-bots. Auth: Bearer token or ?secret= using
 * SEO_BOTS_TOKEN, GROWTH_ADMIN_TOKEN or CRON_SECRET (first configured wins).
 *
 *   GET  /api/seo-bots/report
 *   POST /api/seo-bots/run            body/query: stages=areas,suggestions,index,traffic,brand
 *   GET  /api/seo-bots/autocomplete?q= full suggestion payload (site + articles)
 *   GET  /api/seo-bots/areas?limit=    registered area registry
 */

const express = require('express');
const crypto = require('node:crypto');
const { runSeoBots, seoBotsReport } = require('../services/seoBotsRunner');

const VALID_STAGES = ['areas', 'suggestions', 'index', 'traffic', 'brand'];
const DEFAULT_STAGES = ['areas', 'suggestions', 'index', 'traffic'];

function tokenMatches(expected, provided) {
  if (!expected || !provided) return false;
  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(provided));
  if (a.length !== b.length) {
    // Still consume a comparison to keep timing flat.
    crypto.timingSafeEqual(Buffer.alloc(a.length), Buffer.alloc(a.length));
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function parseStages(value) {
  if (!value) return DEFAULT_STAGES;
  const stages = String(value)
    .split(',')
    .map(stage => stage.trim().toLowerCase())
    .filter(stage => VALID_STAGES.includes(stage));
  return stages.length ? stages : DEFAULT_STAGES;
}

module.exports = function seoBotsRoutes(pool) {
  const router = express.Router();

  router.use((req, res, next) => {
    const expected = process.env.SEO_BOTS_TOKEN || process.env.GROWTH_ADMIN_TOKEN || process.env.CRON_SECRET;
    if (!expected) return res.status(503).json({ error: 'SEO_BOTS_TOKEN is not configured' });
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = bearer || String(req.query.secret || '') || String(req.headers['x-cron-secret'] || '');
    if (!tokenMatches(expected, provided)) return res.status(401).json({ error: 'Unauthorized' });
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get('/report', async (_req, res) => {
    try {
      res.json(await seoBotsReport(pool));
    } catch (err) {
      console.error('[SeoBots report]', err.message);
      res.status(500).json({ error: 'SEO bot report failed' });
    }
  });

  router.post('/run', async (req, res) => {
    try {
      const stages = parseStages(req.body?.stages || req.query.stages);
      const result = await runSeoBots(pool, {
        stages,
        trafficSessions: Math.min(Math.max(Number(req.body?.sessions) || 6, 1), 20),
        indexLimit: Math.min(Math.max(Number(req.body?.limit) || 100, 1), 500)
      });
      res.json(result);
    } catch (err) {
      console.error('[SeoBots run]', err.message);
      res.status(500).json({ error: 'SEO bot run failed', message: err.message });
    }
  });

  router.get('/autocomplete', async (req, res) => {
    try {
      const { suggest } = require('../services/seoAutocomplete');
      const q = String(req.query.q || '').trim();
      res.json(await suggest(pool, q, {
        limit: Math.min(Math.max(Number(req.query.limit) || 10, 1), 20),
        includeArticles: true
      }));
    } catch (err) {
      console.error('[SeoBots autocomplete]', err.message);
      res.json({ query: String(req.query.q || ''), terms: [], site: [], articles: [] });
    }
  });

  router.get('/areas', async (req, res) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
      if (!pool) {
        const { buildAreas } = require('../services/areaExpansionBot');
        return res.json({ status: 'no_database', areas: buildAreas().slice(0, limit) });
      }
      const result = await pool.query(
        `SELECT slug, name, kind, country, language, path, score, indexed_at, index_status, last_traffic_at
         FROM seo_areas ORDER BY score DESC, name ASC LIMIT $1`,
        [limit]
      );
      res.json({ status: 'ok', areas: result.rows });
    } catch (err) {
      console.error('[SeoBots areas]', err.message);
      res.status(500).json({ error: 'Area registry failed' });
    }
  });

  return router;
};
