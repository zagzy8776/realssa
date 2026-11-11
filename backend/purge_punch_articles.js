const { getAllPools } = require('./config/multiDb');

async function purgePunchArticles() {
  console.log('🧹 Purging all Punch articles across DB1-DB4 cluster...');
  const poolEntries = Object.entries(getAllPools());

  let totalDeleted = 0;

  for (const [name, pool] of poolEntries) {
    if (!pool || typeof pool.query !== 'function') continue;
    try {
      const res = await pool.query(`
        DELETE FROM rss_articles
        WHERE source_name ILIKE '%punch%'
           OR external_link ILIKE '%punchng.com%'
      `);
      console.log(`   [${name}]: Deleted ${res.rowCount} Punch rows.`);
      totalDeleted += res.rowCount;
    } catch (err) {
      console.warn(`   [${name}] Purge Warning:`, err.message);
    }
  }

  console.log(`\n✅ PURGE COMPLETE: Removed total ${totalDeleted} Punch articles from cluster.`);
  process.exit(0);
}

purgePunchArticles().catch(err => {
  console.error('Purge error:', err);
  process.exit(1);
});
