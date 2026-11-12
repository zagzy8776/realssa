/**
 * Core AI Agent Service
 * Shared Gemini utility for all agentic AI features.
 * Provides structured prompt execution, fallback handling, and rate limiting.
 */

// ── Gemini Call ──────────────────────────────────────────────────────────

/**
 * Execute a structured prompt against Gemini.
 * @param {string} systemInstruction - Role definition for the agent
 * @param {string} userPrompt - The task-specific instructions + data
 * @param {object} options - { maxTokens, temperature, responseFormat }
 * @returns {string|null} The model's text response
 */
async function callGemini(systemInstruction, userPrompt, options = {}) {
    return require('./aiRouter.cjs').runAI('comment', [systemInstruction, userPrompt].join('\n\n'), {
        maxTokens: options.maxTokens || 800, temperature: options.temperature ?? 0.4,
        validate: options.responseFormat === 'json' ? text => { try { JSON.parse(text); return true; } catch { return false; } } : null
    });
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

module.exports = { callGemini, callGeminiJSON, callGeminiText: callGemini };