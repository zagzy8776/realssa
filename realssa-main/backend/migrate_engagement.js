require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('Connecting to database to add engagement columns...');
    
    await pool.query(`
      ALTER TABLE rss_articles 
      ADD COLUMN IF NOT EXISTS save_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS reaction_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_rss_articles_engagement 
      ON rss_articles(view_count DESC, save_count DESC, reaction_count DESC);
    `);
    
    console.log('Migration successful!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

migrate();
