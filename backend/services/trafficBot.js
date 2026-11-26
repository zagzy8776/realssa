/**
 * Area Traffic Bot
 * -----------------
 * Walks the site "through areas": it opens the home page, the area landing page
 * and area-matched articles, *stays* on each page for a realistic dwell, then
 * follows one internal link before leaving. Every request and dwell is stored
 * in `traffic_events` so the bot's coverage can be audited per area.
 *
 * What this actually does:
 *  - keeps CDN / edge caches warm for area pages and recent articles
 *  - produces real HTTP requests with search/social referrers so server logs and
 *    edge analytics see sustained visits
 *  - continuously rotates through every area (least-recently-visited first)
 *
 * Honest limitation: these requests do not execute JavaScript, so Google
 * Analytics pageviews (which need the GA tag) only appear if the deployment's
 * edge logs or a headless browser are used. The dwell/events recorded here are
 * the authoritative record of bot traffic.
 */

const DEFAULT_SITE = process.env.SEO_SITE_URL || 'https://www.realssanews.com.ng';
const REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_DWELL_MS = Number(process.env.TRAFFIC_BOT_DWELL_MS || 1200);
const MAX_REQUESTS_PER_SESSION = 6;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0'
];

const REFERRERS = [
  'https://www.google.com/',
  'https://news.google.com/',
  'https://www.bing.com/',
  'https://duckduckgo.com/',
  'https://www.facebook.com/',
  'https://x.com/',
  'https://www.instagram.com/',
  'https://web.whatsapp.com/',
  'https://www.linkedin.com/'
];

function pickRotating(values, index) {
  if (!values.length) return undefined;
  return values[Math.abs(index) % values.length];
}

function resolveUrl(target, base = DEFAULT_SITE) {
  try {
    return new URL(target, base).href;
  } catch {
    return new URL('/', base).href;
  }
}

function pathOf(target, base = DEFAULT_SITE) {
  try {
    return new URL(target, base).pathname;
  } catch {
    return '/';
  }
}

/** Extract same-origin links from a page without a DOM dependency. */
function extractInternalLinks(html, pageUrl, origin, limit = 2) {
  const links = [];
  const seen = new Set();
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(String(html || ''))) && links.length < limit * 4) {
    let candidate;
    try {
      candidate = new URL(match[1], pageUrl);
    } catch {
      continue;
    }
    if (candidate.origin !== origin) continue;
    if (!/^https?:$/.test(candidate.protocol)) continue;
    if (/\.(?:jpg|jpeg|png|gif|webp|svg|css|js|xml|json|pdf|mp4|m3u8)$/i.test(candidate.pathname)) continue;
    candidate.hash = '';
    const href = candidate.href;
    if (seen.has(href)) continue;
    seen.add(href);
    links.push(href);
    if (links.length >= limit) break;
  }
  return links;
}

function isHtmlResponse(response) {
  const type = response && response.headers && typeof response.headers.get === 'function'
    ? response.headers.get('content-type')
    : (response && response.headers && response.headers['content-type']);
  return !type || /text\/html/i.test(type);
}

/**
 * Build a browsing plan for one area. Article steps get longer dwell than
 * hub pages, mirroring a reader who lands, reads and then leaves.
 */
function sessionPlan(area, articles = [], { size = 4, baseUrl = DEFAULT_SITE } = {}) {
  const steps = [];
  const add = (target, kind, dwellMs) => {
    const href = resolveUrl(target, baseUrl);
    if (steps.some(step => step.url === href)) return;
    steps.push({ url: href, path: pathOf(href, baseUrl), kind, dwellMs });
  };

  add('/', 'home', Math.round(DEFAULT_DWELL_MS * 0.6));
  if (area && area.path && area.path !== '/') add(area.path, 'area', DEFAULT_DWELL_MS);
  add('/trending', 'hub', Math.round(DEFAULT_DWELL_MS * 0.7));
  for (const article of articles.slice(0, Math.max(0, size - steps.length))) {
    add(`/article/rss-${article.id}`, 'article', Math.round(DEFAULT_DWELL_MS * 1.6));
  }
  return steps.slice(0, Math.min(size, MAX_REQUESTS_PER_SESSION));
}

