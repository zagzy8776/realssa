// Simple script to check article count in database
const { Pool } = require('pg');

async function checkCount() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n========================================');
    console.log('📊 CHECKING ARTICLE COUNT');
    console.log('========================================\n');
    
    const result = await pool.query('SELECT COUNT(*) as count FROM rss_articles');
    const count = parseInt(result.rows[0].count);
    
    console.log(`✅ Total articles in database: ${count.toLocaleString()}\n`);
    
    if (count < 1000) {
      console.log('⚠️  WARNING: Less than 1000 articles!');
      console.log('📋 ACTION NEEDED: Run migration to copy articles from ep-sweet-field\n');
      console.log('💡 Run this command:');
      console.log('   node fixed_migrate.js\n');
    } else if (count >= 5000) {
      console.log('✅ GOOD: You have 5000+ articles!');
      console.log('📋 NO MIGRATION NEEDED\n');
      console.log('⚠️  But AI summaries are missing. Check summarization service.\n');
    } else {
      console.log('⚠️  PARTIAL: You have some articles but not all');
      console.log('📋 RECOMMENDED: Run migration to get all articles\n');
      console.log('💡 Run this command:');
      console.log('   node fixed_migrate.js\n');
    }
    
    console.log('========================================\n');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkCount();
