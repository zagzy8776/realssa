const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const tmdbService = require('./services/tmdbService');

(async () => {
  console.log('Testing TMDB Trending fetch...');
  console.log('TMDB API KEY:', process.env.TMDB_API_KEY || 'Not set in env');
  try {
    const data = await tmdbService.getTrending('all', 'day', 1);
    console.log('Success!');
    console.log('Results count:', data.results ? data.results.length : 0);
    if (data.results && data.results.length > 0) {
      console.log('First item title:', data.results[0].title || data.results[0].name);
    }
  } catch (err) {
    console.error('Error fetching trending:', err.message);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
    }
  }
  process.exit(0);
})();
