const tmdbService = require('./tmdbService');
const pureStreamExtractor = require('./pureStreamExtractor');
const redisService = require('./redisService');

/**
 * Cinema Cron Pre-Warmer Service
 * Pre-populates the Top 50 Trending Movies & TV Episodes into Redis & Neon DB8
 * so user requests hit sub-5ms playback initialization with 0 scraping lag.
 */

async function runCinemaPrewarmer() {
  console.log('⏰ [Cinema Pre-Warmer] Starting background stream pre-warming job...');
  let prewarmedCount = 0;

  try {
    // 1. Fetch Trending Movies & Shows from TMDB
    const [moviesData, showsData] = await Promise.all([
      tmdbService.getTrending('movie', 'day'),
      tmdbService.getTrending('tv', 'day')
    ]);

    const topMovies = (moviesData.results || []).slice(0, 30);
    const topShows = (showsData.results || []).slice(0, 20);

    // 2. Pre-warm Top Movies
    for (const movie of topMovies) {
      if (!movie.id) continue;
      try {
        await pureStreamExtractor.extractMovieStreams(movie.id);
        prewarmedCount++;
      } catch (err) {
        console.warn(`[Cinema Pre-Warmer] Movie ${movie.id} pre-warm skip:`, err.message);
      }
    }

    // 3. Pre-warm Top TV Shows (Season 1 Episode 1)
    for (const show of topShows) {
      if (!show.id) continue;
      try {
        await pureStreamExtractor.extractEpisodeStreams(show.id, 1, 1);
        prewarmedCount++;
      } catch (err) {
        console.warn(`[Cinema Pre-Warmer] Show ${show.id} pre-warm skip:`, err.message);
      }
    }

    // Cache pre-warm run stats
    const lastRunInfo = {
      timestamp: new Date().toISOString(),
      prewarmed_items: prewarmedCount,
      status: 'success'
    };
    await redisService.setCached('cinema:prewarm:last_run', lastRunInfo, 3600 * 24);

    console.log(`🎉 [Cinema Pre-Warmer] Pre-warming complete! Processed ${prewarmedCount} items.`);
    return lastRunInfo;

  } catch (err) {
    console.error('❌ [Cinema Pre-Warmer Error]:', err.message);
    return { status: 'error', error: err.message };
  }
}

module.exports = {
  runCinemaPrewarmer
};
