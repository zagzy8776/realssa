const axios = require('axios');

async function testEndpoint(url) {
  console.log(`\nRequesting URL: ${url}`);
  try {
    const res = await axios.get(url, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });
    console.log(`Status: ${res.status}`);
    console.log(`Data count:`, Array.isArray(res.data) ? res.data.length : 'non-array');
    console.log(`Data snippet:`, String(JSON.stringify(res.data)).slice(0, 300));
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    if (err.response) {
      console.error(`Response status: ${err.response.status}`);
      console.error(`Response data:`, err.response.data);
    }
  }
}

(async () => {
  console.log('Testing Fly.io Backend endpoints directly...');
  await testEndpoint('https://realssa-scraper.fly.dev/api/news/sports');
  await testEndpoint('https://realssa-scraper.fly.dev/api/sports/matches');
  await testEndpoint('https://realssa-scraper.fly.dev/api/sports/stream-schedule');
})();
