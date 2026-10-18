/**
 * Test Redis connection and clear sports cache
 */

// Set Redis URL from command line arg or use default
if (process.argv[2]) {
  process.env.REDIS_URL = process.argv[2];
}

const redisService = require('./services/redisService');

async function testRedis() {
  console.log('Testing Redis connection...\n');
  
  // Wait for Redis to connect
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (!redisService.isAvailable()) {
    console.error('❌ Redis is NOT connected');
    console.log('Check REDIS_URL environment variable');
    process.exit(1);
  }
  
  console.log('✅ Redis is connected!\n');
  
  // Test write
  console.log('Testing write...');
  const testKey = 'test:redis:connection';
  const testValue = { timestamp: new Date().toISOString(), test: true };
  await redisService.setCached(testKey, testValue, 60);
  console.log('✅ Write successful\n');
  
  // Test read
  console.log('Testing read...');
  const retrieved = await redisService.getCached(testKey);
  console.log('✅ Read successful:', retrieved);
  console.log('');
  
  // Clean up test key
  await redisService.deleteCached(testKey);
  
  // Check sports cache
  console.log('Checking sports cache...');
  const sportsCacheKey = 'sports:feed:v2';
  const sportsCache = await redisService.getCached(sportsCacheKey);
  
  if (sportsCache) {
    console.log('✅ Sports cache exists');
    console.log('   - Generated:', sportsCache.generatedAt);
    console.log('   - Match count:', sportsCache.count || 0);
    console.log('   - Live count:', sportsCache.liveCount || 0);
    
    if (sportsCache.count === 0) {
      console.warn('\n⚠️  WARNING: Sports cache has ZERO matches!');
      console.log('This is why your site shows "No matches found"');
      console.log('\nClearing stale cache...');
      await redisService.deleteCached(sportsCacheKey);
      console.log('✅ Sports cache cleared!');
      console.log('\nNext API call will fetch fresh data.');
    }
  } else {
    console.log('ℹ️  Sports cache is empty (will be populated on first API call)');
  }
  
  console.log('\n✅ Redis test complete!');
  process.exit(0);
}

testRedis().catch(err => {
  console.error('❌ Redis test failed:', err);
  process.exit(1);
});
