/**
 * Crypto Live Feed — real-time price engine
 *
 * Primary: Binance public WebSocket (no API key) streaming bookTicker
 *          updates applied to a CoinGecko REST price baseline.
 * Fallback: 60s REST re-seed if the WebSocket is unavailable.
 *
 * Also tracks the Crypto Fear & Greed index (alternative.me, 1/min max).
 * Exposes:
 *   - subscribe(cb)         : register for real-time tick callbacks
 *   - getSnapshot()         : current prices + fear/greed + 24h stats
 *   - getCorrelatedNews()   : articles whose title mentions a moving coin
 *                             (the "Correlated News" markets→news bridge)
 */

const { pgSelect } = require('./pg');

// Lightweight namespaced logger (project logger.js is a static metrics class)
const LOG = {
  info: (m) => console.log(`[CryptoLive] ${m}`),
  warn: (m) => console.warn(`[CryptoLive] ${m}`),
  error: (m) => console.error(`[CryptoLive] ${m}`),
};
const WS_URL = 'wss://stream.binance.com:9443/stream';
const FEAR_GREED_URL = 'https://api.alternative.me/fng/?limit=1';
const REST_POLL_MS = 60 * 1000;
const USE_WS = process.env.CRYPTO_WS !== '0';

const SYMBOLS = [
  { ws: 'btcusdt', symbol: 'BTC', name: 'Bitcoin', newsKeywords: ['bitcoin', 'btc', 'satoshi'] },
  { ws: 'ethusdt', symbol: 'ETH', name: 'Ethereum', newsKeywords: ['ethereum', 'ether'] },
  { ws: 'solusdt', symbol: 'SOL', name: 'Solana', newsKeywords: ['solana'] },
  { ws: 'xrpusdt', symbol: 'XRP', name: 'XRP', newsKeywords: ['xrp', 'ripple'] },
  { ws: 'dogeusdt', symbol: 'DOGE', name: 'Dogecoin', newsKeywords: ['dogecoin', 'doge'] },
  { ws: 'bnbusdt', symbol: 'BNB', name: 'BNB', newsKeywords: ['bnb', 'binance'] },
];

// state: { [symbol]: { price, prevPrice, change24h, volume24h, lastTick, sparkline[] } }
const state = new Map();
const listeners = new Set();
let fearGreed = { value: null, classification: null, updated_at: null };
let ws = null;
let restTimer = null;
let fngTimer = null;

function tick() {
  const snap = getSnapshot();
  for (const cb of listeners) {
    try { cb(snap); } catch (e) { /* listener error — ignore */ }
  }
}

/**
 * Seed baseline prices + 24h stats from CoinGecko REST (no key needed).
 */
