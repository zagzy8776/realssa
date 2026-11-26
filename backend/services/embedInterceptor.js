/**
 * Task 7: Embed Interceptor
 * -------------------------
 * Replaces fragile iframe parsing with headless-browser network interception.
 *
 * Given an embed URL (e.g. https://embed.st/embed/<provider>/<id>/1), open it in
 * headless Chromium, let the embedded player boot, and capture the first
 * .m3u8 / .mpd request the page makes. That direct manifest URL is what OUR
 * native HLS player needs -- no iframe, no third-party chrome, no pop-up ads.
 *
 * Design notes:
 *  - Optional: if Playwright is not installed (or PLAYWRIGHT_AVAILABLE is not
 *    "true"), every call resolves to null so callers keep their existing
 *    iframe/embed fallback. Nothing breaks when the browser is absent.
 *  - Redis-cached per embed URL (short TTL) so 600k viewers do not each boot a
 *    browser for the same fixture.
 *  - One shared browser instance, one context per call, always closed.
 *  - Hard concurrency cap + timeout so a hung embed cannot wedge the API.
 */

const redisService = require('./redisService');

const CACHE_PREFIX = 'sports:embed-intercept:v1:';
const CACHE_TTL = 240;                 // 4 minutes — a live embed URL is stable per fixture
const DEFAULT_TIMEOUT_MS = 12000;      // total budget for one embed
const DEFAULT_MAX_CONCURRENT = 3;      // never boot more than 3 browsers at once
const MAX_DISCOVERED = 4;              // keep the top few manifests we saw

