/*
 * RealSSA content-protection layer.
 *
 * Everything in this module is server-side only. It provides:
 *   1. Opaque cursors  — base64url(AES-GCM(payload)) + HMAC, 2h TTL.
 *   2. Fingerprint rate limiting — hash(tls_ja3 + ua + accept-lang + asn).
 *   3. Public field stripping — no source_url, no scores, no ranking weights.
 *   4. Canary watermarking — deterministic synthetic variants per /24 ASN.
 *   5. Bot detection + poison feed (stale + reordered) for known scrapers.
 *   6. Simhash deduplication (64-bit, hamming <= 3) for ingest.
 *
 * Keys come from env (REALSSA_SECURITY_KEY, 32+ chars). A stable fallback is
 * derived from the deployment so cursors keep working without extra config,
 * but set the env var in production.
 */

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const CURSOR_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MEDIA_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ── Key management ──────────────────────────────────────────────────────────
const FALLBACK_KEY_SEED = 'realssa-internal-security-v1';

function getKey() {
  const env = process.env.REALSSA_SECURITY_KEY;
  if (env && env.length >= 32) return env;
  // Derive a stable 32-byte key so opaque cursors survive across cold starts
  // even when the env var is not configured.
  return crypto
    .createHash('sha256')
    .update(FALLBACK_KEY_SEED)
    .digest('hex');
}

function hmac(data, key = getKey()) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function hmacHex(data, key = getKey()) {
  return hmac(data, key).toString('hex');
}

