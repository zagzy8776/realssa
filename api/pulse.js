/**
 * RealSSA Pulse — Unified Neural Ticker Endpoint (GET /api/pulse)
 * One payload feeds the Pulse Bar, Markets and Crypto surfaces:
 *   • Parallel FX rates   — our own scraped parallel_rates table (our data)
 *   • Live crypto prices  — CoinGecko, 60s instance-cached
 *   • Weather             — wttr.in, 15min cached per city, geo-aware via ?city=
 *   • Breaking headline   — freshest featured story from rss_articles
 *   • Fear & Greed Index  — computed from crypto momentum + Naira movement
 * Never 500s: every subsystem degrades independently so the bar always renders.
 */

const { Pool } = require('pg');

let pool = null;
function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  pool = new Pool({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 8000,
  });
  pool.on('error', () => {});
  return pool;
}

const RATES_TTL = 30 * 1000;
const CRYPTO_TTL = 60 * 1000;
const WEATHER_TTL = 15 * 60 * 1000;
const NEG_TTL = 2 * 60 * 1000;

const memRates = { data: null, at: 0 };
const memCrypto = { data: null, at: 0 };
const memWeather = new Map(); // city -> { data, at, neg }

const CRYPTO_IDS = [
  ['bitcoin', 'BTC', 'Bitcoin'],
  ['ethereum', 'ETH', 'Ethereum'],
  ['tether', 'USDT', 'Tether'],
  ['binancecoin', 'BNB', 'BNB'],
  ['solana', 'SOL', 'Solana'],
  ['ripple', 'XRP', 'XRP'],
  ['dogecoin', 'DOGE', 'Dogecoin'],
];

const CRYPTO_FALLBACK = [
  { symbol: 'BTC', name: 'Bitcoin', price: 67240.5, change24h: 0.4 },
  { symbol: 'ETH', name: 'Ethereum', price: 3480.2, change24h: -0.6 },
  { symbol: 'USDT', name: 'Tether', price: 1.0, change24h: 0.0 },
  { symbol: 'BNB', name: 'BNB', price: 592.3, change24h: 0.9 },
  { symbol: 'SOL', name: 'Solana', price: 172.8, change24h: 1.6 },
  { symbol: 'XRP', name: 'XRP', price: 0.62, change24h: -1.2 },
  { symbol: 'DOGE', name: 'Dogecoin', price: 0.14, change24h: 2.1 },
];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function fetchJson(url, timeoutMs = 6000) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RealSSA-Pulse/1.0 (+https://realssanews.com.ng)', Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Parallel FX (our own scraped table) ────────────────────────────────────
async function getRates() {
  if (memRates.data && Date.now() - memRates.at < RATES_TTL) return memRates.data;
  const db = getPool();
  if (!db) return memRates.data || [];
  try {
    const { rows } = await db.query('SELECT * FROM parallel_rates ORDER BY updated_at DESC LIMIT 80');
    const seen = new Set();
    const rates = [];
    for (const r of rows || []) {
      const currency = String(r.currency || '').toUpperCase();
      if (!currency || seen.has(currency)) continue;
      seen.add(currency);
      const buy = num(r.buy_rate ?? r.street_buy ?? r.buy);
      const sell = num(r.sell_rate ?? r.street_sell ?? r.sell);
      const mid = num(r.mid_rate) || (buy && sell ? (buy + sell) / 2 : buy || sell);
      if (!mid) continue;
      rates.push({ currency, buy, sell, mid: Math.round(mid * 100) / 100, changePct: 0 });
    }
    // 24h direction from our own history table (best-effort)
    try {
      const h = await db.query(
        `SELECT DISTINCT ON (currency) currency, mid_rate FROM parallel_rates_history
         WHERE recorded_at > NOW() - INTERVAL '26 hours' ORDER BY currency, recorded_at ASC`
      );
      const prev = new Map((h.rows || []).map(x => [String(x.currency).toUpperCase(), num(x.mid_rate)]));
      for (const r of rates) {
        const p = prev.get(r.currency);
        if (p && r.mid) r.changePct = Math.round(((r.mid - p) / p) * 1000) / 10;
      }
    } catch {}
    memRates.data = rates;
    memRates.at = Date.now();
    return rates;
  } catch (err) {
    console.warn('[Pulse] rates failed:', err.message);
    return memRates.data || [];
  }
}

// __PULSE_PART2__
