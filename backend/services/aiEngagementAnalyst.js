/**
 * AI Engagement Analyst
 * Feature: The AI periodically looks at engagement data and surfaces things you
 * wouldn't think to ask — "sports content gets 3x engagement between 6-8pm but
 * you're not sending pushes then" or "Kenya category has zero followers, consider
 * dropping it." The AI acting as an analyst working for you.
 */

const { callGemini } = require('./aiAgentService');

const SYSTEM_INSTRUCTION = `You are a Data Analyst working for RealSSA News. You review engagement metrics and surface actionable insights that a human editor might miss.

You look for patterns like:
- Categories with high read-through but low notification volume
- Times of day with spikes in engagement that aren't being capitalized on
- Categories with zero or very low engagement that could be pruned
- Sources that consistently underperform vs. their peers
- Content types (sports, politics, entertainment) that are over or under-served
- Day-of-week patterns in user activity
- Correlation between notification timing and open rates

Your output should be specific, data-driven, and actionable.`;

/**
 * Analyze engagement metrics and surface actionable insights.
 * @param {object} metrics - Aggregated engagement data
 * @param {Array} metrics.categoryEngagement - [{ category, totalViews, uniqueUsers, avgTimeOnArticle, notificationSent, notificationOpenRate }]
 * @param {Array} metrics.hourlyEngagement - [{ hour: 0-23, totalViews, notificationOpens }]
 * @param {Array} metrics.sourcePerformance - [{ sourceName, totalArticles, avgViews, avgTimeOnArticle }]
 * @param {object} metrics.categoryFollowers - { category: followerCount }
 * @returns {Promise<Array>} Array of insight objects { insight, recommendation, priority, data }
 */
async function analyzeEngagement(metrics) {
    if (!metrics) return [];

    console.log('[aiEngagementAnalyst] Analyzing engagement patterns...');

    // Build a summary of the data for the AI
    const dataSummary = [];

    if (metrics.categoryEngagement) {
        dataSummary.push('=== CATEGORY ENGAGEMENT ===');
        metrics.categoryEngagement.forEach(c => {
            dataSummary.push(
                `${c.category}: ${c.totalViews} views, ${c.uniqueUsers} users, ` +
                `${c.avgTimeOnArticle || 0}s avg time, ${c.notificationSent || 0} notifications sent, ` +
                `${(c.notificationOpenRate || 0)}% open rate`
            );
        });
    }

    if (metrics.hourlyEngagement) {
        dataSummary.push('\n=== HOURLY ENGAGEMENT ===');
        metrics.hourlyEngagement.forEach(h => {
            if (h.totalViews > 0) {
                dataSummary.push(`Hour ${h.hour}:00 — ${h.totalViews} views, ${h.notificationOpens || 0} notification opens`);
            }
        });
    }

    if (metrics.sourcePerformance) {
        dataSummary.push('\n=== SOURCE PERFORMANCE ===');
        metrics.sourcePerformance.forEach(s => {
            dataSummary.push(
                `${s.sourceName}: ${s.totalArticles} articles, avg ${s.avgViews || 0} views/article, ` +
                `${s.avgTimeOnArticle || 0}s avg time`
            );
        });
    }

    if (metrics.categoryFollowers) {
        dataSummary.push('\n=== CATEGORY FOLLOWERS ===');
        for (const [cat, count] of Object.entries(metrics.categoryFollowers)) {
            dataSummary.push(`${cat}: ${count} followers`);
        }
    }

    const prompt = [
        'Here is the latest engagement data for RealSSA News. Analyze it thoroughly and surface the TOP 5 most important, actionable insights.',
        '',
        dataSummary.join('\n'),
        '',
        'For each insight, explain the pattern you see, WHY it matters, and WHAT specific action to take.',
        'Be specific — use actual numbers from the data.',
        'Focus on insights that a human editor would NOT immediately notice.'
    ].join('\n');

    const result = await callGemini(SYSTEM_INSTRUCTION, prompt, {
        maxTokens: 1000,
        temperature: 0.3
    });

    if (!result) {
        // Fallback: basic automated analysis
        return _basicAnalysis(metrics);
    }

    // Parse the AI's text response into structured insights
    const insights = _parseInsights(result, metrics);
    console.log(`[aiEngagementAnalyst] Generated ${insights.length} insights`);
    return insights;
}

function _parseInsights(text, metrics) {
    // Try to extract structured insights from the free-form AI response
    const lines = text.split('\n').filter(l => l.trim());
    const insights = [];
    let currentInsight = null;

    for (const line of lines) {
        // Detect numbered insights: "1." "2." etc or "**1.**"
        if (/^[\*\s]*\d+[\.\)]\s*\*/.test(line.replace(/\*\*/g, '')) ||
            /^insight|pattern|finding/i.test(line.trim())) {
            if (currentInsight) {
                insights.push(currentInsight);
            }
            currentInsight = {
                insight: line.replace(/^[\*\s]*\d+[\.\)]\s*/, '').replace(/\*\*/g, '').trim(),
                recommendation: '',
                priority: 'medium',
                data: null
            };
        } else if (currentInsight) {
            // Check for recommendation keywords
            if (/recommend|action|should|consider|try/i.test(line)) {
                currentInsight.recommendation += (currentInsight.recommendation ? ' ' : '') + line.trim();
            } else {
                currentInsight.insight += ' ' + line.trim();
            }
        }
    }
    if (currentInsight) insights.push(currentInsight);

    return insights.length > 0 ? insights : [{ insight: text.slice(0, 500), recommendation: 'Review the data', priority: 'medium', data: null }];
}

function _basicAnalysis(metrics) {
    const insights = [];

    if (metrics.hourlyEngagement && metrics.hourlyEngagement.length > 0) {
        const peakHours = [...metrics.hourlyEngagement]
            .sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0))
            .slice(0, 3);
        if (peakHours.length > 0) {
            insights.push({
                insight: `Peak engagement hours: ${peakHours.map(h => `${h.hour}:00`).join(', ')}`,
                recommendation: 'Schedule important notifications during these hours for maximum reach.',
                priority: 'high',
                data: peakHours
            });
        }
    }

    if (metrics.categoryEngagement) {
        const lowest = [...metrics.categoryEngagement]
            .sort((a, b) => (a.totalViews || 0) - (b.totalViews || 0))
            .slice(0, 3);
        if (lowest.length > 0 && lowest[0].totalViews === 0) {
            insights.push({
                insight: `Zero-engagement categories: ${lowest.filter(c => !c.totalViews).map(c => c.category).join(', ')}`,
                recommendation: 'Consider dropping these categories or merging them into broader topics.',
                priority: 'medium',
                data: lowest.filter(c => !c.totalViews)
            });
        }
    }

    return insights;
}

module.exports = { analyzeEngagement };