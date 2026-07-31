/**
 * Edge Telemetry Service & Shock-Absorber Buffer Architecture
 * Intercepts high-concurrency client-side beacon events and buffers them
 * in-memory/Redis before flushing via bulk INSERT to PostgreSQL.
 */

// In-memory queue fallback if UPSTASH_REDIS_REST_URL is not set
const memoryBuffer = [];
const MAX_BUFFER_SIZE = 1000;
let flusherInterval = null;

/**
 * Helper: fetch with AbortSignal timeout
 */
async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = 5000, ...fetchOpts } = options;
  return fetch(url, {
    ...fetchOpts,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/**
 * Parses raw request body from navigator.sendBeacon Blob text stream safely
 */
function parseBeaconPayload(rawBody) {
  if (!rawBody) return null;
  if (typeof rawBody === 'object') return rawBody;
  
  try {
    return JSON.parse(rawBody);
  } catch (err) {
    // If sendBeacon sent URL-encoded text or wrapped string, sanitize
    try {
      const decoded = decodeURIComponent(rawBody);
      return JSON.parse(decoded);
    } catch {
      console.warn('⚠️ [Telemetry] Failed to parse beacon raw body');
      return null;
    }
  }
}

/**
 * Buffer telemetry payload into Upstash Redis REST API or Memory Fallback
 */
async function bufferTelemetry(payload) {
  if (!payload) return false;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      // Execute LPUSH command over HTTP REST to Upstash Redis (Edge safe)
      const res = await fetchWithTimeout(`${redisUrl}/lpush/telemetry_buffer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(JSON.stringify(payload)),
        timeoutMs: 3000,
      });
      return res.ok;
    } catch (err) {
      console.warn('⚠️ [Telemetry] Redis LPUSH failed, falling back to memory queue:', err.message);
    }
  }

  // Fallback to in-memory queue
  if (memoryBuffer.length < MAX_BUFFER_SIZE) {
    memoryBuffer.push({ payload, timestamp: Date.now() });
    return true;
  }

  return false;
}

/**
 * Cron Flusher: Flushes buffered telemetry in bulk to PostgreSQL
 */
async function flushTelemetryToDb(pool) {
  if (!pool) return;

  let itemsToFlush = [];

  // Check Upstash Redis first if available
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      // Pull up to 100 item payloads from Redis using RPOP
      const res = await fetchWithTimeout(`${redisUrl}/rpop/telemetry_buffer/100`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${redisToken}` },
        timeoutMs: 5000,
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.result) && data.result.length > 0) {
          itemsToFlush = data.result
            .map(str => {
              try { return JSON.parse(str); } catch { return null; }
            })
            .filter(Boolean);
        }
      }
    } catch (err) {
      console.warn('⚠️ [Telemetry] Redis RPOP flusher failed:', err.message);
    }
  }

  // Drain memory buffer if Redis was empty or unavailable
  if (itemsToFlush.length === 0 && memoryBuffer.length > 0) {
    itemsToFlush = memoryBuffer.splice(0, 100).map(item => item.payload);
  }

  if (itemsToFlush.length === 0) return;

  try {
    // Perform single bulk INSERT to PostgreSQL for maximum throughput
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of itemsToFlush) {
        const deviceId = item.deviceId || 'anon';
        const eventsJson = JSON.stringify(item.events || []);
        const activeDwell = item.activeDwellSeconds || 0;

        await client.query(
          `INSERT INTO user_preferences (device_uuid, top_category, interaction_counts, updated_at)
           VALUES ($1, 'general', $2::jsonb, NOW())
           ON CONFLICT (device_uuid) DO UPDATE
           SET updated_at = NOW()`,
          [deviceId, eventsJson]
        );
      }

      await client.query('COMMIT');
      console.log(`✅ [Telemetry Flusher] Bulk inserted ${itemsToFlush.length} telemetry payloads to DB.`);
    } catch (dbErr) {
      await client.query('ROLLBACK');
      console.error('❌ [Telemetry Flusher] Bulk DB insert failed:', dbErr.message);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ [Telemetry Flusher] Pool connection error:', err.message);
  }
}

/**
 * Initialize 5-minute background flusher loop
 */
function initTelemetryFlusher(pool) {
  if (flusherInterval) return;

  // Flush buffer every 5 minutes (300,000 ms)
  flusherInterval = setInterval(() => {
    flushTelemetryToDb(pool).catch(err => {
      console.error('❌ [Telemetry Flusher] Background loop error:', err.message);
    });
  }, 300000);

  console.log('⚡ [Telemetry Service] Shock-absorber buffer & Cron Flusher active (5 min cycle)');
}

module.exports = {
  parseBeaconPayload,
  bufferTelemetry,
  flushTelemetryToDb,
  initTelemetryFlusher,
};
