const axios = require('axios');

(async () => {
  console.log('Testing production API for Sports Stream Schedule...');
  const url = 'https://www.realssanews.com.ng/api/sports/stream-schedule';
  try {
    console.log('Requesting URL:', url);
    const start = Date.now();
    const res = await axios.get(url, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Origin': 'http://localhost:8080',
        'Referer': 'http://localhost:8080/'
      }
    });
    console.log(`Response received in ${Date.now() - start}ms`);
    console.log('Status:', res.status);
    console.log('Is Array?', Array.isArray(res.data));
    console.log('Events count:', res.data ? res.data.length : 0);
    if (Array.isArray(res.data) && res.data.length > 0) {
      console.log('First 5 events:');
      res.data.slice(0, 5).forEach((item, idx) => {
        console.log(`[${idx}] event: "${item.event}", sport: "${item.sport}", time: "${item.time}", id: "${item.id}", channels count: ${item.channels ? item.channels.length : 0}`);
      });
    } else {
      console.log('Data returned:', res.data);
    }
  } catch (err) {
    console.error('Error fetching production sports schedule:', err.message);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
    }
  }
})();
