/**
 * pricesBot.js — NBS Commodity Price Bot
 * Source: Nigeria National Bureau of Statistics — Selected Food Price Watch
 * URL: https://nigerianstat.gov.ng/elibrary (public government data)
 * Cadence: weekly check — NBS publishes monthly
 * Schema: upsert current prices, keep history 90 days
 * If no parseable data found: log clearly, do NOT seed fake data
 */

const cron = require('node-cron');

const NBS_SEARCH_URL = 'https://nigerianstat.gov.ng/elibrary?queries[search]=selected+food+price+watch';
const NBS_BASE = 'https://nigerianstat.gov.ng';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; RealSSABot/1.0; +https://realssanews.com.ng)' };

let pool;

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_prices (
      item_name   VARCHAR(200) PRIMARY KEY,
      price       NUMERIC(12,2) NOT NULL,
      unit        VARCHAR(50)   DEFAULT 'unit',
      location    VARCHAR(200)  DEFAULT 'Nigeria (National Average)',
      source      VARCHAR(100)  DEFAULT 'NBS',
      updated_at  TIMESTAMPTZ   DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS market_prices_history (
      id          SERIAL PRIMARY KEY,
      item_name   VARCHAR(200) NOT NULL,
      price       NUMERIC(12,2) NOT NULL,
      unit        VARCHAR(50),
      source      VARCHAR(100),
      recorded_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_prices_history_lookup
      ON market_prices_history (item_name, recorded_at DESC);
  `).catch(err => console.warn('[PricesBot] Table setup:', err.message));
}

async function findLatestReportId() {
  const res = await fetch(NBS_SEARCH_URL, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`NBS elibrary returned ${res.status}`);
  const html = await res.text();

  const matches = [...html.matchAll(/elibrary\/read\/(\d+)/g)];
  if (!matches.length) throw new Error('No report links found on NBS elibrary page');

  const ids = matches.map(m => parseInt(m[1])).sort((a, b) => b - a);
  console.log(`[PricesBot] Found ${ids.length} NBS reports. Latest ID: ${ids[0]}`);
  return ids[0];
}

async function alreadyImported(reportId) {
  const res = await pool.query(
    `SELECT 1 FROM market_prices WHERE source = $1 LIMIT 1`,
    [`NBS-${reportId}`]
  );
  return res.rows.length > 0;
}

async function fetchReportPage(reportId) {
  const res = await fetch(`${NBS_BASE}/elibrary/read/${reportId}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`Report page returned ${res.status}`);
  return res.text();
}

function parsePricesFromHtml(html) {
  // Extract price rows from HTML tables
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const items = [];
  const seen = new Set();

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map(c => c[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim())
      .filter(Boolean);

    if (cells.length < 2) continue;

    const itemName = cells[0];
    if (!itemName || itemName.length < 3 || itemName.length > 150) continue;
    if (seen.has(itemName.toLowerCase())) continue;

    // Find a cell that looks like a price
    const priceCell = cells.slice(1).find(c => /^\d[\d,\.]*$/.test(c.replace(/[₦,\s]/g, '')));
    if (!priceCell) continue;

    const price = parseFloat(priceCell.replace(/[₦,\s]/g, ''));
    if (isNaN(price) || price <= 0 || price > 500000) continue;

    const unitCell = cells.find(c => /\b(kg|litre|liter|piece|bunch|tuber|bag|wrap|paint|mudu|paint)\b/i.test(c));
    const unit = unitCell || 'unit';

    seen.add(itemName.toLowerCase());
    items.push({ itemName, price, unit, location: 'Nigeria (National Average)' });
  }

  return items;
}

async function upsertPrices(items, reportId) {
  let inserted = 0;
  for (const item of items) {
    try {
      // Upsert current price
      await pool.query(
        `INSERT INTO market_prices (item_name, price, unit, location, source, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (item_name) DO UPDATE SET
           price      = EXCLUDED.price,
           unit       = EXCLUDED.unit,
           location   = EXCLUDED.location,
           source     = EXCLUDED.source,
           updated_at = NOW()`,
        [item.itemName, item.price, item.unit, item.location, `NBS-${reportId}`]
      );

      // Append to history
      await pool.query(
        `INSERT INTO market_prices_history (item_name, price, unit, source, recorded_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [item.itemName, item.price, item.unit, `NBS-${reportId}`]
      );

      inserted++;
    } catch (err) {
      console.warn(`[PricesBot] Failed to upsert "${item.itemName}":`, err.message);
    }
  }

  // Purge history older than 90 days
  const purged = await pool.query(
    `DELETE FROM market_prices_history WHERE recorded_at < NOW() - INTERVAL '90 days'`
  );
  if (purged.rowCount > 0) {
    console.log(`[PricesBot] Purged ${purged.rowCount} old history rows.`);
  }

  return inserted;
}

async function runPricesCheck() {
  try {
    console.log('[PricesBot] Checking for new NBS food price report...');

    const latestId = await findLatestReportId();
    if (!latestId) return;

    if (await alreadyImported(latestId)) {
      console.log(`[PricesBot] Report NBS-${latestId} already imported. Nothing to do.`);
      return;
    }

    console.log(`[PricesBot] New report found: NBS-${latestId}. Fetching...`);
    const html = await fetchReportPage(latestId);
    const items = parsePricesFromHtml(html);

    if (items.length === 0) {
      // Honest failure — log clearly, do not seed fake data
      console.warn(`[PricesBot] ⚠️ Could not parse price data from NBS-${latestId}.`);
      console.warn('[PricesBot] The report may be a PDF or ZIP requiring manual parsing.');
      console.warn('[PricesBot] No data written. Will retry next week.');
      return;
    }

    const inserted = await upsertPrices(items, latestId);
    console.log(`[PricesBot] ✅ Imported ${inserted} commodity prices from NBS-${latestId}.`);

  } catch (err) {
    console.error('[PricesBot] ❌ Run failed:', err.message);
  }
}

function initPricesBot(sharedPool) {
  pool = sharedPool;
  console.log('[PricesBot] Initialized — checking weekly for new NBS reports.');
  ensureTable().then(() => {
    runPricesCheck();
    // Every Sunday 06:00 UTC
    cron.schedule('0 6 * * 0', runPricesCheck);
  });
}

module.exports = { initPricesBot };
