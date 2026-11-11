const { createClient } = require('redis');

let client = null;
let isConnected = false;

let redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  // Strip UTF-8 BOM, double/single quotes, and leading/trailing whitespace
  redisUrl = redisUrl.replace(/^\uFEFF/, '').replace(/^["']|["']$/g, '').trim();

  try {
    client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            console.warn('❌ [Redis] Max reconnection attempts reached. Disabling cache.');
            return false;
          }
          return Math.min(retries * 500, 2000);
        }
      }
    });

    client.on('error', (err) => {
      console.warn('⚠️ [Redis Error]:', err.message);
    });
  } catch (err) {
    console.warn('❌ [Redis Client Creation Failed]:', err.message);
    client = null;
  }
}

if (client) {
  client.on('connect', () => {
    console.log('🔌 [Redis] Connecting to Upstash...');
  });

  client.on('ready', () => {
    isConnected = true;
    console.log('✅ [Redis] Connection established successfully.');
  });

  // Attempt initial connect
  client.connect().catch((err) => {
    console.warn('⚠️ [Redis] Initial connection failed:', err.message);
  });
} else {
  console.warn('⚠️ [Redis] REDIS_URL not configured. Caching is disabled.');
}

/**
 * Retrieve cached JSON/string from Redis
 */
async function getCached(key) {
  if (!client || !isConnected) return null;
  try {
    const val = await client.get(key);
    if (!val) return null;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  } catch (err) {
    console.warn(`⚠️ [Redis Get Fail] Key: ${key}:`, err.message);
    return null;
  }
}

/**
 * Write value to Redis cache with TTL (Time To Live) in seconds
 */
async function setCached(key, value, ttlSeconds = 86400) {
  if (!client || !isConnected) return false;
  try {
    const stringified = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await client.set(key, stringified, {
      EX: ttlSeconds
    });
    return true;
  } catch (err) {
    console.warn(`⚠️ [Redis Set Fail] Key: ${key}:`, err.message);
    return false;
  }
}

/**
 * Delete key from Redis cache
 */
async function deleteCached(key) {
  if (!client || !isConnected) return false;
  try {
    await client.del(key);
    return true;
  } catch (err) {
    console.warn(`⚠️ [Redis Del Fail] Key: ${key}:`, err.message);
    return false;
  }
}

module.exports = {
  getCached,
  setCached,
  deleteCached,
  client,
  isAvailable: () => isConnected
};
