const Parser = require('rss-parser');
const { FEED_CATEGORIES } = require('./ingestion');

const parser = new Parser({ timeout: 5000 });

async function checkFeedHealth(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!res.ok) {
      return { isHealthy: false, statusCode: String(res.status), errorMessage: `HTTP ${res.status}` };
    }
    
    const xmlText = await res.text();
    // Test parsing the feed
    const sanitizedXml = xmlText.replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g, '&amp;');
    await parser.parseString(sanitizedXml);
    
    return { isHealthy: true, statusCode: '200', errorMessage: null };
  } catch (err) {
    return { isHealthy: false, statusCode: 'ERR', errorMessage: err.message.substring(0, 100) };
  }
}

async function runFeedHealthCheck(pool) {
  console.log(`[${new Date().toISOString()}] 🔍 Starting Weekly RSS Feed Health Validation...`);
  try {
    // 1. Extract all URLs
    const feeds = [];
    for (const cat of FEED_CATEGORIES) {
      if (cat.feeds) {
        for (const url of cat.feeds) {
          feeds.push({ category: cat.category, url });
        }
      }
      if (cat.videoFeeds) {
        for (const url of cat.videoFeeds) {
          feeds.push({ category: cat.category + '-video', url });
        }
      }
    }

    console.log(`[HealthChecker] Validating ${feeds.length} feeds in memory...`);
    const results = [];
    let healthyCount = 0;
    let failedCount = 0;

    // 2. Perform all health checks in memory (batches of 10)
    const BATCH_SIZE = 10;
    for (let i = 0; i < feeds.length; i += BATCH_SIZE) {
      const batch = feeds.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async ({ category, url }) => {
        const { isHealthy, statusCode, errorMessage } = await checkFeedHealth(url);
        results.push({ url, category, statusCode, errorMessage, isHealthy });
        if (isHealthy) {
          healthyCount++;
        } else {
          console.warn(`[HealthChecker] ❌ Feed failing: ${url} (${statusCode}) - ${errorMessage || 'No error'}`);
          failedCount++;
        }
      }));
    }

    console.log(`[HealthChecker] Finished checks. Inserting ${results.length} results in a single bulk transaction...`);

    // 3. Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rss_feed_health_log (
        id SERIAL PRIMARY KEY,
        feed_url TEXT NOT NULL,
        category TEXT NOT NULL,
        status_code TEXT,
        error_message TEXT,
        is_healthy BOOLEAN NOT NULL,
        checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Bulk insert into database
    if (results.length > 0) {
      const values = [];
      const placeholders = [];
      results.forEach((res, index) => {
        const base = index * 5;
        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
        values.push(res.url, res.category, res.statusCode, res.errorMessage, res.isHealthy);
      });
      
      const insertQuery = `
        INSERT INTO rss_feed_health_log (feed_url, category, status_code, error_message, is_healthy)
        VALUES ${placeholders.join(', ')}
      `;
      await pool.query(insertQuery, values);
    }

    console.log(`[${new Date().toISOString()}] 🔍 Health check complete. Healthy: ${healthyCount}, Failed: ${failedCount}`);

    // 5. Purge logs older than 60 days
    await pool.query(`DELETE FROM rss_feed_health_log WHERE checked_at < NOW() - INTERVAL '60 days'`);
    
    return { success: true, healthyCount, failedCount };
  } catch (err) {
    console.error('[HealthChecker] Error running feed validation:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { runFeedHealthCheck };
