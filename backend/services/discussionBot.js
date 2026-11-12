const { pools } = require('../config/multiDb');
const { runAI } = require('./aiRouter.cjs');
const { createHash } = require('crypto');
const pool = pools?.[0]?.pool;
const BOT_NAME = 'RealSSA Community Bot 🤖';
const BOT_KEY = 'community-discussion';
const DAILY_LIMIT = Math.max(1, Number(process.env.COMMUNITY_BOT_DAILY_LIMIT) || 30);
let timer;
let schemaReady;
async function ensureBotSchema() {
  if (!pool) throw new Error('Community bot database is not configured');
  if (!schemaReady) schemaReady = pool.query(`CREATE TABLE IF NOT EXISTS external_comments (
    id BIGSERIAL PRIMARY KEY, article_id TEXT NOT NULL, author_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL, parent_id BIGINT, likes INTEGER DEFAULT 0,
    is_bot BOOLEAN DEFAULT false, bot_key TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    ALTER TABLE external_comments ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;
    ALTER TABLE external_comments ADD COLUMN IF NOT EXISTS bot_key TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_external_community_prompt
      ON external_comments(article_id, bot_key) WHERE is_bot = true AND bot_key = 'community-discussion';`)
    .catch(error => { schemaReady = null; throw error; });
  await schemaReady;
}
async function generateDiscussionPrompt(title, excerpt, category) {
  return runAI('comment', [
    'You are the official RealSSA AI Community Bot, openly identified as a bot.',
    'Ask one useful, neutral discussion question about this article. Maximum two sentences.',
    'Use only the supplied context. Do not invent facts or impersonate a human reader.',
    'Return just the question, no labels, hashtags, or quotation marks.',
    `Title: ${JSON.stringify(title)}`, `Category: ${JSON.stringify(category)}`,
    `Context: ${JSON.stringify(String(excerpt || '').slice(0, 5000))}`
  ].join('\n'), { maxTokens: 250, budgetMs: 20000, validate: text => text.length >= 12 && text.length <= 500 });
}
const feedId = url => 'rss-' + createHash('sha1').update(url.split('#')[0]).digest('hex').slice(0, 16);
async function liveCandidates() {
  const articles = await require('../../api/home-feed').getHomeArticles();
  return articles.map(article => ({ id: article.id, title: article.title,
    excerpt: article.excerpt, category: article.category, external_link: article.externalLink }));
}
async function savedCandidates(client, articleId, articleUrl) {
  const numeric = /^rss-\d+$/.test(articleId || '') ? articleId.slice(4) : null;
  return (await client.query(`SELECT 'rss-' || a.id AS id, a.title,
    COALESCE(a.ai_summary, a.full_content, a.original_excerpt) AS excerpt, a.category, a.external_link
    FROM rss_articles a WHERE ${articleId ? '(($1::text IS NOT NULL AND a.id::text = $1) OR ($2::text IS NOT NULL AND a.external_link = $2))' : "a.published_at >= NOW() - INTERVAL '2 days'"}
    ORDER BY a.published_at DESC LIMIT ${articleId ? '1' : '60'}`, articleId ? [numeric, articleUrl || null] : [])).rows;
}
async function hasPrompt(client, article) {
  const aliases = [article.id];
  if (article.external_link) aliases.push(feedId(article.external_link));
  const result = await client.query(`SELECT id FROM external_comments
    WHERE article_id = ANY($1::text[]) AND is_bot = true AND bot_key = $2 LIMIT 1`, [aliases, BOT_KEY]);
  return result.rows.length > 0;
}
async function runCycle({ articleId, articleUrl } = {}) {
  await ensureBotSchema();
  const client = await pool.connect();
  let locked = false;
  try {
    locked = (await client.query('SELECT pg_try_advisory_lock(728393) AS locked')).rows[0]?.locked;
    if (!locked) return { created: 0, skipped: 'already_running' };
    const count = Number((await client.query(`SELECT COUNT(*)::int AS count FROM external_comments
      WHERE is_bot = true AND bot_key = $1 AND created_at >= CURRENT_DATE`, [BOT_KEY])).rows[0]?.count || 0);
    const limit = Math.min(articleId ? 1 : 3, Math.max(0, DAILY_LIMIT - count));
    if (!limit) return { created: 0, skipped: 'daily_limit', dailyLimit: DAILY_LIMIT };
    let saved = [];
    try { saved = await savedCandidates(client, articleId, articleUrl); }
    catch (error) { console.warn('[Community Bot] Saved articles unavailable:', error.code || error.name); }
    // Homepage RSS articles remain eligible even before ingestion saves them.
    let live = [];
    if (!articleId || !saved.length) live = await liveCandidates();
    if (articleId) {
      live = live.filter(article => article.id === articleId && (!articleUrl || article.external_link === articleUrl));
      saved = saved.filter(article => article.id === articleId || article.external_link && feedId(article.external_link) === articleId);
    }
    const seen = new Set();
    const candidates = [...saved, ...live].filter(article => {
      const key = article.external_link || article.id;
      if (!article.title || seen.has(key)) return false;
      seen.add(key); return true;
    });
    let created = 0, attempted = 0;
    for (const article of candidates) {
      if (created >= limit || attempted >= limit) break;
      if (await hasPrompt(client, article)) continue;
      attempted++;
      const content = await generateDiscussionPrompt(article.title, article.excerpt, article.category);
      if (!content) continue;
      const result = await client.query(`INSERT INTO external_comments
        (article_id, author_name, content, is_bot, bot_key) VALUES ($1, $2, $3, true, $4)
        ON CONFLICT DO NOTHING RETURNING id`, [article.id, BOT_NAME, content, BOT_KEY]);
      created += result.rows.length;
    }
    return { created, selected: candidates.length, attempted,
      ...(articleId && !candidates.length ? { skipped: 'unknown_article' } : {}) };
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock(728393)').catch(() => {});
    client.release();
  }
}
async function monitorAndSimulate() {
  const result = await runCycle();
  console.info('[Community Bot] Scheduled cycle:', JSON.stringify(result));
  return result;
}
async function ensureArticlePrompt(articleId, articleUrl) {
  if (!/^rss-(?:\d+|[a-f0-9]{16})$/.test(articleId || '')) return { created: 0, skipped: 'unsupported_article' };
  const result = await runCycle({ articleId, articleUrl });
  console.info('[Community Bot] Reader request:', articleId, JSON.stringify(result));
  return result;
}
async function initDiscussionBot() {
  if (timer) return;
  timer = setInterval(() => monitorAndSimulate().catch(error => console.error('[Community Bot]', error.code || error.name)), 5 * 60000);
  await monitorAndSimulate();
}
module.exports = { initDiscussionBot, monitorAndSimulate, generateDiscussionPrompt, ensureArticlePrompt };
