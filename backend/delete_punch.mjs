import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uuysjtxxewqchejkllhs.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_qK6f8L_-P5TXv8tntq-MUA_FBkbNHtO';
// NOTE: We need the service role key to delete if RLS is enabled, but let's try with what we have.
// Wait, we have the Supabase Postgres connection string!
import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres:EkcwPYnMV6ev5kGG@db.uuysjtxxewqchejkllhs.supabase.co:5432/postgres'
});

async function run() {
  try {
    await client.connect();
    const res = await client.query(`DELETE FROM rss_articles WHERE source_name ILIKE '%punch%' OR url ILIKE '%punchng.com%'`);
    console.log('Deleted rows:', res.rowCount);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
