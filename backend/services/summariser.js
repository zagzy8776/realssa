/**
 * AI Summariser — Multi-Provider with Job Assignment
 *
 * Job assignments (primary → fallbacks):
 *  generateAIAnalysis  → Gemini (JSON mode, structured output)  → Groq → Cerebras → title fallback
 *  generateSocialHook  → Groq (fast, high volume)               → Cerebras → Gemini → Cloudflare → title fallback
 *  rewriteArticle      → Cerebras gemma-4-31b (best writing)    → Groq → Gemini → plain text fallback
 *  generateEmbedding   → Gemini embedding-001                   → null (no fallback, optional feature)
 */

// ── Key Rotation Helpers ──────────────────────────────────────────────────

let _gi = 0;
const getGeminiKey = () => {
  const keys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
  if (!keys.length) return null;
  return keys[(_gi++) % keys.length];
};

let _qi = 0;
const getGroqKey = () => {
  const keys = (process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
  if (!keys.length) return null;
  return keys[(_qi++) % keys.length];
};

const getCerebrasKey = () => process.env.CEREBRAS_API_KEY || null;
const getCfToken    = () => process.env.CF_API_TOKEN || null;

// ── Provider URLs ─────────────────────────────────────────────────────────

const GEMINI_URL       = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';
const GROQ_URL         = 'https://api.groq.com/openai/v1/chat/completions';
const CEREBRAS_URL     = 'https://api.cerebras.ai/v1/chat/completions';
const CF_URL           = () => {
  const id = process.env.CF_ACCOUNT_ID || '3145b2a1f6614db2dfd1cb49a27d1141';
  return `https://api.cloudflare.com/client/v4/accounts/${id}/ai/run/@cf/meta/llama-3.1-8b-instruct`;
};

// ── Low-level Callers ─────────────────────────────────────────────────────

async function callGemini(prompt, { maxOutputTokens = 800, temperature = 0.3, timeout = 12000, responseMimeType } = {}) {
  const key = getGeminiKey();
  if (!key) return null;
  try {
    const config = { maxOutputTokens, temperature, topP: 0.9 };
    if (responseMimeType) config.responseMimeType = responseMimeType;
    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: config }),
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) { console.warn(`[Gemini] ${res.status} — key prefix: ${key.slice(0, 8)}`); return null; }
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (err) { console.warn(`[Gemini] ${err.message}`); return null; }
}

async function callGroq(prompt, { maxTokens = 800, temperature = 0.3 } = {}) {
  const key = getGroqKey();
  if (!key) return null;
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (!res.ok) { console.warn(`[Groq] ${res.status} — ${data.error?.message}`); return null; }
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) { console.warn(`[Groq] ${err.message}`); return null; }
}

async function callCerebras(prompt, { maxTokens = 800, temperature = 0.3 } = {}) {
  const key = getCerebrasKey();
  if (!key) return null;
  try {
    const res = await fetch(CEREBRAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gemma-4-31b', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (!res.ok) { console.warn(`[Cerebras] ${res.status} — ${data.message}`); return null; }
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) { console.warn(`[Cerebras] ${err.message}`); return null; }
}

async function callCloudflare(prompt, { maxTokens = 256 } = {}) {
  const key = getCfToken();
  if (!key) return null;
  try {
    const res = await fetch(CF_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json();
    if (!res.ok || !data.success) { console.warn(`[Cloudflare] ${res.status} — ${JSON.stringify(data.errors)}`); return null; }
    return data.result?.response?.trim() || null;
  } catch (err) { console.warn(`[Cloudflare] ${err.message}`); return null; }
}

// ── Job: AI Analysis (Summary + Translations + Entities) ─────────────────
// Primary: Gemini (JSON mode) → Groq → Cerebras → minimal fallback

const AI_ANALYSIS_PROMPT = (title, cleanText) => [
  'You are the lead editor for RealSSA News, Africa\'s leading digital news platform.',
  'Analyze the following news article and output a structured JSON object.',
  'Strict requirements for the JSON schema:',
  '{',
  '  "summary": "2-sentence summary. First sentence states key fact directly. Second sentence explains why it matters for Africa or everyday people.",',
  '  "entities": [{ "name": "Full canonical name", "type": "person|organization|location|sports_team" }],',
  '  "translations": {',
  '    "pidgin":  { "title": "...", "summary": "..." },',
  '    "yoruba":  { "title": "...", "summary": "..." },',
  '    "hausa":   { "title": "...", "summary": "..." },',
  '    "igbo":    { "title": "...", "summary": "..." }',
  '  }',
  '}',
  `Article Title: "${title}"`,
  `Article Text: "${cleanText}"`,
  'Return ONLY the raw JSON block. No markdown, no ```json wrappers.'
].join('\n');

async function generateAIAnalysis(title, excerpt) {
  const cleanText = (excerpt || title || '').replace(/<[^>]+>/g, '').slice(0, 600);
  const prompt = AI_ANALYSIS_PROMPT(title, cleanText);

  // 1. Gemini — best for structured JSON
  let raw = await callGemini(prompt, { maxOutputTokens: 800, temperature: 0.2, timeout: 12000, responseMimeType: 'application/json' });
  if (raw) {
    try { const r = JSON.parse(raw); console.log('[AIAnalysis] ✅ Gemini'); return r; } catch {}
  }

  // 2. Groq fallback
  raw = await callGroq(prompt, { maxTokens: 900, temperature: 0.2 });
  if (raw) {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) { const r = JSON.parse(jsonMatch[0]); console.log('[AIAnalysis] ✅ Groq fallback'); return r; }
    } catch {}
  }

  // 3. Cerebras fallback
  raw = await callCerebras(prompt, { maxTokens: 900, temperature: 0.2 });
  if (raw) {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) { const r = JSON.parse(jsonMatch[0]); console.log('[AIAnalysis] ✅ Cerebras fallback'); return r; }
    } catch {}
  }

  // 4. Minimal fallback — at least return a basic summary so article isn't blank
  console.warn(`[AIAnalysis] All providers failed for: "${title.slice(0, 50)}" — using excerpt fallback`);
  return { summary: cleanText.slice(0, 200) || title, entities: [], translations: {} };
}

