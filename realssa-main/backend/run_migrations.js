const { Pool } = require('pg');
const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const migrations = [
    'ALTER TABLE feed_schedule ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0',
    'ALTER TABLE feed_schedule ADD COLUMN IF NOT EXISTS quarantined_until TIMESTAMP WITH TIME ZONE NULL',
    'ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_ai_starter BOOLEAN DEFAULT false',
    'CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, title TEXT, description TEXT, article_id INTEGER, created_at TIMESTAMP DEFAULT NOW())',
  ];
  for (const sql of migrations) {
    try {
      await p.query(sql);
      console.log('OK:', sql.substring(0, 60));
    } catch (e) {
      console.error('FAIL:', e.message);
    }
  }
  await p.end();
  console.log('All migrations complete.');
}
run();
