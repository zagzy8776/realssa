const { Client } = require('pg');

const SOURCE = 'postgresql://neondb_owner:npg_VvqMQyLsL6Qi@ep-sweet-field-a7hqqrzy.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';
const TARGET = 'postgresql://neondb_owner:npg_Vo3Pa9lmCHNp@ep-small-mouse-aybehdo9.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const src = new Client({ connectionString: SOURCE, ssl: { rejectUnauthorized: false } });
  const tgt = new Client({ connectionString: TARGET, ssl: { rejectUnauthorized: false } });

  try {
    console.log('[info] Starting migration...');
    
    // Connect both clients
    await src.connect();
    await tgt.connect();
    console.log('[info] Connected to both databases');

    // Get target table columns to avoid copying incompatible ones
    const colResult = await tgt.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='rss_articles' ORDER BY ordinal_position
    `);
    const targetColumns = colResult.rows.map(r => r.column_name);
    console.log('[info] Target table columns:', targetColumns);

    // Fetch all articles from source
    const sourceResult = await src.query('SELECT * FROM rss_articles ORDER BY id ASC');
    const sourceRows = sourceResult.rows;
    console.log(`[info] Fetched ${sourceRows.length} rows from source`);

    // Truncate target table
    await tgt.query('TRUNCATE TABLE rss_articles CASCADE;');
    console.log('[info] Truncated target table');

    // Build compatible column list
    const compatibleCols = Object.keys(sourceRows[0] || {}).filter(col => targetColumns.includes(col));
    console.log('[info] Compatible columns:', compatibleCols);

    if (compatibleCols.length === 0) {
      throw new Error('No compatible columns found!');
    }

    // Bulk insert in batches, skipping incompatible columns
    let inserted = 0;
    let failed = 0;

    for (let i = 0; i < sourceRows.length; i += 200) {
      const batch = sourceRows.slice(i, i + 200);
      
      for (const row of batch) {
        const values = compatibleCols.map(col => row[col]);
        const placeholders = compatibleCols.map((_, idx) => `$${idx + 1}`).join(',');
        const query = `INSERT INTO rss_articles (${compatibleCols.join(',')}) VALUES (${placeholders})`;
        
        try {
          await tgt.query(query, values);
          inserted++;
        } catch (err) {
          failed++;
          console.log(`[warning] Row insert error: ${err.message.slice(0, 80)}`);
        }
      }
      
      const pct = Math.round((i + batch.length) / sourceRows.length * 100);
      console.log(`[progress] ${i + batch.length}/${sourceRows.length} (${pct}%) - ${inserted} inserted, ${failed} failed`);
    }

    console.log('[info] Batch insert complete');

    // Verify final counts
    const srcCount = await src.query('SELECT COUNT(*) as cnt FROM rss_articles');
    const tgtCount = await tgt.query('SELECT COUNT(*) as cnt FROM rss_articles');

    const srcCnt = srcCount.rows[0].cnt;
    const tgtCnt = tgtCount.rows[0].cnt;

    console.log(`[verify] Source: ${srcCnt} | Target: ${tgtCnt}`);

    if (srcCnt === tgtCnt) {
      console.log(`[success] Counts match! All ${srcCnt} articles copied successfully. Ready to switch DATABASE_URL in Vercel`);
    } else {
      console.log(`[WARNING] Count mismatch: Source has ${srcCnt}, Target has ${tgtCnt}. Expected ${srcCnt - tgtCnt} more rows on target.`);
    }

  } catch (err) {
    console.error('[error]', err.message);
    process.exit(1);
  } finally {
    await src.end();
    await tgt.end();
  }
}

main();
