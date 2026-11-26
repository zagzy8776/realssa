/**
 * News Pipeline Orchestrator
 *
 * This is the MASTER BOT that runs the complete pipeline when new feeds arrive:
 * 1. Feed Ingestion → 2. Image Rescue → 3. AI Summarization → 4. Categorization →
 * 5. Feed Ranking → 6. Breaking News Selection → 7. Content Gap Filling →
 * 8. Notification Optimization → 9. Engagement Analysis → 10. Content Sanity Check
 *
 * All bots have their jobs and run in sequence with proper error handling.
 */

const { findBestArticleImage, extractAllImages, normalizeUrl } = require('./aggressiveImageScraper');
const { callGemini, callGeminiJSON } = require('./aiAgentService');
const { selectBreakingNow } = require('./aiHomepageEditor');
const { fillContentGap } = require('./aiContentGapNegotiator');
const { writeToneMatchedNotification, shouldNotify, optimalSendTime } = require('./aiNotificationOptimizer');
const { analyzeEngagement } = require('./aiEngagementAnalyst');
const { checkImage } = require('./aiImageSanityChecker');
const { investigateStoryCluster } = require('./aiInvestigativeAgent');
const { searchForStories, discoverNewSources } = require('./aiWebSearchAgent');
const { diagnoseFeedFailure, searchReplacementFeed } = require('./aiFeedRepairAgent');

const LOG = {
  info: (m) => console.log(`[NewsPipeline] ${new Date().toISOString()} ${m}`),
  warn: (m) => console.warn(`[NewsPipeline] ${new Date().toISOString()} ${m}`),
  error: (m) => console.error(`[NewsPipeline] ${new Date().toISOString()} ${m}`),
  debug: (m) => process.env.DEBUG_PIPELINE && console.log(`[NewsPipeline:DEBUG] ${m}`),
};

// Pipeline stages configuration
const PIPELINE_STAGES = [
  'image_rescue',
  'ai_summarization',
  'categorization',
  'breaking_selection',
  'content_gap_check',
  'image_sanity_check',
  'notification_gating',
  'engagement_analysis',
];

