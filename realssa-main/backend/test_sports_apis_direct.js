const axios = require('axios');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function testUrl(url) {
  console.log(`Querying: ${url}`);
  const start = Date.now();
  try {
    const res = await axios.get(url, { headers, timeout: 6000 });
    console.log(`  -> SUCCESS in ${Date.now() - start}ms (status: ${res.status})`);
    if (Array.isArray(res.data)) {
      console.log(`  -> Returned array of ${res.data.length} items`);
      if (res.data.length > 0) {
        console.log(`  -> Sample item keys:`, Object.keys(res.data[0]));
        console.log(`  -> Sample item title/name:`, res.data[0].title || res.data[0].name);
      }
    } else if (res.data && typeof res.data === 'object') {
      console.log(`  -> Returned object with keys:`, Object.keys(res.data));
    } else {
      console.log(`  -> Returned data:`, String(res.data).slice(0, 200));
    }
    return true;
  } catch (err) {
    console.error(`  -> FAILED: ${err.message}`);
    if (err.response) {
      console.error(`     Response status: ${err.response.status}`);
      console.error(`     Response data snippet:`, String(JSON.stringify(err.response.data)).slice(0, 300));
    }
    return false;
  }
}

(async () => {
  console.log('--- TESTING STREAMED.ST ENDPOINTS ---');
  await testUrl('https://streamed.st/api/matches/live');
  await testUrl('https://streamed.st/api/matches/all');
})();