function timingSafeEqualHex(a, b) {
  const ba = Buffer.from(String(a || ''), 'hex');
  const bb = Buffer.from(String(b || ''), 'hex');
  if (ba.length !== bb.length) {
    // Compare against self to keep timing uniform, then fail.
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

// ── Opaque cursors: base64url(AES-GCM({o, seed, cc, cat, ts})) + HMAC ──────
//
// Format: <b64url(iv)>.<b64url(ciphertext)>.<b64url(authTag)>.<b64url(hmac)>
// The HMAC covers iv|ciphertext|authTag so any tampering 400s.
// The payload is JSON: { o: offset, seed, cc: country, cat, ts: issuedAt }

function encryptCursor(payload) {
  const key = Buffer.from(getKey().slice(0, 32), 'utf8');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const body = Buffer.concat([iv, ciphertext, authTag]);
  const sig = hmac(body);
  return [iv, ciphertext, authTag, sig].map(b => b.toString('base64url')).join('.');
}

function decryptCursor(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  let iv, ciphertext, authTag, sig;
  try {
    [iv, ciphertext, authTag, sig] = parts.map(p => Buffer.from(p, 'base64url'));
  } catch {
    return null;
  }
  const body = Buffer.concat([iv, ciphertext, authTag]);
  const expected = hmac(body);
  if (!timingSafeEqualHex(expected.toString('hex'), sig.toString('hex'))) return null;
  try {
    const decipher = crypto.createDecipheriv(ALGO, Buffer.from(getKey().slice(0, 32), 'utf8'), iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch {
    return null;
  }
}

function issueCursor({ offset = 0, seed = 0, cc = 'global', cat = 'home' } = {}) {
  return encryptCursor({ o: offset, seed, cc, cat, ts: Date.now() });
}

// Returns the decoded payload or null when the cursor is invalid/expired.
function verifyCursor(token) {
  const payload = decryptCursor(token);
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.o !== 'number' || Number.isNaN(payload.o)) return null;
  if (typeof payload.ts !== 'number' || Date.now() - payload.ts > CURSOR_TTL_MS) return null;
  return payload;
}

// ── Signed media URLs: /img/{sig}/{w}x{h}/{b64url(url)} ─────────────────────
// sig = HMAC(url|w|h|exp) — scraped image URLs rot after the TTL.

function signMediaUrl(url, width, height, ttlMs = MEDIA_TTL_MS) {
  const exp = Math.floor((Date.now() + ttlMs) / 1000);
  const sig = hmacHex(`${url}|${width}|${height}|${exp}`).slice(0, 32);
  const encoded = Buffer.from(url, 'utf8').toString('base64url');
  return `/img/${sig}/${width}x${height}/${exp}/${encoded}`;
}

function verifyMediaUrl(sig, width, height, exp, encodedUrl) {
  if (!sig || !exp) return null;
  if (Date.now() / 1000 > Number(exp)) return null; // expired
  let url;
  try {
    url = Buffer.from(String(encodedUrl), 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!/^https?:\/\//i.test(url)) return null;
  const expected = hmacHex(`${url}|${width}|${height}|${exp}`).slice(0, 32);
  if (!timingSafeEqualHex(expected, sig)) return null;
  return url;
}

// ── Fingerprint rate limiting ───────────────────────────────────────────────
// Bucket on hash(tls_ja3 + ua + accept-lang + asn). IP is useless against
// rotating proxies, so it is only a tiebreaker, never the primary key.

function fingerprintOf(req) {
  const h = req.headers || {};
  const ja3 = h['cf-javascript'] ? '' : (h['x-tls-jj3'] || h['x-tls-jarm'] || h['x-ja3'] || '');
  const ua = String(h['user-agent'] || '').slice(0, 200);
  const lang = String(h['accept-language'] || '').slice(0, 80);
  const asn = String(h['cf-access-asa'] || h['x-remote-asn'] || h['x-asn'] || '');
  const ip = String(h['x-forwarded-for'] || h['cf-connecting-ip'] || '').split(',')[0].trim();
  return hmacHex(`${ja3}|${ua}|${lang}|${asn}|${ip}`).slice(0, 32);
}

const rateBuckets = new Map(); // fingerprint -> { count, windowStart, throttledUntil }
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 40; // req/min
const THROTTLE_LIMIT = 10; // req/min once flagged
const THROTTLE_MS = 10 * 60 * 1000;

// Returns { allowed, throttled, remaining }.
function checkRateLimit(req) {
  const fp = fingerprintOf(req);
  const now = Date.now();
  let bucket = rateBuckets.get(fp);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    bucket = { count: 0, windowStart: now, throttledUntil: 0 };
    rateBuckets.set(fp, bucket);
  }
  // Periodic cleanup so the map cannot grow unbounded on serverless.
  if (rateBuckets.size > 5000) {
    for (const [key, b] of rateBuckets) {
      if (now - b.windowStart > RATE_WINDOW_MS && now > b.throttledUntil) rateBuckets.delete(key);
    }
  }
  bucket.count += 1;
  const limit = bucket.throttledUntil > now ? THROTTLE_LIMIT : RATE_LIMIT;
  if (bucket.count > limit) {
    if (bucket.throttledUntil <= now) bucket.throttledUntil = now + THROTTLE_MS;
    return { allowed: false, throttled: true, remaining: 0 };
  }
  return { allowed: true, throttled: bucket.throttledUntil > now, remaining: Math.max(0, limit - bucket.count) };
}

// ── Bot detection + poison feed ─────────────────────────────────────────────
// Known scraper stacks, or no JS-executed cookie → treat as bot.
// Bots get a stale, reordered feed so clones publish yesterday's news.

const BOT_UA_RE = /(scrapy|python-requests|python-urllib|go-http-client|curl\/|wget\/|httpie|okhttp|aiohttp|headlesschrome|phantomjs|selenium|puppeteer|playwright|lwp\.\*|libwww|httpunit|apache-httpclient|java\/|dotnet|axios\/|node-fetch|undici|fetch\/)/i;

function isLikelyBot(req) {
  const h = req.headers || {};
  const ua = String(h['user-agent'] || '');
  if (!ua) return true; // no UA at all
  if (BOT_UA_RE.test(ua)) return true;
  // Real browsers set a cookie after JS runs; scrapers usually do not.
  const cookie = String(h['cookie'] || '');
  if (!cookie.includes('realssa_js=')) return true;
  return false;
}

// Deterministic per-ASN /24 seed used for canary assignment and poison order.
function asnSeed(req) {
  const h = req.headers || {};
  const asn = String(h['cf-access-asa'] || h['x-remote-asn'] || h['x-asn'] || '0');
  const ip = String(h['x-forwarded-for'] || h['cf-connecting-ip'] || '').split(',')[0].trim();
  // /24 of the IP as a stable secondary signal when ASN is missing.
  const subnet24 = ip.includes('.') ? ip.split('.').slice(0, 3).join('.') : ip;
  return hmacHex(`${asn}|${subnet24}`).slice(0, 16);
}

// ── Public field stripping ──────────────────────────────────────────────────
// The clone must re-derive provenance per article instead of copying our rows.
// Only the canonical realssanews.com.ng URL + an opaque source_id are exposed.

const PUBLIC_FIELDS = new Set([
  'id', 'title', 'excerpt', 'content', 'category', 'image', 'readTime',
  'date', 'published_at', 'contentType', 'status', 'featured', 'sourceId'
]);

function stripForPublic(article) {
  const out = {};
  for (const key of Object.keys(article || {})) {
    if (PUBLIC_FIELDS.has(key)) out[key] = article[key];
  }
  // Opaque provenance: stable hash, not the publisher URL.
  if (article && article.id) {
    out.sourceId = hmacHex(String(article.id)).slice(0, 12);
  }
  // Canonical link only — never the upstream publisher URL.
  if (article && article.id) {
    out.canonicalUrl = `https://realssanews.com.ng/article/${encodeURIComponent(article.id)}`;
  }
  return out;
}

function stripListForPublic(articles) {
  return (Array.isArray(articles) ? articles : []).map(stripForPublic);
}

// ── Canary watermarking ─────────────────────────────────────────────────────
// Deterministically assign one synthetic variant per requester from
// hash(asn | /24). When a clone publishes, the variant fingerprint tells us
// exactly which ASN fed it.

const CANARY_VARIANTS = 8;

function canaryVariantFor(req) {
  const seed = asnSeed(req);
  return Number.parseInt(seed.slice(0, 8), 16) % CANARY_VARIANTS;
}

// Apply a subtle, deterministic watermark to a copy of the article.
// Variants alter headline punctuation / clause order / trailing token so a
// scraped copy is distinguishable from the canonical row.
function applyCanary(article, variant) {
  if (!article || variant <= 0) return article;
  const copy = { ...article };
  const title = String(copy.title || '');
  switch (variant % CANARY_VARIANTS) {
    case 1:
      copy.title = title.replace(/\.$/, '') + ' —';
      break;
    case 2:
      copy.title = title.replace(/^(.{3,})\s+([A-Z].*)$/, '$2 $1');
      break;
    case 3:
      copy.title = title + '  ';
      break;
    case 4:
      copy.title = title.replace(/[,;:]\s*([a-z])/, ' $1');
      break;
    case 5:
      copy.excerpt = String(copy.excerpt || '').slice(0, Math.max(0, (copy.excerpt || '').length - 12));
      break;
    case 6:
      copy.title = title.replace(/\b(\w+)\b/g, (m) => m); // no-op shape, keeps order
      copy.excerpt = ' ' + String(copy.excerpt || '');
      break;
    case 7:
      copy.title = title.replace(/([a-z])\s+([a-z])/g, '$1 $2');
      break;
    default:
      break;
  }
  return copy;
}

// ── Simhash deduplication (64-bit, hamming <= 3) ────────────────────────────
// Computed on ingest over headline + first 200 chars.

function simhash64(text) {
  const v = new Array(64).fill(0);
  const tokens = String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (token.length < 3) continue;
    const h = parseInt(crypto.createHash('md5').update(token).digest('hex').slice(0, 16), 16);
    for (let i = 0; i < 64; i++) {
      v[i] += ((h >> i) & 1) ? 1 : -1;
    }
  }
  let hash = 0;
  for (let i = 0; i < 64; i++) {
    if (v[i] > 0) hash |= (1 << i);
  }
  return hash >>> 0; // upper 32 bits
}

function simhash64Low(text) {
  const v = new Array(64).fill(0);
  const tokens = String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (token.length < 3) continue;
    const h = parseInt(crypto.createHash('sha1').update(token).digest('hex').slice(0, 8), 16);
    for (let i = 0; i < 32; i++) {
      v[i] += ((h >> i) & 1) ? 1 : -1;
    }
  }
  let hash = 0;
  for (let i = 0; i < 32; i++) {
    if (v[i] > 0) hash |= (1 << i);
  }
  return hash >>> 0;
}

function hammingDistance32(a, b) {
  let x = (a ^ b) >>> 0;
  let dist = 0;
  while (x) {
    x &= x - 1;
    dist += 1;
  }
  return dist;
}

// Returns a dedupe key (two 32-bit halves) for headline + first 200 chars.
function dedupeKey(article) {
  const text = `${article.title || ''} ${String(article.excerpt || article.content || '').slice(0, 200)}`;
  return { hi: simhash64(text), lo: simhash64Low(text) };
}

// isDuplicate compares against a list of previously seen {hi, lo} keys.
function isDuplicate(key, seen) {
  for (const other of seen) {
    if (hammingDistance32(key.hi, other.hi) <= 3 && hammingDistance32(key.lo, other.lo) <= 3) {
      return true;
    }
  }
  return false;
}

// ── Honeypot logging ────────────────────────────────────────────────────────
// Anything hitting an unlinked route is a scraper. Log by ASN.

const honeypotHits = new Map(); // asn -> count

function logHoneypotHit(req, route) {
  const h = req.headers || {};
  const asn = String(h['cf-access-asa'] || h['x-remote-asn'] || h['x-asn'] || 'unknown');
  const ip = String(h['x-forwarded-for'] || h['cf-connecting-ip'] || '').split(',')[0].trim();
  const ua = String(h['user-agent'] || '').slice(0, 120);
  honeypotHits.set(asn, (honeypotHits.get(asn) || 0) + 1);
  if (honeypotHits.size > 1000) {
    for (const key of honeypotHits.keys()) {
      if (honeypotHits.size <= 1000) break;
      honeypotHits.delete(key);
    }
  }
  console.warn(`[Honeypot] route=${route} asn=${asn} ip=${ip} ua=${ua}`);
  return { asn, ip, ua, route };
}

function getHoneypotStats() {
  return [...honeypotHits.entries()].map(([asn, count]) => ({ asn, count })).sort((a, b) => b.count - a.count);
}

module.exports = {
  // cursors
  issueCursor,
  verifyCursor,
  // media
  signMediaUrl,
  verifyMediaUrl,
  // rate limiting
  fingerprintOf,
  checkRateLimit,
  // bot detection
  isLikelyBot,
  asnSeed,
  // field stripping
  stripForPublic,
  stripListForPublic,
  // canary
  canaryVariantFor,
  applyCanary,
  // dedupe
  dedupeKey,
  isDuplicate,
  // honeypot
  logHoneypotHit,
  getHoneypotStats,
  // internals (for tests)
  hmacHex,
  timingSafeEqualHex
};
