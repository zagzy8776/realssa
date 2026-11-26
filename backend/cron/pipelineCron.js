/**
 * Pipeline Cron Jobs
 * Runs the news pipeline on a schedule and after feed ingestion
 */

const { getOrchestrator } = require('../services/newsPipelineOrchestrator');

const LOG = {
  info: (m) => console.log(`[PipelineCron] ${new Date().toISOString()} ${m}`),
  warn: (m) => console.warn(`[PipelineCron] ${new Date().toISOString()} ${m}`),
  error: (m) => console.error(`[PipelineCron] ${new Date().toISOString()} ${m}`),
};

// Store pool reference
let poolRef = null;

function initCronJobs(pool) {
  poolRef = pool;
  const orchestrator = getOrchestrator(pool);

  LOG.info('⏰ Initializing pipeline cron jobs...');

  // 1. Run pipeline every 15 minutes for recent articles
  setInterval(async () => {
    try {
      LOG.info('🔄 Running scheduled pipeline (15min)...');
      const result = await orchestrator.runFullPipeline([], { processAll: false });
      LOG.info(`Scheduled pipeline result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    } catch (err) {
      LOG.error(`Scheduled pipeline error: ${err.message}`);
    }
  }, 15 * 60 * 1000); // 15 minutes

  // 2. Run full pipeline with engagement analysis every hour
  setInterval(async () => {
    try {
      LOG.info('🔄 Running hourly full pipeline with engagement analysis...');
      const result = await orchestrator.runFullPipeline([], {
        processAll: true,
        runEngagementAnalysis: true
      });
      LOG.info(`Hourly pipeline result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    } catch (err) {
      LOG.error(`Hourly pipeline error: ${err.message}`);
    }
  }, 60 * 60 * 1000); // 1 hour

  // 3. Run image sanity check on recent articles every 30 minutes
  setInterval(async () => {
    try {
      LOG.info('🔍 Running image sanity check...');
      const result = await orchestrator.runImageSanityStage(
        await getRecentArticles(pool, 4, 50)
      );
      LOG.info(`Image sanity check: ${result.checked} checked, ${result.flagged} flagged`);
    } catch (err) {
      LOG.error(`Image sanity check error: ${err.message}`);
    }
  }, 30 * 60 * 1000); // 30 minutes

  // 4. Run content gap check every 2 hours
  setInterval(async () => {
    try {
      LOG.info('🔍 Running content gap check...');
      const result = await orchestrator.runContentGapStage();
      LOG.info(`Content gap check: ${result.gapsFound} gaps found`);
    } catch (err) {
      LOG.error(`Content gap check error: ${err.message}`);
    }
  }, 2 * 60 * 60 * 1000); // 2 hours

  // 5. Run engagement analysis every 6 hours (more comprehensive)
  setInterval(async () => {
    try {
      LOG.info('📊 Running comprehensive engagement analysis...');
      const result = await orchestrator.runEngagementAnalysisStage();
      LOG.info(`Engagement analysis: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    } catch (err) {
      LOG.error(`Engagement analysis error: ${err.message}`);
    }
  }, 6 * 60 * 60 * 1000); // 6 hours

  LOG.info('✅ Pipeline cron jobs initialized');
  return orchestrator;
}

/**
 * Helper to get recent articles for pipeline stages
 */
async function getRecentArticles(pool, hoursBack, limit) {
  const result = await pool.query(`
    SELECT 'rss-' || id as id, id as db_id, title, original_excerpt, ai_summary,
           category, image, author, source_name, external_link, published_at, content_type
    FROM rss_articles
    WHERE published_at > NOW() - INTERVAL '${hoursBack} hours'
      AND content_type = 'article'
    ORDER BY published_at DESC
    LIMIT ${limit}
  `);
  return result.rows;
}

/**
 * Trigger pipeline after feed ingestion - call this from your feed ingestion code
 */
async function triggerPipelineAfterFeedIngestion(newArticleIds, source = 'feed-ingestion') {
  if (!poolRef) {
    LOG.warn('Pool not initialized, cannot trigger pipeline');
    return { success: false, reason: 'pool_not_initialized' };
  }

  const orchestrator = getOrchestrator(poolRef);

  LOG.info(`📥 Pipeline triggered by ${source} for ${newArticleIds.length} articles`);

  // Run in background, don't await
  orchestrator.runFullPipeline(newArticleIds, {
    processAll: !newArticleIds.length,
    runEngagementAnalysis: true
  }).then(result => {
    LOG.info(`Pipeline triggered by ${source} completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  }).catch(err => {
    LOG.error(`Pipeline triggered by ${source} error: ${err.message}`);
  });

  return { success: true, triggered: true, articleCount: newArticleIds.length };
}

/**
 * Manual trigger for testing
 */
async function manualPipelineRun(articleIds = [], options = {}) {
  if (!poolRef) {
    throw new Error('Pool not initialized');
  }

  const orchestrator = getOrchestrator(poolRef);
  return await orchestrator.runFullPipeline(articleIds, options);
}

module.exports = {
  initCronJobs,
  triggerPipelineAfterFeedIngestion,
  manualPipelineRun
};