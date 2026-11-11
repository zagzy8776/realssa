/**
 * AI Web Search & Source Discovery Agent
 *
 * Features:
 * 1. Actively search for stories your RSS feeds missed
 * 2. Fill coverage gaps on demand — search the live web for topics with thin coverage
 * 3. Discover new legitimate sources automatically — find publications with public RSS/video feeds
 *
 * The AI actively searches and fetches from the open web, then formats what it finds.
 */

const { callGeminiJSON, callGemini } = require('./aiAgentService');

const SYSTEM_SEARCH_INSTRUCTION = `You are an AI News Researcher for RealSSA News. Your job is to search the web for news stories on specific topics and return structured results.

Given a search query, you will:
1. Formulate 2-3 search queries optimized for finding recent, authoritative news
2. For each search result you would expect, provide the likely headline, source, and URL
3. Rate the relevance and authority of each candidate

Return JSON: {
  "search_queries": ["query1", "query2"],
  "candidates": [
    {
      "title": "Headline",
      "source": "Publication Name",
      "estimated_url": "likely URL",
      "relevance_score": 0-1,
      "authority": "high|medium|low",
      "reason": "Why this fits the query"
    }
  ]
}`;

const SYSTEM_SOURCE_DISCOVERY = `You are a News Source Scout for RealSSA News. Your job is to discover new, legitimate news publications with public RSS feeds or YouTube channels.

Given a topic or region, suggest news sources that:
1. Are legitimate journalistic publications (not aggregators or blogs)
2. Have a public RSS feed (preferably) or active news website
3. Cover topics relevant to RealSSA's audience (Africa, African diaspora, world news)
4. Are currently active (updated within the last week)
5. Are not already in our feeds

For each candidate, you MUST provide:
- The publication name
- The likely RSS feed URL (based on common patterns: /feed/, /rss, /rss.xml)
- The category it fits (nigerian-news, ghana, kenya, south-africa, sports, tech, culture, business, world)
- Why it would be a valuable addition

Return JSON: {
  "candidates": [
    {
      "name": "Publication Name",
      "rss_url": "https://example.com/feed/",
      "category": "sports",
      "confidence": 0-1,
      "reason": "Why this source matters"
    }
  ]
}`;

/**
 * Search for news stories on a topic the RSS feeds might have missed.
 * @param {string} topic - The topic to search for
 * @param {string} region - Optional region filter (e.g., "Nigeria", "Africa")
 * @returns {Promise<Array>} Array of article candidates found
 */
async function searchForStories(topic, region = '') {
    console.log(`[aiWebSearch] Searching for stories on: "${topic}"${region ? ` in ${region}` : ''}`);

    const userPrompt = [
        `Search for the latest news stories about: "${topic}"`,
        region ? `Focus on the region: ${region}` : '',
        'Prioritize stories from the last 24-48 hours.',
        'Include a mix of sources (major wire services, local African publications, international).',
        'Provide up to 8 candidates.'
    ].filter(Boolean).join('\n');

    const result = await callGeminiJSON(SYSTEM_SEARCH_INSTRUCTION, userPrompt, {
        maxTokens: 800,
        temperature: 0.4
    });

    if (!result || !result.candidates) {
        console.log('[aiWebSearch] No candidates found');
        return [];
    }

    console.log(`[aiWebSearch] Found ${result.candidates.length} candidates`);
    return result.candidates;
}

/**
 * Discover new legitimate RSS feed sources automatically.
 * @param {string} topicOrRegion - Topic or region to search for sources
 * @returns {Promise<Array>} Array of source candidates with RSS URLs
 */
async function discoverNewSources(topicOrRegion = '') {
    console.log(`[aiWebSearch] Discovering new sources for: "${topicOrRegion || 'African news'}"`);

    const userPrompt = [
        'Discover new legitimate news sources for RealSSA News.',
        topicOrRegion ? `Focus area: ${topicOrRegion}` : 'Focus on African news, Nigerian football, African tech startups, and regional business news.',
        'IMPORTANT: For each source, provide the MOST LIKELY RSS feed URL based on standard patterns.',
        'Common RSS URL patterns: /feed/, /rss, /rss.xml, /feeds/posts/default, /news/rss.xml',
        'If you are not 100% sure of the RSS URL, indicate low confidence.',
        'Provide up to 5 candidates.'
    ].join('\n');

    const result = await callGeminiJSON(SYSTEM_SOURCE_DISCOVERY, userPrompt, {
        maxTokens: 800,
        temperature: 0.4
    });

    if (!result || !result.candidates) {
        console.log('[aiWebSearch] No new sources discovered');
        return [];
    }

    console.log(`[aiWebSearch] Discovered ${result.candidates.length} potential new sources`);
    return result.candidates;
}

/**
 * Generate a formatted summary with citations for a search query.
 * Used when a user searches for a topic with thin coverage.
 * @param {string} query - The user's search query
 * @param {Array} sources - Array of article candidates
 * @returns {Promise<string>} Formatted summary with citations
 */
async function generateSearchSummary(query, sources) {
    if (!sources || sources.length === 0) return null;

    const sourcesText = sources.map((s, i) =>
        `[${i + 1}] "${s.title}" from ${s.source}\n    URL: ${s.estimated_url || 'N/A'}\n    Relevance: ${s.relevance_score || 'Unknown'}`
    ).join('\n\n');

    const prompt = [
        `A user searched for: "${query}"`,
        'Below are news stories found from across the web.',
        'Write a brief, informative summary (2-3 paragraphs) that synthesizes these findings.',
        'Cite sources using [1], [2], etc. in the text.',
        'Be objective and factual. Do not editorialize.',
        '',
        sourcesText
    ].join('\n');

    return await callGemini(
        'You are a News Aggregator for RealSSA News. Synthesize search results into a coherent, cited summary.',
        prompt,
        { maxTokens: 600, temperature: 0.3 }
    );
}

module.exports = { searchForStories, discoverNewSources, generateSearchSummary };