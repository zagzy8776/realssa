/**
 * Exa API Neural Web Search Service (exaSearchService.js)
 * Canonical reference: https://docs.exa.ai/reference/search-api-guide-for-coding-agents
 * 
 * Performs high-precision neural web search with contents.highlights using Exa API.
 */

async function searchExa(query, options = {}) {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    console.log('[Exa Search] EXA_API_KEY not found in environment. Falling back to native DB & web search.');
    return null;
  }

  try {
    const payload = {
      query: query,
      type: options.type || 'auto',
      numResults: options.numResults || 10,
      contents: {
        highlights: true
      }
    };

    if (options.includeDomains && options.includeDomains.length > 0) {
      payload.includeDomains = options.includeDomains;
    }

    if (options.excludeDomains && options.excludeDomains.length > 0) {
      payload.excludeDomains = options.excludeDomains;
    }

    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[Exa Search] API error (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();
    if (!data || !data.results) {
      return null;
    }

    // Format Exa search results for RealSSA AI Search Engine
    const formattedResults = data.results.map(r => ({
      title: r.title || 'Web Search Result',
      url: r.url,
      publishedDate: r.publishedDate || null,
      score: r.score || null,
      highlights: Array.isArray(r.highlights) ? r.highlights.join(' ') : (r.highlights || '')
    }));

    return {
      success: true,
      provider: 'Exa Neural Search',
      results: formattedResults
    };
  } catch (err) {
    console.error('[Exa Search] Execution error:', err.message);
    return null;
  }
}

module.exports = { searchExa };
