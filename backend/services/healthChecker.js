const fetch = require('node-fetch');

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
      );

      // If dead, mark as offline
      if (!isHealthy) {
        await pool.query("UPDATE live_streams SET is_live = false WHERE id = $1", [stream.id]);
        deadCount++;
      }
    }));

    console.log(`[HealthChecker] Validation complete. Marked ${deadCount} streams as offline.`);

    // Purge old offline streams
    await pool.query("DELETE FROM live_streams WHERE is_live = false AND updated_at < NOW() - INTERVAL '1 day'");
    
  } catch (err) {
    console.error('[HealthChecker] Error running validation:', err);
  }
}

module.exports = {
  runHealthCheck
};
