const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// The script intentionally reads DATABASE_URL directly from the process.
// This keeps credentials out of source control and works in CI/Fly/Vercel shells.
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required. Set it to the Aiven PostgreSQL connection string.');
  process.exit(1);
}

const root = __dirname;
const files = ['rss_articles_schema.sql', 'db_schema.sql', 'aiven_migration.sql'];

async function main() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 10000,
  });

  pool.on('error', err => console.error(`[Aiven PostgreSQL] ${err.message}`));

  try {
    const client = await pool.connect();
    try {
      const info = await client.query(`
        SELECT current_database() AS database,
               current_user AS user,
               version() AS version
      `);
      console.log(`Connected to PostgreSQL database: ${info.rows[0].database}`);
      console.log(`PostgreSQL user: ${info.rows[0].user}`);
      console.log(`Server: ${String(info.rows[0].version).split(',')[0]}`);

      for (const file of files) {
        const filePath = path.join(root, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        console.log(`Applying ${file}...`);
        await client.query(sql);
        console.log(`  OK ${file}`);
      }

      const verification = await client.query(`
        SELECT
          to_regclass('public.rss_articles') AS rss_articles,
          to_regclass('public.users') AS users,
          to_regclass('public.live_matches') AS live_matches,
          to_regclass('public.feed_health') AS feed_health,
          (SELECT COUNT(*)::int FROM rss_articles) AS article_count
      `);

      const row = verification.rows[0];
      if (!row.rss_articles || !row.users || !row.live_matches || !row.feed_health) {
        throw new Error(`Schema verification failed: ${JSON.stringify(row)}`);
      }

      console.log('Database verification:', row);
      console.log('Aiven PostgreSQL migration completed successfully.');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Aiven PostgreSQL migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
