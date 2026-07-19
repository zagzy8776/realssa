/**
 * Core AI Agent Service
 * Shared Gemini utility for all agentic AI features.
 * Provides structured prompt execution, fallback handling, and rate limiting.
 */

const getGeminiKey = () => {
  const keys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
  return keys.length > 0 ? keys[Math.floor(Math.random() * keys.length)] : null;
};
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';

// ── Rate Limiter ──────────────────────────────────────────────────────────
// Gemini free tier: 15 RPM, 1,500 RPD
const RATE_WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 12; // Keep under 15 for safety
let callTimestamps = [];

function _checkRateLimit() {
    const now = Date.now();
    callTimestamps = callTimestamps.filter(ts => now - ts < RATE_WINDOW_MS);
    if (callTimestamps.length >= MAX_CALLS_PER_WINDOW) {
        const oldest = callTimestamps[0];
        const waitMs = RATE_WINDOW_MS - (now - oldest) + 100;
        return waitMs;
    }
    callTimestamps.push(now);
    return 0;
}

async function _waitForSlot() {
    const wait = _checkRateLimit();
    if (wait > 0) {
        console.log(`[AI Agent] Rate limited — waiting ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
        callTimestamps.push(Date.now());
    }
}

// ── Gemini Call ──────────────────────────────────────────────────────────

/**
 * Execute a structured prompt against Gemini.
 * @param {string} systemInstruction - Role definition for the agent
 * @param {string} userPrompt - The task-specific instructions + data
 * @param {object} options - { maxTokens, temperature, responseFormat }
 * @returns {string|null} The model's text response
 */
async function callGemini(systemInstruction, userPrompt, options = {}) {
    const apiKey = getGeminiKey();
    if (!apiKey) {
        console.warn('[AI Agent] No GEMINI_API_KEY set — returning null');
        return null;
    }

    const {
        maxTokens = 300,
        temperature = 0.4,
        responseFormat = null
    } = options;

    await _waitForSlot();

    const prompt = [
        systemInstruction,
        '',
        userPrompt
    ].join('\n');

    try {
        const body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: maxTokens,
                temperature,
                topP: 0.9
            }
        };

        // Add structured output constraint if requested
        if (responseFormat === 'json') {
            body.generationConfig.response_mime_type = 'application/json';
        }

        const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            console.warn(`[AI Agent] Gemini API error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return text && text.length > 5 ? text : null;
    } catch (err) {
        console.warn(`[AI Agent] Gemini call failed: ${err.message}`);
        return null;
    }
}

/**
 * Call Gemini and parse the response as JSON.
 * @param {string} systemInstruction
 * @param {string} userPrompt
 * @param {object} options
 * @returns {object|null}
 */
async function callGeminiJSON(systemInstruction, userPrompt, options = {}) {
    const text = await callGemini(
        systemInstruction + '\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no extra text.',
        userPrompt,
        { ...options, responseFormat: 'json', maxTokens: options.maxTokens || 500 }
    );
    if (!text) return null;

    // Strip markdown fences if present
    let cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
    // Find the first { and last }
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    cleaned = cleaned.slice(start, end + 1);

    try {
        return JSON.parse(cleaned);
    } catch {
        console.warn('[AI Agent] Failed to parse Gemini JSON response:', cleaned.slice(0, 200));
        return null;
    }
}

module.exports = { callGemini, callGeminiJSON };