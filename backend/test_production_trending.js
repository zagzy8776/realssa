const axios = require('axios');

(async () => {
  console.log('Testing production API with headers simulating local app...');
  const url = 'https://www.realssanews.com.ng/api/cinema/trending?page=1&time_window=week';
  try {
    const res = await axios.get(url, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Origin': 'http://localhost:5173',
        'Referer': 'http://localhost:5173/'
      }
    });
    console.log('Status:', res.status);
    console.log('Results count:', res.data.results ? res.data.results.length : 0);
    if (res.data.results && res.data.results.length > 0) {
      console.log('First 5 items:');
      res.data.results.slice(0, 5).forEach((item, idx) => {
        console.log(`[${idx}] title/name: "${item.title || item.name}", media_type: "${item.media_type}", vote_average: ${item.vote_average}, poster_path: "${item.poster_path}", r2_poster_url: "${item.r2_poster_url}"`);
      });
    }
  } catch (err) {
    console.error('Error fetching production API:', err.message);
  }
})();