async function seedFromRest() {
  try {
    const ids = 'bitcoin,ethereum,solana,ripple,dogecoin,binancecoin';
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`,
      { headers: { 'User-Agent': 'RealSSA-CryptoLive/1.0' }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return false;
    const data = await res.json();
    const map = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', ripple: 'XRP', dogecoin: 'DOGE', binancecoin: 'BNB' };
    for (const [id, sym] of Object.entries(map)) {
      const row = data[id];
      if (!row || !row.usd) continue;
      const existing = state.get(sym) || {};
      state.set(sym, {
        symbol: sym,
        price: row.usd,
        prevPrice: existing.price || row.usd,
        change24h: row.usd_24h_change ?? null,
        volume24h: row.usd_24h_vol ?? null,
        lastTick: Date.now(),
        sparkline: existing.sparkline || [],
      });
    }
    tick();
    return state.size > 0;
  } catch (err) {
    LOG.warn(`CoinGecko seed failed: ${err.message}`);
    return false;
  }
}

/**
 * Connect to the Binance combined stream. Reconnects with backoff.
 */
async function connectWS() {
  if (!USE_WS) return;
  try {
    const WS = require('ws');
    ws = new WS(`${WS_URL}?streams=${SYMBOLS.map((s) => `${s.ws}@bookTicker`).join('/')}`);
    const symMap = Object.fromEntries(SYMBOLS.map((s) => [s.ws, s.symbol]));

    ws.on('open', () => LOG.info('Binance WS connected'));
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const data = msg.data || {};
        const m = String(msg.stream || '').match(/^(.*)@bookTicker$/);
        if (!m || !data.p) return;
        const sym = symMap[m[1]];
        if (!sym) return;
        const price = parseFloat(data.p);
        const st = state.get(sym);
        if (!st) return;
        st.prevPrice = st.price;
        st.price = price;
        st.lastTick = Date.now();
        st.sparkline.push(price);
        if (st.sparkline.length > 60) st.sparkline.shift();
        tick();
      } catch (e) { /* malformed frame — ignore */ }
    });
    ws.on('close', () => {
      LOG.warn('Binance WS closed — reconnect in 5s');
      setTimeout(() => connectWS().catch(() => {}), 5000);
    });
    ws.on('error', (err) => LOG.warn(`Binance WS error: ${err.message}`));
  } catch (err) {
    LOG.warn(`WS connect failed (REST fallback active): ${err.message}`);
  }
}

/**
 * Fetch the Fear & Greed index (at most once per minute).
 */
async function fetchFearGreed() {
  try {
    const res = await fetch(
      FEAR_GREED_URL,
      { headers: { 'User-Agent': 'RealSSA-CryptoLive/1.0' }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return;
    const data = await res.json();
    const row = data?.data?.[0];
    if (row) {
      fearGreed = {
        value: parseInt(row.value, 10),
        classification: row.value_classification,
        updated_at: new Date(parseInt(row.timestamp, 10) * 1000).toISOString(),
      };
      tick();
    }
  } catch (err) {
    LOG.warn(`Fear&Greed fetch failed: ${err.message}`);
  }
}

/**
 * Build the public snapshot consumed by the frontend.
 */
function getSnapshot() {
  const coins = [];
  for (const def of SYMBOLS) {
    const st = state.get(def.symbol);
    if (!st) continue;
    const tickChange = st.price > 0 && st.prevPrice > 0
      ? Math.round(((st.price - st.prevPrice) / st.prevPrice) * 100000) / 1000
      : 0;
    coins.push({
      symbol: def.symbol,
      name: def.name,
      price: st.price,
      change24h: st.change24h,
      tickChange,
      volume24h: st.volume24h,
      sparkline: st.sparkline.slice(-30),
      lastTick: st.lastTick,
      stale: Date.now() - st.lastTick > 120000,
    });
  }
  return { coins, fearGreed, updatedAt: new Date().toISOString() };
}

/**
 * Correlated News bridge: articles whose title mentions a moving coin,
 * weighted by that coin's 24h move. Powers the "Correlated News" link
 * between markets and the news feed.
 */
async function getCorrelatedNews(limit = 8) {
  try {
    const movers = SYMBOLS
      .map((def) => ({ def, st: state.get(def.symbol) }))
      .filter((x) => x.st && x.st.price > 0)
      .map((x) => ({ ...x, absMove: Math.abs(x.st.change24h || 0) }))
      .sort((a, b) => b.absMove - a.absMove)
      .slice(0, 3);

    if (!movers.length) return [];
    const params = [];
    const clauses = [];
    for (const m of movers) {
      for (const k of m.def.newsKeywords) {
        params.push(`%${k.trim()}%`);
        clauses.push(`lower(title) LIKE $${params.length}`);
      }
    }
    const rows = await pgSelect(
      `SELECT id, title, category, image, external_link, published_at,
              COALESCE(ai_summary, original_excerpt, '') AS excerpt
       FROM rss_articles
       WHERE published_at > NOW() - INTERVAL '12 hours' AND (${clauses.join(' OR ')})
       ORDER BY published_at DESC LIMIT ${Math.min(limit, 20)}`,
      params
    );
    return rows.slice(0, limit).map((r) => {
      const title = String(r.title || '').toLowerCase();
      const matched = movers.find((m) => m.def.newsKeywords.some((k) => title.includes(k)));
      return {
        ...r,
        symbol: matched ? matched.def.symbol : null,
        coin_move: matched ? matched.st.change24h : null,
      };
    });
  } catch (err) {
    LOG.warn(`Correlated news query failed: ${err.message}`);
    return [];
  }
}

function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function start() {
  seedFromRest().then((ok) => { if (ok) connectWS(); });
  fetchFearGreed();
  restTimer = setInterval(() => { seedFromRest().catch(() => {}); }, REST_POLL_MS);
  fngTimer = setInterval(fetchFearGreed, 60 * 1000);
  if (restTimer.unref) restTimer.unref();
  if (fngTimer.unref) fngTimer.unref();
  LOG.info('Crypto live feed started');
}

function stop() {
  if (restTimer) clearInterval(restTimer);
  if (fngTimer) clearInterval(fngTimer);
  if (ws) { try { ws.close(); } catch (e) {} }
  listeners.clear();
}

module.exports = { start, stop, subscribe, getSnapshot, getCorrelatedNews, SYMBOLS };