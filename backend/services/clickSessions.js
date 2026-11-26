/**
 * Task 11: Click Sessions
 * -----------------------
 * Realistic Google "search -> click -> dwell" sessions driven by Playwright.
 *
 * Rules:
 *  - One residential proxy per session, geo-matched to the target country.
 *  - Cookies/state persisted per proxy so repeat visits look like returning users.
 *  - Flow: open Google -> type query -> scroll SERP -> find domain -> click -> dwell.
 *  - Hard cap 3 sessions per proxy IP per day.
 *  - 20-60 concurrent sessions, ramped over 10 minutes.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_SESSIONS_PER_IP_PER_DAY = 3;
const MIN_CONCURRENT = 20;
const MAX_CONCURRENT = 60;
const RAMP_UP_MINUTES = 10;
const MIN_DWELL_MS = 45 * 1000;
const MAX_DWELL_MS = 180 * 1000;
const SCROLL_STEPS_MIN = 3;
const SCROLL_STEPS_MAX = 6;
const MAX_SESSION_LOG = 500;

const STATE_DIR = process.env.CLICK_SESSION_STATE_DIR
  || path.join(process.cwd(), '.click-session-state');

const sessionLog = [];
const activeSessions = new Set();
const ipSessionCount = new Map();
let lastResetDay = new Date().toISOString().slice(0, 10);

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDwell() {
  return randomInt(MIN_DWELL_MS, MAX_DWELL_MS);
}

function randomScrollSteps() {
  return randomInt(SCROLL_STEPS_MIN, SCROLL_STEPS_MAX);
}

/** Extract the proxy host so sessions can be capped per IP. */
function proxyIpOf(proxy) {
  if (!proxy) return 'direct';
  const server = typeof proxy === 'string' ? proxy : proxy.server;
  if (!server) return 'direct';
  try {
    return new URL(server).hostname;
  } catch {
    return String(server).replace(/^https?:\/\//, '').split(':')[0].split('/')[0];
  }
}

function maybeResetDaily() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== lastResetDay) {
    ipSessionCount.clear();
    lastResetDay = today;
  }
}

function canSessionFromIp(ip) {
  maybeResetDaily();
  return (ipSessionCount.get(ip) || 0) < MAX_SESSIONS_PER_IP_PER_DAY;
}

function recordSessionForIp(ip) {
  maybeResetDaily();
  ipSessionCount.set(ip, (ipSessionCount.get(ip) || 0) + 1);
}

function resetDailyCounts() {
  ipSessionCount.clear();
  lastResetDay = new Date().toISOString().slice(0, 10);
}

// Safety net: reset counters at midnight even if the process never restarts.
const dailyResetTimer = setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) resetDailyCounts();
}, 60 * 1000);
if (dailyResetTimer.unref) dailyResetTimer.unref();

/** Per-proxy cookie state file. */
function stateFileFor(proxy) {
  const key = crypto.createHash('sha1').update(proxyIpOf(proxy)).digest('hex').slice(0, 16);
  return path.join(STATE_DIR, `proxy-${key}.json`);
}

function loadStorageState(proxy) {
  try {
    const file = stateFileFor(proxy);
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.warn('[ClickSession] storageState load failed:', err.message);
  }
  return undefined;
}

function saveStorageState(proxy, state) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(stateFileFor(proxy), JSON.stringify(state));
  } catch (err) {
    console.warn('[ClickSession] storageState save failed:', err.message);
  }
}

/** Prefer playwright-extra + stealth, fall back to plain playwright. */
function getChromium() {
  try {
    const { chromium } = require('playwright-extra');
    chromium.use(require('puppeteer-extra-plugin-stealth')());
    return chromium;
  } catch {
    return require('playwright').chromium;
  }
}

/** Find SERP links pointing at the target domain (handles /url?q= wrappers). */
async function findTargetResult(page, targetDomain) {
  const direct = await page.$$(`a[href*="${targetDomain}"]`);
  if (direct.length) return direct;

  const all = await page.$$('a[href]');
  const matches = [];
  for (const handle of all) {
    const href = await handle.getAttribute('href').catch(() => null);
    if (!href) continue;
    if (href.includes(targetDomain)) {
      matches.push(handle);
    } else {
      try {
        const parsed = new URL(href, 'https://www.google.com');
        const q = parsed.searchParams.get('q') || parsed.searchParams.get('url');
        if (q && q.includes(targetDomain)) matches.push(handle);
      } catch { /* malformed href */ }
    }
    if (matches.length >= 30) break;
  }
  return matches;
}

