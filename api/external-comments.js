const { pools } = require('../backend/config/multiDb');
const crypto = require('crypto');

const pool = pools?.[0]?.pool;
const tableReady = new WeakMap();
// Simple in-memory flood guard per serverless isolate (best-effort).
// Protects the DB from a single burst of spam inserts.
const recentPosts = new Map(); // key -> timestamps[]
const FLOOD_WINDOW_MS = 60_000;
const FLOOD_MAX_PER_KEY = 8; // max comments per article+author fingerprint / minute

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  // Vercel sometimes leaves body on the stream
  if (typeof req.on === 'function') {
    const chunks = [];
    await new Promise((resolve, reject) => {
      req.on('data', (c) => chunks.push(c));
      req.on('end', resolve);
      req.on('error', reject);
      // already consumed
      setTimeout(resolve, 50);
    });
    if (chunks.length) {
      try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
    }
  }
  return {};
}

const ensureTable = async () => {
  if (!pool) return false;
  const existing = tableReady.get(pool);
  if (existing) return existing;

  const promise = (async () => {
    const existingTable = await pool.query("SELECT to_regclass('external_comments') AS relation");
    if (existingTable.rows[0]?.relation) {
      const columns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'external_comments' AND column_name IN ('is_bot', 'bot_key')");
      if (columns.rows.length === 2) return true;
    }
    await pool.query(`
      CREATE TABLE IF NOT EXISTS external_comments (
        id BIGSERIAL PRIMARY KEY,
        article_id TEXT NOT NULL,
        author_name VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        parent_id BIGINT NULL,
        likes INTEGER NOT NULL DEFAULT 0,
        is_bot BOOLEAN NOT NULL DEFAULT FALSE,
        bot_key TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Separate statements so a failed ALTER does not block the whole path
    try { await pool.query(`ALTER TABLE external_comments ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE`); } catch (_) {}
    try { await pool.query(`ALTER TABLE external_comments ADD COLUMN IF NOT EXISTS bot_key TEXT NULL`); } catch (_) {}
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_external_comments_article
          ON external_comments (article_id, created_at ASC, id ASC)
      `);
    } catch (_) {}
    return true;
  })().catch((error) => {
    tableReady.delete(pool);
    console.warn('[External Comments] Table init failed:', error.message);
    return false;
  });

  tableReady.set(pool, promise);
  return promise;
};

const normalize = (row, source) => ({
  id: `${source}-${row.id}`,
  articleId: String(row.article_id),
  parentId: row.parent_id ? `${source}-${row.parent_id}` : null,
  author: row.author_name,
  content: row.content,
  date: new Date(row.created_at).toISOString(),
  likes: Number(row.likes || 0),
  isBot: Boolean(row.is_bot),
  botKey: row.bot_key || null,
  replies: []
});

function floodBlocked(articleId, author) {
  const key = `${articleId}::${author.toLowerCase()}`;
  const now = Date.now();
  const arr = (recentPosts.get(key) || []).filter((t) => now - t < FLOOD_WINDOW_MS);
  if (arr.length >= FLOOD_MAX_PER_KEY) {
    recentPosts.set(key, arr);
    return true;
  }
  arr.push(now);
  recentPosts.set(key, arr);
  // Cap map size in long-lived isolates
  if (recentPosts.size > 5000) {
    const first = recentPosts.keys().next().value;
    recentPosts.delete(first);
  }
  return false;
}

const getComments = async (articleId, articleUrl) => {
  const aliases = [articleId];
  if (/^rss-\d+$/.test(articleId)) {
    try {
      const row = (await pool.query('SELECT external_link FROM rss_articles WHERE id = $1', [articleId.slice(4)])).rows[0];
      if (row?.external_link) {
        aliases.push(
          'rss-' +
            crypto.createHash('sha1').update(row.external_link.split('#')[0]).digest('hex').slice(0, 16)
        );
      }
    } catch (_) {}
  }
  if (articleUrl && /^rss-[a-f0-9]{16}$/.test(articleId)) {
    const expected =
      'rss-' + crypto.createHash('sha1').update(articleUrl.split('#')[0]).digest('hex').slice(0, 16);
    if (expected === articleId) {
      try {
        const row = (await pool.query('SELECT id FROM rss_articles WHERE external_link = $1 LIMIT 1', [articleUrl])).rows[0];
        if (row) aliases.push(`rss-${row.id}`);
      } catch (_) {}
    }
  }

  // Cap rows so a viral article cannot blow memory / response size
  const external = await pool.query(
    `SELECT id, article_id, author_name, content, parent_id, likes, is_bot, bot_key, created_at
     FROM external_comments WHERE article_id = ANY($1::text[])
     ORDER BY created_at ASC, id ASC
     LIMIT 500`,
    [aliases]
  );

  let legacy = { rows: [] };
  try {
    legacy = await pool.query(
      `SELECT id, article_id, author_name, content, parent_id, likes, created_at,
              CASE WHEN device_id = 'realssa-community-bot' THEN TRUE ELSE FALSE END AS is_bot,
              CASE WHEN device_id = 'realssa-community-bot' THEN 'community-discussion' ELSE NULL END AS bot_key
       FROM comments WHERE article_id = ANY($1::text[])
       ORDER BY created_at ASC, id ASC
       LIMIT 200`,
      [aliases]
    );
  } catch (error) {
    console.warn('[External Comments] Legacy comments read skipped:', error.message);
  }

  const nodes = [
    ...external.rows.map((row) => normalize(row, 'external')),
    ...legacy.rows.map((row) => normalize(row, 'legacy')),
  ];

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const roots = [];
  for (const node of nodes) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId).replies.push(node);
    else roots.push(node);
  }
  return roots.sort((a, b) => new Date(a.date) - new Date(b.date));
};

