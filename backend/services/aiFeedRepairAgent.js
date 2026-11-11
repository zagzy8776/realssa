/**
 * AI Self-Healing Feed Repair Agent
 * Feature: When feedHealthChecker.js flags a feed as failing, the AI looks at
 * the raw error and the feed's HTML/XML, diagnoses the likely cause (moved URL,
 * changed XML structure, new anti-bot header requirement), and either auto-patches
 * the parser config or flags exactly what needs fixing with a suggested fix.
 *
 * This turns the health-check system from a report into a repair agent.
 */

const { callGeminiJSON } = require('./aiAgentService');

const SYSTEM_INSTRUCTION = `You are a Senior Feed Engineer for RealSSA News. Your job is to diagnose why an RSS/ATOM feed is failing and suggest a precise fix.

When given:
1. The feed URL
2. The error message from the fetch attempt
3. The HTTP status code
4. A snippet of the response body (first 2000 chars of HTML or XML)

You must determine the most likely cause and provide a fix. Possible causes:
- MOVED: Feed URL has permanently moved (301/308) — suggest the new URL from the Location header
- CHANGED_STRUCTURE: Feed XML structure changed — describe what's different and how to parse it
- BLOCKED: Server returns 403/429/Cloudflare challenge — suggest UA/header changes or proxy
- DEAD: 410 Gone — feed is permanently dead, suggest searching for replacement URL
- EMPTY: 200 OK but no valid XML content — feed is misconfigured at source
- TIMEOUT: Feed is too slow — suggest increasing timeout or alternative source
- SSL_ERROR: Certificate issue — suggest alternative URL or ignoring cert

Return JSON with: { "diagnosis": "MOVED|CHANGED_STRUCTURE|BLOCKED|DEAD|EMPTY|TIMEOUT|SSL_ERROR|UNKNOWN", "confidence": 0-1, "explanation": "1-2 sentences explaining the issue", "suggested_fix": "The exact action to take", "new_url": "if MOVED, the new URL to use", "header_fix": "if BLOCKED, what headers to add/change" }`;

/**
 * Diagnose a failing feed and suggest a repair.
 * @param {string} feedUrl - The failing RSS feed URL
 * @param {object} failureInfo - { statusCode, errorMessage, responseBody }
 * @param {object} pool - PostgreSQL pool for storing repairs
 * @returns {Promise<object>} { diagnosis, confidence, explanation, suggested_fix, new_url, header_fix }
 */
