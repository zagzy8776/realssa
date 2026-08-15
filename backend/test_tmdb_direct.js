const axios = require('axios');

(async () => {
  console.log('Testing direct fetch to TMDB...');
  const url = 'https://api.themoviedb.org/3/trending/all/day?api_key=c45fd7812c8980c108390153b0041416&page=1';
  try {
    console.log('Requesting URL:', url);
    const start = Date.now();
    const res = await axios.get(url, { timeout: 5000 });
    console.log(`Response received in ${Date.now() - start}ms`);
    console.log('Status:', res.status);
    console.log('Results count:', res.data.results ? res.data.results.length : 0);
  } catch (err) {
    console.error('Error fetching directly from TMDB:', err.message);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
    }
  }
})();
