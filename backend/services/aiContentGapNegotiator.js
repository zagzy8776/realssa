/**
 * AI Content Gap Negotiator
 * Feature: If a user opens a category (e.g., Sports) and there's genuinely nothing
 * live right now, the AI decides what to show instead — pull a relevant highlight,
 * a related news story, or a "next match in 3 hours" card — rather than a static
 * empty state. The AI making a real-time content decision based on what's available.
 */

const { callGemini } = require('./aiAgentService');

const SYSTEM_INSTRUCTION = `You are a Content Curator at RealSSA News. When a category has no content, you decide what to show instead.

You are given:
1. The category name the user opened (e.g., "sports", "nigerian-news")
2. The current time and day
3. A list of available content from OTHER categories that could fill the gap
4. Any scheduled upcoming events (e.g., matches, elections, releases)

Your job is to make a REAL-TIME CONTENT DECISION:
- Pick the BEST item from available content to show as a "suggested while you wait"
- OR generate an informational message about what's coming soon
- OR suggest a featured highlight from the same category if something recently happened
- The goal: NEVER show a stale empty state. Always give the user something valuable.

Return a JSON object with your decision.`;

/**
 * Generate content to fill a category with no live articles.
 * @param {string} category - The empty category slug
 * @param {Array} availableContent - Articles from other categories [{ title, excerpt, category, image, id }]
 * @param {Array} upcomingEvents - Scheduled upcoming events [{ title, time, type }]
 * @param {object} recentHighlights - Optional highlights from the same category [{ title, excerpt, image, timeAgo }]
 * @returns {Promise<object>} { type: "cross_category|upcoming|highlight|informational", content: object }
 */
async function fillContentGap(category, availableContent, upcomingEvents, recentHighlights) {
    console.log(`[aiContentGap] Filling gap for category: "${category}"`);

    // If there are recent highlights in the same category, use those
    if (recentHighlights && recentHighlights.length > 0) {
        const highlight = recentHighlights[0];
        return {
            type: 'highlight',
            content: {
                title: `🏆 Recent Highlight: ${highlight.title}`,
                excerpt: highlight.excerpt || 'A key moment from recent action.',
                image: highlight.image,
                articleId: highlight.id,
                label: 'Recent Highlight'
            }
        };
    }

    // If there are upcoming events, generate an "upcoming" card
    if (upcomingEvents && upcomingEvents.length > 0) {
        const nextEvent = upcomingEvents[0];
        const timeUntil = _timeUntil(new Date(nextEvent.time));
        return {
            type: 'upcoming',
            content: {
                title: `⏰ ${nextEvent.title}`,
                excerpt: `Starts in ${timeUntil}`,
                image: null,
                label: 'Upcoming'
            }
        };
    }

    // Use AI to pick the best cross-category content
    if (availableContent && availableContent.length > 0) {
        const availableForAI = availableContent.slice(0, 10).map((a, i) => ({
            idx: i,
            title: a.title,
            excerpt: (a.ai_summary || a.original_excerpt || a.excerpt || '').slice(0, 150),
            category: a.category,
            image: a.image
        }));

        const userPrompt = [
            `Category with no content: "${category}"`,
            `Current time: ${new Date().toLocaleString('en-US', { weekday: 'long', hour: 'numeric', timeZone: 'UTC' })} UTC`,
            '',
            'Available content from other categories to choose from:',
            JSON.stringify(availableForAI, null, 2),
            '',
            'Pick the most relevant article to show to a user who opened the empty category. Consider:',
            `- Would a ${category} reader also be interested in this?`,
            '- Is this a major/important story?',
            '- Does the image look good for display?',
            '- Is it recent?',
            '',
            'Return JSON: { "pick_idx": number, "reason": "1-sentence explanation" }'
        ].join('\n');

        const result = await callGeminiJSON(
            SYSTEM_INSTRUCTION,
            userPrompt,
            { maxTokens: 200, temperature: 0.4 }
        );

        if (result && typeof result.pick_idx === 'number' && availableContent[result.pick_idx]) {
            const pick = availableContent[result.pick_idx];
            return {
                type: 'cross_category',
                content: {
                    title: pick.title,
                    excerpt: pick.excerpt || pick.title,
                    image: pick.image,
                    articleId: pick.id,
                    label: `While you wait — from ${pick.category || 'related coverage'}`,
                    reason: result.reason || ''
                }
            };
        }
    }

    // Last resort: informational message
    const infoMessages = {
        'sports': 'No live matches right now. Check back soon for the latest scores, transfers, and analysis from the world of African football and global sports.',
        'nigerian-news': 'No new stories at this moment. Our journalists are tracking the latest developments across Nigeria.',
        'ghana': 'Ghana news feed will refresh shortly. Stay tuned for the latest from Accra and beyond.',
        'kenya': 'Kenya news updates incoming. Check back for breaking stories from Nairobi and East Africa.',
        'world': 'World news feed refreshing. Our global network is monitoring developments around the clock.',
        'tech': 'Tech stories loading. The African innovation scene is always moving — refresh shortly.',
        'business': 'Business news feed updating. Markets and economies are constantly in motion.',
        'culture': 'Culture feed refreshing. New music, film, and arts stories coming soon.',
        'entertainment': 'Entertainment stories on the way. Nollywood, Afrobeats, and more loading.',
        'default': 'This feed will refresh with new stories shortly. Check back soon.'
    };

    return {
        type: 'informational',
        content: {
            title: `📡 ${category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}`,
            excerpt: infoMessages[category] || infoMessages['default'],
            image: null,
            label: 'No new stories right now'
        }
    };
}

function _timeUntil(date) {
    const now = Date.now();
    const diff = date.getTime() - now;
    if (diff <= 0) return 'Any moment now';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

module.exports = { fillContentGap };