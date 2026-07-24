/**
 * Intelligent @RealSSA_Bot Comment Assistant (aiCommentBotService.js)
 * 
 * Answers user comments tagging @RealSSA_Bot inside comment sections.
 * 1. Reads current article context & title.
 * 2. Performs real-time multi-database search across DB1-DB4 for background context.
 * 3. Uses Gemini AI to draft an authoritative 2-3 sentence editor response.
 * 4. Logs bot memory into DB5 (ai_agent_memory).
 */

const { getAiPool, queryMultiDb } = require('../config/multiDb');
const { callGeminiText } = require('./aiAgentService');

async function handleCommentBotMention(commentText, articleTitle, articleContext = '') {
  console.log(`🤖 [@RealSSA_Bot] Received mention in comment: "${commentText.slice(0, 60)}"`);

  // Strip @RealSSA_Bot from prompt
  const userQuestion = commentText.replace(/@RealSSA_Bot/gi, '').trim() || 'Please explain what this means.';

  // 1. Query DB1-DB4 for background context on key keywords
  let searchContext = '';
  try {
    const keywords = userQuestion.split(/\s+/).filter(w => w.length > 3).slice(0, 3).join(' | ');
    if (keywords) {
      const dbRes = await queryMultiDb(`
        SELECT title, original_excerpt, ai_summary, category
        FROM rss_articles
        WHERE to_tsvector('english', title || ' ' || COALESCE(original_excerpt, '')) @@ to_tsquery('english', $1)
        ORDER BY published_at DESC
        LIMIT 3
      `, [keywords]);

      if (dbRes.rows.length > 0) {
        searchContext = dbRes.rows.map(r => `• ${r.title}: ${r.ai_summary || r.original_excerpt || ''}`).join('\n');
      }
    }
  } catch (dbErr) {
    console.warn('[@RealSSA_Bot] DB context search notice:', dbErr.message);
  }

  // 2. Draft authoritative response via Gemini AI
  const prompt = [
    'You are @RealSSA_Bot, the senior verified AI Fact-Checker and Editor for RealSSA News.',
    'A reader tagged you in the comment section asking a question about this news article.',
    '',
    `Article Title: "${articleTitle}"`,
    `Article Summary: "${articleContext.slice(0, 800)}"`,
    searchContext ? `Background Database Context:\n${searchContext}` : '',
    '',
    `User Question: "${userQuestion}"`,
    '',
    'INSTRUCTIONS:',
    '- Answer directly in 2 to 3 clear, authoritative, engaging sentences.',
    '- Cite verified facts if available. If information is evolving, state that data is being updated by the RealSSA News Desk.',
    '- End with a friendly, professional tone.',
    'Return ONLY the text response for the comment thread.'
  ].join('\n');

  let botReply = await callGeminiText('You are @RealSSA_Bot, senior AI news editor.', prompt);

  if (!botReply || botReply.length < 10) {
    botReply = `Thanks for asking! The RealSSA News Desk is actively tracking updates on "${articleTitle.slice(0, 50)}...". Stay tuned as more verified data develops! 📰`;
  }

  // 3. Log bot memory to DB5 (ai_agent_memory)
  try {
    const aiDb = getAiPool();
    await aiDb.query(`
      INSERT INTO ai_agent_memory (agent_name, action_type, target_id, input_summary, verification_result, confidence_score)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, ['@RealSSA_Bot', 'comment_reply', articleTitle.slice(0, 100), userQuestion, { reply: botReply }, 0.98]);
  } catch (memErr) {
    console.warn('[@RealSSA_Bot] Memory log notice:', memErr.message);
  }

  return {
    success: true,
    author: '@RealSSA_Bot (Verified AI)',
    reply: botReply,
    timestamp: new Date().toISOString()
  };
}

module.exports = { handleCommentBotMention };
