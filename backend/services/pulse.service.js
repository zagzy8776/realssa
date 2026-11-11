const fs = require('fs');
const path = require('path');
const eventBus = require('./eventBus');
const { execute, runQuery } = require('./sqliteMultiEngine');
const RealSSALogger = require('./logger');

/**
 * RealSSA Pulse: Event-Driven Promotion Scoring & Freshness Decay Engine
 * Updates promotion scores dynamically on Publish, Click, and Share events
 */
class PulseService {
  constructor() {
    this.loadWeights();
    this.setupListeners();
  }

  loadWeights() {
    try {
      const weightsPath = path.resolve(__dirname, '../config/promotion_weights.json');
      const raw = fs.readFileSync(weightsPath, 'utf8');
      this.weights = JSON.parse(raw);
    } catch {
      this.weights = { freshness: 0.25, ctr: 0.20, engagement: 0.20, readingTime: 0.10, trendScore: 0.10, authority: 0.10, categoryWeight: 0.05 };
    }
  }

  setupListeners() {
    // Event-Driven updates on Publish, Click, and Share
    eventBus.on('article:created', (data) => this.recalculateArticleScore(data.id, 'PUBLISH'));
    eventBus.on('article:viewed', (data) => this.recalculateArticleScore(data.id, 'CLICK'));
    eventBus.on('article:shared', (data) => this.recalculateArticleScore(data.id, 'SHARE'));
  }

  async recalculateArticleScore(articleId, eventType = 'CLICK') {
    if (!articleId) return;
    const startTime = Date.now();

    try {
      // Calculate score based on event type and decay
      let bonus = 0;
      if (eventType === 'PUBLISH') bonus = 40;
      if (eventType === 'CLICK') bonus = 5;
      if (eventType === 'SHARE') bonus = 15;

      const currentRows = await runQuery('intelligence', 'SELECT promotion_score FROM article_scores WHERE article_id = ?', [articleId]);
      const currentScore = (currentRows && currentRows.length > 0) ? currentRows[0].promotion_score : 50;

      const newScore = Math.min(100, currentScore + bonus);

      await execute('intelligence', `
        INSERT OR REPLACE INTO article_scores (article_id, promotion_score, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `, [articleId, newScore]);

      const latency = Date.now() - startTime;
      await RealSSALogger.logServiceExecution(`RealSSA_Pulse_${eventType}`, 'SUCCESS', latency);
    } catch (err) {
      console.error(`❌ [RealSSA Pulse] Failed to score article ${articleId}:`, err.message);
    }
  }

  async applyHourlyDecay() {
    console.log('[RealSSA Pulse] ⏳ Applying hourly exponential freshness decay $e^{-\\lambda t}$...');
    try {
      await execute('intelligence', `
        UPDATE article_scores
        SET promotion_score = MAX(10, promotion_score * 0.95)
      `);
      console.log('✅ [RealSSA Pulse] Hourly freshness decay applied.');
    } catch (err) {
      console.error('❌ [RealSSA Pulse Decay Error]:', err.message);
    }
  }
}

const pulseService = new PulseService();
module.exports = pulseService;
