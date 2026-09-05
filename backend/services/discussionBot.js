const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

const usersDbUrl = process.env.USERS_DATABASE_URL || process.env.DATABASE_URL;
const usersPool = new Pool({
  connectionString: usersDbUrl,
  ssl: usersDbUrl ? { rejectUnauthorized: false } : undefined
});

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';
const CEREBRAS_URL = 'https://api.cerebras.ai/v1/chat/completions';

const BOT_NAME = 'RealSSA Community Bot 🤖';
const BOT_DEVICE_ID = 'realssa-community-bot';
const SCAN_WINDOW_MINUTES = 30;
const MAX_ARTICLES_PER_CYCLE = 12;
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
  'Do not invent facts, names, quotes, statistics, events, or claims that are not supported by the supplied article context.',
  'Do not give financial, medical, legal, or investment instructions.',
  'Keep the question neutral, useful, and directly related to the article.',
  'Use standard Nigerian English. No hashtags. Maximum 2 sentences. No emojis.',
  '',
  `Title: ${title}`,
  `Excerpt: ${excerpt || ''}`,
  `Category: ${category || 'news'}`,
  '',
  'Return ONLY the discussion question text.'
].join('\n');

function cleanGeneratedText(value) {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value
    .replace(/^\s*(discussion question|comment|response)\s*:\s*/i, '')
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 12 || cleaned.length > 500) return null;
  return cleaned;
}

async function callGemini(promptText) {
  const keys = (process.env.GEMINI_API_KEY || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  if (!keys.length) return null;
  const key = keys[Math.floor(Math.random() * keys.length)];

  try {
    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          maxOutputTokens: 100,
          temperature: 0.35
        }
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) return null;
    const data = await res.json();
    return cleanGeneratedText(data?.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (err) {
    console.warn('[Community Bot] Gemini request failed:', err.message);
    return null;
  }
}

async function callCerebras(promptText) {
  const key = process.env.CEREBRAS_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(CEREBRAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-oss-120b',
        messages: [{ role: 'user', content: promptText }],
        max_tokens: 100,
        temperature: 0.35
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) return null;
    const data = await res.json();
    return cleanGeneratedText(data?.choices?.[0]?.message?.content);
  } catch (err) {
    console.warn('[Community Bot] Cerebras request failed:', err.message);
    return null;
  }
}

async function generateDiscussionPrompt(title, excerpt, category) {
  const prompt = DISCUSSION_PROMPT(title, excerpt, category);
  return (await callGemini(prompt)) || (await callCerebras(prompt));
}

async function ensureBotSchema() {
  await usersPool.query(`
    ALTER TABLE comments
      ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS bot_key VARCHAR(80)
  `);

  await usersPool.query(`
    CREATE INDEX IF NOT EXISTS idx_comments_bot_article
    ON comments (article_id, bot_key)
    WHERE is_bot = true
  `);

  // Prevent duplicate official bot prompts when multiple worker instances overlap.
  await usersPool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_comments_bot_article
    ON comments (article_id, bot_key)
    WHERE is_bot = true AND bot_key IS NOT NULL
  `);
}

async function articleAlreadyHasBotComment(articleId) {
  const result = await usersPool.query(
    `SELECT id FROM comments
     WHERE article_id = $1 AND is_bot = true AND bot_key = $2
     LIMIT 1`,
    [articleId, BOT_DEVICE_ID]
  );
  return result.rows.length > 0;
}

async function insertBotComment(articleId, content) {
  try {
    const result = await usersPool.query(
      `INSERT INTO comments (
        article_id,
        parent_id,
        author_name,
        device_id,
        content,
        likes,
        created_at,
        is_bot,
        bot_key
      ) VALUES ($1, NULL, $2, $3, $4, 0, NOW(), true, $5)
      ON CONFLICT DO NOTHING
      RETURNING *`,
      [articleId, BOT_NAME, BOT_DEVICE_ID, content, BOT_DEVICE_ID]
    );

    return result.rows[0] || null;
  } catch (err) {
    console.error(`[Community Bot] Insert failed for article ${articleId}:`, err.message);
    return null;
  }
}

async function buildDiscussionThread(articleId, title, excerpt, category) {
  if (!articleId || !title) return null;

  // A transaction-scoped advisory lock stops duplicate generation across workers.
  const client = await usersPool.connect();
  try {
    await client.query('BEGIN');
    const lock = await client.query(
      'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked',
      [`realssa-community-bot:${articleId}`]
    );

    if (!lock.rows[0]?.locked) {
      await client.query('ROLLBACK');
      return null;
    }

    const existing = await client.query(
      `SELECT id FROM comments
       WHERE article_id = $1 AND is_bot = true AND bot_key = $2
       LIMIT 1`,
      [articleId, BOT_DEVICE_ID]
    );

    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const generated = await generateDiscussionPrompt(title, excerpt, category);
    const categoryKey = String(category || 'general').toLowerCase();
    const content = generated || FALLBACK_QUESTIONS[categoryKey] || FALLBACK_QUESTIONS.general;

    const result = await client.query(
      `INSERT INTO comments (
        article_id, parent_id, author_name, device_id, content, likes, created_at, is_bot, bot_key
      ) VALUES ($1, NULL, $2, $3, $4, 0, NOW(), true, $5)
      ON CONFLICT DO NOTHING
      RETURNING id`,
      [articleId, BOT_NAME, BOT_DEVICE_ID, content, BOT_DEVICE_ID]
    );

    await client.query('COMMIT');

    if (result.rows[0]?.id) {
      console.log(`💬 [Community Bot] Posted official discussion prompt for ${articleId}`);
      return result.rows[0].id;
    }
    return null;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error(`[Community Bot] Thread creation failed for ${articleId}:`, err.message);
    return null;
  } finally {
    client.release();
  }
}

async function monitorAndSimulate() {
  try {
    console.log('[Community Bot] Checking recent articles for discussion prompts...');

    const articlesRes = await pool.query(`
      SELECT 'rss-' || id AS id, title, original_excerpt AS excerpt, category
      FROM rss_articles
      WHERE published_at >= NOW() - INTERVAL '${SCAN_WINDOW_MINUTES} minutes'
      ORDER BY published_at DESC
      LIMIT $1
    `, [MAX_ARTICLES_PER_CYCLE]);

    let created = 0;
    for (const article of articlesRes.rows) {
      if (await articleAlreadyHasBotComment(article.id)) continue;
      const id = await buildDiscussionThread(article.id, article.title, article.excerpt, article.category);
      if (id) created += 1;
    }

    console.log(`[Community Bot] Cycle complete: ${created} official prompts created.`);
  } catch (err) {
    console.error('[Community Bot] Monitoring cycle failed:', err.message);
  }
}

async function initDiscussionBot() {
  try {
    await ensureBotSchema();
    console.log('📢 RealSSA Community Bot initialized (transparent, idempotent mode).');
    await monitorAndSimulate();

    setInterval(() => {
      monitorAndSimulate().catch(err => {
        console.error('[Community Bot] Scheduled cycle failed:', err.message);
      });
    }, CYCLE_MS);
  } catch (err) {
    console.error('[Community Bot] Initialization failed:', err.message);
  }
}

module.exports = { initDiscussionBot };
