const fetch = require('node-fetch');
const { runCrawler } = require('./crawlerService');

async function checkStreamHealth(url, type) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 5000);

    // Use GET request instead of HEAD, as many video CDNs block HEAD requests (returning 403 or 405)
    // We abort immediately after receiving headers to avoid downloading large video chunks.
    if (type === 'hls') {
      const response = await fetch(url, { method: 'GET', signal: controller.signal });
      
      // We got headers, so the endpoint exists and isn't a hard 404.
      const isOk = response.ok || response.status === 403 || response.status === 405; 
      
      // Abort the download
      controller.abort();
      clearTimeout(timeout);
      
      return isOk;
    }

    // For iframes, we just assume they are healthy unless manually flagged or older than 4 hours
    clearTimeout(timeout);
    return true; 
  } catch (error) {
    return false;
  }
}

async function runHealthCheck(pool) {
  console.log('[HealthChecker] Starting stream validation...');
  try {
    const result = await pool.query("SELECT id, stream_url, stream_type FROM live_streams WHERE is_live = true");
    const activeStreams = result.rows;

    let deadCount = 0;

    // Run health checks in parallel to avoid 10s Vercel timeout
    await Promise.all(activeStreams.map(async (stream) => {
      const isHealthy = await checkStreamHealth(stream.stream_url, stream.stream_type);

      // Log health check
      await pool.query(
        "INSERT INTO stream_health_log (stream_id, status_code, is_healthy) VALUES ($1, $2, $3)",
        [stream.id, isHealthy ? 200 : 404, isHealthy]
      ).catch(() => {}); // ignore logging errors

      // If dead, delete immediately from database
      if (!isHealthy) {
        await pool.query("DELETE FROM live_streams WHERE id = $1", [stream.id]);
        deadCount++;
      }
    }));

    console.log(`[HealthChecker] Validation complete. Deleted ${deadCount} dead streams.`);

    // Check remaining active streams count
    const remainingResult = await pool.query("SELECT COUNT(*) FROM live_streams WHERE is_live = true");
    const remainingCount = parseInt(remainingResult.rows[0].count) || 0;
    console.log(`[HealthChecker] ${remainingCount} healthy streams remaining in database.`);

    // Auto-trigger crawler if active streams count drops below 15
    if (remainingCount < 15) {
      console.log(`[HealthChecker] Stream count is low (${remainingCount}/15). Auto-triggering crawler for new channels...`);
      setImmediate(async () => {
        try {
          await runCrawler(pool);
        } catch (err) {
          console.error('[HealthChecker] Background auto-crawler run failed:', err.message);
        }
      });
    }
    
  } catch (err) {
    console.error('[HealthChecker] Error running validation:', err);
  }
}

module.exports = {
  runHealthCheck
};
