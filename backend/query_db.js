const { Client } = require('pg');

const neonConfig = {
  connectionString: 'postgresql://neondb_owner:npg_wmktK02ZbDfo@ep-morning-wind-assnxr5o.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require'
};

async function getTables() {
  const client = new Client(neonConfig);
  try {
    await client.connect();
    
    // List all tables across all schemas
    const res = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      ORDER BY table_schema, table_name
    `);
    console.log('=== Neon Tables ===');
    console.table(res.rows.filter(r => !r.table_schema.startsWith('pg_') && r.table_schema !== 'information_schema'));
    
    // Search for Lewandowski
    const lewanRes = await client.query("SELECT title FROM rss_articles WHERE title ILIKE '%Lewandowski%'");
    console.log('Lewandowski articles in DB:', lewanRes.rows);
    
    const dbNameRes = await client.query('SELECT current_database()');
    console.log('Current Database:', dbNameRes.rows[0].current_database);
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    await client.end();
  }
}

getTables();
