const { pools } = require('../backend/config/multiDb');

const pool = pools?.[0]?.pool;

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

const ensureTable = async () => {
  if (!pool) return false;
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
    );
    ALTER TABLE external_comments ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE external_comments ADD COLUMN IF NOT EXISTS bot_key TEXT NULL;
    CREATE INDEX IF NOT EXISTS idx_external_comments_article
      ON external_comments (article_id, created_at ASC, id ASC);
  `);
  return true;
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

const getComments = async (articleId) => {
  const external = await pool.query(
    `SELECT id, article_id, author_name, content, parent_id, likes, is_bot, bot_key, created_at
     FROM external_comments WHERE article_id = $1 ORDER BY created_at ASC, id ASC`,
    [articleId]
  );

  let legacy = { rows: [] };
  try {
    legacy = await pool.query(
      `SELECT id, article_id, author_name, content, parent_id, likes, created_at,
              CASE WHEN device_id = 'realssa-community-bot' THEN TRUE ELSE FALSE END AS is_bot,
              CASE WHEN device_id = 'realssa-community-bot' THEN 'community-discussion' ELSE NULL END AS bot_key
       FROM comments WHERE article_id = $1 ORDER BY created_at ASC, id ASC`,
      [articleId]
    );
  } catch (error) {
    console.warn('[External Comments] Legacy comments read skipped:', error.message);
  }

  const nodes = [
    ...external.rows.map((row) => normalize(row, 'external')),
    ...legacy.rows.map((row) => normalize(row, 'legacy'))
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
    await ensureTable();
    const url = new URL(req.url, `https://${req.headers.host || 'www.realssanews.com.ng'}`);
    const match = url.pathname.match(/^\/api\/external-comments(?:\/([^/]+)\/like)?\/?$/);

    if (!match) return send(res, 404, { error: 'Not found' });

    if (req.method === 'GET' && !match[1]) {
      const articleId = String(url.searchParams.get('articleId') || '').trim();
      if (!articleId || articleId.length > 255) return send(res, 400, { error: 'Invalid articleId' });
      return send(res, 200, await getComments(articleId));
    }

    if (req.method === 'POST' && !match[1]) {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const articleId = String(body.articleId || '').trim();
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

      let numericParent = null;
      if (parentId) {
        const [, source, id] = parentId.match(/^(external|legacy)-(\d+)$/) || [];
        if (source !== 'external') return send(res, 400, { error: 'Replies to this comment are temporarily unavailable' });
        numericParent = Number(id);
        const parent = await pool.query(
          'SELECT id FROM external_comments WHERE id = $1 AND article_id = $2',
          [numericParent, articleId]
        );
        if (!parent.rows.length) return send(res, 400, { error: 'Parent comment not found' });
      }

      const isBot = Boolean(body.isBot) || author === '@RealSSA_Bot' || author === '@RealSSA_Bot (Verified AI)';
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
    return send(res, 500, { error: 'Comments temporarily unavailable', retryable: true });
  }
};
