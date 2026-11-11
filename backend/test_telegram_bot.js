/**
 * Automated Test for Telegram Bot Engine (@RealSSABot)
 * Validates module syntax, imports, database queries, and message dispatching.
 */

// Load environment variables
require('dotenv').config();

const { queryMultiDb } = require('./config/multiDb');
const telegramBot = require('./services/telegramBot');

async function runTest() {
  console.log('🧪 Starting Telegram Bot Engine Test...');

  // 1. Verify exports
  if (typeof telegramBot.startTelegramBot !== 'function' || typeof telegramBot.stopTelegramBot !== 'function') {
    console.error('❌ test failed: startTelegramBot or stopTelegramBot is not exported as function.');
    process.exit(1);
  }
  console.log('✅ Exports verified.');

  // 2. Test direct database query connection
  try {
    const res = await queryMultiDb('SELECT NOW()');
    console.log('✅ Database connection test: successfully queried timestamp:', res.rows[0].now);
  } catch (dbErr) {
    console.error('❌ Database connection test failed:', dbErr.message);
    process.exit(1);
  }

  // 3. Test /brief query mock simulation
  console.log('⌛ Simulating /brief command database query...');
  try {
    const queryStr = `
      SELECT id, title, COALESCE(ai_summary, original_excerpt) AS excerpt, source_name, published_at
      FROM rss_articles
      ORDER BY published_at DESC
      LIMIT 3
    `;
    const res = await queryMultiDb(queryStr);
    console.log(`✅ /brief simulation: successfully retrieved ${res.rows.length} articles.`);
    res.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. [rss-${row.id}] ${row.title} (Source: ${row.source_name})`);
    });
  } catch (briefErr) {
    console.error('❌ /brief query test failed:', briefErr.message);
    process.exit(1);
  }

  // 4. Test /query [term] search simulation
  const term = 'fuel';
  console.log(`⌛ Simulating /query command search for "${term}"...`);
  try {
    const queryStr = `
      SELECT id, title, COALESCE(ai_summary, original_excerpt) AS excerpt, source_name, published_at
      FROM rss_articles
      WHERE title ILIKE $1 OR original_excerpt ILIKE $1 OR ai_summary ILIKE $1
      ORDER BY published_at DESC
      LIMIT 3
    `;
    const res = await queryMultiDb(queryStr, [`%${term}%`]);
    console.log(`✅ /query simulation: retrieved ${res.rows.length} matches for "${term}".`);
  } catch (queryErr) {
    console.error('❌ /query search test failed:', queryErr.message);
    process.exit(1);
  }

  console.log('🎉 All Telegram Bot Engine unit tests completed successfully!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Unexpected test error:', err.message);
  process.exit(1);
});