function pushSessionLog(entry) {
  sessionLog.push(entry);
  if (sessionLog.length > MAX_SESSION_LOG) {
    sessionLog.splice(0, sessionLog.length - MAX_SESSION_LOG);
  }
}

/**
 * Run a single click session.
 *
 * @param {object} sessionConfig { proxy, geo, query, targetDomain, sessionId }
 * @param {object} pool          Optional pg pool for telemetry
 */
async function runClickSession(sessionConfig, pool) {
  const { proxy, geo, query, targetDomain } = sessionConfig;
  const sessionId = sessionConfig.sessionId || `session_${Date.now()}_${randomInt(1000, 9999)}`;
  const proxyIp = proxyIpOf(proxy);

  const sessionData = {
    sessionId,
    proxy: proxy ? (typeof proxy === 'string' ? proxy : proxy.server) : 'direct',
    geo: geo || 'NG',
    query,
    targetDomain,
    landedUrl: null,
    dwellTime: 0,
    scrollSteps: 0,
    outcome: 'pending',
    startTime: new Date().toISOString(),
    endTime: null,
    totalDuration: 0
  };

  // Hard daily cap per proxy IP.
  if (!canSessionFromIp(proxyIp)) {
    sessionData.outcome = 'ip_daily_cap_reached';
    pushSessionLog(sessionData);
    console.log(`[ClickSession ${sessionId}] skipped: IP daily cap reached (${proxyIp})`);
    return sessionData;
  }
  recordSessionForIp(proxyIp);

  let browser;
  let context;
  const startTime = Date.now();

  try {
    const chromium = getChromium();

    // Playwright expects a proxy object with a `server` field.
    const proxyOptions = proxy && typeof proxy === 'object' && proxy.server
      ? {
          server: proxy.server,
          ...(proxy.username ? { username: proxy.username } : {}),
          ...(proxy.password ? { password: proxy.password } : {})
        }
      : undefined;

    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu'
      ],
      ...(proxyOptions ? { proxy: proxyOptions } : {})
    });

    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: geo === 'NG' ? 'en-NG' : 'en-US',
      timezoneId: geo === 'NG' ? 'Africa/Lagos' : 'America/New_York',
      storageState: loadStorageState(proxy)
    });

    const page = await context.newPage();

    // 1. Open Google
    await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('input[name="q"], textarea[name="q"]', { timeout: 10000 });

    // 2. Type the query and submit
    const box = (await page.$('input[name="q"]')) || (await page.$('textarea[name="q"]'));
    await box.type(query, { delay: randomInt(40, 120) });
    await page.keyboard.press('Enter');
    await page.waitForSelector('#search, #rso', { timeout: 10000 });

    // 3. Scroll the SERP
    const serpScrolls = randomScrollSteps();
    for (let i = 0; i < serpScrolls; i++) {
      await page.evaluate(() => window.scrollBy(0, 300));
      await page.waitForTimeout(randomInt(400, 900));
    }
    sessionData.scrollSteps = serpScrolls;

    // 4. Locate the target domain in the results
    const results = await findTargetResult(page, targetDomain);
    if (results.length === 0) {
      sessionData.outcome = 'not_found_in_top_30';
      return sessionData;
    }
    // 5. Click the target (handle popups/new tabs)
    const chosen = results[randomInt(0, Math.min(results.length, 30) - 1)];
    const popupPromise = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);
    await chosen.click();
    const popup = await popupPromise;
    const landing = popup || page;
    await landing.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    sessionData.landedUrl = landing.url();

    // 6. Dwell on the landing page
    const dwell = randomDwell();
    await landing.waitForTimeout(dwell);
    sessionData.dwellTime = dwell;

    // 7. Scroll the article
    const pageScrolls = randomScrollSteps();
    for (let i = 0; i < pageScrolls; i++) {
      await landing.evaluate(() => window.scrollBy(0, 400));
      await landing.waitForTimeout(randomInt(600, 1200));
    }

    // 8. Click an internal link, then dwell again
    const origin = new URL(landing.url()).origin;
    const internalLinks = await landing.$$(`a[href^="/"], a[href^="${origin}"]`);
    if (internalLinks.length > 0) {
      const target = internalLinks[randomInt(0, internalLinks.length - 1)];
      await target.click({ timeout: 5000 }).catch(() => {});
      await landing.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      await landing.waitForTimeout(Math.floor(dwell * 0.5));
      sessionData.dwellTime += Math.floor(dwell * 0.5);
    }

    sessionData.outcome = 'success';
    saveStorageState(proxy, await context.storageState());
  } catch (err) {
    sessionData.outcome = `error: ${err.message}`;
    console.error(`[ClickSession ${sessionId}] ${err.message}`);
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});

    sessionData.endTime = new Date().toISOString();
    sessionData.totalDuration = Date.now() - startTime;
    activeSessions.delete(sessionId);

    if (pool) {
      try {
        await pool.query(
          `INSERT INTO click_sessions
             (session_id, proxy_server, geo, query, target_domain, landed_url,
              dwell_time_ms, scroll_steps, outcome, start_time, end_time, total_duration_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (session_id) DO NOTHING`,
          [
            sessionId, sessionData.proxy, geo || 'NG', query, targetDomain,
            sessionData.landedUrl, sessionData.dwellTime, sessionData.scrollSteps,
            sessionData.outcome, sessionData.startTime, sessionData.endTime,
            sessionData.totalDuration
          ]
        );
      } catch (err) {
        console.warn('[ClickSession] DB log failed:', err.message);
      }
    }

    pushSessionLog(sessionData);
    console.log(`[ClickSession ${sessionId}] ${sessionData.outcome} (${sessionData.totalDuration}ms)`);
  }

  return sessionData;
}

