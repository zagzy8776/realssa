/**
 * RealSSA Comment Assistant (aiCommentBotService.js)
 *
 * Responds when a reader explicitly tags @RealSSA_Bot.
 * The bot is always disclosed as an official RealSSA AI account and is
 * instructed not to invent facts or present uncertain information as verified.
 */

const { getAiPool, queryMultiDb } = require('../config/multiDb');
const { callGeminiText } = require('./aiAgentService');

const BOT_NAME = '@RealSSA_Bot';
const MAX_COMMENT_LENGTH = 2000;
const MAX_ARTICLE_CONTEXT = 1200;

function normalizeText(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function buildSearchTerms(question) {
  return normalizeText(question, 300)
    .split(/\s+/)
    .map(word => word.replace(/[^a-zA-Z0-9'-]/g, ''))
    .filter(word => word.length >= 4)
    .slice(0, 5);
}

async function findBackgroundContext(question) {
  const terms = buildSearchTerms(question);
  if (!terms.length) return '';

  try {
    // Build a safe OR query from sanitized individual terms instead of passing
    // arbitrary user text into to_tsquery().
    const tsQuery = terms.map(term => `${term}:*`).join(' | ');
    const dbRes = await queryMultiDb(`
      SELECT title, original_excerpt, ai_summary, category
      FROM rss_articles
      WHERE to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(original_excerpt, ''))
        @@ to_tsquery('english', $1)
      ORDER BY published_at DESC
      LIMIT 4
    `, [tsQuery]);

    return dbRes.rows
      .map(row => `• ${normalizeText(row.title, 180)}: ${normalizeText(row.ai_summary || row.original_excerpt, 500)}`)
      .filter(Boolean)
      .join('\n');
  } catch (error) {
    console.warn(`[${BOT_NAME}] Context search skipped:`, error.message);
    return '';
  }
}

async function handleCommentBotMention(commentText, articleTitle, articleContext = '') {
  const rawComment = normalizeText(commentText, MAX_COMMENT_LENGTH);
  const title = normalizeText(articleTitle, 300);
  const context = normalizeText(articleContext, MAX_ARTICLE_CONTEXT);

  if (!rawComment || !title) {
    return {
      success: false,
      author: BOT_NAME,
      reply: 'Please include the article context and your question so I can help.',
      timestamp: new Date().toISOString()
    };
  }

  console.log(`🤖 [${BOT_NAME}] Received a reader mention.`);

  const userQuestion = normalizeText(
    rawComment.replace(/@RealSSA_Bot/gi, ''),
    1200
  ) || 'Please explain what this means.';

  const searchContext = await findBackgroundContext(userQuestion);

  const prompt = [
    `You are ${BOT_NAME}, the official AI community assistant for RealSSA News.`,
    'A reader explicitly tagged you in a public comment.',
    'You must be transparent that you are an AI assistant. Never impersonate a human reader.',
    'Use only the supplied article context and database context as evidence.',
    'Do not invent facts, quotes, sources, statistics, events, identities, or outcomes.',
    'If the supplied evidence is insufficient, say that the RealSSA News Desk needs more verified information.',
    'Do not provide financial, medical, or legal instructions.',
    'Answer directly in 2 to 3 clear sentences.',
    'Return ONLY the response text, without labels or markdown.',
    '',
    `Article Title: ${title}`,
    `Article Context: ${context || 'No article summary was supplied.'}`,
    searchContext ? `Related RealSSA context:\n${searchContext}` : '',
    '',
    `Reader question: ${userQuestion}`
  ].join('\n');

  let botReply = null;
  try {
    botReply = normalizeText(
      await callGeminiText(`You are ${BOT_NAME}, an official RealSSA News AI assistant.`, prompt),
      900
    );
  } catch (error) {
    console.warn(`[${BOT_NAME}] Generation failed:`, error.message);
  }

  if (!botReply || botReply.length < 10) {
    botReply = `I’m ${BOT_NAME}, RealSSA News’s AI community assistant. I don’t have enough verified information in the supplied article context to answer that confidently yet; the News Desk is tracking further updates.`;
  }

  // Memory is useful, but it must never prevent a valid public response.
  try {
    const aiDb = getAiPool();
    await aiDb.query(`
      INSERT INTO ai_agent_memory (
        agent_name, action_type, target_id, input_summary, verification_result, confidence_score
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      BOT_NAME,
      'comment_reply',
      title.slice(0, 100),
      userQuestion.slice(0, 500),
      JSON.stringify({ reply: botReply, grounded: Boolean(searchContext || context) }),
      searchContext || context ? 0.75 : 0.35
    ]);
  } catch (error) {
    console.warn(`[${BOT_NAME}] Memory log skipped:`, error.message);
  }

  return {
    success: true,
    author: `${BOT_NAME} (Official AI)`,
    reply: botReply,
    timestamp: new Date().toISOString()
  };
}

module.exports = { handleCommentBotMention };
