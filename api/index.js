/*
 * Vercel entrypoint for RealSSA.
 *
 * Vercel handles request/response traffic. External cron and the persistent
 * worker handle scheduled/background work. Keep those concerns isolated so a
 * background service cannot take the API down during a cold start.
 */

process.env.VERCEL = process.env.VERCEL || '1';
process.env.VERCEL_ENV = process.env.VERCEL_ENV || 'production';

const Module = require('module');
const originalLoad = Module._load;
const originalSetInterval = global.setInterval;

const pg = require('pg');
const NativePool = pg.Pool;
const poolCache = new Map();

class SharedVercelPool extends NativePool {
  constructor(config = {}) {
    const rawConnectionString = typeof config === 'string' ? config : config.connectionString;
    const cacheKey = rawConnectionString ? String(rawConnectionString).split('?')[0] : null;
    if (cacheKey && poolCache.has(cacheKey)) return poolCache.get(cacheKey);
    super(config);
    if (cacheKey) poolCache.set(cacheKey, this);
  }
}

pg.Pool = SharedVercelPool;

const persistentOnly = {
  streamHealthMonitor: {
    runStreamHealthCheck: async () => ({}),
    getServerHealthStatus: async () => ({}),
    SERVERS: []
  },
  whatsappBots: {
    initWhatsAppBots: () => {
      console.log('[Vercel] WhatsApp background worker disabled; external/Fly worker owns it.');
    }
  }
};

const vercelWorker = {
  runMigrations: async () => {
    console.log('[Vercel] Worker migrations skipped; migrations belong to the external worker/cron path.');
  }
};

let realAuthService;
let authParent = null;
const loadRealAuthService = (request, parent) => {
  if (!realAuthService) realAuthService = originalLoad.call(Module, request, parent, false);
  return realAuthService;
};

const lazyAuthService = {
  registerWithEmail: (...args) => loadRealAuthService('./services/authService', authParent).registerWithEmail(...args),
  verifyEmailToken: (...args) => loadRealAuthService('./services/authService', authParent).verifyEmailToken(...args),
  sendPhoneOtp: (...args) => loadRealAuthService('./services/authService', authParent).sendPhoneOtp(...args),
  verifyPhoneOtp: (...args) => loadRealAuthService('./services/authService', authParent).verifyPhoneOtp(...args),
  loginWithEmail: (...args) => loadRealAuthService('./services/authService', authParent).loginWithEmail(...args),
  getAllUsersAdmin: (...args) => loadRealAuthService('./services/authService', authParent).getAllUsersAdmin(...args)
};

Module._load = function patchedModuleLoad(request, parent, isMain) {
  if (request === './services/streamHealthMonitor' || request.endsWith('/services/streamHealthMonitor')) return persistentOnly.streamHealthMonitor;
  if (request === './services/whatsappBots' || request.endsWith('/services/whatsappBots')) return persistentOnly.whatsappBots;
  if (request === './worker' || request.endsWith('/worker')) return vercelWorker;
  if (request === './services/authService' || request.endsWith('/services/authService')) {
    authParent = parent;
    return lazyAuthService;
  }
  return originalLoad.call(this, request, parent, isMain);
};

global.setInterval = function vercelNoStartupIntervals() {
  return { __realssaVercelStartupTimer: true };
};

let app;
try {
  app = require('../backend/server.js');
} finally {
  global.setInterval = originalSetInterval;
  Module._load = originalLoad;
}

// Vercel sits behind a trusted reverse proxy. Tell Express/rate-limit to use
// the forwarded client address so X-Forwarded-For does not become a runtime
// validation error on every API request.
app.set('trust proxy', 1);

// backend/config/multiDb is loaded by server.js with the same shared pg.Pool
// constructor above. Its primary pool therefore exists immediately, even
// before server.js finishes its asynchronous SELECT NOW() probe.
let fallbackDatabasePool = null;
try {
  const multiDb = require('../backend/config/multiDb');
  fallbackDatabasePool = multiDb.pools?.[0]?.pool || null;
} catch (error) {
  console.warn('[Vercel] Could not resolve shared database pool:', error.message);
}

