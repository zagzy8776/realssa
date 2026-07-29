const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_iljcrTy74CPR@ep-snowy-field-azwdymwg-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query('SELECT COUNT(*) as count FROM human_learning_brain');
    console.log('Total insights learned:', res.rows[0].count);

    const samples = await pool.query('SELECT category, phrase, human_nuance, frequency_count FROM human_learning_brain ORDER BY frequency_count DESC LIMIT 5');
    console.log('Top 5 learned phrases:', samples.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

run();
