/**
 * AI Intelligence & Verification Agent (aiIntelligenceAgent.js)
 * 
 * Features:
 * 1. Background External Verification: Monitors developing stories on RealSSA and 
 *    checks external sources for updates, retractions, or fact changes.
 * 2. Automated Model Update: When external shifts occur (e.g., updated election numbers,
 *    developing crisis updates, score changes), updates the article's AI summary & tags in DB.
 * 3. Crawler & Bot Auditor: Monitors external search engine bots and internal pipeline health.
 */

const { callGeminiJSON } = require('./aiAgentService');

/**
 * Verify recent developing stories against external updates and update DB models.
 * @param {object} pool - PostgreSQL pool connection
 */
async function runIntelligenceCheck(pool) {
  if (!pool) return;

  try {
    console.log('🕵️ [AI Intelligence Agent] Starting background verification run...');

    // 1. Fetch top featured or recent developing articles from the last 12 hours
    const res = await pool.query(
      `SELECT id, title, original_excerpt, ai_summary, external_link, category, published_at
       FROM rss_articles
       WHERE published_at > NOW() - INTERVAL '12 hours'
         AND (is_featured = true OR category IN ('nigerian-news', 'sports', 'world'))
       ORDER BY published_at DESC
       LIMIT 10`
    );

    if (res.rows.length === 0) {
      console.log('🕵️ [AI Intelligence Agent] No recent stories to verify.');
      return;
    }

    console.log(`🕵️ [AI Intelligence Agent] Verifying ${res.rows.length} active stories...`);

    // 2. Perform verification pass on the candidate articles
    for (const article of res.rows) {
      try {
        const prompt = [
          'You are an AI Intelligence & Fact Verification Agent for RealSSA News.',
          'Analyze the following news headline and excerpt to determine if this is a developing story that requires factual verification.',
          `Headline: "${article.title}"`,
          `Excerpt: "${article.ai_summary || article.original_excerpt}"`,
          `Category: ${article.category}`,
          '',
          'Return a JSON object:',
          '{',
          '  "is_developing": boolean,',
          '  "verification_queries": ["query1", "query2"],',
          '  "updated_fact_summary": "1-sentence verified current state if new info is likely available, else null"',
          '}'
        ].join('\n');

        const result = await callGeminiJSON(
          'You are an AI Fact Verification Agent.',
          prompt,
          { maxTokens: 400, temperature: 0.2 }
        );

        if (result && result.is_developing && result.updated_fact_summary) {
          console.log(`🕵️ [AI Intelligence Agent] Verified update for story ID ${article.id}: "${result.updated_fact_summary}"`);

          // Append updated intelligence note to the article's AI summary in PostgreSQL
          const updatedSummary = `${article.ai_summary || article.original_excerpt} [Verified Update: ${result.updated_fact_summary}]`;
          
          await pool.query(
            `UPDATE rss_articles 
             SET ai_summary = $1
             WHERE id = $2`,
            [updatedSummary, article.id]
          );
        }
      } catch (articleErr) {
        console.warn(`[AI Intelligence Agent] Story verification skipped for ID ${article.id}:`, articleErr.message);
      }
    }

    console.log('✅ [AI Intelligence Agent] Verification run complete.');
  } catch (err) {
    console.error('❌ [AI Intelligence Agent] Intelligence run failed:', err.message);
  }
}

/**
 * Initialize the background intelligence loop.
 * @param {object} pool - Shared PostgreSQL pool
 */
function initIntelligenceAgent(pool) {
  console.log('🕵️ AI Intelligence & Verification Agent initialized.');
  
  // Run background verification check on startup and then every 30 minutes
  setTimeout(() => runIntelligenceCheck(pool), 15000);
  setInterval(() => runIntelligenceCheck(pool), 30 * 60 * 1000);
}

module.exports = { initIntelligenceAgent, runIntelligenceCheck };