const waitForDatabasePool = async (timeoutMs = 10000) => {
  if (!process.env.DATABASE_URL) return null;
  if (app.get('pool')) return app.get('pool');
  if (fallbackDatabasePool) return fallbackDatabasePool;

  const started = Date.now();
  while (!app.get('pool') && Date.now() - started < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return app.get('pool') || fallbackDatabasePool || null;
};

const sendJson = (res, statusCode, payload) => {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const originalHandle = app.handle.bind(app);
const { ingestCronCategory } = require('../backend/services/cronIngestionFast');

const EXTERNAL_ARTICLE_ID_RE = /^(?:https?:\/\/|www\.)/i;
const SPARSE_CATEGORY_MIN = 18;
const SPARSE_CATEGORY_COOLDOWN_MS = 2 * 60 * 1000;
const sparseCategoryRefresh = new Map();
const externalCommentsTableReady = new WeakMap();

const isExternalArticleId = (value) => {
  const id = String(value || '').trim();
  if (!id) return false;
  if (/^\d+$/.test(id)) return false;
  if (/^rss-\d+$/.test(id)) return false;
  return !EXTERNAL_ARTICLE_ID_RE.test(id) || id.length > 40;
};

const escapeCommentText = (value, maxLength) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')
  .slice(0, maxLength);

const ensureExternalCommentsTable = async (pool) => {
  if (!pool) return false;
  const existing = externalCommentsTableReady.get(pool);
  if (existing) return existing;

  const promise = pool.query(`
    CREATE TABLE IF NOT EXISTS external_comments (
      id BIGSERIAL PRIMARY KEY,
      article_id TEXT NOT NULL,
      author_name VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      parent_id BIGINT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_external_comments_article
      ON external_comments (article_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_external_comments_parent
      ON external_comments (parent_id);
  `).then(() => true).catch((error) => {
    externalCommentsTableReady.delete(pool);
    console.warn('[Vercel Comments] Table initialization failed:', error.message);
    return false;
  });

  externalCommentsTableReady.set(pool, promise);
  return promise;
};

const mapExternalComments = (rows) => {
  const comments = new Map();
  for (const row of rows) {
    comments.set(String(row.id), {
      id: String(row.id),
      articleId: row.article_id,
      parentId: row.parent_id ? String(row.parent_id) : null,
      author: row.author_name,
      content: row.content,
      date: new Date(row.created_at).toISOString(),
      likes: Number(row.likes || 0),
      replies: []
    });
  }

  const roots = [];
  for (const comment of comments.values()) {
    if (comment.parentId && comments.has(comment.parentId)) {
      comments.get(comment.parentId).replies.push(comment);
    } else {
      roots.push(comment);
    }
  }
  return roots;
};

const handleExternalComments = async (parsed, req, res, pool) => {
  if (!pool || !parsed.pathname.startsWith('/api/comments')) return false;

  const method = req.method.toUpperCase();
  const pathMatch = parsed.pathname.match(/^\/api\/comments(?:\/([^/]+)\/like)?\/?$/);
  if (!pathMatch) return false;

  if (method === 'GET' && !pathMatch[1]) {
    const articleId = parsed.searchParams.get('articleId');
    if (!articleId || !isExternalArticleId(articleId)) return false;

    if (!(await ensureExternalCommentsTable(pool))) {
      return sendJson(res, 200, []), true;
    }

    try {
      const result = await pool.query(
        'SELECT id, article_id, author_name, content, parent_id, likes, created_at FROM external_comments WHERE article_id = $1 ORDER BY created_at ASC, id ASC',
        [String(articleId)]
      );
      return sendJson(res, 200, mapExternalComments(result.rows)), true;
    } catch (error) {
      console.warn('[Vercel Comments] External comment read failed:', error.message);
      return sendJson(res, 200, []), true;
    }
  }

  if (method === 'POST' && !pathMatch[1]) {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const articleId = String(body.articleId || '').trim();
    const author = String(body.author || '').trim();
    const content = String(body.content || '').trim();
    const parentId = body.parentId ? String(body.parentId).trim() : null;

    if (!articleId || !author || !content) return sendJson(res, 400, { error: 'Missing required fields' }), true;
    if (!isExternalArticleId(articleId)) return false;
    if (author.length > 100 || content.length > 1000) return sendJson(res, 400, { error: 'Comment is too long' }), true;
    if (parentId && !/^\d+$/.test(parentId)) return sendJson(res, 400, { error: 'Invalid parent comment' }), true;

    if (!(await ensureExternalCommentsTable(pool))) {
      return sendJson(res, 503, { error: 'Comments temporarily unavailable', retryable: true }), true;
    }

    try {
      const safeAuthor = escapeCommentText(author, 100);
      const safeContent = escapeCommentText(content, 1000);
      const pId = parentId ? Number(parentId) : null;

      if (pId) {
        const parent = await pool.query(
          'SELECT id FROM external_comments WHERE id = $1 AND article_id = $2',
          [pId, articleId]
        );
        if (parent.rows.length === 0) return sendJson(res, 400, { error: 'Parent comment not found' }), true;
      }

      const result = await pool.query(
        `INSERT INTO external_comments (article_id, author_name, content, parent_id)
         VALUES ($1, $2, $3, $4) RETURNING id, article_id, author_name, content, parent_id, likes, created_at`,
        [articleId, safeAuthor, safeContent, pId]
      );
      const created = result.rows[0];
      return sendJson(res, 201, {
        id: String(created.id),
        articleId: created.article_id,
        parentId: created.parent_id ? String(created.parent_id) : null,
        author: created.author_name,
        content: created.content,
        date: new Date(created.created_at).toISOString(),
        likes: Number(created.likes || 0),
        replies: []
      }), true;
    } catch (error) {
      console.error('[Vercel Comments] External comment write failed:', error.message);
      return sendJson(res, 500, { error: 'Failed to save comment' }), true;
    }
  }

  if (method === 'POST' && pathMatch[1]) {
    const commentId = pathMatch[1];
    if (!/^\d+$/.test(commentId)) return false;
    if (!(await ensureExternalCommentsTable(pool))) return false;

    try {
      const result = await pool.query(
        `UPDATE external_comments
         SET likes = likes + 1
         WHERE id = $1
         RETURNING id, article_id, author_name, content, parent_id, likes, created_at`,
        [Number(commentId)]
      );
      if (result.rows.length === 0) return false;
      const updated = result.rows[0];
      return sendJson(res, 200, {
        id: String(updated.id),
        articleId: updated.article_id,
        parentId: updated.parent_id ? String(updated.parent_id) : null,
        author: updated.author_name,
        content: updated.content,
        date: new Date(updated.created_at).toISOString(),
        likes: Number(updated.likes || 0)
      }), true;
    } catch (error) {
      console.warn('[Vercel Comments] External like failed:', error.message);
      return false;
    }
  }

  return false;
};

const maybeRefreshSparseCategory = async (parsed, pool) => {
  if (!pool || parsed.pathname.split('/').length !== 4 || !parsed.pathname.startsWith('/api/news/')) return;
  const category = decodeURIComponent(parsed.pathname.slice('/api/news/'.length)).toLowerCase();
  const allowedCategories = new Set([
    'nigerian', 'nigerian-news', 'ghana', 'kenya', 'south-africa', 'uk', 'usa',
    'crypto', 'culture', 'entertainment', 'jobs', 'tech', 'business', 'science',
    'lifestyle', 'sports'
  ]);
  if (!allowedCategories.has(category)) return;

  const last = sparseCategoryRefresh.get(category) || 0;
  if (Date.now() - last < SPARSE_CATEGORY_COOLDOWN_MS) return;

  try {
    const dbCategory = category === 'nigerian' ? 'nigerian-news' : category;
    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM rss_articles WHERE LOWER(category) = LOWER($1)',
      [dbCategory]
    );
    const count = Number(countResult.rows[0]?.count || 0);
    if (count >= SPARSE_CATEGORY_MIN) return;

    sparseCategoryRefresh.set(category, Date.now());
    try {
      const result = await Promise.race([
        ingestCronCategory(dbCategory),
        new Promise((_, reject) => setTimeout(() => reject(new Error('sparse refresh timeout')), 5500))
      ]);
      console.log(`[Vercel Sparse Refresh] ${dbCategory}: ${count} stored ->`, result?.newCount || 0, 'new');
    } catch (error) {
      console.warn(`[Vercel Sparse Refresh] ${dbCategory} failed:`, error.message);
    }
  } catch (error) {
    console.warn(`[Vercel Sparse Refresh] Count failed for ${category}:`, error.message);
  }
};

// Vercel-side compatibility routes. These keep the web app usable even when
// legacy Express handlers expect columns/tables from an older schema.
const handleStableApi = async (parsed, req, res, pool) => {
  if (!pool || req.method !== 'GET') return false;

  if (parsed.pathname === '/api/sports/matches') {
    try {
      const result = await pool.query(`
        SELECT
          match_id AS provider_match_id,
          COALESCE(competition, 'Other') AS competition_name,
          COALESCE(home_team, 'Home Team') AS home_team_name,
          home_team_crest,
          COALESCE(away_team, 'Away Team') AS away_team_name,
          away_team_crest,
          COALESCE(status, 'scheduled') AS status,
          COALESCE(match_minute::text, '') AS minute,
          COALESCE(home_score, 0) AS home_score,
          COALESCE(away_score, 0) AS away_score,
          kickoff_at,
          updated_at,
          match_url
        FROM live_matches
        WHERE status IN ('live', 'scheduled', 'finished')
          AND (status = 'live' OR kickoff_at > NOW() - INTERVAL '3 days')
        ORDER BY
          CASE status WHEN 'live' THEN 1 WHEN 'scheduled' THEN 2 ELSE 3 END,
          kickoff_at ASC NULLS LAST
        LIMIT 100
      `);
      return sendJson(res, 200, { matches: Array.isArray(result.rows) ? result.rows : [] }), true;
    } catch (error) {
      console.warn('[Vercel Sports] Stable match query failed:', error.message);
      return sendJson(res, 200, { matches: [] }), true;
    }
  }

  if (parsed.pathname === '/api/rates') {
    try {
      const result = await pool.query(`
        SELECT currency, buy_rate, sell_rate, source, updated_at AS created_at
        FROM parallel_rates
        ORDER BY currency
      `);
      return sendJson(res, 200, Array.isArray(result.rows) ? result.rows : []), true;
    } catch (error) {
      console.warn('[Vercel Market] Rates query failed:', error.message);
      return sendJson(res, 200, []), true;
    }
  }

  if (parsed.pathname === '/api/prices') {
    try {
      const result = await pool.query(`
        SELECT item_name, price, location, unit, updated_at AS created_at
        FROM market_prices
        ORDER BY updated_at DESC, item_name ASC
        LIMIT 200
      `);
      return sendJson(res, 200, Array.isArray(result.rows) ? result.rows : []), true;
    } catch (error) {
      console.warn('[Vercel Market] Prices query failed:', error.message);
      return sendJson(res, 200, []), true;
    }
  }

  // ngx_stocks is not present in the production database. Do not allow that
  // missing optional table to turn the entire Market Hub request into a 500.
  // Return the empty shape the UI already understands until a real NGX feed is
  // wired into the persistent ingestion worker.
  if (parsed.pathname === '/api/stocks') {
    try {
      const result = await pool.query(`
        SELECT to_regclass('public.ngx_stocks') AS table_name
      `);
      if (!result.rows[0]?.table_name) {
        return sendJson(res, 200, []), true;
      }
    } catch (error) {
      console.warn('[Vercel Market] Stock table check failed:', error.message);
      return sendJson(res, 200, []), true;
    }
  }

  return false;
};

app.handle = async function realssaVercelHandle(req, res, out) {
  let parsed;
  try {
    parsed = new URL(req.url || '/', 'https://realssa.internal');
  } catch {
    return originalHandle(req, res, out);
  }

  const isApiRequest = parsed.pathname.startsWith('/api/');
  const isRssRequest = parsed.pathname === '/rss.xml' || parsed.pathname.startsWith('/rss/');
  const isCronIngest = parsed.pathname === '/api/cron/ingest';

  if ((req.method === 'GET' || req.method === 'POST') && isCronIngest) {
    const configuredSecret = process.env.CRON_SECRET;
    const suppliedSecret = parsed.searchParams.get('secret') || req.headers['x-cron-secret'];
    if (!configuredSecret || suppliedSecret !== configuredSecret) return sendJson(res, 401, { error: 'Unauthorized' });

    const category = parsed.searchParams.get('category');
    if (!category) return sendJson(res, 400, { error: 'category is required' });

    try {
      const result = await ingestCronCategory(category);
      return sendJson(res, 200, {
        success: true,
        completed: true,
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Vercel Fast Cron] Ingestion failed:', error.message);
      return sendJson(res, 500, {
        success: false,
        completed: false,
        category,
        error: 'Ingestion failed'
      });
    }
  }

  if (process.env.DATABASE_URL && (isApiRequest || isRssRequest)) {
    const readyPool = await waitForDatabasePool();
    if (!readyPool) {
      return sendJson(res, 503, { error: 'Database temporarily unavailable', retryable: true });
    }

    const externalCommentsHandled = await handleExternalComments(parsed, req, res, readyPool);
    if (externalCommentsHandled) return;

    await maybeRefreshSparseCategory(parsed, readyPool);

    const stableHandled = await handleStableApi(parsed, req, res, readyPool);
    if (stableHandled) return;
  }

  return originalHandle(req, res, out);
};

module.exports = app;
