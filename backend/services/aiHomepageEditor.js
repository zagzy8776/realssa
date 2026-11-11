/**
 * AI Homepage Editor Agent
 * Feature: Instead of rule-based sorting (recency + affinity score), the AI
 * reads ALL fresh articles from the past hour and picks the top 5 "Breaking Now"
 * stories based on genuine news judgment (significance, impact, geography, timeliness).
 *
 * This replaces a formula with actual editorial reasoning — a decision, not a description.
 */

const { callGeminiJSON } = require('./aiAgentService');

const SYSTEM_INSTRUCTION = `You are the Senior Breaking News Editor at RealSSA News, Africa's leading digital news platform.
Your job is to read through ALL fresh articles ingested in the last hour and select the TOP 5 that should be promoted as "Breaking Now" stories and the TOP 3 featured hero stories.

You are NOT sorting by formula. You are making EDITORIAL JUDGMENTS based on:
1. SIGNIFICANCE: How many people are affected? Is it a major event?
2. IMPACT: Does this change things? Policy, safety, economy, culture?
3. URGENCY: Is this developing? Is time of the essence?
4. GEOGRAPHY: Diversity of regions across Africa and the world
5. FRESHNESS: Is it genuinely new vs. a recycled wire story?
6. SOURCE AUTHORITY: Premium Times, BBC, Al Jazeera, Reuters > obscure blogs

Return a JSON object with two keys:
  "breaking_now": array of exactly 5 items, sorted by editorial priority
  "hero_stories": array of exactly 3 items, sorted by editorial priority
Each entry must have: { "idx": number, "editorial_reason": "1-sentence why this matters here" }
The "idx" field corresponds to the index in the articles array provided below (0-based).`;

/**
 * Select the top 5 Breaking Now + top 3 Hero stories from fresh articles.
 * @param {Array} articles - Array of article objects from the last hour
 * @param {object} pool - PostgreSQL pool
 * @returns {Promise<{breakingNow: Array, heroStories: Array}>}
 */
async function selectBreakingNow(articles, pool) {
    if (!articles || articles.length === 0) {
        return { breakingNow: [], heroStories: [] };
    }

    // Limit input to the AI to stay under token limits (max 60 articles)
    const candidates = articles.slice(0, 60);

    // Build a compact representation for the AI
    const articlesForAI = candidates.map((a, i) => ({
        idx: i,
        id: `rss-${a.db_id || a.id}`,
        title: a.title,
        excerpt: (a.ai_summary || a.original_excerpt || a.excerpt || '').slice(0, 150),
        category: a.category,
        source: a.source_name || a.author || 'Unknown',
        published: a.published_at || a.date,
        has_image: !!(a.image && !/logo|icon|placeholder/i.test(a.image))
    }));

    const userPrompt = [
        'Here are ALL fresh articles from the past hour. Select the 5 most important "Breaking Now" stories and the 3 best hero/featured stories.',
        '',
        JSON.stringify(articlesForAI, null, 2),
        '',
        'Return ONLY valid JSON. No markdown, no code fences.'
    ].join('\n');

    const result = await callGeminiJSON(SYSTEM_INSTRUCTION, userPrompt, {
        maxTokens: 800,
        temperature: 0.3
    });

    if (!result) {
        // Fallback: just sort by recency
        console.log('[aiHomepageEditor] AI unavailable — falling back to recency sort');
        const sorted = [...candidates].sort((a, b) => new Date(b.published_at || b.date) - new Date(a.published_at || a.date));
        return {
            breakingNow: sorted.slice(0, 5),
            heroStories: sorted.slice(0, 3)
        };
    }

    // Map back from the AI's idx references to full article objects
    const breakingNow = ((result.breaking_now || result.breakingNow || [])).slice(0, 5).map(pick => {
        const article = typeof pick.idx === 'number' ? candidates[pick.idx] : null;
        if (!article) return null;
        return { ...article, editorial_reason: pick.editorial_reason || '' };
    }).filter(Boolean);

    const heroStories = (result.hero_stories || result.heroStories || []).slice(0, 3).map(pick => {
        const article = typeof pick.idx === 'number' ? candidates[pick.idx] : null;
        if (!article) return null;
        return { ...article, editorial_reason: pick.editorial_reason || '' };
    }).filter(Boolean);

    console.log(`[aiHomepageEditor] AI selected ${breakingNow.length} breaking + ${heroStories.length} hero stories`);

    // Cache the editor's picks in the database
    if (pool && breakingNow.length > 0) {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS ai_editor_picks (
                    id SERIAL PRIMARY KEY,
                    article_ids JSONB NOT NULL,
                    hero_ids JSONB NOT NULL,
                    selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour')
                )
            `);

            await pool.query(`
                INSERT INTO ai_editor_picks (article_ids, hero_ids)
                VALUES ($1, $2)
            `, [
                JSON.stringify(breakingNow.map(a => a.id)),
                JSON.stringify(heroStories.map(a => a.id))
            ]);

            // Clean up old picks
            await pool.query(`DELETE FROM ai_editor_picks WHERE selected_at < NOW() - INTERVAL '2 hours'`);
        } catch (err) {
            console.warn('[aiHomepageEditor] DB cache error:', err.message);
        }
    }

    return { breakingNow, heroStories };
}

module.exports = { selectBreakingNow };