/**
 * Dedicated Isolated Human Brain Store (brainStore.js)
 * Manages storage for learned human expressions, QA patterns, tone & phrasing.
 * Micro-compressed storage footprint ensures zero bloat and zero extra cost.
 */

const { pool } = require('./ingestion');

// Migration: Ensure dedicated human_learning_brain table exists
async function initBrainStore() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS human_learning_brain (
        id SERIAL PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        phrase TEXT NOT NULL,
        context TEXT,
        human_nuance TEXT,
        frequency_count INT DEFAULT 1,
        source_type VARCHAR(50) DEFAULT 'web_crawl',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category, phrase)
      )
    `);
    console.log('[BrainStore] ✅ Dedicated human learning database table ready');
  } catch (err) {
    console.warn('[BrainStore] Init table warning:', err.message);
  }
}

// Immediately trigger table check
initBrainStore();

/**
 * Save or increment a learned human phrase/pattern
 */
async function saveHumanInsight({ category = 'phrasing', phrase, context = '', humanNuance = '', sourceType = 'web_crawl' }) {
  if (!phrase || !phrase.trim()) return null;
  const cleanPhrase = phrase.trim().slice(0, 500);
  const cleanContext = (context || '').slice(0, 300);
  const cleanNuance = (humanNuance || '').slice(0, 300);

  try {
    const res = await pool.query(
      `INSERT INTO human_learning_brain (category, phrase, context, human_nuance, source_type, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (category, phrase)
       DO UPDATE SET
         frequency_count = human_learning_brain.frequency_count + 1,
         context = EXCLUDED.context,
         human_nuance = EXCLUDED.human_nuance,
         updated_at = NOW()
       RETURNING id, frequency_count`,
      [category, cleanPhrase, cleanContext, cleanNuance, sourceType]
    );
    return res.rows[0];
  } catch (err) {
    console.warn('[BrainStore] Save error:', err.message);
    return null;
  }
}

/**
 * Fetch top human learning context for AI system prompt
 */
async function getHumanContextForPrompt(limit = 15) {
  try {
    const res = await pool.query(
      `SELECT category, phrase, context, human_nuance 
       FROM human_learning_brain 
       ORDER BY frequency_count DESC, updated_at DESC 
       LIMIT $1`,
      [limit]
    );
    if (res.rows.length === 0) return '';
    return res.rows.map(r => `- [${r.category}] "${r.phrase}" (Nuance: ${r.human_nuance || 'Natural speech'})`).join('\n');
  } catch (err) {
    return '';
  }
}

/**
 * Get stats of human brain store
 */
async function getBrainStats() {
  try {
    const res = await pool.query(`SELECT COUNT(*) as total_insights, SUM(frequency_count) as total_occurrences FROM human_learning_brain`);
    return res.rows[0];
  } catch (err) {
    return { total_insights: 0, total_occurrences: 0 };
  }
}

module.exports = {
  initBrainStore,
  saveHumanInsight,
  getHumanContextForPrompt,
  getBrainStats
};