async function diagnoseFeedFailure(feedUrl, failureInfo, pool) {
    const { statusCode, errorMessage, responseBody } = failureInfo;

    console.log(`[aiFeedRepair] Diagnosing: ${feedUrl} (${statusCode})`);

    // Quick deterministic checks first (no AI needed)
    if (statusCode === '410') {
        return {
            diagnosis: 'DEAD',
            confidence: 1.0,
            explanation: 'Server returned 410 Gone — this feed has been permanently removed.',
            suggested_fix: `Search for a replacement URL by visiting the publication's homepage or checking their RSS page.`,
            new_url: null,
            header_fix: null
        };
    }

    if (statusCode === '403' || statusCode === '429') {
        const diag = {
            diagnosis: 'BLOCKED',
            confidence: 0.95,
            explanation: `Server returned ${statusCode} — likely anti-bot protection or rate limiting.`,
            suggested_fix: 'Update the User-Agent header to mimic a real browser and add Accept-Language and Referer headers.',
            new_url: null,
            header_fix: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.google.com/'
            }
        };

        if (pool) {
            await _storeDiagnosis(pool, feedUrl, diag);
        }
        return diag;
    }

    if (statusCode === '408' || (errorMessage && errorMessage.includes('timeout'))) {
        return {
            diagnosis: 'TIMEOUT',
            confidence: 0.9,
            explanation: 'Feed did not respond within the timeout period. May be temporarily slow or permanently down.',
            suggested_fix: 'Increase the fetch timeout from 10s to 30s for this feed, or find a faster mirror.',
            new_url: null,
            header_fix: null
        };
    }

    // For ambiguous cases, use the AI
    const bodySnippet = responseBody ? responseBody.slice(0, 2000) : 'No response body available';

    const userPrompt = [
        `Feed URL: ${feedUrl}`,
        `HTTP Status: ${statusCode || 'Unknown'}`,
        `Error Message: ${errorMessage || 'None'}`,
        '',
        `Response Body (first 2000 chars):`,
        bodySnippet,
        '',
        'Analyze the above and return a JSON diagnosis with fix recommendations.'
    ].join('\n');

    const result = await callGeminiJSON(SYSTEM_INSTRUCTION, userPrompt, {
        maxTokens: 500,
        temperature: 0.2
    });

    if (!result) {
        // Fallback: generic timeout
        const fallback = {
            diagnosis: 'UNKNOWN',
            confidence: 0.3,
            explanation: `Feed failed with status ${statusCode}: ${errorMessage || 'Unknown error'}. AI was unavailable for deep diagnosis.`,
            suggested_fix: 'Manually check the feed URL by visiting it in a browser. It may have moved or changed structure.',
            new_url: null,
            header_fix: null
        };
        if (pool) await _storeDiagnosis(pool, feedUrl, fallback);
        return fallback;
    }

    const diagnosis = {
        diagnosis: result.diagnosis || 'UNKNOWN',
        confidence: Math.min(1, Math.max(0, result.confidence || 0.5)),
        explanation: result.explanation || 'No explanation provided',
        suggested_fix: result.suggested_fix || 'Manual investigation required',
        new_url: result.new_url || null,
        header_fix: result.header_fix || null
    };

    if (pool) {
        await _storeDiagnosis(pool, feedUrl, diagnosis);
    }

    console.log(`[aiFeedRepair] → ${diagnosis.diagnosis} (${(diagnosis.confidence * 100).toFixed(0)}% confidence): ${diagnosis.explanation}`);
    return diagnosis;
}

/**
 * Search for a replacement URL when a feed is dead.
 * Uses AI to suggest likely new URLs based on the dead feed's name.
 */
async function searchReplacementFeed(feedUrl) {
    const deadUrlHint = new URL(feedUrl).hostname;

    const userPrompt = [
        `A known RSS feed at ${feedUrl} is permanently dead (410 Gone).`,
        `The publication hostname was: ${deadUrlHint}`,
        '',
        'Suggest up to 3 likely new RSS feed URLs for this same publication.',
        'Consider common patterns like /feed/, /rss, /rss.xml, /feed.xml, /news/rss.xml',
        'Return as JSON: { "candidates": ["url1", "url2", "url3"] }'
    ].join('\n');

    const result = await callGeminiJSON(
        'You are a feed discovery specialist. Suggest replacement RSS feed URLs for a dead feed.',
        userPrompt,
        { maxTokens: 300, temperature: 0.3 }
    );

    return result ? (result.candidates || []) : [];
}

/**
 * Test a potential replacement feed URL.
 */
async function testFeedCandidate(url) {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            },
            signal: AbortSignal.timeout(10000)
        });
        if (!res.ok) return false;
        const text = await res.text();
        return text.includes('<rss') || text.includes('<feed') || text.includes('<rdf:RDF');
    } catch {
        return false;
    }
}

async function _storeDiagnosis(pool, feedUrl, diagnosis) {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS feed_repair_log (
                id SERIAL PRIMARY KEY,
                feed_url TEXT NOT NULL,
                diagnosis TEXT,
                confidence REAL,
                explanation TEXT,
                suggested_fix TEXT,
                new_url TEXT,
                header_fix JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            INSERT INTO feed_repair_log (feed_url, diagnosis, confidence, explanation, suggested_fix, new_url, header_fix)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            feedUrl,
            diagnosis.diagnosis,
            diagnosis.confidence,
            diagnosis.explanation,
            diagnosis.suggested_fix,
            diagnosis.new_url,
            diagnosis.header_fix ? JSON.stringify(diagnosis.header_fix) : null
        ]);
    } catch (err) {
        console.warn('[aiFeedRepair] DB store error:', err.message);
    }
}

module.exports = { diagnoseFeedFailure, searchReplacementFeed, testFeedCandidate };