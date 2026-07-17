/**
 * AI Notification Optimizer
 *
 * Features:
 * 1. AI-Personalized Notification Timing — learn when each user opens notifications
 *    vs. ignores them, hold non-urgent alerts for their active window
 * 2. AI Notification Tone-Matching —write each notification's phrasing differently
 *    depending on the story type (urgent/clipped, warm/human, sharp/analytical)
 * 3. AI "Should This Even Be a Notification?" Gatekeeper — decide if a story is
 *    genuinely worth interrupting someone's day for
 */

const { callGeminiJSON, callGemini } = require('./aiAgentService');

const TONE_GUIDE_SYSTEM = `You are a Push Notification Copywriter for RealSSA News. You write notification text differently based on story type.

Story type → tone mapping:
- "breaking": URGENT, clipped, high-impact. 5-8 words. Use ALL CAPS for key words if extreme. Example: "🚨 EARTHQUAKE: 6.8 magnitude hits Lagos"
- "politics": SHARP, analytical, neutral. Focus on stakes and implications. Example: "Senate passes tax reform bill — what it means for your wallet"
- "sports": EXCITED, energetic. Use team names, scores, emojis. Example: "⚽ GOAL! Super Eagles take 2-1 lead vs Ghana in 78th minute"
- "feelgood": WARM, human, uplifting. Focus on human interest. Example: "A 12-year-old invents device to purify water — and it costs just $2"
- "entertainment": PLAYFUL, intriguing, curiosity-gap. Example: "🎬 New Nollywood thriller breaks box office record in first weekend"
- "business": DIRECT, numbers-driven. Focus on market impact. Example: "Naira gains 5% against dollar — central bank intervenes"
- "tech": CLEVER, forward-looking. Example: "💡 African fintech startup raises $50M Series B — here's the pitch"
- "default": CLEAR, informative. Focus on who, what, why. Example: "📰 President signs executive order on digital economy"

Return ONLY the notification text. No labels, no explanations. Max 90 characters.`;

const GATEKEEPER_SYSTEM = `You are the Notification Gatekeeper at RealSSA News. Your job is to read the full context of a story and decide: is this genuinely worth interrupting someone's day for?

Criteria for PASS (worthy of notification):
- Loss of life or significant safety risk
- Major policy/economy change affecting millions
- Major sports moment (goal in a big match, tournament result)
- Major entertainment/culture moment
- Development that changes a story people are already following
- Something the average person would stop what they're doing to read

Criteria for FAIL (not worth interrupting):
- Routine political statement or press release
- Minor update on a slow-developing story
- Celebrity gossip with no wider significance
- Business as usual (company hires new executive, etc.)
- Generic "X says Y" quote articles
- Content that is primarily opinion or analysis
- Stories that will still be relevant hours later (no urgency)

Return JSON: { "verdict": "PASS|FAIL", "confidence": 0-1, "reason": "1-sentence explanation of the decision" }`;

/**
 * Determine the story type and write tone-matched notification copy.
 * @param {object} article - { title, excerpt, category, source_name }
 * @param {number} score - The notification score (1-3)
 * @returns {Promise<object>} { tone, notificationText }
 */
async function writeToneMatchedNotification(article, score) {
    const { title, excerpt, category } = article;

    // Map category to story type
    let storyType = 'default';
    if (score >= 3) storyType = 'breaking';
    else if (category === 'politics' || category === 'nigerian-news') storyType = 'politics';
    else if (category === 'sports') storyType = 'sports';
    else if (category === 'entertainment' || category === 'culture') storyType = 'entertainment';
    else if (category === 'business' || category === 'crypto') storyType = 'business';
    else if (category === 'tech') storyType = 'tech';
    else if (/feelgood|good news|inspiring|heartwarming/i.test(title + ' ' + (excerpt || ''))) storyType = 'feelgood';

    const prompt = [
        `Story Type: ${storyType}`,
        `Title: "${title}"`,
        `Excerpt: "${(excerpt || '').slice(0, 200)}"`,
        `Category: ${category}`,
        '',
        `Write a ${storyType}-toned push notification for this article. Max 90 characters.`
    ].join('\n');

    const notificationText = await callGemini(TONE_GUIDE_SYSTEM, prompt, {
        maxTokens: 60,
        temperature: 0.7
    });

    return {
        tone: storyType,
        notificationText: notificationText || title.slice(0, 90)
    };
}

