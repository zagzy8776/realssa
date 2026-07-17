/**
 * AI Agent API Routes
 * Exposes all agentic AI features as REST API endpoints.
 * Each endpoint is stateless (agents pull their own data from DB).
 */

const express = require('express');
const router = express.Router();

const { selectBreakingNow } = require('../services/aiHomepageEditor');
const { diagnoseFeedFailure, searchReplacementFeed, testFeedCandidate } = require('../services/aiFeedRepairAgent');
const { checkImage } = require('../services/aiImageSanityChecker');
const { searchForStories, discoverNewSources, generateSearchSummary } = require('../services/aiWebSearchAgent');
const { writeToneMatchedNotification, shouldNotify, optimalSendTime } = require('../services/aiNotificationOptimizer');
const { investigateStoryCluster } = require('../services/aiInvestigativeAgent');
const { analyzeEngagement } = require('../services/aiEngagementAnalyst');
const { fillContentGap } = require('../services/aiContentGapNegotiator');

/**
 * Inject the pool when the routes are mounted.
 * @param {object} pool - PostgreSQL pool
 */
function initRouter(pool) {
    // ── AI Homepage Editor ────────────────────────────────────────────────
    // GET /api/ai/breaking-now — Get AI-chosen breaking now stories
    router.get('/breaking-now', async (req, res) => {
        try {
            const hoursBack = parseInt(req.query.hours) || 1;
            const result = await pool.query(
                `SELECT 'rss-' || id as id, id as db_id, title, original_excerpt, ai_summary,
                        category, image, author, source_name, external_link, published_at, content_type
                 FROM rss_articles
                 WHERE published_at > NOW() - INTERVAL '${hoursBack} hours'
                   AND image IS NOT NULL AND image != ''
                 ORDER BY published_at DESC
                 LIMIT 60`
            );

            const articles = result.rows;
            const { breakingNow, heroStories } = await selectBreakingNow(articles, pool);

            res.json({
                success: true,
                generated_at: new Date().toISOString(),
                breakingNow,
                heroStories
            });
        } catch (err) {
            console.error('[AI Route] /breaking-now error:', err.message);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // ── AI Feed Repair Agent ─────────────────────────────────────────────
    // POST /api/ai/diagnose-feed — Diagnose a failing feed URL
    router.post('/diagnose-feed', async (req, res) => {
        try {
            const { feedUrl, statusCode, errorMessage, responseBody } = req.body;
            if (!feedUrl) return res.status(400).json({ error: 'feedUrl required' });

            const diagnosis = await diagnoseFeedFailure(feedUrl, {
                statusCode: statusCode || 'ERR',
                errorMessage: errorMessage || 'Unknown error',
                responseBody: responseBody || null
            }, pool);

            res.json({ success: true, feedUrl, diagnosis });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // POST /api/ai/search-replacement-feed — Find replacement for a dead feed
    router.post('/search-replacement-feed', async (req, res) => {
        try {
            const { feedUrl } = req.body;
            if (!feedUrl) return res.status(400).json({ error: 'feedUrl required' });

            const candidates = await searchReplacementFeed(feedUrl);

            // Test each candidate
            const tested = [];
            for (const url of candidates) {
                const valid = await testFeedCandidate(url);
                tested.push({ url, valid });
            }

            res.json({ success: true, feedUrl, candidates: tested });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // ── AI Image Sanity Checker ──────────────────────────────────────────
    // POST /api/ai/check-image — Verify image relevance
    router.post('/check-image', async (req, res) => {
        try {
            const { imageUrl, title, excerpt, sourceName } = req.body;
            if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });

            const result = await checkImage(imageUrl, title || '', excerpt || '', sourceName || '');
            res.json({ success: true, ...result });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // ── AI Web Search Agent ──────────────────────────────────────────────
    // POST /api/ai/search-stories — Search for stories RSS feeds might have missed
    router.post('/search-stories', async (req, res) => {
        try {
            const { topic, region } = req.body;
            if (!topic) return res.status(400).json({ error: 'topic required' });

            const candidates = await searchForStories(topic, region || '');
            const summary = candidates.length > 0 ? await generateSearchSummary(topic, candidates) : null;

            res.json({ success: true, topic, region: region || null, candidates, summary });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // POST /api/ai/discover-sources — Discover new RSS feed sources
    router.post('/discover-sources', async (req, res) => {
        try {
            const { topic } = req.body;
            const sources = await discoverNewSources(topic || '');
            res.json({ success: true, sources });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // ── AI Notification Optimizer ────────────────────────────────────────
    // POST /api/ai/write-notification — Write tone-matched notification copy
    router.post('/write-notification', async (req, res) => {
        try {
            const { article, score } = req.body;
            if (!article) return res.status(400).json({ error: 'article required' });

            const result = await writeToneMatchedNotification(article, score || 0);
            res.json({ success: true, ...result });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // POST /api/ai/should-notify — Gatekeeper: should this be a notification?
    router.post('/should-notify', async (req, res) => {
        try {
            const { article } = req.body;
            if (!article) return res.status(400).json({ error: 'article required' });

            const result = await shouldNotify(article);
            res.json({ success: true, ...result });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // POST /api/ai/optimal-send-time — Determine best time to send notification
    router.post('/optimal-send-time', async (req, res) => {
        try {
            const { deviceId, urgency } = req.body;
            if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

            const getUserPattern = async (id) => {
                try {
                    const result = await pool.query(
                        `SELECT EXTRACT(HOUR FROM interacted_at) as hour, COUNT(*) as count
                         FROM user_interactions
                         WHERE device_id = $1 AND interacted_at > NOW() - INTERVAL '7 days'
                         GROUP BY hour
                         ORDER BY count DESC
                         LIMIT 6`,
                        [id]
                    );
                    if (result.rows.length === 0) return null;
                    return {
                        activeHours: result.rows.map(r => parseInt(r.hour))
                    };
                } catch {
                    return null;
                }
            };

            const result = await optimalSendTime(deviceId, urgency || 1, getUserPattern);
            res.json({ success: true, ...result });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // ── AI Investigative Agent ────────────────────────────────────────────
    // POST /api/ai/investigate — Investigate a cluster of related articles
    router.post('/investigate', async (req, res) => {
        try {
            const { articles } = req.body;
            if (!articles || !Array.isArray(articles)) {
                return res.status(400).json({ error: 'articles array required' });
            }

            const result = await investigateStoryCluster(articles);
            res.json({ success: true, ...result });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // ── AI Engagement Analyst ────────────────────────────────────────────
    // POST /api/ai/analyze-engagement — Analyze engagement patterns
    router.post('/analyze-engagement', async (req, res) => {
        try {
            const metrics = req.body.metrics;
            if (!metrics) return res.status(400).json({ error: 'metrics required' });

            const insights = await analyzeEngagement(metrics);
            res.json({ success: true, insights });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // GET /api/ai/analyze-engagement/dashboard — Auto-gather metrics and analyze
    router.get('/analyze-engagement/dashboard', async (req, res) => {
        try {
            // Auto-gather metrics from database
            const [categoryEng, hourlyEng, sourcePerf, catFollowers] = await Promise.all([
                pool.query(`
                    SELECT category, COUNT(*) as total_views
                    FROM rss_articles
                    WHERE published_at > NOW() - INTERVAL '7 days'
                    GROUP BY category
                    ORDER BY total_views DESC
                `),
                pool.query(`
                    SELECT EXTRACT(HOUR FROM interacted_at) as hour, COUNT(*) as total_views
                    FROM user_interactions
                    WHERE interacted_at > NOW() - INTERVAL '7 days'
                    GROUP BY hour
                    ORDER BY hour
                `),
                pool.query(`
                    SELECT source_name, COUNT(*) as total_articles,
                           COALESCE(AVG(view_count), 0) as avg_views
                    FROM rss_articles
                    WHERE published_at > NOW() - INTERVAL '30 days'
                    GROUP BY source_name
                    ORDER BY total_articles DESC
                    LIMIT 20
                `),
                pool.query(`
                    SELECT category, COUNT(*) as followers
                    FROM user_category_affinities
                    WHERE score > 0
                    GROUP BY category
                    ORDER BY followers DESC
                `)
            ]);

            const metrics = {
                categoryEngagement: categoryEng.rows.map(r => ({
                    category: r.category,
                    totalViews: parseInt(r.total_views) || 0,
                    uniqueUsers: 0,
                    avgTimeOnArticle: 0,
                    notificationSent: 0,
                    notificationOpenRate: 0
                })),
                hourlyEngagement: hourlyEng.rows.map(r => ({
                    hour: parseInt(r.hour),
                    totalViews: parseInt(r.total_views) || 0,
                    notificationOpens: 0
                })),
                sourcePerformance: sourcePerf.rows.map(r => ({
                    sourceName: r.source_name,
                    totalArticles: parseInt(r.total_articles),
                    avgViews: parseFloat(r.avg_views) || 0,
                    avgTimeOnArticle: 0
                })),
                categoryFollowers: Object.fromEntries(
                    catFollowers.rows.map(r => [r.category, parseInt(r.followers)])
                )
            };

            const insights = await analyzeEngagement(metrics);
            res.json({ success: true, metrics, insights });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // ── Database Audit Endpoint ─────────────────────────────────────────
    // GET /api/ai/audit — Run full database audit (returns JSON)
    router.get('/audit', async (req, res) => {
        try {
            const [totalRes, catRes, imgRes, summaryRes, viewsRes, healthRes, sizeRes] = await Promise.all([
                pool.query('SELECT COUNT(*) FROM rss_articles'),
                pool.query(`
                    SELECT category, COUNT(*) as count,
                           MIN(published_at) as oldest,
                           MAX(published_at) as newest
                    FROM rss_articles GROUP BY category ORDER BY count DESC
                `),
                pool.query(`
                    SELECT COUNT(*) as total,
                           SUM(CASE WHEN image IS NULL OR image = '' THEN 1 ELSE 0 END) as no_image,
                           SUM(CASE WHEN image ~* \'(logo|icon|brand|placeholder|avatar|favicon|punchng)\' THEN 1 ELSE 0 END) as logo_image,
                           SUM(CASE WHEN image IS NOT NULL AND image != \'\'
                                     AND image !~* \'(logo|icon|brand|placeholder|avatar|favicon|punchng)\' THEN 1 ELSE 0 END) as good_image
                    FROM rss_articles
                `),
                pool.query(`
                    SELECT COUNT(*) as total,
                           SUM(CASE WHEN ai_summary IS NOT NULL THEN 1 ELSE 0 END) as has_summary
                    FROM rss_articles WHERE content_type = 'article'
                `),
                pool.query(`
                    SELECT title, category, source_name, view_count, published_at
                    FROM rss_articles WHERE view_count > 0
                    ORDER BY view_count DESC LIMIT 10
                `),
                pool.query(`
                    SELECT COUNT(*) as total,
                           SUM(CASE WHEN is_healthy = true THEN 1 ELSE 0 END) as healthy,
                           SUM(CASE WHEN is_healthy = false THEN 1 ELSE 0 END) as failing
                    FROM rss_feed_health_log
                `),
                pool.query(`
                    SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
                `)
            ]);

            // Get failing feeds if any
            let failingFeeds = [];
            if (parseInt(healthRes.rows[0].failing) > 0) {
                const failRes = await pool.query(`
                    SELECT feed_url, status_code, error_message, checked_at
                    FROM rss_feed_health_log WHERE is_healthy = false
                    ORDER BY checked_at DESC LIMIT 20
                `);
                failingFeeds = failRes.rows;
            }

            // Get user engagement table counts
            const userTables = ['user_category_affinities', 'user_interactions', 'user_subscriptions', 'notified_articles', 'followed_matches', 'article_reactions'];
            const engagement = {};
            for (const table of userTables) {
                try {
                    const exists = await pool.query(`
                        SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`, [table]);
                    if (exists.rows[0].exists) {
                        const c = await pool.query(`SELECT COUNT(*) FROM ${table}`);
                        engagement[table] = parseInt(c.rows[0].count);
                    }
                } catch { engagement[table] = -1; }
            }

            res.json({
                success: true,
                timestamp: new Date().toISOString(),
                source: 'LIVE DATABASE',
                total_articles: parseInt(totalRes.rows[0].count),
                articles_by_category: catRes.rows.map(r => ({
                    category: r.category,
                    count: parseInt(r.count),
                    oldest: r.oldest,
                    newest: r.newest
                })),
                image_quality: {
                    total: parseInt(imgRes.rows[0].total),
                    good_images: parseInt(imgRes.rows[0].good_image),
                    logo_placeholders: parseInt(imgRes.rows[0].logo_image),
                    no_image: parseInt(imgRes.rows[0].no_image)
                },
                ai_summary_coverage: {
                    total_articles_needing: parseInt(summaryRes.rows[0].total),
                    with_summary: parseInt(summaryRes.rows[0].has_summary),
                    coverage_pct: parseInt(summaryRes.rows[0].total) > 0
                        ? ((parseInt(summaryRes.rows[0].has_summary) / parseInt(summaryRes.rows[0].total)) * 100).toFixed(1)
                        : '0.0'
                },
                top_viewed_articles: viewsRes.rows.map(r => ({
                    title: r.title,
                    category: r.category,
                    source: r.source_name,
                    views: r.view_count,
                    published: r.published_at
                })),
                feed_health: {
                    total_checks: parseInt(healthRes.rows[0].total),
                    healthy: parseInt(healthRes.rows[0].healthy),
                    failing: parseInt(healthRes.rows[0].failing),
                    failing_feeds: failingFeeds.map(r => ({
                        url: r.feed_url,
                        status: r.status_code,
                        error: r.error_message,
                        checked_at: r.checked_at
                    }))
                },
                engagement_tables: engagement,
                database_size: sizeRes.rows[0].db_size
            });
        } catch (err) {
            console.error('[AI Route] /audit error:', err.message);
            res.status(500).json({ success: false, error: err.message, stack: err.stack });
        }
    });

    // ── AI Content Gap Negotiator ────────────────────────────────────────
    // POST /api/ai/fill-content-gap — Generate content for an empty category
    router.post('/fill-content-gap', async (req, res) => {
        try {
            const { category, availableContent, upcomingEvents, recentHighlights } = req.body;
            if (!category) return res.status(400).json({ error: 'category required' });

            const result = await fillContentGap(
                category,
                availableContent || [],
                upcomingEvents || [],
                recentHighlights || null
            );
            res.json({ success: true, ...result });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // GET /api/ai/fill-content-gap/:category — Auto-fill from DB
    router.get('/fill-content-gap/:category', async (req, res) => {
        try {
            const category = req.params.category;

            // Check if category has recent articles
            const recentRes = await pool.query(
                `SELECT COUNT(*) as count FROM rss_articles
                 WHERE category = $1 AND published_at > NOW() - INTERVAL '6 hours'`,
                [category]
            );

            if (parseInt(recentRes.rows[0].count) > 0) {
                return res.json({ success: true, type: 'has_content', content: null });
            }

            // Get available content from other categories
            const availableRes = await pool.query(
                `SELECT 'rss-' || id as id, title, original_excerpt as excerpt, ai_summary, category, image
                 FROM rss_articles
                 WHERE published_at > NOW() - INTERVAL '6 hours'
                   AND image IS NOT NULL AND image != ''
                 ORDER BY published_at DESC
                 LIMIT 20`
            );

            const result = await fillContentGap(category, availableRes.rows, [], null);
            res.json({ success: true, ...result });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // ── Health Check ─────────────────────────────────────────────────────
    router.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            agents: [
                'aiHomepageEditor',
                'aiFeedRepairAgent',
                'aiImageSanityChecker',
                'aiWebSearchAgent',
                'aiNotificationOptimizer',
                'aiInvestigativeAgent',
                'aiEngagementAnalyst',
                'aiContentGapNegotiator',
                'sportsBot (existing)',
                'aiMatchEventDetector (existing sportsBot)'
            ],
            gemini_api_key_set: !!process.env.GEMINI_API_KEY,
            timestamp: new Date().toISOString()
        });
    });

    return router;
}

module.exports = { initRouter };