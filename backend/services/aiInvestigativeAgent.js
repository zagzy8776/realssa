/**
 * AI Investigative Agent
 * Feature: When multiple articles mention a developing story with gaps or contradictions,
 * the AI actively searches for missing pieces and adds a short "background" note to the cluster.
 * The AI doing something closer to actual reporting/research, not summarizing what's already there.
 */

const { callGeminiJSON } = require('./aiAgentService');

const SYSTEM_INSTRUCTION = `You are an Investigative Journalist at RealSSA News. Your job is to analyze a cluster of related articles about a developing story, identify gaps and contradictions, then search for context.

Given a story cluster (multiple articles on the same topic), you must:
1. Identify what information is CONFIRMED across multiple sources
2. Identify what is CONTRADICTORY between sources
3. Identify what is MISSING — questions raised but not answered
4. Suggest what to SEARCH for to fill those gaps

Return JSON: {
  "story_summary": "1-2 sentence summary of the confirmed facts",
  "confirmed_facts": ["fact1", "fact2"],
  "contradictions": ["Source A says X while Source B says Y"],
  "missing_context": ["What caused this?", "Who is affected?"],
  "investigation_queries": ["search query 1", "search query 2"],
  "background_note": "A short paragraph adding crucial context that no single article provides — e.g., history, root causes, or related events"
}`;

/**
 * Investigate a cluster of related articles and produce a background note.
 * @param {Array} cluster - Array of article objects { title, excerpt, source, published, url }
 * @returns {Promise<object>} Investigation results with background note
 */
async function investigateStoryCluster(cluster) {
    if (!cluster || cluster.length < 2) {
        return { background_note: null, investigation_queries: [] };
    }

    console.log(`[aiInvestigator] Analyzing cluster of ${cluster.length} articles`);

    const clusterForAI = cluster.map((a, i) => ({
        idx: i,
        title: a.title,
        snippet: (a.ai_summary || a.original_excerpt || a.excerpt || '').slice(0, 300),
        source: a.source_name || a.author || 'Unknown',
        published: a.published_at || a.date,
        url: a.external_link || a.url || ''
    }));

    const userPrompt = [
        'Below is a cluster of related news articles about a developing story. Analyze them for gaps, contradictions, and missing context.',
        '',
        JSON.stringify(clusterForAI, null, 2),
        '',
        'Identify the confirmed facts, contradictions, and what context is missing. Suggest investigation queries to fill the gaps.'
    ].join('\n');

    const result = await callGeminiJSON(SYSTEM_INSTRUCTION, userPrompt, {
        maxTokens: 800,
        temperature: 0.3
    });

    if (!result) {
        console.log('[aiInvestigator] AI unavailable for investigation');
        return { background_note: null, investigation_queries: [] };
    }

    // If the AI suggested investigation queries, we could fire them through the search agent
    console.log(`[aiInvestigator] Found ${result.confirmed_facts?.length || 0} confirmed facts, ${result.contradictions?.length || 0} contradictions, ${(result.investigation_queries || []).length} gaps to search`);

    return {
        story_summary: result.story_summary || null,
        confirmed_facts: result.confirmed_facts || [],
        contradictions: result.contradictions || [],
        missing_context: result.missing_context || [],
        investigation_queries: result.investigation_queries || [],
        background_note: result.background_note || null
    };
}

module.exports = { investigateStoryCluster };