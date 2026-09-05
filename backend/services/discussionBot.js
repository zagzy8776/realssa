const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined });
const usersDbUrl = process.env.USERS_DATABASE_URL || process.env.DATABASE_URL;
const usersPool = new Pool({ connectionString: usersDbUrl, ssl: usersDbUrl ? { rejectUnauthorized: false } : undefined });

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';
const CEREBRAS_URL = 'https://api.cerebras.ai/v1/chat/completions';
const BOT_NAME = 'RealSSA Community Bot 🤖';
const BOT_DEVICE_ID = 'realssa-community-bot';
const BOT_KEY = 'community-discussion';
const SCAN_WINDOW_MINUTES = 120;
const MAX_ARTICLES_PER_CYCLE = 12;
const MAX_DAILY_PROMPTS = 30;
const CYCLE_MS = 5 * 60 * 1000;

const FALLBACK_QUESTIONS = {
  sports: 'What do you make of this result, and what should happen next?',
  politics: 'What impact do you think this development could have, and what should readers watch next?',
  crypto: 'What is the biggest thing readers should understand about this development?',
  tech: 'How significant do you think this development is for users and businesses?',
  business: 'What do you think this development means for businesses and consumers?',
  general: 'What is your take on this development, and what should readers watch next?'
};

const DISCUSSION_PROMPT = (title, excerpt, category) => [
  'You are the RealSSA News Community Editor.',
  'Write ONE short discussion question for a public news comment section.',
  'This is an official AI-generated RealSSA community prompt. Never pretend to be a human reader.',
  'Do not invent facts, names, quotes, statistics, events, or claims not supported by the supplied article context.',
  'Do not give financial, medical, legal, or investment instructions.',
  'Keep the question neutral, useful, and directly related to the article.',
  'Use standard Nigerian English. No hashtags, emojis, or fake engagement language.',
  'Maximum 2 sentences. Return only the question.',
  `Title: ${title}`,
  `Excerpt: ${excerpt || ''}`,
  `Category: ${category || 'news'}`
].join('\n');

function clean(value) {
  if (!value || typeof value !== 'string') return null;
  const text = value.replace(/^\s*(discussion question|comment|response)\s*:\s*/i, '').replace(/^['"]|['"]$/g, '').replace(/\s+/g, ' ').trim();
  return text.length >= 12 && text.length <= 500 ? text : null;
}

async function callGemini(prompt) {
  const keys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
  if (!keys.length) return null;
  try {
    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(keys[Math.floor(Math.random() * keys.length)])}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 100, temperature: 0.35 } }),
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return clean(data?.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (err) { console.warn('[Community Bot] Gemini failed:', err.message); return null; }
}

async function callCerebras(prompt) {
  if (!process.env.CEREBRAS_API_KEY) return null;
  try {
    const res = await fetch(CEREBRAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CEREBRAS_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-oss-120b', messages: [{ role: 'user', content: prompt }], max_tokens: 100, temperature: 0.35 }),
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return clean(data?.choices?.[0]?.message?.content);
  } catch (err) { console.warn('[Community Bot] Cerebras failed:', err.message); return null; }
}

async function generateDiscussionPrompt(title, excerpt, category) {
  const prompt = DISCUSSION_PROMPT(title, excerpt, category);
  return (await callGemini(prompt)) || (await callCerebras(prompt));
}

async function ensureBotSchema() {
  await usersPool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      article_id VARCHAR(255) NOT NULL,
      parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
      author_name VARCHAR(100) NOT NULL,
      device_id VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;
    ALTER TABLE comments ADD COLUMN IF NOT EXISTS bot_key VARCHAR(80);
    CREATE INDEX IF NOT EXISTS idx_comments_article ON comments (article_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_bot_article ON comments (article_id, bot_key) WHERE is_bot = true;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_comments_bot_article ON comments (article_id, bot_key) WHERE is_bot = true AND bot_key IS NOT NULL;
  `);
}

async function dailyLimitReached() {
  const result = await usersPool.query(`SELECT COUNT(*)::int AS count FROM comments WHERE is_bot = true AND bot_key = $1 AND created_at >= CURRENT_DATE`, [BOT_KEY]);
  return Number(result.rows[0]?.count || 0) >= MAX_DAILY_PROMPTS;
}

async function hasPrompt(articleId) {
  const result = await usersPool.query(`SELECT id FROM comments WHERE article_id = $1 AND is_bot = true AND bot_key = $2 LIMIT 1`, [articleId, BOT_KEY]);
  return result.rows.length > 0;
}

async function createPrompt(articleId, title, excerpt, category) {
  if (!articleId || !title || await hasPrompt(articleId)) return null;
  const content = (await generateDiscussionPrompt(title, excerpt, category)) || FALLBACK_QUESTIONS[String(category || 'general').toLowerCase()] || FALLBACK_QUESTIONS.general;

  try {
    const result = await usersPool.query(`
      INSERT INTO comments (article_id, parent_id, author_name, device_id, content, likes, created_at, is_bot, bot_key)
      SELECT $1, NULL, $2, $3, $4, 0, NOW(), true, $5
      WHERE NOT EXISTS (
        SELECT 1 FROM comments WHERE article_id = $1 AND is_bot = true AND bot_key = $5
      )
      RETURNING id
    `, [articleId, BOT_NAME, BOT_DEVICE_ID, content, BOT_KEY]);
    return result.rows[0]?.id || null;
  } catch (err) {
    console.error(`[Community Bot] Insert failed for ${articleId}:`, err.message);
    return null;
  }
}

async function monitorAndSimulate() {
  try {
    if (await dailyLimitReached()) {
      console.log(`[Community Bot] Daily limit reached (${MAX_DAILY_PROMPTS}).`);
      return;
    }

    const articlesRes = await pool.query(`
      SELECT 'rss-' || id AS id, title, original_excerpt AS excerpt, category
      FROM rss_articles
      WHERE published_at >= NOW() - INTERVAL '${SCAN_WINDOW_MINUTES} minutes'
        AND COALESCE(TRIM(title), '') <> ''
      ORDER BY published_at DESC
      LIMIT $1
    `, [MAX_ARTICLES_PER_CYCLE]);

    let created = 0;
    for (const article of articlesRes.rows) {
      if (created >= MAX_ARTICLES_PER_CYCLE || await dailyLimitReached()) break;
      const id = await createPrompt(article.id, article.title, article.excerpt, article.category);
      if (id) created += 1;
    }
    console.log(`[Community Bot] Cycle complete: ${created} official prompts created.`);
  } catch (err) { console.error('[Community Bot] Cycle failed:', err.message); }
}

async function initDiscussionBot() {
  try {
    await ensureBotSchema();
    console.log('📢 RealSSA Community Bot initialized.');
    await monitorAndSimulate();
    setInterval(() => monitorAndSimulate().catch(err => console.error('[Community Bot] Scheduled cycle failed:', err.message)), CYCLE_MS);
  } catch (err) { console.error('[Community Bot] Initialization failed:', err.message); }
}

module.exports = { initDiscussionBot };
