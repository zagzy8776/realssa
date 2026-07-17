import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://postgres:EkcwPYnMV6ev5kGG@db.uuysjtxxewqchejkllhs.supabase.co:5432/postgres'
});

const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_wmktK02ZbDfo@ep-morning-wind-assnxr5o.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  try {
    await client.connect();
    const res = await client.query(`DELETE FROM rss_articles WHERE source_name ILIKE '%punch%' OR url ILIKE '%punchng.com%'`);
    console.log('Supabase Deleted rows:', res.rowCount);
  } catch (err) {
    console.error('Supabase Error:', err.message);
  } finally {
    try { await client.end(); } catch (e) {}
  }

  try {
    await neonClient.connect();
    const res = await neonClient.query(`DELETE FROM rss_articles WHERE source_name ILIKE '%punch%' OR url ILIKE '%punchng.com%'`);
    console.log('Neon Deleted rows:', res.rowCount);
  } catch (err) {
    console.error('Neon Error:', err.message);
  } finally {
    try { await neonClient.end(); } catch (e) {}
  }
}

run();
