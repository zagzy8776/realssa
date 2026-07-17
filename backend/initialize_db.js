const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const neonConfig = {
  connectionString: 'postgresql://neondb_owner:npg_wmktK02ZbDfo@ep-morning-wind-assnxr5o-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
};

async function main() {
  const client = new Client(neonConfig);
  try {
    await client.connect();
    console.log('Connected to Neon DB.');

    // 1. Run rss_articles_schema.sql as a single query
    const rssSchemaPath = path.join(__dirname, 'rss_articles_schema.sql');
    console.log(`Running: ${rssSchemaPath}`);
    const rssSql = fs.readFileSync(rssSchemaPath, 'utf8');
    await client.query(rssSql);
    console.log('rss_articles_schema.sql completed successfully.');

    // 2. Run db_schema.sql as a single query (strip the invalid backfill UPDATE comment issue if needed, but let's just run it)
    const dbSchemaPath = path.join(__dirname, 'db_schema.sql');
    console.log(`Running: ${dbSchemaPath}`);
    let dbSql = fs.readFileSync(dbSchemaPath, 'utf8');
    
    // The backfill UPDATE in db_schema.sql has a comment that splits poorly if split manually, but as a single query it should work.
    // Let's run it.
    await client.query(dbSql);
    console.log('db_schema.sql completed successfully.');

  } catch (err) {
    console.error('Migration failed:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await client.end();
  }
}

main();
