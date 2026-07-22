/**
 * AI Trending Topic Synthesizer Agent (aiTrendingSynthesizer.js)
 * 
 * Features:
 * 1. Trend Detection: Monitors Google Trends RSS for Nigeria (NG) & West Africa.
 * 2. Content Gap Check: Checks PostgreSQL to see if RealSSA already covers the trend.
 * 3. Autonomous Article Synthesis: Synthesizes a original, professional news report
 *    using multi-provider AI if the topic has zero coverage.
 * 4. Automatic Indexing Dispatch: Triggers Master Search Controller so the article
 *    is indexed by Google & Bing within minutes of creation.
 */

const crypto = require('crypto');
const Parser = require('rss-parser');
const { callGeminiJSON } = require('./aiAgentService');
const { dispatchIndexingCommand } = require('./searchController');

const parser = new Parser();
const TRENDS_RSS_NG = 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=NG';

const SYNTHESIZE_PROMPT = (topic, snippet) => [
  'You are a Lead Senior Reporter for RealSSA News, Africa\'s leading digital news network.',
  `Synthesize an original, high-quality breaking news article for the trending topic: "${topic}".`,
  `Context / Search Snippet: "${snippet}"`,
  '',
  'Strict JSON Output Requirements:',
  '{',
  '  "title": "Compelling, journalistic headline under 90 characters",',
  '  "summary": "2-sentence executive summary stating the key fact and its significance for readers.",',
  '  "category": "nigerian-news|sports|business|world|tech",',
  '  "content": "<p>Paragraph 1 stating what happened...</p><p>Paragraph 2 providing background and context...</p><p>Paragraph 3 explaining implications and next steps...</p>"',
  '}',
  'Return ONLY valid JSON.'
].join('\n');

/**
 * Run the AI Trending Topic Synthesizer cycle.
 * @param {object} pool - PostgreSQL pool connection
 */
async function runTrendingSynthesizer(pool) {
  if (!pool) return;

  try {
    console.log('⚡ [AI Trending Synthesizer] Fetching Google Trends for Nigeria...');
    const feed = await parser.parseURL(TRENDS_RSS_NG);

    if (!feed || !feed.items || feed.items.length === 0) {
      console.log('⚡ [AI Trending Synthesizer] No trend items returned.');
      return;
    }

    // Process top 5 trending topics
    const trends = feed.items.slice(0, 5);

    for (const item of trends) {
      const topic = item.title ? item.title.trim() : '';
      if (!topic) continue;

      // 1. Check if RealSSA already has coverage in rss_articles
      const checkRes = await pool.query(
        `SELECT id FROM rss_articles 
         WHERE title ~* $1 
            OR original_excerpt ~* $1 
            OR ai_summary ~* $1
         LIMIT 1`,
        [topic.replace(/[^a-zA-Z0-9\s]/g, '')]
      );

      if (checkRes.rows.length > 0) {
        console.log(`⚡ [AI Trending Synthesizer] Already covered trend: "${topic}" — skipping.`);
        continue;
      }

      console.log(`⚡ [AI Trending Synthesizer] 🚀 Content Gap Found for trend: "${topic}" — Synthesizing article...`);

      const snippet = item.contentSnippet || item.description || topic;
      const result = await callGeminiJSON(
        'You are a Senior Reporter at RealSSA News.',
        SYNTHESIZE_PROMPT(topic, snippet),
        { maxTokens: 900, temperature: 0.4 }
      );

      if (!result || !result.title || !result.content) {
        console.warn(`⚡ [AI Trending Synthesizer] Synthesis failed for topic: "${topic}"`);
        continue;
      }

      // Generate unique hash
      const urlHash = crypto.createHash('md5').update('trend-' + topic + Date.now()).digest('hex');
      const storyHash = crypto.createHash('md5').update(result.title).digest('hex');
      const category = result.category || 'nigerian-news';
      const image = 'https://realssanews.com.ng/logo.png';

      // Insert synthesized article into database
      const insertRes = await pool.query(
        `INSERT INTO rss_articles
           (url_hash, title, original_excerpt, ai_summary, category, image, author, source_name, external_link, published_at, content_type, is_featured, story_hash, full_content)
         VALUES ($1, $2, $3, $4, $5, $6, 'RealSSA AI Desk', 'RealSSA News', $7, NOW(), 'article', true, $8, $9)
         ON CONFLICT (story_hash) DO NOTHING
         RETURNING id`,
        [
          urlHash,
          result.title,
          result.summary || topic,
          result.summary || topic,
          category,
          image,
          `https://realssanews.com.ng/search?q=${encodeURIComponent(topic)}`,
          storyHash,
          result.content
        ]
      );

      if (insertRes.rows.length > 0) {
        const articleId = `rss-${insertRes.rows[0].id}`;
        console.log(`⚡ [AI Trending Synthesizer] ✅ Published Synthesized Article: "${result.title}" (${articleId})`);

        // Dispatch instant indexing to Googlebot & IndexNow via Master Controller
        dispatchIndexingCommand([articleId]).catch(err =>
          console.error('[AI Trending Synthesizer] Indexing dispatch error:', err.message)
        );
      }
    }

    console.log('⚡ [AI Trending Synthesizer] Trend check complete.');
  } catch (err) {
    console.error('❌ [AI Trending Synthesizer] Run failed:', err.message);
  }
}

/**
 * Initialize background scheduler for AI Trending Synthesizer.
 * Runs once every 2 hours.
 * @param {object} pool - PostgreSQL pool connection
 */
function initTrendingSynthesizer(pool) {
  console.log('⚡ AI Trending Topic Synthesizer Agent initialized.');
  setTimeout(() => runTrendingSynthesizer(pool), 30000);
  setInterval(() => runTrendingSynthesizer(pool), 2 * 60 * 60 * 1000);
}

module.exports = { initTrendingSynthesizer, runTrendingSynthesizer };
