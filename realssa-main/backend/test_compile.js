const axios = require('axios');

(async () => {
  console.log('Fetching CinemaHub.tsx from Vite dev server...');
  const url = 'http://localhost:8080/src/pages/CinemaHub.tsx';
  try {
    const res = await axios.get(url, { timeout: 5000 });
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('Body snippet (first 500 chars):');
    console.log(res.data.slice(0, 500));
  } catch (err) {
    console.error('Error fetching from Vite dev server:', err.message);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
    }
  }
})();