async function generateSummary(title, excerpt) {
  const analysis = await generateAIAnalysis(title, excerpt);
  return analysis?.summary || null;
}

// ── Job: Social Hooks for Buffer (platform-specific) ────────────────────
// Primary: Groq → Cerebras → Gemini → Cloudflare → title fallback
//
// Platform rules:
//  Twitter/X  — 280 chars total. Link (~23 chars) + space = 24 chars reserved.
//               So caption must be ≤ 255 chars. 1-2 emojis, 2 hashtags max.
//  Instagram  — No clickable links in captions. Max 2200 chars but keep it
//               punchy (≤ 300 chars). End with "Link in bio 🔗". 5-10 hashtags.
//  Facebook   — No hard limit. 1-3 short paragraphs, conversational tone,
//               link posted separately as attachment. 3-5 hashtags.

const TWITTER_PROMPT = (title, cleanText) => [
  'You are a social media manager for RealSSA News posting on Twitter/X.',
  'Write a tweet for this article. STRICT RULES:',
  '- Maximum 230 characters (the link will be added separately and takes 23 chars)',
  '- 1-2 emojis only',
  '- Maximum 2 hashtags',
  '- Make it punchy, urgent, and newsworthy',
  '- Do NOT include any URL or link',
  '- Do NOT say "Read more" or "Link in bio"',
  `Article title: "${title}"`,
  `Article text: "${cleanText}"`,
  'Return ONLY the tweet text. No intro, no quotes.'
].join('\n');

const INSTAGRAM_PROMPT = (title, cleanText) => [
  'You are a social media manager for RealSSA News posting on Instagram.',
  'Write an Instagram caption for this article. STRICT RULES:',
  '- Maximum 300 characters for the main caption text',
  '- Engaging, conversational tone — speak directly to the audience',
  '- 1-2 emojis in the caption',
  '- End the caption with exactly: "Link in bio 🔗"',
  '- After the caption, on a new line add 8-10 relevant hashtags',
  '- Do NOT include any URL in the caption',
  `Article title: "${title}"`,
  `Article text: "${cleanText}"`,
  'Return ONLY the caption + hashtags. No intro, no quotes.'
].join('\n');

const FACEBOOK_PROMPT = (title, cleanText) => [
  'You are a social media manager for RealSSA News posting on Facebook.',
  'Write a Facebook post for this article. STRICT RULES:',
  '- 2-3 short paragraphs, conversational and engaging',
  '- Maximum 400 characters total',
  '- 1-2 emojis',
  '- End with "Read the full story 👇" (the link will be attached automatically)',
  '- 3-5 relevant hashtags at the end',
  '- Do NOT include any URL',
  `Article title: "${title}"`,
  `Article text: "${cleanText}"`,
  'Return ONLY the post text. No intro, no quotes.'
].join('\n');