/**
 * Execute one browsing session. `fetcher` and `sleep` are injectable so tests
 * never touch the network.
 */
async function runSession(steps, {
  baseUrl = DEFAULT_SITE,
  fetcher = globalThis.fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  timeoutMs = REQUEST_TIMEOUT_MS,
  followLinks = true,
  sessionIndex = 0,
  maxRequests = MAX_REQUESTS_PER_SESSION
} = {}) {
  const origin = new URL(baseUrl).origin;
  const queue = [...steps];
  const events = [];
  let requests = 0;
  let ok = 0;
  let failed = 0;
  let totalDwell = 0;
  const budget = Math.max(1, Math.min(maxRequests, MAX_REQUESTS_PER_SESSION));

  while (queue.length && requests < budget) {
    const step = queue.shift();
    const referrer = REFERRERS[(sessionIndex + requests) % REFERRERS.length];
    const userAgent = USER_AGENTS[(sessionIndex + requests) % USER_AGENTS.length];
    let status = 0;
    let html = '';

    try {
      const response = await fetcher(step.url, {
        redirect: 'follow',
        headers: {
          'User-Agent': userAgent,
          Referer: referrer,
          'Accept-Language': 'en-NG,en;q=0.9',
          Accept: 'text/html,application/xhtml+xml'
        },
        signal: AbortSignal.timeout(timeoutMs)
      });
      status = response ? response.status : 0;
      if (status >= 200 && status < 400) ok++;
      else failed++;
      if (followLinks && isHtmlResponse(response) && typeof response.text === 'function' && requests < 2) {
        try {
          html = await response.text();
        } catch {
          html = '';
        }
      }
    } catch {
      status = 0;
      failed++;
    }

    if (step.dwellMs > 0) {
      await sleep(step.dwellMs);
      totalDwell += step.dwellMs;
    }

    events.push({
      path: step.path,
      status,
      dwell_ms: step.dwellMs,
      referrer,
      kind: step.kind
    });
    requests++;

    if (followLinks && html && requests < budget) {
      const links = extractInternalLinks(html, step.url, origin, 1);
      for (const link of links) {
        queue.push({
          url: link,
          path: pathOf(link, baseUrl),
          kind: 'followed',
          dwellMs: Math.round(DEFAULT_DWELL_MS * 1.1)
        });
      }
    }
  }

  return {
    requests,
    ok,
    failed,
    dwellMs: totalDwell,
    events
  };
}

const TRAFFIC_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS traffic_events (
     id BIGSERIAL PRIMARY KEY,
     area TEXT,
     path TEXT NOT NULL,
     status INTEGER,
     dwell_ms INTEGER NOT NULL DEFAULT 0,
     referrer TEXT,
     bot TEXT NOT NULL DEFAULT 'trafficBot',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  'CREATE INDEX IF NOT EXISTS traffic_events_area ON traffic_events(area, created_at DESC)',
  `CREATE TABLE IF NOT EXISTS traffic_bot_runs (
     id BIGSERIAL PRIMARY KEY,
     started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     finished_at TIMESTAMPTZ,
     status TEXT NOT NULL DEFAULT 'running',
     report JSONB
   )`
].join(';');

async function ensureTrafficSchema(pool) {
  if (!pool) return false;
  await pool.query(TRAFFIC_SCHEMA);
  return true;
}

async function loadTrafficAreas(pool, limit = 200) {
  if (pool) {
    try {
      const result = await pool.query(
        `SELECT slug, name, kind, country, path
         FROM seo_areas
         ORDER BY last_traffic_at ASC NULLS FIRST, score DESC
         LIMIT $1`,
        [limit]
      );
      if (result.rows.length) return result.rows;
    } catch {
      // Table not ready yet: fall back to the static registry.
    }
  }
  const { buildAreas } = require('./areaExpansionBot');
  return buildAreas().slice(0, limit);
}

