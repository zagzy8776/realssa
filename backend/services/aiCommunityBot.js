/**
 * AI Community & Conversation Bot (aiCommunityBot.js)
 * 
 * Features:
 * 1. AI Discussion Starter Generator: Analyzes new breaking stories and posts an engaging,
 *    thought-provoking discussion prompt at the top of the comment section.
 * 2. Real-Time Comment Moderation: Evaluates user comments before publication to filter
 *    out spam, financial scams, hate speech, and bot abuse automatically.
 */

const { callGeminiJSON } = require('./aiAgentService');

const DISCUSSION_STARTER_PROMPT = (title, summary, category) => [
  'You are the Senior Community Editor for RealSSA News, Africa\'s leading digital news platform.',
  'Analyze the following news article and generate a short, engaging, thought-provoking discussion starter question for the comment section.',
  '',
  `Title: "${title}"`,
  `Summary: "${summary}"`,
  `Category: ${category}`,
  '',
  'Editorial Instructions:',
  '- Write 1 or 2 engaging sentences inviting everyday readers to share their opinion.',
  '- Be neutral, friendly, and respectful.',
  '- Use 1 natural emoji.',
  '- End with a call to action like: "Share your thoughts below! 👇" or "What is your take on this? Let us know below! 👇"',
  '',
  'Return JSON: { "starter_text": "The short discussion prompt text" }'
].join('\n');

const MODERATION_PROMPT = (author, content) => [
  'You are an Automated AI Comment Moderator for RealSSA News.',
  'Evaluate the following user comment for compliance with editorial community standards.',
  '',
  `Author: "${author}"`,
  `Comment Content: "${content}"`,
  '',
  'Flag and reject the comment if it contains:',
  '1. Financial scams, WhatsApp money doubling schemes, crypto giveaways, or spam URLs.',
  '2. Severe hate speech, harassment, slurs, or explicit threats of violence.',
  '3. Complete random gibberish (e.g. "asdfghjkl", "123123123").',
  '',
  'Return JSON:',
  '{',
  '  "approved": boolean,',
  '  "reason": "Clean" | "Spam/Scam" | "Hate Speech" | "Gibberish"',
  '}'
].join('\n');

/**
 * Generate and insert an AI Discussion Starter comment for an article.
 * @param {object} pool - PostgreSQL pool connection
 * @param {string|number} articleId - Raw article ID
 * @param {string} title - Article title
 * @param {string} summary - Article summary
 * @param {string} category - Article category
 */
async function generateDiscussionStarter(pool, articleId, title, summary, category) {
  if (!pool || !articleId || !title) return null;

  try {
    // Check if a starter comment already exists for this article
    const existing = await pool.query(
      `SELECT id FROM comments WHERE article_id = $1 AND is_ai_starter = true LIMIT 1`,
      [`${articleId}`]
    );

    if (existing.rows.length > 0) return null;

    const result = await callGeminiJSON(
      'You are the Senior Community Editor at RealSSA News.',
      DISCUSSION_STARTER_PROMPT(title, summary || title, category || 'general'),
      { maxTokens: 250, temperature: 0.5 }
    );

    if (!result || !result.starter_text) return null;

    const starterText = result.starter_text.trim();

    // Ensure comments table has necessary columns
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        article_id TEXT NOT NULL,
        author VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        likes INTEGER DEFAULT 0,
        is_ai_starter BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'approved',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Insert AI Discussion Starter
    const insertRes = await pool.query(
      `INSERT INTO comments (article_id, author, content, likes, is_ai_starter, status, created_at)
       VALUES ($1, 'RealSSA Editor AI 💬', $2, 5, true, 'approved', NOW())
       RETURNING id`,
      [`${articleId}`, starterText]
    );

    console.log(`💬 [AI Community Bot] Posted discussion starter for article ${articleId}: "${starterText.slice(0, 50)}..."`);
    return insertRes.rows[0]?.id || null;
  } catch (err) {
    console.error('❌ [AI Community Bot] Discussion starter error:', err.message);
    return null;
  }
}

/**
 * Moderate a user-submitted comment in real-time.
 * @param {string} author - Author name
 * @param {string} content - Comment text
 * @returns {Promise<{approved: boolean, reason: string}>}
 */
async function moderateUserComment(author, content) {
  if (!content || content.trim().length < 2) {
    return { approved: false, reason: 'Comment too short' };
  }

  // Fast-path regex checks for obvious spam/scams before hitting AI
  const SPAM_REGEX = /(whatsapp\s*group|\+234\d{10}|make\s*\$\d+.*day|crypto\s*giveaway|telegram\s*t\.me)/i;
  if (SPAM_REGEX.test(content)) {
    return { approved: false, reason: 'Spam/Scam link detected' };
  }

  try {
    const result = await callGeminiJSON(
      'You are an Automated Comment Moderator.',
      MODERATION_PROMPT(author || 'Anonymous', content),
      { maxTokens: 150, temperature: 0.1 }
    );

    if (result && typeof result.approved === 'boolean') {
      return {
        approved: result.approved,
        reason: result.reason || (result.approved ? 'Clean' : 'Violates community guidelines')
      };
    }
  } catch (err) {
    console.warn('[AI Community Bot] Moderation fallback to basic checks:', err.message);
  }

  // Safe fallback if AI is unavailable: approve unless basic spam keywords exist
  return { approved: true, reason: 'Clean' };
}

module.exports = { generateDiscussionStarter, moderateUserComment };