async function _callWithFallbacks(prompt, maxTokens, label) {
  let text = await callGroq(prompt, { maxTokens, temperature: 0.7 });
  if (text && text.length > 20) { console.log(`[${label}] ✅ Groq`); return text; }

  text = await callCerebras(prompt, { maxTokens, temperature: 0.7 });
  if (text && text.length > 20) { console.log(`[${label}] ✅ Cerebras`); return text; }

  text = await callGemini(prompt, { maxOutputTokens: maxTokens, temperature: 0.7, timeout: 8000 });
  if (text && text.length > 20) { console.log(`[${label}] ✅ Gemini`); return text; }

  text = await callCloudflare(prompt, { maxTokens });
  if (text && text.length > 20) { console.log(`[${label}] ✅ Cloudflare`); return text; }

  return null;
}

/**
 * Generate platform-specific social hooks.
 * Returns { twitter, instagram, facebook }
 */
async function generateSocialHooks(title, excerpt) {
  const cleanText = (excerpt || title || '').replace(/<[^>]+>/g, '').slice(0, 600);

  const [twitter, instagram, facebook] = await Promise.all([
    _callWithFallbacks(TWITTER_PROMPT(title, cleanText), 80, 'Twitter'),
    _callWithFallbacks(INSTAGRAM_PROMPT(title, cleanText), 200, 'Instagram'),
    _callWithFallbacks(FACEBOOK_PROMPT(title, cleanText), 150, 'Facebook'),
  ]);

  // Title fallbacks — Buffer never skips
  return {
    twitter:   twitter   || `${title.slice(0, 200)} 📰`,
    instagram: instagram || `${title} 📰\n\nLink in bio 🔗\n\n#RealSSA #News #Africa #NigeriaNews #BreakingNews`,
    facebook:  facebook  || `${title} 📰\n\nRead the full story 👇\n\n#RealSSA #News`,
  };
}

// Keep old single-hook export for any legacy callers
async function generateSocialHook(title, excerpt) {
  const hooks = await generateSocialHooks(title, excerpt);
  return hooks.twitter;
}

// ── Job: Article Rewrite ──────────────────────────────────────────────────
// Primary: Cerebras gemma-4-31b (best writing quality) → Groq → Gemini

const REWRITE_PROMPT = (title, cleanText) => [
  'You are a professional journalist for the "RealSSA News Desk".',
  'Rewrite the following article as an original, exclusive news report.',
  'Rules: 3-5 concise paragraphs. Professional tone like BBC/Al Jazeera for African audience.',
  'Do NOT mention AI or summarising. Output ONLY the article wrapped in <p> tags.',
  `Original Title: "${title}"`,
  `Original Text: "${cleanText}"`
].join('\n');

async function rewriteArticle(title, text) {
  const cleanText = (text || '').replace(/<[^>]+>/g, '').slice(0, 10000);
  const prompt = REWRITE_PROMPT(title, cleanText);

  // 1. Cerebras — best writing quality
  let result = await callCerebras(prompt, { maxTokens: 900, temperature: 0.7 });
  if (result && result.length > 50) { console.log('[Rewrite] ✅ Cerebras'); return result; }

  // 2. Groq fallback
  result = await callGroq(prompt, { maxTokens: 900, temperature: 0.7 });
  if (result && result.length > 50) { console.log('[Rewrite] ✅ Groq fallback'); return result; }

  // 3. Gemini fallback
  result = await callGemini(prompt, { maxOutputTokens: 800, temperature: 0.7, timeout: 12000 });
  if (result && result.length > 50) { console.log('[Rewrite] ✅ Gemini fallback'); return result; }

  return null;
}

// ── Job: Vector Embeddings ────────────────────────────────────────────────
// Primary: Gemini embedding-001 (only provider with proper embeddings)

async function generateEmbedding(text) {
  const key = getGeminiKey();
  if (!key || !text?.trim()) return null;
  try {
    const res = await fetch(`${GEMINI_EMBED_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text: text.substring(0, 2000) }] }, outputDimensionality: 768 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.warn(`[Embedding] ${res.status}`); return null; }
    const data = await res.json();
    return data?.embedding?.values?.slice(0, 768) || null;
  } catch (err) { console.warn(`[Embedding] ${err.message}`); return null; }
}

module.exports = { generateSummary, generateSocialHook, generateSocialHooks, rewriteArticle, generateAIAnalysis, generateEmbedding };
