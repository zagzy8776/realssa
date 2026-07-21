/**
 * ratesBot.js — Official Exchange Rate Bot
 * Source: open.er-api.com (free, no key, no ToS issues)
 * Cadence: every 6 hours
 * Currencies: USD, GBP, EUR, ZAR, GHS, KES vs NGN
 * Schema: rolling history — upsert current + keep 90 days, purge older
 * Label: "CBN Official Rate" — not parallel/street rate
 */

const cron = require('node-cron');

const ER_API_URL = 'https://open.er-api.com/v6/latest/NGN';
const CURRENCIES = ['USD', 'GBP', 'EUR', 'ZAR', 'GHS', 'KES'];

let pool;

async function ensureTable() {
  // Two tables:
  // parallel_rates — current snapshot (one row per currency, upserted in place)
  // parallel_rates_history — rolling 90-day history for trend lines
  await pool.query(`
    CREATE TABLE IF NOT EXISTS parallel_rates (
      currency    VARCHAR(10) PRIMARY KEY,
      buy_rate    NUMERIC(12,2) NOT NULL,
      sell_rate   NUMERIC(12,2) NOT NULL,
      mid_rate    NUMERIC(12,2) NOT NULL,
      source      VARCHAR(100) DEFAULT 'CBN Official Rate',
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS parallel_rates_history (
      id          SERIAL PRIMARY KEY,
      currency    VARCHAR(10) NOT NULL,
      mid_rate    NUMERIC(12,2) NOT NULL,
      source      VARCHAR(100) DEFAULT 'CBN Official Rate',
      recorded_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_rates_history_lookup
      ON parallel_rates_history (currency, recorded_at DESC);
  `).catch(err => console.warn('[RatesBot] Table setup:', err.message));
}

async function fetchRates() {
  try {
    console.log('[RatesBot] Fetching official exchange rates...');

    const res = await fetch(ER_API_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`ExchangeRate-API returned ${res.status}`);

    const data = await res.json();
    if (data.result !== 'success') throw new Error(`API error: ${data['error-type']}`);

    for (const currency of CURRENCIES) {
      const ratePerNgn = data.rates[currency];
      if (!ratePerNgn || ratePerNgn === 0) {
        console.warn(`[RatesBot] No rate found for ${currency} — skipping`);
        continue;
      }

      // Invert: data gives NGN-per-unit as 1/ratePerNgn
      const mid = parseFloat((1 / ratePerNgn).toFixed(2));
      const buy = parseFloat((mid * 0.995).toFixed(2));  // 0.5% spread
      const sell = parseFloat((mid * 1.005).toFixed(2));

      // Upsert current snapshot
      await pool.query(
        `INSERT INTO parallel_rates (currency, buy_rate, sell_rate, mid_rate, source, updated_at)
         VALUES ($1, $2, $3, $4, 'CBN Official Rate', NOW())
         ON CONFLICT (currency) DO UPDATE SET
           buy_rate   = EXCLUDED.buy_rate,
           sell_rate  = EXCLUDED.sell_rate,
           mid_rate   = EXCLUDED.mid_rate,
           source     = EXCLUDED.source,
           updated_at = NOW()`,
        [currency, buy, sell, mid]
      );

      // Append to history
      await pool.query(
        `INSERT INTO parallel_rates_history (currency, mid_rate, source, recorded_at)
         VALUES ($1, $2, 'CBN Official Rate', NOW())`,
        [currency, mid]
      );

      console.log(`[RatesBot] ${currency}/NGN — Mid: ₦${mid} | Buy: ₦${buy} | Sell: ₦${sell}`);
    }

    // Purge history older than 90 days
    const purged = await pool.query(
      `DELETE FROM parallel_rates_history WHERE recorded_at < NOW() - INTERVAL '90 days'`
    );
    if (purged.rowCount > 0) {
      console.log(`[RatesBot] Purged ${purged.rowCount} old history rows.`);
    }

    console.log('[RatesBot] ✅ Rates updated.');
  } catch (err) {
    console.error('[RatesBot] ❌ Failed:', err.message);
  }
}

function initRatesBot(sharedPool) {
  pool = sharedPool;
  console.log('[RatesBot] Initialized — polling every 6 hours.');
  ensureTable().then(() => {
    fetchRates();
    cron.schedule('0 */6 * * *', fetchRates);
  });
}

module.exports = { initRatesBot };