class NewsPipelineOrchestrator {
  constructor(pool) {
    this.pool = pool;
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      articlesProcessed: 0,
      imagesRescued: 0,
      summariesGenerated: 0,
      notificationsSent: 0,
      errors: [],
    };
  }

  /**
   * MAIN ENTRY POINT - Run complete pipeline on new articles
   * Called after RSS feed ingestion completes
   */
  async runFullPipeline(newArticleIds = [], options = {}) {
    if (this.isRunning) {
      LOG.warn('Pipeline already running, skipping this trigger');
      return { success: false, reason: 'already_running' };
    }

    this.isRunning = true;
    const runId = `pipeline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    LOG.info(`🚀 Starting pipeline run ${runId} for ${newArticleIds.length} articles`);

    try {
      // Get articles to process (new ones or recent unprocessed)
      const articles = await this.getArticlesToProcess(newArticleIds, options);
      LOG.info(`📦 Processing ${articles.length} articles through pipeline`);

      const results = {
        runId,
        startTime: new Date(startTime).toISOString(),
        articlesProcessed: articles.length,
        stages: {},
        errors: [],
      };

      // STAGE 1: Image Rescue - Get original photos for all articles
      results.stages.image_rescue = await this.runImageRescueStage(articles);

      // STAGE 2: AI Summarization - Generate summaries for articles without them
      results.stages.ai_summarization = await this.runSummarizationStage(articles);

      // STAGE 3: Categorization - Ensure proper categorization
      results.stages.categorization = await this.runCategorizationStage(articles);

      // STAGE 4: Breaking News Selection - AI picks breaking stories
      results.stages.breaking_selection = await this.runBreakingSelectionStage(articles);

      // STAGE 5: Content Gap Check - Fill empty categories
      results.stages.content_gap_check = await this.runContentGapStage();

      // STAGE 6: Image Sanity Check - Verify image relevance
      results.stages.image_sanity_check = await this.runImageSanityStage(articles);

      // STAGE 7: Notification Gating - Decide which articles get notifications
      results.stages.notification_gating = await this.runNotificationStage(articles);

      // STAGE 8: Engagement Analysis - Periodic analysis
      if (options.runEngagementAnalysis || this.shouldRunEngagementAnalysis()) {
        results.stages.engagement_analysis = await this.runEngagementAnalysisStage();
      }

      // Update stats
      this.stats.totalRuns++;
      this.stats.successfulRuns++;
      this.stats.articlesProcessed += articles.length;
      this.stats.imagesRescued += results.stages.image_rescue?.rescued || 0;
      this.stats.summariesGenerated += results.stages.ai_summarization?.generated || 0;
      this.stats.notificationsSent += results.stages.notification_gating?.queued || 0;
      this.lastRun = new Date().toISOString();

      const duration = Date.now() - startTime;
      LOG.info(`✅ Pipeline ${runId} completed in ${duration}ms`);

      return { success: true, ...results, duration };

    } catch (error) {
      this.stats.totalRuns++;
      this.stats.failedRuns++;
      this.stats.errors.push({ time: new Date().toISOString(), error: error.message, stack: error.stack });
      LOG.error(`❌ Pipeline ${runId} failed: ${error.message}`);
      return { success: false, runId, error: error.message, duration: Date.now() - startTime };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get articles that need processing
   */
  async getArticlesToProcess(newArticleIds, options) {
    let query = `
      SELECT 'rss-' || id as id, id as db_id, title, original_excerpt, ai_summary,
             category, image, author, source_name, external_link, published_at, content_type
      FROM rss_articles
      WHERE 1=1
    `;
    const params = [];

    if (newArticleIds.length > 0) {
      const placeholders = newArticleIds.map((_, i) => `$${i + 1}`).join(',');
      query += ` AND ('rss-' || id) IN (${placeholders})`;
      params.push(...newArticleIds);
    } else if (!options.processAll) {
      // Default: last 2 hours, unprocessed articles
      query += ` AND published_at > NOW() - INTERVAL '2 hours'
                AND (ai_summary IS NULL OR image IS NULL OR image = '' OR image ~* '(logo|placeholder|icon|brand)')
                AND content_type = 'article'`;
    }

    query += ` ORDER BY published_at DESC LIMIT 100`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 1: IMAGE RESCUE - Get original article photos
  // ═══════════════════════════════════════════════════════════════
  async runImageRescueStage(articles) {
    LOG.info('🖼️ Stage 1: Image Rescue');
    let rescued = 0;
    let skipped = 0;
    const errors = [];

    for (const article of articles) {
      const needsRescue = !article.image ||
        article.image === '' ||
        /logo|icon|brand|placeholder|avatar|favicon|punchng.*logo|cropped-punch|PUNCH-Logo/i.test(article.image);

      if (!needsRescue) {
        skipped++;
        continue;
      }

      if (!article.external_link) {
        LOG.debug(`No external link for ${article.id}, skipping image rescue`);
        continue;
      }

      try {
        // Use the aggressive image scraper
        const bestImage = await findBestArticleImage(article.external_link, null, article.title);

        if (bestImage && !/logo|icon|brand|placeholder|avatar|favicon|punchng.*logo|cropped-punch|PUNCH-Logo/i.test(bestImage)) {
          await this.pool.query(
            'UPDATE rss_articles SET image = $1, updated_at = NOW() WHERE id = $2',
            [bestImage, article.db_id]
          );
          rescued++;
          LOG.info(`✅ Rescued image for "${article.title.slice(0, 50)}...": ${bestImage.slice(0, 60)}...`);
        } else {
          LOG.debug(`No suitable image found for ${article.id}`);
        }
      } catch (err) {
        errors.push({ articleId: article.id, error: err.message });
        LOG.warn(`Image rescue failed for ${article.id}: ${err.message}`);
      }
    }

    return { rescued, skipped, errors: errors.length, errorDetails: errors };
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 2: AI SUMMARIZATION - Generate summaries
  // ═══════════════════════════════════════════════════════════════
  async runSummarizationStage(articles) {
    LOG.info('📝 Stage 2: AI Summarization');
    let generated = 0;
    let skipped = 0;
    const errors = [];

    const articlesNeedingSummary = articles.filter(a =>
      a.content_type === 'article' &&
      (!a.ai_summary || a.ai_summary.trim() === '') &&
      a.external_link
    );

    for (const article of articlesNeedingSummary) {
      try {
        // Fetch article content if needed
        let content = article.original_excerpt || '';

        if (content.length < 200 && article.external_link) {
          try {
            const res = await fetch(article.external_link, {
              signal: AbortSignal.timeout(10000),
              headers: { 'User-Agent': 'RealSSABot/1.0' }
            });
            if (res.ok) {
              const html = await res.text();
              content = this.extractArticleText(html) || content;
            }
          } catch (e) {
            LOG.debug(`Could not fetch full content for ${article.id}`);
          }
        }

        if (content.length < 50) {
          LOG.debug(`Insufficient content for ${article.id}, skipping summary`);
          continue;
        }

        const summary = await this.generateSummary(article.title, content, article.category);

        if (summary) {
          await this.pool.query(
            'UPDATE rss_articles SET ai_summary = $1, updated_at = NOW() WHERE id = $2',
            [summary, article.db_id]
          );
          generated++;
          LOG.info(`✅ Generated summary for "${article.title.slice(0, 50)}..."`);
        }
      } catch (err) {
        errors.push({ articleId: article.id, error: err.message });
        LOG.warn(`Summarization failed for ${article.id}: ${err.message}`);
      }
    }

    skipped = articles.length - articlesNeedingSummary.length;
    return { generated, skipped, errors: errors.length, errorDetails: errors };
  }

  extractArticleText(html) {
    // Simple text extraction from HTML
    try {
      // Remove scripts, styles, noscript
      let text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
        // Get article/main content
        .replace(/.*<article[^>]*>/i, '')
        .replace(/<\/article>.*/i, '')
        // Remove all tags
        .replace(/<[^>]+>/g, ' ')
        // Decode entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, "'")
        // Clean whitespace
        .replace(/\s+/g, ' ')
        .trim();

      return text.slice(0, 5000); // Limit for token efficiency
    } catch {
      return '';
    }
  }

  async generateSummary(title, content, category) {
    const systemPrompt = `You are a professional news summarizer for RealSSA, an African news platform.
Write a concise, engaging 2-3 sentence summary that captures the key facts and why it matters to African readers.
Be objective, clear, and informative. Use simple language.`;

    const userPrompt = `Title: ${title}
Category: ${category}
Content: ${content.slice(0, 3000)}

Write a 2-3 sentence summary for African news readers. Focus on: what happened, why it matters, key details.`;

    return await callGemini(systemPrompt, userPrompt, {
      maxTokens: 200,
      temperature: 0.3
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 3: CATEGORIZATION - Ensure proper categorization
  // ═══════════════════════════════════════════════════════════════
  async runCategorizationStage(articles) {
    LOG.info('🏷️ Stage 3: Categorization');
    let updated = 0;
    let skipped = 0;

    // Categories that should exist in our system
    const validCategories = [
      'nigerian-news', 'nigerian-politics', 'nigerian-business', 'nigerian-sports',
      'nigerian-tech', 'nigerian-lifestyle', 'nigerian-gaming', 'crypto-nigeria',
      'afrobeats', 'nollywood', 'culture', 'fashion', 'tech', 'music',
      'world', 'uk', 'usa', 'africa', 'ghana', 'kenya', 'south-africa',
      'crypto', 'business', 'sports', 'entertainment', 'breaking'
    ];

    for (const article of articles) {
      if (!article.category || !validCategories.includes(article.category.toLowerCase())) {
        // Try to infer category from title/content
        const inferred = await this.inferCategory(article.title, article.original_excerpt);
        if (inferred && inferred !== article.category) {
          await this.pool.query(
            'UPDATE rss_articles SET category = $1, updated_at = NOW() WHERE id = $2',
            [inferred, article.db_id]
          );
          updated++;
          LOG.info(`✅ Recategorized "${article.title.slice(0, 50)}..." → ${inferred}`);
        }
      } else {
        skipped++;
      }
    }

    return { updated, skipped };
  }

  async inferCategory(title, excerpt) {
    const text = `${title} ${excerpt || ''}`.toLowerCase();

    // Simple keyword-based categorization
    const categoryKeywords = {
      'nigerian-politics': ['tinubu', 'buhari', 'atiku', 'senate', 'assembly', 'minister', 'governor', 'election', 'apc', 'pdp', 'presidency', 'nigeria politics'],
      'nigerian-business': ['economy', 'naira', 'cbn', 'bank', 'inflation', 'trade', 'investment', 'stock', 'market', 'business', 'finance', 'budget', 'revenue'],
      'nigerian-sports': ['super eagles', 'nigeria football', 'npfl', 'lagos', 'nigerian player', 'afcon', 'world cup qualifier'],
      'nigerian-tech': ['startup', 'fintech', 'tech', 'innovation', 'digital', 'app', 'software', 'developer', 'lagos tech', 'nigerian tech'],
      'afrobeats': ['burna boy', 'wizkid', 'davido', 'tiwa', 'runtown', 'afrobeats', 'afrobeat', 'nigerian music', 'album', 'song', 'music'],
      'nollywood': ['nollywood', 'movie', 'film', 'actor', 'actress', 'cinema', 'netflix', 'director', 'production'],
      'crypto': ['bitcoin', 'ethereum', 'crypto', 'blockchain', 'binance', 'token', 'defi', 'web3', 'cryptocurrency'],
      'world': ['biden', 'trump', 'putin', 'china', 'russia', 'ukraine', 'europe', 'america', 'un ', 'world', 'global'],
      'sports': ['football', 'premier league', 'champions league', 'fifa', 'olympics', 'tennis', 'basketball', 'cricket'],
      'business': ['stock market', 'economy', 'inflation', 'central bank', 'trade', 'investment', 'merger', 'acquisition'],
      'tech': ['ai', 'artificial intelligence', 'google', 'microsoft', 'apple', 'amazon', 'meta', 'startup', 'technology'],
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(k => text.includes(k))) {
        return category;
      }
    }

    return 'nigerian-news'; // Default
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 4: BREAKING NEWS SELECTION
  // ═══════════════════════════════════════════════════════════════
  async runBreakingSelectionStage(articles) {
    LOG.info('🚨 Stage 4: Breaking News Selection');

    try {
      // Get recent articles with images for breaking news consideration
      const result = await this.pool.query(`
        SELECT 'rss-' || id as id, id as db_id, title, original_excerpt, ai_summary,
               category, image, author, source_name, external_link, published_at, content_type
        FROM rss_articles
        WHERE published_at > NOW() - INTERVAL '4 hours'
          AND image IS NOT NULL AND image != ''
          AND image !~* '(logo|icon|brand|placeholder|avatar|favicon|punchng.*logo|cropped-punch|PUNCH-Logo)'
        ORDER BY published_at DESC
        LIMIT 50
      `);

      const { breakingNow, heroStories } = await selectBreakingNow(result.rows, this.pool);

      // Mark breaking stories in database
      for (const story of [...breakingNow, ...heroStories]) {
        await this.pool.query(
          `UPDATE rss_articles SET is_breaking = true, breaking_rank = $1, updated_at = NOW()
           WHERE id = $2 AND (is_breaking IS NOT TRUE OR breaking_rank IS NULL)`,
          [story.rank || 99, story.db_id || story.id?.replace('rss-', '')]
        );
      }

      LOG.info(`✅ Selected ${breakingNow.length} breaking + ${heroStories.length} hero stories`);
      return { breakingCount: breakingNow.length, heroCount: heroStories.length };
    } catch (err) {
      LOG.error(`Breaking selection failed: ${err.message}`);
      return { error: err.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 5: CONTENT GAP CHECK
  // ═══════════════════════════════════════════════════════════════
  async runContentGapStage() {
    LOG.info('🔍 Stage 5: Content Gap Check');
    const categories = [
      'nigerian-news', 'nigerian-politics', 'nigerian-business', 'nigerian-sports',
      'nigerian-tech', 'world', 'sports', 'business', 'tech', 'crypto', 'entertainment',
      'ghana', 'kenya', 'south-africa', 'afrobeats', 'nollywood', 'culture'
    ];

    const gaps = [];

    for (const category of categories) {
      const recentRes = await this.pool.query(
        `SELECT COUNT(*) as count FROM rss_articles
         WHERE category = $1 AND published_at > NOW() - INTERVAL '6 hours'`,
        [category]
      );

      if (parseInt(recentRes.rows[0].count) === 0) {
        // Get available content from other categories
        const availableRes = await this.pool.query(
          `SELECT 'rss-' || id as id, title, original_excerpt as excerpt, ai_summary, category, image
           FROM rss_articles
           WHERE published_at > NOW() - INTERVAL '6 hours'
             AND image IS NOT NULL AND image != ''
           ORDER BY published_at DESC LIMIT 15`
        );

        const result = await fillContentGap(category, availableRes.rows, [], null);
        gaps.push({ category, ...result });
      }
    }

    LOG.info(`✅ Checked ${categories.length} categories, found ${gaps.length} gaps`);
    return { gapsChecked: categories.length, gapsFound: gaps.length, gaps };
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 6: IMAGE SANITY CHECK
  // ═══════════════════════════════════════════════════════════════
  async runImageSanityStage(articles) {
    LOG.info('🔍 Stage 6: Image Sanity Check');
    let checked = 0;
    let flagged = 0;
    const errors = [];

    // Check recent articles that have images
    const articlesToCheck = articles.filter(a => a.image && a.image.length > 10);

    for (const article of articlesToCheck.slice(0, 20)) { // Limit to 20 per run
      try {
        const result = await checkImage(article.image, article.title, article.ai_summary || article.original_excerpt || '', article.source_name || '');
        checked++;

        if (!result.relevant || result.isLogo) {
          flagged++;
          // Mark for review
          await this.pool.query(
            `UPDATE rss_articles SET image_flagged = true, image_flag_reason = $1, updated_at = NOW() WHERE id = $2`,
            [result.reason || 'Failed sanity check', article.db_id]
          );
          LOG.warn(`🚩 Flagged image for "${article.title.slice(0, 50)}...": ${result.reason}`);
        }
      } catch (err) {
        errors.push({ articleId: article.id, error: err.message });
      }
    }

    return { checked, flagged, errors: errors.length };
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 7: NOTIFICATION GATING
  // ═══════════════════════════════════════════════════════════════
  async runNotificationStage(articles) {
    LOG.info('🔔 Stage 7: Notification Gating');
    let queued = 0;
    let skipped = 0;

    // Get articles that haven't been evaluated for notifications
    const candidates = articles.filter(a =>
      a.content_type === 'article' &&
      a.ai_summary &&
      a.image &&
      !a.image_flagged
    ).slice(0, 10);

    for (const article of candidates) {
      try {
        const notifyResult = await shouldNotify({
          id: article.id,
          title: article.title,
          excerpt: article.ai_summary || article.original_excerpt,
          category: article.category,
          image: article.image,
          source_name: article.source_name,
          published_at: article.published_at,
        });

        if (notifyResult.shouldNotify && notifyResult.score > 0.7) {
          // Get optimal send time
          const deviceResult = await this.pool.query(
            `SELECT DISTINCT device_id FROM user_category_affinities
             WHERE category = $1 AND score > 5 LIMIT 100`,
            [article.category]
          );

          for (const { device_id } of deviceResult.rows) {
            const timeResult = await optimalSendTime(device_id, notifyResult.urgency || 1);

            // Queue notification
            await this.pool.query(
              `INSERT INTO notification_queue (device_id, article_id, title, body, scheduled_for, priority, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())
               ON CONFLICT DO NOTHING`,
              [
                device_id,
                article.id,
                notifyResult.title,
                notifyResult.body,
                timeResult.sendAt || new Date(),
                notifyResult.urgency || 1,
              ]
            );
            queued++;
          }
        } else {
          skipped++;
        }
      } catch (err) {
        LOG.warn(`Notification gating failed for ${article.id}: ${err.message}`);
      }
    }

    return { queued, skipped };
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE 8: ENGAGEMENT ANALYSIS
  // ═══════════════════════════════════════════════════════════════
  async runEngagementAnalysisStage() {
    LOG.info('📊 Stage 8: Engagement Analysis');

    try {
      const [categoryEng, hourlyEng, sourcePerf, catFollowers] = await Promise.all([
        this.pool.query(`
          SELECT category, COUNT(*) as total_views
          FROM rss_articles
          WHERE published_at > NOW() - INTERVAL '7 days'
          GROUP BY category ORDER BY total_views DESC
        `),
        this.pool.query(`
          SELECT EXTRACT(HOUR FROM interacted_at) as hour, COUNT(*) as total_views
          FROM user_interactions
          WHERE interacted_at > NOW() - INTERVAL '7 days'
          GROUP BY hour ORDER BY hour
        `),
        this.pool.query(`
          SELECT source_name, COUNT(*) as total_articles,
                 COALESCE(AVG(view_count), 0) as avg_views
          FROM rss_articles
          WHERE published_at > NOW() - INTERVAL '30 days'
          GROUP BY source_name ORDER BY total_articles DESC LIMIT 20
        `),
        this.pool.query(`
          SELECT category, COUNT(*) as followers
          FROM user_category_affinities
          WHERE score > 0 GROUP BY category ORDER BY followers DESC
        `)
      ]);

      const metrics = {
        categoryEngagement: categoryEng.rows.map(r => ({
          category: r.category,
          totalViews: parseInt(r.total_views) || 0,
        })),
        hourlyEngagement: hourlyEng.rows.map(r => ({
          hour: parseInt(r.hour),
          totalViews: parseInt(r.total_views) || 0,
        })),
        sourcePerformance: sourcePerf.rows.map(r => ({
          sourceName: r.source_name,
          totalArticles: parseInt(r.total_articles),
          avgViews: parseFloat(r.avg_views) || 0,
        })),
        categoryFollowers: Object.fromEntries(
          catFollowers.rows.map(r => [r.category, parseInt(r.followers)])
        ),
      };

      const insights = await analyzeEngagement(metrics);

      // Store insights for later use
      await this.pool.query(
        `INSERT INTO engagement_insights (insights, metrics, created_at) VALUES ($1, $2, NOW())`,
        [JSON.stringify(insights), JSON.stringify(metrics)]
      );

      LOG.info(`✅ Engagement analysis complete: ${insights.recommendations?.length || 0} recommendations`);
      return { success: true, insights };
    } catch (err) {
      LOG.error(`Engagement analysis failed: ${err.message}`);
      return { error: err.message };
    }
  }

  shouldRunEngagementAnalysis() {
    // Run once per hour
    if (!this.lastEngagementRun) return true;
    return Date.now() - new Date(this.lastEngagementRun).getTime() > 3600000;
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════
  getStats() {
    return { ...this.stats, isRunning: this.isRunning, lastRun: this.lastRun };
  }

  async healthCheck() {
    return {
      status: this.isRunning ? 'running' : 'idle',
      lastRun: this.lastRun,
      stats: this.getStats(),
      pipelineStages: PIPELINE_STAGES,
    };
  }
}

// Singleton instance
let orchestratorInstance = null;

function getOrchestrator(pool) {
  if (!orchestratorInstance) {
    orchestratorInstance = new NewsPipelineOrchestrator(pool);
  }
  return orchestratorInstance;
}

module.exports = { NewsPipelineOrchestrator, getOrchestrator };