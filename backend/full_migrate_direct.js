const { Client } = require('pg');

const SOURCE = 'postgresql://neondb_owner:npg_LXS6rJEbRCl2@ep-sweet-field-azj0x1ei.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const TARGET = 'postgresql://neondb_owner:npg_Vo3Pa9lmCHNp@ep-small-mouse-aybehdo9.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const src = new Client({ connectionString: SOURCE, ssl: { rejectUnauthorized: false } });
  const tgt = new Client({ connectionString: TARGET, ssl: { rejectUnauthorized: false } });

  try {
    await src.connect();
    await tgt.connect();

    console.log('[migrate] Fetching all articles from source (no LIMIT)...');
    const result = await src.query('SELECT * FROM rss_articles ORDER BY id ASC');
    const rows = result.rows;
    console.log(`[migrate] Fetched ${rows.length} rows`);

    console.log('[migrate] Truncating target table...');
    await tgt.query('TRUNCATE TABLE rss_articles CASCADE;');

    console.log('[migrate] Inserting all rows to target...');
    let inserted = 0;
    const batchSize = 200;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      for (const row of batch) {
        const cols = Object.keys(row).map(k => `"${k}"`).join(', ');
        const vals = Object.values(row).map((v, i) => {
          if (v === null) return 'NULL';
          if (typeof v === 'string') return `$${i + 1}`;
          if (typeof v === 'number' || typeof v === 'boolean') return `$${i + 1}`;
          if (v instanceof Date) return `$${i + 1}`;
          return `$${i + 1}`;
        }).join(', ');

        try {
          await tgt.query(
            `INSERT INTO rss_articles (${cols}) VALUES (${vals})`,
            Object.values(row)
          );
          inserted++;
        } catch (e) {
          if (!e.message.includes('violates unique constraint')) {
            console.error(`[warning] Row ${row.id} insert error:`, e.message);
          }
        }
      }

      console.log(`[progress] ${Math.min(i + batchSize, rows.length)}/${rows.length} rows`);
    }

    console.log(`[migrate] Inserted ${inserted} rows`);

    const srcCnt = await src.query('SELECT COUNT(*) as c FROM rss_articles');
    const tgtCnt = await tgt.query('SELECT COUNT(*) as c FROM rss_articles');

    console.log(`[verify] Source: ${srcCnt.rows[0].c} | Target: ${tgtCnt.rows[0].c}`);

    if (srcCnt.rows[0].c === tgtCnt.rows[0].c) {
      console.log('[success] Counts match! Ready to switch DATABASE_URL in Vercel');
    } else {
      console.log(`[warning] Count mismatch: ${srcCnt.rows[0].c} vs ${tgtCnt.rows[0].c}`);
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
