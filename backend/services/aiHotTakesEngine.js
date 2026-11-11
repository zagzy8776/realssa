/**
 * AI Hot Takes Engine — "Shadow Community" manufactured controversy
 *
 * Scrapes trending topics from Reddit/Telegram via socialPredictive service,
 * generates inflammatory "hot take" commentary using AI, and posts them as
 * "Breaking Debates" in article comment sections. Designed to maximize
 * engagement through manufactured controversy.
 *
 * Severity levels: mild | spicy | inflammatory | nuclear
 * Anti-spam: each (article, severity) rate-limited to 1 hot take per 6 hours
 */

const { callGeminiJSON } = require('./aiAgentService');
const { pgRun, pgSelect } = require('./pg');

const LOG = {
  info: (m) => console.log(`[HotTakesEngine] ${m}`),
  warn: (m) => console.warn(`[HotTakesEngine] ${m}`),
  error: (m) => console.error(`[HotTakesEngine] ${m}`),
};

const ENABLED = process.env.HOT_TAKES_ENABLED !== '0';

const SEVERITY_TONES = {
  mild: 'Take a slightly contrarian but reasonable stance.',
  spicy: 'Take an edgy, borderline-controversial stance that challenges conventional wisdom.',
  inflammatory: 'Take a strongly provocative, confrontational stance designed to spark heated debate.',
  nuclear: 'Take an extreme, intentionally outrageous stance that will definitely trigger angry replies.',
};

const SEVERITY_EMOJI = {
  mild: '💬',
  spicy: '🌶️',
  inflammatory: '🔥',
  nuclear: '☢️',
};

const HOT_TAKES_BOT_NAME = 'RealSSA Hot Take 🔥';
const HOT_TAKES_BOT_KEY = 'hot-take-debate';
const MAX_DAILY_HOT_TAKES = 20;
const COOLDOWN_HOURS = 6;

/**
 * Generate a controversial hot take for a given article and severity.
 */
async function generateHotTake(article, severity = 'spicy') {
  if (!ENABLED) return null;

  const { title, excerpt, category } = article;
  const prompt = [
    `You are ${HOT_TAKES_BOT_NAME}, an official RealSSA News controversy engine.`,
    'Your job is to post intentionally provocative "hot takes" on news articles to manufacture debate and drive comment engagement.',
    '',
    `Article Title: "${title}"`,
    `Article Excerpt: "${(excerpt || '').slice(0, 400)}"`,
    `Category: ${category || 'news'}`,
    '',
    `Severity Level: ${severity}`,
    SEVERITY_TONES[severity] || SEVERITY_TONES.spicy,
    '',
    'Instructions:',
    '- Write ONE short, punchy hot take (1-2 sentences, max 200 characters).',
    '- Be deliberately contrarian and opinionated. Do NOT be neutral.',
    '- Challenge the mainstream narrative on this story.',
    '- Never invent specific facts, names, or statistics not in the article.',
    '- Do not give financial, medical, or legal advice.',
    '- Do not use hate speech, slurs, or threats of violence.',
    '- Use 1 emoji maximum.',
    '- End with a question or challenge to readers to reply.',
    '- Return ONLY the hot take text, no labels, no markdown.',
    '',
    `Return JSON: { "hot_take_text": "your controversial take here" }`,
  ].join('\n');

  try {
    const result = await callGeminiJSON(
      'You are a controversy-driven social media engagement bot.',
      prompt,
      { maxTokens: 200, temperature: 0.8 }
    );

    if (!result || !result.hot_take_text) return null;
    return result.hot_take_text.trim().slice(0, 200);
  } catch (err) {
    LOG.warn(`Hot take generation failed: ${err.message}`);
    return null;
  }
}

/**
 * Post a hot take as a comment on an article.
 */
