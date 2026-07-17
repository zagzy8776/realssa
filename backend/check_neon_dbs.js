const { Pool } = require('pg');

async function test() {
  const db1 = 'postgresql://neondb_owner:npg_nJc1fMvS8YyG@ep-raspy-firefly-a5d61tii-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';
  const db2 = 'postgresql://neondb_owner:npg_nJc1fMvS8YyG@ep-morning-wind-assnxr5o-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require';

  console.log('Testing DB 1 (Ohio - Fly.io)...');
  const pool1 = new Pool({ connectionString: db1, ssl: { rejectUnauthorized: false } });
  try {
    const res = await pool1.query('SELECT COUNT(*) FROM rss_articles');
    console.log('DB 1 Article Count:', res.rows[0].count);
  } catch (err) {
    console.error('DB 1 Error:', err.message);
  }
  await pool1.end();

  console.log('\nTesting DB 2 (Frankfurt - Vercel)...');
  const pool2 = new Pool({ connectionString: db2, ssl: { rejectUnauthorized: false } });
  try {
    const res = await pool2.query('SELECT COUNT(*) FROM rss_articles');
    console.log('DB 2 Article Count:', res.rows[0].count);
  } catch (err) {
    console.error('DB 2 Error:', err.message);
  }
  await pool2.end();
}

test();
