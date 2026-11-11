const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query('SELECT category, COUNT(*) as count FROM rss_articles GROUP BY category ORDER BY count DESC');
    console.log('=== Database Category Counts ===');
    console.table(res.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error running check:', err.message);
    process.exit(1);
  }
}

check();