const STREAM_URL_RE = /\.(m3u8|mpd)(?:[?#].*)?$/i;

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ── State ───────────────────────────────────────────────────────────────────
let sharedBrowser = null;
let browserLaunchFailed = false;
const stats = { attempts: 0, hits: 0, cacheHits: 0, failures: 0, timeouts: 0 };

function isEnabled() {
  const flag = String(process.env.PLAYWRIGHT_AVAILABLE || '').toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

/** True when Playwright is installed AND the feature flag is on. */
function isAvailable() {
  if (!isEnabled()) return false;
  try {
    require.resolve('playwright');
    return true;
  } catch {
    try {
      require.resolve('playwright-extra');
      return true;
    } catch {
      return false;
    }
  }
}

function getMaxConcurrent() {
  const n = parseInt(process.env.EMBED_INTERCEPT_MAX_CONCURRENT || '', 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_CONCURRENT;
}

function getTimeoutMs() {
  const n = parseInt(process.env.EMBED_INTERCEPT_TIMEOUT_MS || '', 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

/** Resolve the chromium launcher, preferring playwright-extra + stealth. */
function getChromium() {
  try {
    const extra = require('playwright-extra');
    try {
      extra.chromium.use(require('puppeteer-extra-plugin-stealth')());
    } catch { /* stealth plugin optional */ }
    return extra.chromium;
  } catch {
    return require('playwright').chromium;
  }
}

async function getBrowser() {
  if (sharedBrowser && typeof sharedBrowser.isConnected === 'function' && sharedBrowser.isConnected()) {
    return sharedBrowser;
  }
  if (browserLaunchFailed) return null;

  try {
    const chromium = getChromium();
    sharedBrowser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-accelerated-2d-canvas',
        '--autoplay-policy=no-user-gesture-required'
      ]
    });
    browserLaunchFailed = false;
    sharedBrowser.on('disconnected', () => { sharedBrowser = null; });
    return sharedBrowser;
  } catch (err) {
    browserLaunchFailed = true;
    console.warn('[EmbedInterceptor] browser launch failed:', err.message);
    return null;
  }
}

/** Close the shared browser (call on shutdown or in tests). */
async function closeBrowser() {
  if (!sharedBrowser) return;
  const b = sharedBrowser;
  sharedBrowser = null;
  await b.close().catch(() => {});
}

// ── Core interception ───────────────────────────────────────────────────────
async function readCache(embedUrl) {
  try {
    const cached = await redisService.getCached(CACHE_PREFIX + embedUrl);
    if (cached && cached.streamUrl) {
      stats.cacheHits++;
      return cached;
    }
  } catch { /* redis optional */ }
  return null;
}

async function writeCache(embedUrl, value) {
  try {
    await redisService.setCached(CACHE_PREFIX + embedUrl, value, CACHE_TTL);
  } catch { /* redis optional */ }
}

/**
 * Intercept the direct stream URL behind an embed page.
 *
 * @param {string} embedUrl  The third-party embed/iframe URL.
 * @param {object} [options] { referer, timeoutMs, userAgent }
 * @returns {Promise<{streamUrl: string, referer: string, candidates: string[],
 *                    via: string}|null>}
 */
async function interceptEmbed(embedUrl, options = {}) {
  if (!embedUrl || typeof embedUrl !== 'string') return null;
  if (!isAvailable()) return null;

  const cached = await readCache(embedUrl);
  if (cached) return cached;

  const timeoutMs = options.timeoutMs || getTimeoutMs();
  const referer = options.referer || embedUrl;
  const userAgent = options.userAgent || DEFAULT_USER_AGENT;

  stats.attempts++;

  let context = null;
  let timer = null;
  const discovered = [];
  const seen = new Set();

  const record = url => {
    if (!url || seen.has(url) || !STREAM_URL_RE.test(url)) return;
    seen.add(url);
    discovered.push(url);
  };

  try {
    const browser = await getBrowser();
    if (!browser) return null;

    context = await browser.newContext({
      userAgent,
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: 'UTC'
    });

    // Kill heavy assets; we only need the network metadata.
    await context.route('**/*', route => {
      const type = route.request().resourceType();
      if (type === 'image' || type === 'font' || type === 'stylesheet' || type === 'media') {
        return route.abort();
      }
      return route.continue();
    });

    const page = await context.newPage();
    page.on('request', req => record(req.url()));
    page.on('response', res => record(res.url()));

    // Race the page load against the overall timeout so a hung embed cannot
    // hold the request open past our budget.
    const navigate = page.goto(embedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
      referer
    }).catch(() => null);

    await Promise.race([
      navigate,
      new Promise(resolve => { timer = setTimeout(resolve, timeoutMs); })
    ]);
    if (timer) { clearTimeout(timer); timer = null; }

    // Give the player a short window to request its manifest.
    if (discovered.length === 0) {
      await new Promise(resolve => {
        const deadline = Date.now() + 4000;
        const poll = () => {
          if (discovered.length > 0 || Date.now() > deadline) return resolve();
          setTimeout(poll, 200);
        };
        poll();
      });
    }

    if (discovered.length === 0) {
      stats.failures++;
      return null;
    }

    const result = {
      streamUrl: discovered[0],
      candidates: discovered.slice(0, MAX_DISCOVERED),
      referer,
      via: 'playwright-network-interception'
    };
    stats.hits++;
    await writeCache(embedUrl, result);
    return result;
  } catch (err) {
    if (/timeout/i.test(err.message)) stats.timeouts++;
    else stats.failures++;
    console.warn(`[EmbedInterceptor] ${embedUrl} failed: ${err.message}`);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
    if (context) await context.close().catch(() => {});
  }
}

/**
 * Intercept several embed URLs with a hard concurrency cap.
 * Returns a Map keyed by embed URL; values are the intercept result or null.
 */
async function interceptMany(embedUrls, options = {}) {
  const urls = Array.isArray(embedUrls)
    ? embedUrls.filter(u => typeof u === 'string' && u.length > 0)
    : [];
  if (urls.length === 0) return new Map();
  if (!isAvailable()) return new Map(urls.map(u => [u, null]));

  const results = new Map();
  const limit = Math.max(1, Math.min(getMaxConcurrent(), urls.length));
  let cursor = 0;

  const worker = async () => {
    while (cursor < urls.length) {
      const idx = cursor++;
      const url = urls[idx];
      results.set(url, await interceptEmbed(url, options));
    }
  };

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

function getStats() {
  return {
    ...stats,
    available: isAvailable(),
    enabled: isEnabled(),
    browserRunning: !!sharedBrowser,
    maxConcurrent: getMaxConcurrent(),
    timeoutMs: getTimeoutMs()
  };
}

function clearCache(embedUrl) {
  try {
    return redisService.deleteCached(CACHE_PREFIX + embedUrl);
  } catch {
    return false;
  }
}

module.exports = {
  interceptEmbed,
  interceptMany,
  isAvailable,
  isEnabled,
  getStats,
  closeBrowser,
  clearCache,
  STREAM_URL_RE,
  CACHE_PREFIX,
  CACHE_TTL
};
