const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbs = [
  {
    name: 'DATABASE_URL (.env)',
    url: process.env.DATABASE_URL
  },
  {
    name: 'NEON_DATABASE_URL_1 (.env)',
    url: process.env.NEON_DATABASE_URL_1
  },
  {
    name: 'NEON_DATABASE_URL_2 (.env)',
    url: process.env.NEON_DATABASE_URL_2
  },
  {
    name: 'NEON_DATABASE_URL_3 (.env)',
    url: process.env.NEON_DATABASE_URL_3
  },
  {
    name: 'ep-snowy-field-azwdymwg (check_new_neon.js)',
    url: 'postgresql://neondb_owner:npg_iljcrTy74CPR@ep-snowy-field-azwdymwg-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
  },
  {
    name: 'ep-raspy-firefly-a5d61tii (check_neon_dbs.js db1)',
    url: 'postgresql://neondb_owner:npg_nJc1fMvS8YyG@ep-raspy-firefly-a5d61tii-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require'
  },
  {
    name: 'ep-morning-wind-assnxr5o (check_neon_dbs.js db2)',
    url: 'postgresql://neondb_owner:npg_nJc1fMvS8YyG@ep-morning-wind-assnxr5o-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require'
  }
];

async function checkDb(db) {
  console.log(`\n--------------------------------------------`);
  console.log(`Checking ${db.name}...`);
  if (!db.url) {
    console.log('Skipped: URL is not defined.');
    return;
  }
  
  const hostMatch = db.url.match(/@([^/]+)/);
  const host = hostMatch ? hostMatch[1] : 'unknown';
  console.log(`Host: ${host}`);

  const pool = new Pool({
    connectionString: db.url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    const start = Date.now();
    const client = await pool.connect();
    console.log(`✅ Connected successfully in ${Date.now() - start}ms.`);
    
    // Check tables
    const tables = ['rss_articles', 'live_matches', 'matches'];
    const tableStatus = {};
    
    for (const t of tables) {
      const res = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [t]);
      const exists = res.rows[0].exists;
      if (exists) {
        const countRes = await client.query(`SELECT COUNT(*) FROM ${t}`);
        tableStatus[t] = `${countRes.rows[0].count} rows`;
      } else {
        tableStatus[t] = 'DOES NOT EXIST';
      }
    }
    console.log('Tables status:', tableStatus);
    client.release();
  } catch (err) {
    console.log(`❌ Connection failed: ${err.message}`);
  } finally {
    await pool.end();
  }
}

(async () => {
  console.log('=== STARTING NEON DATABASE AUDIT ===');
  for (const db of dbs) {
    await checkDb(db);
  }
  console.log('\n=== NEON DATABASE AUDIT COMPLETE ===');
  process.exit(0);
})();
