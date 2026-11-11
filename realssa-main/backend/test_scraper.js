const { Pool } = require('pg');
const DB_URL = 'postgresql://neondb_owner:npg_wmktK02ZbDfo@ep-morning-wind-assnxr5o.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require';

// Set env vars
process.env.DATABASE_URL = DB_URL;

const { scrapeAllActive } = require('./services/liveScraper');

async function main() {
  console.log("🚀 Running live score scraper test...");
  try {
    await scrapeAllActive();
    console.log("✅ Scraper cycle finished.");
  } catch (err) {
    console.error("❌ Scraper error:", err);
  }
}

main();
