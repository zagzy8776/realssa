/**
 * AI Provider Router
 *
 * The backend historically called Google Gemini using GEMINI_API_KEY.
 * Some deployments supply an NVIDIA API key (nvapi-...) instead.
 * This helper detects the key type and routes to the correct provider:
 *   - nvapi-...  → NVIDIA API (OpenAI-compatible chat completions)
 *   - anything else → Google Gemini (generateContent)
 *
 * Google Gemini keys are the only ones that work with the original
 * generativelanguage.googleapis.com endpoints — NVIDIA keys MUST be
 * routed to integrate.api.nvidia.com or every call fails silently.
 */

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
// Model fallback chain, verified against this account's key:
//   1. nemotron-3-super-120b-a12b — fast (~2-5s) but occasionally unreachable
//   2. z-ai/glm-5.3-flash — slower (reasoning model, ~30-45s) but reliable
// Override the first choice via NVIDIA_AI_MODEL.
const DEFAULT_NVIDIA_MODELS = ['nvidia/nemotron-3-super-120b-a12b', 'z-ai/glm-5.3-flash'];

const isNvidiaKey = (key) => typeof key === 'string' && key.trim().startsWith('nvapi-');

const getNvidiaModels = () => {
  const override = process.env.NVIDIA_AI_MODEL;
  return override ? [override, ...DEFAULT_NVIDIA_MODELS.filter(m => m !== override)] : DEFAULT_NVIDIA_MODELS;
};

/**
 * Call an OpenAI-compatible chat completions endpoint (NVIDIA).
 * Tries each model in the fallback chain until one returns content.
 * The first choice (nemotron-3-super-120b) responds in ~2-5s warm; the
 * fallback (glm-5.3-flash) is a reasoning model that may take 30-45s.
 * @param {string} apiKey - NVIDIA API key
 * @param {string} prompt - Full prompt (system + user combined by caller)
 * @param {object} opts - { maxTokens, temperature, timeout }
 * @returns {Promise<string|null>} Response text or null on failure
 */
async function callNvidia(apiKey, prompt, { maxTokens = 800, temperature = 0.3, timeout = 60000 } = {}) {
    for (const model of getNvidiaModels()) {
        try {
            const body = {
                model,
                messages: [{ role: 'user', content: prompt }],
                // Reasoning models burn tokens on hidden reasoning before emitting
                // content — leave generous headroom so content is never truncated.
                // JSON enforcement is done via prompt + fence-stripping by callers;
                // reasoning models may reject response_format, so we don't send it.
                max_tokens: Math.max(maxTokens, 2048),
                temperature
            };

            const res = await fetch(NVIDIA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(timeout)
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                console.warn(`[NVIDIA] ${res.status} — ${data?.detail || data?.error?.message || 'unknown error'} (model: ${model}); trying next`);
                continue;
            }
            // Reasoning models return reasoning_content separately; use content only
            const msg = data?.choices?.[0]?.message;
            const text = (msg?.content || '').trim();
            if (text) return text;
            console.warn(`[NVIDIA] empty content (model: ${model}); trying next`);
        } catch (err) {
            console.warn(`[NVIDIA] call failed for ${model}: ${err.message}; trying next`);
        }
    }
    return null;
}

/**
 * Provider-agnostic prompt call. Routes by key prefix.
 * @param {string} apiKey - GEMINI_API_KEY value (Google key OR nvapi- key)
 * @param {string} prompt - Full prompt text
 * @param {object} opts - { maxTokens, temperature, timeout, jsonMode, geminiUrl }
 *   geminiUrl: optional full Gemini generateContent URL override
 * @returns {Promise<string|null>} Response text or null
 */
async function callAI(apiKey, prompt, opts = {}) {
    if (!apiKey) return null;
    if (isNvidiaKey(apiKey)) {
        return callNvidia(apiKey, prompt, opts);
    }
    // Google Gemini path (original behaviour)
    const {
        maxTokens = 800,
        temperature = 0.3,
        timeout = 15000,
        jsonMode = false,
        geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'
    } = opts;
    try {
        const config = { maxOutputTokens: maxTokens, temperature, topP: 0.9 };
        if (jsonMode) config.response_mime_type = 'application/json';
        const res = await fetch(`${geminiUrl}?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: config }),
            signal: AbortSignal.timeout(timeout)
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            console.warn(`[Gemini] ${res.status} — ${data?.error?.message || 'unknown error'}`);
            return null;
        }
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch (err) {
        console.warn(`[Gemini] call failed: ${err.message}`);
        return null;
    }
}

module.exports = { isNvidiaKey, getNvidiaModels, callNvidia, callAI };
