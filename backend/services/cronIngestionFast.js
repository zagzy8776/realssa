/**
 * Fast Vercel cron adapter.
 *
 * The scheduled endpoint imports this module so the HTTP cron path can run
 * exactly one requested RSS category without booting the long-lived worker.
 * Keep this adapter small: the full ingestion pipeline remains in ingestion.js.
 */
const Parser = require('rss-parser');
const { getPoolForCategory } = require('../config/multiDb');
const { ensureRssSchema } = require('./ensureRssSchema');
const { ingestAllFeeds } = require('./ingestion');

const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent': 'RealSSA-Cron/1.0 (+https://realssanews.com.ng)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
  }
});

const CATEGORY_ALIASES = new Map([
  ['nigeria', 'nigerian-news'],
  ['nigerian', 'nigerian-news'],
  ['nigerian-news', 'nigerian-news'],
  ['south_africa', 'south-africa'],
  ['south-africa', 'south-africa'],
  ['usa', 'usa'],
  ['us', 'usa'],
  ['uk', 'uk'],
  ['world', 'world'],
  ['crypto', 'crypto'],
  ['culture', 'culture'],
  ['entertainment', 'entertainment'],
  ['sports', 'sports'],
  ['ghana', 'ghana'],
  ['kenya', 'kenya'],
  ['business', 'business'],
  ['tech', 'tech'],
  ['science', 'science'],
  ['lifestyle', 'lifestyle'],
  ['jobs', 'jobs'],
  ['local', 'local'],
  ['social', 'social']
]);

function normalizeCategory(value) {
  const raw = String(value || '').trim().toLowerCase();
  return CATEGORY_ALIASES.get(raw) || raw;
}

async function ingestCronCategory(category) {
  const normalized = normalizeCategory(category);
  if (!normalized) throw new Error('category is required');

  const configured = getPoolForCategory(normalized);
  const pool = configured && configured.pool;

  if (!pool) {
    throw new Error('Primary news database is not configured');
  }

  await ensureRssSchema(pool);

  const startedAt = Date.now();
  const result = await ingestAllFeeds(pool, parser, normalized);

  return {
    category: normalized,
    newCount: Number(result?.newCount || 0),
    summaryCount: Number(result?.summaryCount || 0),
    durationMs: Date.now() - startedAt
  };
}

module.exports = { ingestCronCategory, normalizeCategory };
