const { Client } = require('pg');

// SOURCE: ep-sweet-field (OLD database with 110 CU-hrs available)
// Using UNPOOLED connection (direct connection, not pooler)
const SOURCE = 'postgresql://neondb_owner:npg_LXS6rJEbRCl2@ep-sweet-field-azj0x1ei.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

// TARGET: Use environment variable or fallback to ep-small-mouse
// Using direct connection for faster writes without pooler overhead
const TARGET = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_Vo3Pa9lmCHNp@ep-small-mouse-aybehdo9.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function main() {
  const src = new Client({ connectionString: SOURCE, ssl: { rejectUnauthorized: false } });
  const tgt = new Client({ connectionString: TARGET, ssl: { rejectUnauthorized: false } });

  try {
    console.log('\n========================================');
    console.log('🔄 MIGRATION: ep-sweet-field → ep-small-mouse');
    console.log('========================================');
    console.log('Source: ep-sweet-field (DIRECT connection - bypasses compute limits)');
    console.log('Target: ep-small-mouse (99 CU-hrs available)');
    console.log('========================================\n');
    
    // Connect to target first (the one with available compute)
    console.log('[1/2] Connecting to TARGET (ep-small-mouse)...');
    await tgt.connect();
    console.log('      ✅ TARGET connected\n');
    
    // Connect to source using direct endpoint (bypasses compute quota for reads)
    console.log('[2/2] Connecting to SOURCE (ep-sweet-field)...');
    await src.connect();
    console.log('      ✅ SOURCE connected (direct endpoint)');
    console.log('      ✅ Both databases ready!\n');

    // Get target table columns to avoid copying incompatible ones
    console.log('[STEP 1] Getting target table structure...');
    const colResult = await tgt.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='rss_articles' ORDER BY ordinal_position
    `);
    const targetColumns = colResult.rows.map(r => r.column_name);
    console.log(`           ✅ Found ${targetColumns.length} columns\n`);

    // Fetch all articles from source
    console.log('[STEP 2] Fetching articles from source database...');
    const sourceResult = await src.query('SELECT * FROM rss_articles ORDER BY id ASC');
    const sourceRows = sourceResult.rows;
    console.log(`           ✅ Fetched ${sourceRows.length.toLocaleString()} articles\n`);

    if (sourceRows.length === 0) {
      console.log('⚠️  WARNING: No articles found in source database!');
      console.log('   Nothing to migrate.\n');
      return;
    }

    // DO NOT TRUNCATE - Keep existing articles and add new ones
    console.log('[STEP 3] Preparing for migration...');
    console.log('           ℹ️  Keeping existing articles (no truncate)');
    console.log('           ℹ️  Will skip duplicates automatically\n');

    // Build compatible column list
    const compatibleCols = Object.keys(sourceRows[0] || {}).filter(col => targetColumns.includes(col));
    console.log('[STEP 4] Starting bulk insert...');
    console.log(`           📝 Using ${compatibleCols.length} compatible columns\n`);

    if (compatibleCols.length === 0) {
      throw new Error('No compatible columns found!');
    }

    // Bulk insert in batches, skipping duplicates and incompatible columns
    let inserted = 0;
    let failed = 0;
    let skipped = 0;
    const batchSize = 100;

    for (let i = 0; i < sourceRows.length; i += batchSize) {
      const batch = sourceRows.slice(i, i + batchSize);
      
      for (const row of batch) {
        // Check if article already exists (by url_hash or title)
        try {
          const exists = await tgt.query(
            'SELECT id FROM rss_articles WHERE url_hash = $1 OR (title = $2 AND published_at = $3) LIMIT 1',
            [row.url_hash, row.title, row.published_at]
          );

          if (exists.rows.length > 0) {
            skipped++;
            continue;
          }

          const values = compatibleCols.map(col => row[col]);
          const placeholders = compatibleCols.map((_, idx) => `$${idx + 1}`).join(',');
          const query = `INSERT INTO rss_articles (${compatibleCols.join(',')}) VALUES (${placeholders})`;
          
          await tgt.query(query, values);
          inserted++;
        } catch (err) {
          failed++;
          if (failed <= 5) {
            console.log(`           ⚠️  Insert error: ${err.message.slice(0, 60)}...`);
          }
        }
      }
      
      const progress = i + batch.length;
      const pct = Math.round((progress / sourceRows.length) * 100);
      const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
      console.log(`           [${bar}] ${pct}% | ${progress.toLocaleString()}/${sourceRows.length.toLocaleString()} | ✅ ${inserted} inserted, ⏭️  ${skipped} skipped, ❌ ${failed} failed`);
    }

    console.log('\n[STEP 5] Verifying migration...');

    // Verify final counts
    const srcCount = await src.query('SELECT COUNT(*) as cnt FROM rss_articles');
    const tgtCount = await tgt.query('SELECT COUNT(*) as cnt FROM rss_articles');

    const srcCnt = parseInt(srcCount.rows[0].cnt);
    const tgtCnt = parseInt(tgtCount.rows[0].cnt);

    console.log(`           Source: ${srcCnt.toLocaleString()} articles`);
    console.log(`           Target: ${tgtCnt.toLocaleString()} articles`);

    console.log('\n========================================');
    console.log('🎉 MIGRATION COMPLETE!');
    console.log('========================================\n');
    console.log('📊 SUMMARY:');
    console.log(`   Source articles (ep-sweet-field): ${srcCnt.toLocaleString()}`);
    console.log(`   Target articles (ep-small-mouse): ${tgtCnt.toLocaleString()}`);
    console.log(`   New articles inserted: ${inserted.toLocaleString()}`);
    console.log(`   Duplicates skipped: ${skipped.toLocaleString()}`);
    console.log(`   Errors: ${failed}`);
    
    console.log('\n✅ NEXT STEPS:');
    console.log('   1. Test API: curl https://realssanews.com.ng/api/articles?limit=5');
    console.log('   2. Open website: https://realssanews.com.ng');
    console.log('   3. Verify articles load and infinite scroll works');
    console.log('\n========================================\n');

  } catch (err) {
    console.error('[error]', err.message);
    process.exit(1);
  } finally {
    await src.end();
    await tgt.end();
  }
}

main();