/**
 * Decide if this article is genuinely worth a push notification.
 * @param {object} article - { title, excerpt, category, source_name, score }
 * @returns {Promise<object>} { shouldNotify, confidence, reason }
 */
async function shouldNotify(article) {
    const { title, excerpt, category, score } = article;

    // Hard-coded fast pass for score 3 (breaking, life-safety events)
    if (score >= 3) {
        return { shouldNotify: true, confidence: 0.95, reason: 'High-urgency breaking event — immediate notification warranted.' };
    }

    const prompt = [
        `Title: "${title}"`,
        `Excerpt: "${(excerpt || '').slice(0, 300)}"`,
        `Category: ${category}`,
        `Pre-score: ${score || 0}`,
        '',
        'Read this story context. Is this genuinely worth a push notification right now?',
        'Consider: Would the average person stop what they are doing for this?'
    ].join('\n');

    const result = await callGeminiJSON(GATEKEEPER_SYSTEM, prompt, {
        maxTokens: 200,
        temperature: 0.2
    });

    if (!result) {
        return { shouldNotify: score >= 2, confidence: 0.5, reason: 'AI unavailable — using score-based fallback.' };
    }

    return {
        shouldNotify: result.verdict === 'PASS',
        confidence: Math.min(1, Math.max(0, result.confidence || 0.5)),
        reason: result.reason || 'No reason provided.'
    };
}

/**
 * Determine the best time to send a notification to a specific user.
 * @param {string} deviceId - The user's device ID
 * @param {number} urgency - 1-3 urgency score (3 = fire immediately)
 * @param {Function} getUserEngagementPattern - Async function that returns user's engagement data
 * @returns {Promise<{sendNow: boolean, delayMs: number, reason: string}>}
 */
async function optimalSendTime(deviceId, urgency, getUserEngagementPattern) {
    // Urgency 3 = always send immediately regardless of user patterns
    if (urgency >= 3) {
        return { sendNow: true, delayMs: 0, reason: 'Breaking news — sending immediately.' };
    }

    // Try to get the user's engagement pattern
    let userPattern = null;
    try {
        userPattern = await getUserEngagementPattern(deviceId);
    } catch {
        // If we can't get patterns, send now
        return { sendNow: true, delayMs: 0, reason: 'No user pattern data available — sending now.' };
    }

    if (!userPattern || !userPattern.activeHours) {
        return { sendNow: true, delayMs: 0, reason: 'No engagement history — sending now.' };
    }

    const now = new Date();
    const currentHour = now.getHours();

    // Check if user is in their active window (typical engagement hours)
    const inActiveWindow = userPattern.activeHours.some(h => h === currentHour);

    if (inActiveWindow) {
        return { sendNow: true, delayMs: 0, reason: `User is in active window (hour ${currentHour}) — sending now.` };
    }

    // Find the next active hour
    const nextActiveHour = userPattern.activeHours.find(h => h > currentHour) || userPattern.activeHours[0];
    let delayMs = 0;

    if (nextActiveHour !== undefined) {
        const nextTime = new Date(now);
        nextTime.setHours(nextActiveHour, 0, 0, 0);
        if (nextTime <= now) {
            // Next active hour is tomorrow
            nextTime.setDate(nextTime.getDate() + 1);
        }
        delayMs = nextTime.getTime() - now.getTime();
    }

    // Cap delay at 6 hours for non-urgent content
    delayMs = Math.min(delayMs, 6 * 60 * 60 * 1000);
    if (delayMs < 0) delayMs = 0;

    return {
        sendNow: delayMs === 0,
        delayMs,
        reason: delayMs > 0
            ? `User is outside active window — delaying ${Math.round(delayMs / 60000)} minutes.`
            : 'Sending now.'
    };
}

module.exports = { writeToneMatchedNotification, shouldNotify, optimalSendTime };