/**
 * Run multiple concurrent sessions with a 10-minute ramp-up.
 */
async function runSessionBatch(sessionConfigs, pool) {
  if (!Array.isArray(sessionConfigs) || sessionConfigs.length === 0) return [];

  const planned = Math.min(sessionConfigs.length, MAX_CONCURRENT);
  const rampInterval = Math.max(0, Math.floor((RAMP_UP_MINUTES * 60 * 1000) / planned));
  const inFlight = [];

  for (let i = 0; i < planned; i++) {
    // Wait for a free slot when the concurrency ceiling is reached.
    while (activeSessions.size >= MAX_CONCURRENT) {
      await new Promise(r => setTimeout(r, 250));
    }

    const config = {
      ...sessionConfigs[i],
      sessionId: sessionConfigs[i].sessionId || `session_${Date.now()}_${i}`
    };
    activeSessions.add(config.sessionId);

    inFlight.push(
      runClickSession(config, pool).catch(err => ({
        sessionId: config.sessionId,
        outcome: `error: ${err.message}`
      }))
    );

    if (i > 0 && rampInterval > 0) {
      await new Promise(r => setTimeout(r, rampInterval));
    }
  }

  return Promise.all(inFlight);
}

/**
 * Session statistics (in-memory, last 500 sessions).
 */
function getSessionStats() {
  const total = sessionLog.length;
  const successes = sessionLog.filter(s => s.outcome === 'success').length;
  const avgDwell = total
    ? Math.floor(sessionLog.reduce((sum, s) => sum + (s.dwellTime || 0), 0) / total)
    : 0;

  return {
    totalSessions: total,
    activeSessions: activeSessions.size,
    successRate: total ? Number(((successes / total) * 100).toFixed(2)) : 0,
    avgDwellTimeMs: avgDwell,
    ipSessionCounts: Object.fromEntries(ipSessionCount),
    recent: sessionLog.slice(-10).map(s => ({
      sessionId: s.sessionId,
      outcome: s.outcome,
      geo: s.geo,
      targetDomain: s.targetDomain,
      dwellTime: s.dwellTime
    }))
  };
}

module.exports = {
  runClickSession,
  runSessionBatch,
  getSessionStats,
  canSessionFromIp,
  recordSessionForIp,
  resetDailyCounts,
  proxyIpOf,
  MAX_SESSIONS_PER_IP_PER_DAY,
  MIN_CONCURRENT,
  MAX_CONCURRENT
};
