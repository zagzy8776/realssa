const { getAiPool } = require('./config/multiDb');

async function initAiDatabase() {
  console.log('🤖 INITIALIZING DEDICATED AI & MODEL DATABASE (DB5)...');

  const pool = getAiPool();

  try {
    // Enable pgvector extension if available
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
      console.log('  ✅ pgvector extension enabled on DB5.');
    } catch (e) {
      console.log('  ℹ️ pgvector extension notice:', e.message);
    }

    // 1. Article Entities Table (NER graph for politicians, companies, places)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS article_entities (
        id SERIAL PRIMARY KEY,
        article_id INTEGER,
        entity_name VARCHAR(255) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        confidence_score DOUBLE PRECISION DEFAULT 0.9,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_article_entities_name ON article_entities (entity_name);
      CREATE INDEX IF NOT EXISTS idx_article_entities_type ON article_entities (entity_type);
    `);
    console.log('  ✅ Table created: article_entities');

    // 2. Vector Embeddings Table (Dedicated semantic search bank)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vector_embeddings (
        id SERIAL PRIMARY KEY,
        article_id INTEGER UNIQUE NOT NULL,
        url_hash VARCHAR(64) UNIQUE NOT NULL,
        title TEXT NOT NULL,
        category VARCHAR(100),
        embedding TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_vector_embeddings_hash ON vector_embeddings (url_hash);
    `);
    console.log('  ✅ Table created: vector_embeddings');

    // 3. AI Agent Memory Table (Fact-checking history & verification scores)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_agent_memory (
        id SERIAL PRIMARY KEY,
        agent_name VARCHAR(100) NOT NULL,
        action_type VARCHAR(100) NOT NULL,
        target_id VARCHAR(255),
        input_summary TEXT,
        verification_result JSONB,
        confidence_score DOUBLE PRECISION DEFAULT 1.0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ai_memory_agent ON ai_agent_memory (agent_name, action_type);
    `);
    console.log('  ✅ Table created: ai_agent_memory');

    // 4. Trending Syntheses Table (AI synthesized stories)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trending_syntheses (
        id SERIAL PRIMARY KEY,
        topic_cluster VARCHAR(255) NOT NULL,
        synthesized_title TEXT NOT NULL,
        synthesized_body TEXT NOT NULL,
        source_article_ids INTEGER[],
        confidence DOUBLE PRECISION DEFAULT 0.95,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_trending_syntheses_cluster ON trending_syntheses (topic_cluster);
    `);
    console.log('  ✅ Table created: trending_syntheses');

    // 5. Model Training Logs Table (Bot daily training & prompt performance)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS model_training_logs (
        id SERIAL PRIMARY KEY,
        model_name VARCHAR(100) NOT NULL,
        prompt_version VARCHAR(50),
        tokens_used INTEGER DEFAULT 0,
        latency_ms INTEGER DEFAULT 0,
        accuracy_score DOUBLE PRECISION DEFAULT 1.0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_model_training_name ON model_training_logs (model_name);
    `);
    console.log('  ✅ Table created: model_training_logs');

    console.log('\n🎉 DB5 (AI & MODEL BRAIN) FULLY INITIALIZED AND READY!');

  } catch (err) {
    console.error('❌ Error initializing DB5 AI database:', err.message);
  }
}

if (require.main === module) {
  initAiDatabase().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { initAiDatabase };
