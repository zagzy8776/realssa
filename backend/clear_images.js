const { Pool } = require('pg');

const neonPool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_wmktK02ZbDfo@ep-morning-wind-assnxr5o.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require'
});

const supabasePool = new Pool({
  connectionString: 'postgresql://postgres:EkcwPYnMV6ev5kGG@db.uuysjtxxewqchejkllhs.supabase.co:5432/postgres'
});

async function clearOldImages() {
  const query = `
    UPDATE rss_articles 
    SET image = 'https://realssanews.com.ng/logo.png' 
    WHERE image ILIKE '%punch%' 
       OR image ILIKE '%logo%'
       OR image ILIKE '%cropped-%'
  `;

  try {
    const res1 = await neonPool.query(query);
    console.log(`Neon: Updated ${res1.rowCount} rows`);
  } catch (e) {
    console.error('Neon Error:', e.message);
  }

  try {
    const res2 = await supabasePool.query(query);
    console.log(`Supabase: Updated ${res2.rowCount} rows`);
  } catch (e) {
    console.error('Supabase Error:', e.message);
  }

  await neonPool.end();
  await supabasePool.end();
}

clearOldImages();