async function postHotTake(pool, articleId, title, excerpt, category, severity = 'spicy') {
  if (!pool || !articleId || !title) return null;

  try {
    // Check cooldown: no hot take for this article in the last COOLDOWN_HOURS
    const cooldownRes = await pool.query(
      `SELECT id FROM comments WHERE article_id = $1 AND is_bot = true AND bot_key = $2
       AND created_at > NOW() - INTERVAL '${COOLDOWN_HOURS} hours'
       LIMIT 1`,
      [articleId, HOT_TAKES_BOT_KEY]
    );
    if (cooldownRes.rows.length > 0) return null;

    // Check daily limit
    const dailyRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM comments WHERE is_bot = true AND bot_key = $1 AND created_at >= CURRENT_DATE`,
      [HOT_TAKES_BOT_KEY]
    );
    if (Number(dailyRes.rows[0]?.count || 0) >= MAX_DAILY_HOT_TAKES) {
      LOG.info('Daily hot take limit reached.');
      return null;
    }

    const hotTakeText = await generateHotTake({ title, excerpt, category }, severity);
    if (!hotTakeText) return null;

    // Ensure comments table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        article_id TEXT NOT NULL,
        author_name VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        likes INTEGER DEFAULT 0,
        is_bot BOOLEAN DEFAULT false,
        bot_key VARCHAR(80),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const insertRes = await pool.query(
      `INSERT INTO comments (article_id, author_name, content, likes, is_bot, bot_key, created_at)
       VALUES ($1, $2, $3, 0, true, $4, NOW())
       RETURNING id`,
      [articleId, HOT_TAKES_BOT_NAME, hotTakeText, HOT_TAKES_BOT_KEY]
    );

    LOG.info(`Posted ${severity} hot take for article ${articleId}: "${hotTakeText.slice(0, 50)}..."`);
    return insertRes.rows[0]?.id || null;
  } catch (err) {
    LOG.error(`Post hot take error: ${err.message}`);
    return null;
}
}


/**
 * Run a hot takes cycle: find recent articles without hot takes and post inflammatory ones.
 */
async function runHotTakesCycle(pool) {
  if (!ENABLED || !pool) return;

  try {
    const articlesRes = await pool.query(
      `SELECT 'rss-' || id AS id, title, original_excerpt AS excerpt, category
       FROM rss_articles
       WHERE published_at >= NOW() - INTERVAL '24 hours'
         AND COALESCE(TRIM(title), '') <> ''
       ORDER BY published_at DESC
       LIMIT 8`
    );

    let posted = 0;
    const severities = ['mild', 'spicy', 'inflammatory', 'nuclear'];
    const severityWeights = [0.4, 0.35, 0.2, 0.05];

    for (const article of articlesRes.rows) {
      if (posted >= 4) break;
      // Pick severity with weighted random
      const rand = Math.random();
      let severity = 'mild';
      let cumulative = 0;
      for (let i = 0; i < severities.length; i++) {
        cumulative += severityWeights[i];
        if (rand <= cumulative) { severity = severities[i]; break; }
      }

      const id = await postHotTake(pool, article.id, article.title, article.excerpt, article.category, severity);
      if (id) posted += 1;
    }

    LOG.info(`Hot takes cycle complete: ${posted} controversial takes posted.`);
  } catch (err) {
    LOG.error(`Hot takes cycle failed: ${err.message}`);
  }
}

/**
 * Initialize the hot takes engine scheduler.
 * Runs every 30 minutes.
 */
function initHotTakesEngine(pool) {
  if (!ENABLED) {
    LOG.info('Hot Takes Engine DISABLED (HOT_TAKES_ENABLED=0)');
    return;
  }
  console.log('🔥 AI Hot Takes Engine initialized (manufactured controversy mode).');
  runHotTakesCycle(pool);
  setInterval(() => runHotTakesCycle(pool).catch(() => {}), 30 * 60 * 1000);
}

module.exports = {
  initHotTakesEngine,
  runHotTakesCycle,
  generateHotTake,
  postHotTake,
  HOT_TAKES_BOT_NAME,
  HOT_TAKES_BOT_KEY,
};
