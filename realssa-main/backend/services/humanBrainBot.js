/**
 * Autonomous Human Learning & Discovery Bot (humanBrainBot.js)
 * Silently searches and crawls web discussions, Q&A forums, and human commentary
 * using Tavily, Exa, and Firecrawl APIs to extract authentic human speech patterns.
 */

const { saveHumanInsight, getBrainStats } = require('./brainStore');

// 1. Search Tavily API
async function searchTavily(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, query, max_results: 5, search_depth: 'basic' }),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(r => ({ title: r.title, snippet: r.content, url: r.url }));
  } catch (err) {
    console.warn('[HumanBrainBot] Tavily error:', err.message);
    return [];
  }
}

// 2. Search Exa API
async function searchExa(query) {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, type: 'auto', numResults: 5, contents: { text: { maxCharacters: 1000 } } }),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(r => ({ title: r.title, snippet: r.text || r.title, url: r.url }));
  } catch (err) {
    console.warn('[HumanBrainBot] Exa error:', err.message);
    return [];
  }
}

// 3. Scrape with Firecrawl API
async function scrapeFirecrawl(url) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey || !url) return null;
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown'] }),
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.markdown || null;
  } catch (err) {
    console.warn('[HumanBrainBot] Firecrawl error:', err.message);
    return null;
  }
}

// Extract human nuances from raw text using AI
async function digestHumanText(rawText) {
  const groqKey = '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';
  if (!rawText || rawText.length < 50) return [];

  const prompt = `Analyze this human text. Extract up to 3 distinct human expressions, slang, or Q&A phrasing patterns.
Format as JSON array of objects: [{"category": "slang|phrasing|qa_pattern", "phrase": "...", "human_nuance": "..."}]
Text: "${rawText.slice(0, 1500)}"`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.3 }),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '';
    const jsonMatch = reply.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    return [];
  }
}

// Single autonomous learning cycle
async function runLearningCycle() {
  console.log('[HumanBrainBot] 🧠 Starting autonomous human learning cycle...');
  
  const topics = [
    'African slang popular expressions 2026',
    'How Nigerians talk online discussions',
    'Kenya everyday conversations questions',
    'African football fan banter phrases',
    'Trending African tech community questions'
  ];
  
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  console.log(`[HumanBrainBot] Exploring topic: "${randomTopic}"`);

  // Try Tavily search
  let results = await searchTavily(randomTopic);
  if (results.length === 0) {
    results = await searchExa(randomTopic);
  }

  let learnedCount = 0;
  for (const item of results.slice(0, 3)) {
    // Optionally deep scrape with Firecrawl if available
    let content = item.snippet;
    if (process.env.FIRECRAWL_API_KEY && item.url) {
      const scraped = await scrapeFirecrawl(item.url);
      if (scraped) content = scraped;
    }

    const insights = await digestHumanText(content);
    for (const ins of insights) {
      if (ins.phrase) {
        await saveHumanInsight({
          category: ins.category || 'phrasing',
          phrase: ins.phrase,
          humanNuance: ins.human_nuance || '',
          context: item.title || '',
          sourceType: 'web_discovery'
        });
        learnedCount++;
      }
    }
  }

  const stats = await getBrainStats();
  console.log(`[HumanBrainBot] ✅ Cycle complete. Learned ${learnedCount} new insights. Total in database: ${stats.total_insights || 0}`);
}

module.exports = {
  runLearningCycle
};