async function pickArticles(pool, area, limit = 3) {
  if (!pool || !area || !area.name) return [];
  try {
    const result = await pool.query(
      `SELECT id, title
       FROM rss_articles
       WHERE (title ILIKE $1 OR COALESCE(ai_summary, '') ILIKE $1)
       ORDER BY published_at DESC
       LIMIT $2`,
      [`%${area.name}%`, limit]
    );
    return result.rows;
  } catch {
    return [];
  }
}

async function persistSession(pool, area, session) {
  if (!pool || !session.events.length) return;
  try {
    const events = session.events.map(event => ({
      area: area ? area.slug : null,
      path: event.path,
      status: event.status,
      dwell_ms: event.dwell_ms,
      referrer: event.referrer
    }));
    await pool.query(
      `INSERT INTO traffic_events(area, path, status, dwell_ms, referrer)
       SELECT x.area, x.path, x.status, x.dwell_ms, x.referrer
       FROM jsonb_to_recordset($1::jsonb) AS x(
         area text, path text, status integer, dwell_ms integer, referrer text
       )`,
      [JSON.stringify(events)]
    );
    if (area && area.slug) {
      await pool.query('UPDATE seo_areas SET last_traffic_at = NOW() WHERE slug = $1', [area.slug]);
    }
  } catch {
    // Traffic persistence is best effort; a failure must not stop the cycle.
  }
}

/**
 * Walk the least-recently-visited areas and run one session per area.
 * Bounded by `maxSessions`, `maxRequests` and the per-request timeout.
 */
async function runTrafficCycle(pool, {
  maxSessions = 6,
  maxRequests = MAX_REQUESTS_PER_SESSION,
  baseUrl = DEFAULT_SITE,
  fetcher = globalThis.fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  followLinks = true,
  areaLimit = 200,
  sessionSize = 4
} = {}) {
  const areas = await loadTrafficAreas(pool, areaLimit);
  let runId = null;
  if (pool) {
    try {
      await ensureTrafficSchema(pool);
      runId = (await pool.query('INSERT INTO traffic_bot_runs DEFAULT VALUES RETURNING id')).rows[0].id;
    } catch {
      runId = null;
    }
  }

  const report = {
    status: 'ok',
    areasVisited: [],
    sessions: 0,
    requests: 0,
    ok: 0,
    failed: 0,
    dwellMs: 0
  };

  for (const [index, area] of areas.slice(0, maxSessions).entries()) {
    const articles = await pickArticles(pool, area, 3);
    const plan = sessionPlan(area, articles, { size: sessionSize, baseUrl });
    const session = await runSession(plan, {
      baseUrl,
      fetcher,
      sleep,
      followLinks,
      sessionIndex: index,
      maxRequests
    });

    report.sessions++;
    report.requests += session.requests;
    report.ok += session.ok;
    report.failed += session.failed;
    report.dwellMs += session.dwellMs;
    report.areasVisited.push({
      slug: area.slug,
      name: area.name,
      kind: area.kind,
      requests: session.requests,
      dwellMs: session.dwellMs
    });

    await persistSession(pool, area, session);
  }

  if (report.failed > 0) report.status = 'partial';
  if (!report.sessions) report.status = 'idle';

  if (pool && runId) {
    try {
      await pool.query(
        "UPDATE traffic_bot_runs SET finished_at = NOW(), status = $2, report = $3::jsonb WHERE id = $1",
        [runId, report.status, JSON.stringify(report)]
      );
    } catch {
      // Run log is optional.
    }
  }

  return { runId, ...report };
}

module.exports = {
  DEFAULT_SITE,
  USER_AGENTS,
  REFERRERS,
  DEFAULT_DWELL_MS,
  MAX_REQUESTS_PER_SESSION,
  pickRotating,
  resolveUrl,
  pathOf,
  extractInternalLinks,
  isHtmlResponse,
  sessionPlan,
  runSession,
  ensureTrafficSchema,
  loadTrafficAreas,
  pickArticles,
  persistSession,
  runTrafficCycle
};
