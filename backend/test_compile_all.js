const axios = require('axios');

const urls = [
  'http://localhost:8080/src/pages/CinemaHub.tsx',
  'http://localhost:8080/src/pages/VideoNews.tsx',
  'http://localhost:8080/src/components/CinemaPlayer.tsx',
  'http://localhost:8080/src/components/SportsPlayer.tsx'
];

(async () => {
  for (const url of urls) {
    console.log(`Fetching ${url}...`);
    try {
      const res = await axios.get(url, { timeout: 5000 });
      console.log(`  -> Status: ${res.status} (SUCCESS)`);
    } catch (err) {
      console.error(`  -> ERROR: ${err.message}`);
      if (err.response) {
        console.error(`     Response status: ${err.response.status}`);
        console.error(`     Response data:`, err.response.data);
      }
    }
  }
})();
