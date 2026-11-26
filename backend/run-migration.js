/**
 * Migration runner for Tasks 7, 8, 9, 11.
 *
 * Usage:
 *   node run-migration.js                       # uses DATABASE_URL env
 *   node run-migration.js "postgres://..."      # explicit connection string
 *   node run-migration.js --check "postgres://..."   # connectivity only
 *
 * Order of resolution:
 *   1. CLI argument (non-flag)
 *   2. process.env.DATABASE_URL (load from .env or export before running)
 *
 * No credentials are stored in this file — keep connection strings in a local
 * .env (git-ignored) or your deployment environment variables only.
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const cliUrl = args.find(a => !a.startsWith('--'));

const DATABASE_URL = cliUrl || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Provide a connection string as an argument');
  console.error('   or export DATABASE_URL from a local .env / deployment secret.');
  process.exit(1);
}

const MIGRATIONS = [
  'migrations/004_add_sports_and_click_tables.sql'
];

function redact(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username}:***@${u.host}${u.pathname}`;
  } catch {
    return '<invalid url>';
  }
}

async function main() {
  let Pool;
  try {
    ({ Pool } = require('pg'));
  } catch {
    console.error('❌ The "pg" package is not installed. Run: npm install pg');
    process.exit(1);
  }

  console.log(`📍 Target database: ${redact(DATABASE_URL)}`);

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('sslmode=require') || DATABASE_URL.includes('aivencloud')
      ? { rejectUnauthorized: false }
      : undefined,
    max: 2,
    connectionTimeoutMillis: 20000
  });

  pool.on('error', err => console.error(`[pg] ${err.message}`));

  try {
    const info = await pool.query(
      'SELECT current_database() AS database, current_user AS "user", version() AS version'
    );
    console.log(`✅ Connected to "${info.rows[0].database}" as ${info.rows[0].user}`);
    console.log(`   ${String(info.rows[0].version).split(',')[0]}`);

    if (checkOnly) {
      console.log('ℹ️  --check specified; no migrations applied.');
      return;
    }

    for (const rel of MIGRATIONS) {
      const filePath = path.join(__dirname, rel);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  Skipping missing migration: ${rel}`);
        continue;
      }
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`\n📦 Applying ${rel} ...`);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`✅ ${rel} applied`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`${rel} failed: ${err.message}`);
      } finally {
        client.release();
      }
    }

    // Verify the tables we care about now exist.
    const verify = await pool.query(`
      SELECT
        to_regclass('public.fixtures')             AS fixtures,
        to_regclass('public.live_streams')         AS live_streams,
        to_regclass('public.click_sessions')       AS click_sessions,
        to_regclass('public.stream_health_checks') AS stream_health_checks,
        to_regclass('public.indexing_dead_letter') AS indexing_dead_letter,
        to_regclass('public.rising_queries')       AS rising_queries,
        to_regclass('public.thin_pages')           AS thin_pages
    `);
    console.log('\n🔎 Verification:', verify.rows[0]);

    const missing = Object.entries(verify.rows[0])
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length) {
      console.error(`❌ Missing tables after migration: ${missing.join(', ')}`);
      process.exitCode = 1;
    } else {
      console.log('\n🎉 All Task 7/8/9/11 tables are present.');
    }
  } catch (err) {
    console.error(`\n❌ Migration failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
