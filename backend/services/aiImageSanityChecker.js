/**
 * AI Image Sanity Checker
 * Feature: Before an image goes live on a card, the AI looks at the extracted
 * image URL and article context to verify it's actually relevant to the article
 * (not a mismatched stock photo, not another article's leftover thumbnail, not
 * something inappropriate) — the AI actively guarding quality, not writing anything.
 */

const { callGeminiJSON } = require('./aiAgentService');

const SYSTEM_INSTRUCTION = `You are the Visual Quality Gatekeeper at RealSSA News. Your job is to examine an article's image and title/excerpt and decide if the image is APPROPRIATE for that article.

You check for these FAILURE modes:
1. MISMATCH: Image doesn't match the article topic (e.g., a tech photo for a sports article)
2. LOGO_FAKE: The image is a publication logo, brand icon, or default placeholder, not a real story photo
3. IRRELEVANT: Image is technically from the article but shows something unrelated to the headline
4. OFFENSIVE: Image contains inappropriate or graphic content unsuitable for a general news audience
5. BROKEN: The image URL itself is likely broken (returns 404, is a generic fallback URL)
6. ADVERTISEMENT: Image is actually an ad banner, not editorial content
7. LOW_QUALITY: Image is a pixelated thumbnail or too small to use

Return JSON: { "verdict": "PASS|FAIL", "failure_mode": "MISMATCH|LOGO_FAKE|IRRELEVANT|OFFENSIVE|BROKEN|ADVERTISEMENT|LOW_QUALITY|null", "confidence": 0-1, "reason": "1-2 sentence explanation" }`;

/**
 * Check if an image is appropriate for an article.
 * @param {string} imageUrl - The image URL to check
 * @param {string} title - Article title
 * @param {string} excerpt - Article excerpt/description
 * @param {string} sourceName - Source publication name
 * @returns {Promise<object>} { verdict, failure_mode, confidence, reason }
 */
async function checkImage(imageUrl, title, excerpt, sourceName) {
    // Quick deterministic checks first — no AI needed for obvious cases
    if (!imageUrl) {
        return { verdict: 'FAIL', failure_mode: 'BROKEN', confidence: 1.0, reason: 'No image URL provided.' };
    }

    if (/logo|icon|brand|placeholder|default[-_]?image|gravatar|avatar|favicon|punchng\.com.*cropped|realssanews\.com\.ng\/logo/i.test(imageUrl)) {
        return { verdict: 'FAIL', failure_mode: 'LOGO_FAKE', confidence: 0.95, reason: 'Image appears to be a publication logo/icon, not a real story photo.' };
    }

    if (imageUrl.startsWith('data:')) {
        return { verdict: 'FAIL', failure_mode: 'BROKEN', confidence: 0.9, reason: 'Image is a data URI (inline encoded), likely broken or placeholder.' };
    }

    // Non-image extensions
    if (/\.(svg|pdf|doc|zip|exe)$/i.test(imageUrl)) {
        return { verdict: 'FAIL', failure_mode: 'BROKEN', confidence: 0.9, reason: 'URL points to a non-image file type.' };
    }

    // Use AI for more nuanced checks
    const userPrompt = [
        `Article Title: "${title || 'No title'}"`,
        `Article Excerpt: "${(excerpt || '').slice(0, 300)}"`,
        `Source: ${sourceName || 'Unknown'}`,
        `Image URL: ${imageUrl}`,
        '',
        'Examine the image URL path and filename for clues. Check if the image content (inferred from URL path, filename, alt text context) matches the article subject.',
        'Return JSON verdict.'
    ].join('\n');

    const result = await callGeminiJSON(SYSTEM_INSTRUCTION, userPrompt, {
        maxTokens: 300,
        temperature: 0.2
    });

    if (!result) {
        // AI unavailable — default to PASS (don't block content if AI is down)
        return { verdict: 'PASS', failure_mode: null, confidence: 0.5, reason: 'AI checker unavailable — passed by default.' };
    }

    return {
        verdict: result.verdict === 'FAIL' ? 'FAIL' : 'PASS',
        failure_mode: result.failure_mode || null,
        confidence: Math.min(1, Math.max(0, result.confidence || 0.5)),
        reason: result.reason || 'No specific reason provided.'
    };
}

module.exports = { checkImage };