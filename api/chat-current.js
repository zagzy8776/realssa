const SITE_URL = 'https://www.realssanews.com.ng';
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 6000;
const MAX_NEWS_ITEMS = 14;
const REQUEST_TIMEOUT_MS = 12000;

function envKeys(name) {
  return String(process.env[name] || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item.role,
      content: String(item.content || '').slice(0, 3000),
    }));
}

function isCurrentIntent(text) {
  return /(today|tonight|latest|current|right now|breaking|this morning|this evening|just now|recent|what happened|news|headline|exchange rate|naira|dollar|usd|eur|gbp|bitcoin|crypto|stock|market|weather|score|match|election|president|minister)/i.test(text);
}

async function fetchNewsContext(query, currentIntent) {
  const needsNews = currentIntent || /(news|politic|government|econom|business|sport|football|crypto|market|naira|election|africa|nigeria|ghana|kenya|south africa)/i.test(query);
  if (!needsNews) return { context: '', sources: [] };

  try {
    const response = await fetch(`${SITE_URL}/api/news-feed?limit=${MAX_NEWS_ITEMS}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`news feed ${response.status}`);

    const raw = await response.json();
    const articles = Array.isArray(raw) ? raw : (raw?.articles || []);
    const cleaned = String(query || '').toLowerCase();
    const terms = cleaned.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((x) => x.length > 3).slice(0, 6);

    const ranked = articles
      .filter((article) => article && article.title)
      .map((article) => {
        const haystack = `${article.title} ${article.excerpt || article.summary || ''} ${article.category || ''}`.toLowerCase();
        const score = terms.reduce((n, term) => n + (haystack.includes(term) ? 1 : 0), 0);
        return { article, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_NEWS_ITEMS)
      .map(({ article }) => article);

    const context = ranked.map((article) => {
      const published = article.publishedAt || article.published_at || '';
      const source = article.sourceName || article.source_name || article.source || 'RealSSA';
      const excerpt = article.excerpt || article.summary || '';
      return `- [${article.category || 'news'}] ${article.title} — ${source}${published ? ` (${published})` : ''}${excerpt ? `\n  ${String(excerpt).slice(0, 320)}` : ''}`;
    }).join('\n');

    const sources = ranked.slice(0, 5).map((article) => ({
      title: article.title,
      url: `${SITE_URL}/read?url=${encodeURIComponent(article.externalLink || article.external_link || '')}`,
    }));

    return { context, sources };
  } catch (error) {
    console.warn('[RealSSA Chat] News context unavailable:', error.message);
    return { context: '', sources: [] };
  }
}

function buildSystem({ currentIntent, newsContext }) {
  return `You are RealSSA, the conversational intelligence inside RealSSA News.

Your job is to be genuinely useful, natural, intelligent, and conversational — not a headline generator.

BEHAVIOUR:
- Answer the user's actual question first. Do not force every conversation back to news.
- You can discuss technology, coding, business, relationships, life, education, history, entertainment, sports, finance, travel, ideas, and everyday questions.
- Sound like a sharp, warm, confident human companion. Avoid robotic corporate language, repetitive greetings, fake enthusiasm, and canned endings.
- Use clear paragraphs. Use bullets only when they genuinely improve the answer.
- Maintain continuity with the conversation history. Do not pretend the user said something they did not say.
- When information is uncertain, say so instead of inventing facts.
- Never claim to have taken an external action unless the application actually did it.
- Never turn a publisher URL into an internal RealSSA /article/ URL. When citing a news item, use the supplied source URL exactly or the supplied RealSSA /read?url=... source link.

REALSSA KNOWLEDGE:
- RealSSA News is an African news and intelligence platform focused strongly on Nigeria and Sub-Saharan Africa.
- It has regional news, sports/live matches, markets, crypto, jobs, an in-app reader, and the RealSSA Assistant.

CURRENT INFORMATION RULE:
${currentIntent ? '- This question may require current information. Prefer the supplied current-news context and Groq Compound web results when available. Do not present old model knowledge as current.' : '- This is not necessarily a current-news question. Do not inject the latest headlines unless they directly help answer the user.'}

${newsContext ? `CURRENT REALSSA NEWS CONTEXT:\n${newsContext}` : ''}`;
}

async function callOpenAICompatible({ url, key, model, messages, provider }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: 1600 }),
      signal: controller.signal,
    });
    const raw = await response.text();
    let data = null;
    try { data = JSON.parse(raw); } catch {}
    if (!response.ok) {
      throw new Error(`${provider} ${response.status}: ${(data?.error?.message || raw).slice(0, 240)}`);
    }
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error(`${provider}: empty response`);
    return { reply: text, provider, model };
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini({ key, messages }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n') }] }],
          generationConfig: { maxOutputTokens: 1600 },
        }),
        signal: controller.signal,
      }
    );
    const raw = await response.text();
    let data = null;
    try { data = JSON.parse(raw); } catch {}
    if (!response.ok) throw new Error(`gemini ${response.status}: ${(data?.error?.message || raw).slice(0, 240)}`);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('gemini: empty response');
    return { reply: text, provider: 'gemini', model: 'gemini-3.1-flash-lite' };
  } finally {
    clearTimeout(timeout);
  }
}

async function generateChat({ message, history }) {
  const currentIntent = isCurrentIntent(message);
  const news = await fetchNewsContext(message, currentIntent);
  const messages = [
    { role: 'system', content: buildSystem({ currentIntent, newsContext: news.context }) },
    ...cleanHistory(history),
    { role: 'user', content: message },
  ];
  const errors = [];

  const groqKeys = envKeys('GROQ_API_KEY');
  const cerebrasKeys = envKeys('CEREBRAS_API_KEY');
  const geminiKeys = envKeys('GEMINI_API_KEY');

  const tryProvider = async (keys, config) => {
    for (const key of keys) {
      try {
        return await callOpenAICompatible({ ...config, key, messages });
      } catch (error) {
        errors.push(error.message);
      }
    }
    return null;
  };

  if (currentIntent) {
    const compound = await tryProvider(groqKeys, {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      model: 'groq/compound',
      provider: 'groq-compound',
    });
    if (compound) return { ...compound, sources: news.sources };
  }

  const groq120 = await tryProvider(groqKeys, {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'openai/gpt-oss-120b',
    provider: 'groq',
  });
  if (groq120) return { ...groq120, sources: news.sources };

  const cerebras = await tryProvider(cerebrasKeys, {
    url: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'gpt-oss-120b',
    provider: 'cerebras',
  });
  if (cerebras) return { ...cerebras, sources: news.sources };

  // Current Groq fallback; do not use retired Llama 3.3 70B.
  const groq20 = await tryProvider(groqKeys, {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'openai/gpt-oss-20b',
    provider: 'groq',
  });
  if (groq20) return { ...groq20, sources: news.sources };

  for (const key of geminiKeys) {
    try {
      const gemini = await callGemini({ key, messages });
      return { ...gemini, sources: news.sources };
    } catch (error) {
      errors.push(error.message);
    }
  }

  console.error('[RealSSA Chat] All providers failed:', errors.join(' | '));
  return null;
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', SITE_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = parseBody(req);
  const message = String(body.message || '').trim().slice(0, MAX_MESSAGE_CHARS);
  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    const result = await generateChat({ message, history: body.history });
    if (!result) {
      return res.status(503).json({
        error: 'All AI providers are temporarily unavailable',
        retryable: true,
      });
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error('[RealSSA Chat] Handler failed:', error.message);
    return res.status(500).json({ error: 'Assistant temporarily unavailable', retryable: true });
  }
};
