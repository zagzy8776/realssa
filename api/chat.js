const { createClient } = require('redis');
const { Pool } = require('pg');

const SITE_URL = 'https://www.realssanews.com.ng';
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 6000;
const MAX_NEWS_ITEMS = 14;
const REQUEST_TIMEOUT_MS = 9000;
const NEWS_CACHE_TTL = 120;

let dbPool = null;
let redis = null;
let redisReady = false;

function envKeys(name) {
  return String(process.env[name] || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
}

function getDbPool() {
  if (dbPool || !process.env.DATABASE_URL) return dbPool;
  dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });
  return dbPool;
}

function getRedis() {
  if (redis || !process.env.REDIS_URL) return redis;
  try {
    const url = String(process.env.REDIS_URL)
      .replace(/^\uFEFF/, '')
      .replace(/^["']|["']$/g, '')
      .trim();
    redis = createClient({
      url,
      socket: {
        connectTimeout: 2500,
        reconnectStrategy: (retries) => (retries > 3 ? false : Math.min(retries * 250, 1000)),
      },
    });
    redis.on('ready', () => { redisReady = true; });
    redis.on('end', () => { redisReady = false; });
    redis.on('error', () => { redisReady = false; });
    redis.connect().catch(() => { redisReady = false; });
  } catch {
    redis = null;
  }
  return redis;
}

function isCurrentIntent(text) {
  return /(today|tonight|latest|current|right now|breaking|this morning|this evening|just now|recent|what happened|news|headline|exchange rate|naira|dollar|usd|eur|gbp|bitcoin|crypto|stock|market|weather|score|match|election|president|minister)/i.test(text);
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

async function getNewsContext(query, forceCurrent) {
  const needsNews = forceCurrent || /(news|politic|government|econom|business|sport|football|crypto|market|naira|election|africa|nigeria|ghana|kenya|south africa)/i.test(query);
  if (!needsNews) return { context: '', sources: [] };

  const redisClient = getRedis();
  const cacheKey = 'realssa:chat:news:v2';
  try {
    if (redisClient && redisReady) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
  } catch {}

  const pool = getDbPool();
  if (!pool) return { context: '', sources: [] };

  try {
    let rows = [];
    const cleaned = query.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    const keywords = cleaned.split(/\s+/).filter((word) => word.length > 3).slice(0, 4);

    if (keywords.length) {
      const pattern = `%${keywords.join('%')}%`;
      const search = await pool.query(
        `SELECT title, category, source_name, external_link, original_excerpt, published_at
         FROM rss_articles
         WHERE (title ILIKE $1 OR original_excerpt ILIKE $1)
         ORDER BY published_at DESC
         LIMIT 8`,
        [pattern]
      );
      rows = search.rows || [];
    }

    const recent = await pool.query(
      `SELECT title, category, source_name, external_link, original_excerpt, published_at
       FROM rss_articles
       WHERE published_at > NOW() - INTERVAL '48 hours'
       ORDER BY published_at DESC
       LIMIT $1`,
      [Math.max(6, MAX_NEWS_ITEMS - rows.length)]
    );

    const seen = new Set();
    rows = [...rows, ...(recent.rows || [])].filter((row) => {
      const key = String(row.title || '').toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, MAX_NEWS_ITEMS);

    const payload = {
      context: rows.length
        ? rows.map((row) => {
            const published = row.published_at ? new Date(row.published_at).toISOString() : '';
            return `- [${row.category || 'news'}] ${row.title} — ${row.source_name || 'RealSSA'}${published ? ` (${published})` : ''}${row.original_excerpt ? `\n  ${String(row.original_excerpt).slice(0, 280)}` : ''}`;
          }).join('\n')
        : '',
      sources: rows.slice(0, 5).map((row) => ({
        title: row.title,
        url: `${SITE_URL}/read?url=${encodeURIComponent(row.external_link || '')}`,
      })),
    };

    if (redisClient && redisReady) {
      redisClient.set(cacheKey, JSON.stringify(payload), { EX: NEWS_CACHE_TTL }).catch(() => {});
    }
    return payload;
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
- When the user is joking, be playful. When the user is serious, be thoughtful.
- When information is uncertain, say so instead of inventing facts.
- Never claim to have taken an external action unless the application actually did it.

REALSSA KNOWLEDGE:
- RealSSA News is an African news and intelligence platform focused strongly on Nigeria and Sub-Saharan Africa.
- It has regional news, sports/live matches, markets, crypto, jobs, a first-class in-app browser/reader, and the RealSSA Assistant.

CURRENT INFORMATION RULE:
${currentIntent ? '- This question may require current information. Use the supplied current-news context when it is relevant, and use web-backed tool results when available. Distinguish verified current facts from background knowledge.' : '- This is not necessarily a current-news question. Do not inject the day's headlines unless they directly help answer the user.'}

${newsContext ? `CURRENT REALSSA NEWS CONTEXT:\n${newsContext}` : ''}`;
}

async function callOpenAICompatible({ url, key, model, messages, provider }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = Date.now();
  try {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    };
    if (provider === 'cerebras') headers['X-Cerebras-Version-Patch'] = '2';

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1200,
        temperature: 0.65,
      }),
      signal: controller.signal,
    });

    const raw = await response.text();
    let data = null;
    try { data = JSON.parse(raw); } catch {}

    if (!response.ok) {
      const detail = data?.error?.message || raw.slice(0, 180) || `HTTP ${response.status}`;
      throw new Error(`${provider} ${response.status}: ${detail}`);
    }

    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error(`${provider}: empty model response`);

    return {
      reply: text,
      provider,
      model,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini({ key, messages }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = Date.now();
  try {
    const prompt = messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join('\n\n');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1200, temperature: 0.65, topP: 0.9 },
        }),
        signal: controller.signal,
      }
    );
    const raw = await response.text();
    let data = null;
    try { data = JSON.parse(raw); } catch {}
    if (!response.ok) throw new Error(`gemini ${response.status}: ${(data?.error?.message || raw).slice(0, 180)}`);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('gemini: empty model response');
    return { reply: text, provider: 'gemini', model: 'gemini-2.0-flash', latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

async function rateLimit(ip) {
  const client = getRedis();
  if (!client || !redisReady) return true;
  const normalizedIp = String(ip || 'unknown').slice(0, 120);
  const key = `realssa:chat:rl:${normalizedIp}`;
  try {
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, 60);
    return count <= 20;
  } catch {
    return true;
  }
}

function pickStartIndex(keys, input) {
  if (keys.length <= 1) return 0;
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  return hash % keys.length;
}

async function generateChat({ message, history }) {
  const currentIntent = isCurrentIntent(message);
  const news = await getNewsContext(message, currentIntent);
  const system = buildSystem({ currentIntent, newsContext: news.context });
  const safeHistory = cleanHistory(history);
  const messages = [
    { role: 'system', content: system },
    ...safeHistory,
    { role: 'user', content: message },
  ];

  const groqKeys = envKeys('GROQ_API_KEY');
  const cerebrasKeys = envKeys('CEREBRAS_API_KEY');
  const geminiKeys = envKeys('GEMINI_API_KEY');
  const errors = [];

  async function tryGroq(model) {
    if (!groqKeys.length) return null;
    const start = pickStartIndex(groqKeys, message);
    for (let offset = 0; offset < groqKeys.length; offset += 1) {
      const key = groqKeys[(start + offset) % groqKeys.length];
      try {
        return await callOpenAICompatible({
          url: 'https://api.groq.com/openai/v1/chat/completions',
          key,
          model,
          messages,
          provider: model === 'groq/compound' ? 'groq-compound' : 'groq',
        });
      } catch (error) {
        errors.push(error.message);
      }
    }
    return null;
  }

  async function tryCerebras() {
    if (!cerebrasKeys.length) return null;
    const start = pickStartIndex(cerebrasKeys, `${message}:cerebras`);
    for (let offset = 0; offset < cerebrasKeys.length; offset += 1) {
      const key = cerebrasKeys[(start + offset) % cerebrasKeys.length];
      try {
        return await callOpenAICompatible({
          url: 'https://api.cerebras.ai/v1/chat/completions',
          key,
          model: 'gpt-oss-120b',
          messages,
          provider: 'cerebras',
        });
      } catch (error) {
        errors.push(error.message);
      }
    }
    return null;
  }

  // Current-information questions benefit from Groq Compound's built-in web tools.
  if (currentIntent) {
    const compound = await tryGroq('groq/compound');
    if (compound) return { ...compound, sources: news.sources };
  }

  const groq = await tryGroq('openai/gpt-oss-120b');
  if (groq) return { ...groq, sources: news.sources };

  const cerebras = await tryCerebras();
  if (cerebras) return { ...cerebras, sources: news.sources };

  const groqLlama = await tryGroq('llama-3.3-70b-versatile');
  if (groqLlama) return { ...groqLlama, sources: news.sources };

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
  const history = cleanHistory(body.history);
  if (!message) return res.status(400).json({ error: 'Message required' });

  const clientIp = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (!(await rateLimit(clientIp))) {
    return res.status(429).json({
      error: 'rate_limited',
      reply: 'You are moving fast 😄 Give me a moment, then send the next message.',
    });
  }

  try {
    const result = await generateChat({ message, history });
    if (!result) {
      return res.status(503).json({
        error: 'ai_unavailable',
        reply: 'I’m temporarily unable to reach my language models. Your message came through, but I do not want to fake an answer with headlines. Please try again shortly.',
      });
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error('[RealSSA Chat] Unhandled request error:', error.message);
    return res.status(500).json({
      error: 'chat_failed',
      reply: 'Something went wrong while processing that message. Please try again.',
    });
  }
};
