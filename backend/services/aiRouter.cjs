/** Shared free-provider routing. Credentials stay in env; failures are observable without secrets. */
const cursors = new Map();
const cooling = new Map();
const recent = new Map();
const ORDERS = {
  summary: ['cerebras', 'waterfall', 'gemini', 'nvidia', 'groq', 'cloudflare'],
  social: ['waterfall', 'cerebras', 'groq', 'gemini', 'nvidia', 'cloudflare'],
  comment: ['groq', 'gemini', 'waterfall', 'cerebras', 'nvidia', 'cloudflare'],
  extraction: ['groq', 'gemini', 'waterfall', 'cerebras', 'nvidia', 'cloudflare'],
};
function keysFor(provider) {
  const names = { gemini: ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'], nvidia: ['NVIDIA_API_KEY', 'GEMINI_API_KEY'], groq: ['GROQ_API_KEY'], cerebras: ['CEREBRAS_API_KEY'], waterfall: ['WATERFALL_API_KEY'], cloudflare: ['CF_API_TOKEN'] };
  return [...new Set(names[provider].flatMap(name => String(process.env[name] || '').split(',')).map(k => k.trim()).filter(Boolean))]
    .filter(k => provider === 'nvidia' ? k.startsWith('nvapi-') : provider !== 'gemini' || !k.startsWith('nvapi-'));
}
function providerConfig(provider) {
  const model = { gemini: process.env.GEMINI_MODEL || 'gemini-3.8-flash', nvidia: process.env.NVIDIA_AI_MODEL || 'nvidia/nemotron-3-super-120b-a12b', groq: process.env.GROQ_MODEL || 'llama-3.1-8b-instant', cerebras: process.env.CEREBRAS_MODEL || 'gpt-oss-120b', waterfall: process.env.WATERFALL_MODEL || 'auto', cloudflare: process.env.CF_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct' }[provider];
  const url = { gemini: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions', groq: 'https://api.groq.com/openai/v1/chat/completions', cerebras: 'https://api.cerebras.ai/v1/chat/completions', waterfall: `${(process.env.WATERFALL_BASE_URL || 'https://api.getwaterfall.org/v1').replace(/\/+$/, '')}/chat/completions`, cloudflare: `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID || ''}/ai/run/${model}` }[provider];
  return { model, url };
}
function stripFence(raw) { return String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim(); }
function retryDelay(value) {
  if (!value) return 60000;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(1000, seconds * 1000) : Math.max(1000, Date.parse(value) - Date.now()) || 60000;
}
async function callProvider(provider, prompt, { maxTokens = 2000, temperature = 0.3, timeout = 15000, validate = null, deadline = Date.now() + 45000 } = {}) {
  const keys = keysFor(provider);
  const start = cursors.get(provider) || 0;
  cursors.set(provider, start + 1);
  const { url, model } = providerConfig(provider);
  if (provider === 'cloudflare' && !process.env.CF_ACCOUNT_ID) return null;
  for (let step = 0; step < keys.length; step++) {
    if (Date.now() >= deadline) break;
    const index = (start + step) % keys.length;
    const key = keys[index];
    const tokenId = require('crypto').createHash('sha256').update(provider + key + model).digest('hex');
    if ((cooling.get(tokenId) || 0) > Date.now()) continue;
    const headers = { 'Content-Type': 'application/json' };
    let body;
    if (provider === 'gemini') {
      headers['x-goog-api-key'] = key;
      body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: Math.max(maxTokens, 2048), temperature } };
    } else {
      headers.Authorization = `Bearer ${key}`;
      body = { model, messages: [{ role: 'user', content: prompt }], max_tokens: provider === 'cerebras' || provider === 'nvidia' ? Math.max(4096, maxTokens) : maxTokens, temperature };
    }
    try {
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(Math.max(1, Math.min(timeout, deadline - Date.now()))) });
      if (!response.ok) {
        const status = response.status;
        // Honor Retry-After. Never repeatedly hammer an exhausted or rejected credential.
        if ([401, 403, 404, 429].includes(status)) cooling.set(tokenId, Date.now() + (status === 429 ? retryDelay(response.headers?.get('retry-after')) : 300000));
        recent.set(provider, { status, model, at: new Date().toISOString() });
        console.warn(`[AI:${provider}] HTTP ${status}; model=${model}; keySlot=${index + 1}`);
        continue;
      }
      const data = await response.json();
      const raw = provider === 'gemini' ? data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') : provider === 'cloudflare' ? data.result?.response : data.choices?.[0]?.message?.content;
      const text = stripFence(raw);
      if (!text || validate && !validate(text)) {
        recent.set(provider, { status: 'invalid_output', model, at: new Date().toISOString() });
        console.warn(`[AI:${provider}] Empty or invalid output; trying next configured key/provider`);
        continue;
      }
      recent.set(provider, { status: 'ok', model, at: new Date().toISOString() });
      console.log(`[AI:${provider}] completed; model=${model}; keySlot=${index + 1}`);
      return text;
    } catch {
      recent.set(provider, { status: 'request_failed', model, at: new Date().toISOString() });
      console.warn(`[AI:${provider}] Request failed or timed out; model=${model}`);
    }
  }
  return null;
}
async function runAI(job, prompt, options = {}) {
  const deadline = Date.now() + (options.budgetMs || 45000);
  for (const provider of ORDERS[job] || ORDERS.summary) {
    const result = await callProvider(provider, prompt, { ...options, deadline });
    if (result) return result;
    if (Date.now() >= deadline) break;
  }
  console.warn(`[AI:${job}] No provider completed; configured=${(ORDERS[job] || ORDERS.summary).filter(p => keysFor(p).length).join(',') || 'none'}`);
  return null;
}
function status() {
  return Object.fromEntries(Object.keys(ORDERS).flatMap(job => ORDERS[job]).filter((p,i,a) => a.indexOf(p) === i).map(provider => [provider, { configuredKeys: keysFor(provider).length, model: providerConfig(provider).model, lastResult: recent.get(provider) || null }]));
}
module.exports = { runAI, callProvider, status, keysFor, retryDelay };