module.exports = async function handler(req, res) {
  if (!pool) return send(res, 503, { error: 'Comments temporarily unavailable', retryable: true });

  try {
    const ready = await ensureTable();
    if (!ready) return send(res, 503, { error: 'Comments temporarily unavailable', retryable: true });

    const url = new URL(req.url, `https://${req.headers.host || 'www.realssanews.com.ng'}`);
    // Support both direct file hits and /api/external-comments rewrite paths
    const pathname = url.pathname.replace(/\/api\/external-comments\.js$/, '/api/external-comments');
    const match = pathname.match(/^\/api\/external-comments(?:\/([^/]+)\/like)?\/?$/);

    if (!match) return send(res, 404, { error: 'Not found' });

    if (req.method === 'GET' && !match[1]) {
      const articleId = String(url.searchParams.get('articleId') || '').trim();
      if (!articleId || articleId.length > 255) return send(res, 400, { error: 'Invalid articleId' });
      return send(res, 200, await getComments(articleId, url.searchParams.get('articleUrl')));
    }

    if (req.method === 'POST' && !match[1]) {
      const body = await readBody(req);
      const articleId = String(body.articleId || '').trim();

      if (body.action === 'ensure-community-prompt') {
        if (!articleId || articleId.length > 255) return send(res, 400, { error: 'Invalid articleId' });
        const articleUrl =
          typeof body.articleUrl === 'string' && body.articleUrl.length <= 2000 ? body.articleUrl : null;
        try {
          const { ensureArticlePrompt } = require('../backend/services/discussionBot');
          return send(res, 200, await ensureArticlePrompt(articleId, articleUrl));
        } catch (e) {
          console.warn('[External Comments] prompt bot skipped:', e.message);
          return send(res, 200, { created: false });
        }
      }

      const author = String(body.author || '').trim();
      const content = String(body.content || '').trim();
      const parentId = body.parentId ? String(body.parentId).trim() : null;

      if (!articleId || !author || !content) return send(res, 400, { error: 'Missing required fields' });
      if (articleId.length > 255 || author.length > 100 || content.length > 1000) {
        return send(res, 400, { error: 'Comment is too long' });
      }
      if (parentId && !/^external-\d+$|^legacy-\d+$/.test(parentId)) {
        return send(res, 400, { error: 'Invalid parent comment' });
      }

      if (floodBlocked(articleId, author)) {
        return send(res, 429, {
          error: 'Too many comments too fast. Please wait a minute.',
          retryable: true,
        });
      }

      let numericParent = null;
      if (parentId) {
        const [, source, id] = parentId.match(/^(external|legacy)-(\d+)$/) || [];
        if (source !== 'external') {
          return send(res, 400, { error: 'Replies to this comment are temporarily unavailable' });
        }
        numericParent = Number(id);
        const parent = await pool.query(
          'SELECT id FROM external_comments WHERE id = $1 AND article_id = $2',
          [numericParent, articleId]
        );
        if (!parent.rows.length) return send(res, 400, { error: 'Parent comment not found' });
      }

      const isBot =
        Boolean(body.isBot) || author === '@RealSSA_Bot' || author === '@RealSSA_Bot (Verified AI)';
      const botKey = isBot ? String(body.botKey || 'mention-reply').slice(0, 100) : null;

      const result = await pool.query(
        `INSERT INTO external_comments (article_id, author_name, content, parent_id, is_bot, bot_key)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, article_id, author_name, content, parent_id, likes, is_bot, bot_key, created_at`,
        [articleId, author, content, numericParent, isBot, botKey]
      );
      return send(res, 201, normalize(result.rows[0], 'external'));
    }

    if (req.method === 'POST' && match[1]) {
      const commentId = match[1];
      if (!/^\d+$/.test(commentId)) return send(res, 400, { error: 'Invalid comment id' });
      const result = await pool.query(
        `UPDATE external_comments SET likes = likes + 1
         WHERE id = $1
         RETURNING id, article_id, author_name, content, parent_id, likes, is_bot, bot_key, created_at`,
        [Number(commentId)]
      );
      if (!result.rows.length) return send(res, 404, { error: 'Comment not found' });
      return send(res, 200, normalize(result.rows[0], 'external'));
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('[External Comments] API error:', error.message);
    if (req.method === 'GET') return send(res, 200, []);
    return send(res, 500, {
      error: 'Comments temporarily unavailable',
      retryable: true,
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
