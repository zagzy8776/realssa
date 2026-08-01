const express = require('express');
const router = express.Router();
const tmdbService = require('../services/tmdbService');
const movieScraper = require('../services/movieScraper');

/**
 * GET /api/cinema/trending
 * Returns cached trending movies and TV shows from TMDB.
 */
router.get('/trending', async (req, res) => {
  try {
    const mediaType = req.query.media_type || 'all'; // 'all', 'movie', 'tv'
    const timeWindow = req.query.time_window || 'day'; // 'day', 'week'
    const data = await tmdbService.getTrending(mediaType, timeWindow);
    res.json(data);
  } catch (err) {
    console.error('[Cinema API] Trending error:', err.message);
    res.status(500).json({ error: 'Failed to fetch trending movies/series' });
  }
});

/**
 * GET /api/cinema/search
 * Searches TMDB movie and series catalog.
 */
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Search query parameter "q" is required' });
    }
    const type = req.query.type || 'multi'; // 'multi', 'movie', 'tv'
    const data = await tmdbService.searchCatalog(query, type);
    res.json(data);
  } catch (err) {
    console.error('[Cinema API] Search error:', err.message);
    res.status(500).json({ error: 'Failed to search movie/series catalog' });
  }
});

/**
 * GET /api/cinema/movies/:id
 * Returns movie details, including trailers, recommendations, and streaming server links.
 */
router.get('/movies/:id', async (req, res) => {
  try {
    const movieId = req.params.id;
    
    // Fetch details & recommendations from TMDB
    const movieDetails = await tmdbService.getMovieDetails(movieId);
    
    // Fetch streaming video source links
    const sources = await movieScraper.getMovieSources(movieId);
    
    res.json({
      ...movieDetails,
      sources
    });
  } catch (err) {
    console.error(`[Cinema API] Movie Details error for ID ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch movie details' });
  }
});

/**
 * GET /api/cinema/shows/:id
 * Returns TV show details, including seasons list, trailers, and recommendations.
 */
router.get('/shows/:id', async (req, res) => {
  try {
    const showId = req.params.id;
    const showDetails = await tmdbService.getShowDetails(showId);
    res.json(showDetails);
  } catch (err) {
    console.error(`[Cinema API] TV Show Details error for ID ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch TV show details' });
  }
});

/**
 * GET /api/cinema/shows/:id/season/:season
 * Returns list of episodes and their metadata for a specific season of a TV show.
 */
router.get('/shows/:id/season/:season', async (req, res) => {
  try {
    const showId = req.params.id;
    const seasonNumber = parseInt(req.params.season);
    const seasonData = await tmdbService.getShowSeason(showId, seasonNumber);
    res.json(seasonData);
  } catch (err) {
    console.error(`[Cinema API] TV Season error for Show ID ${req.params.id} S${req.params.season}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch TV season details' });
  }
});

/**
 * GET /api/cinema/episodes/:showId/:season/:episode/sources
 * Returns all streaming source links for a specific TV show episode.
 */
router.get('/episodes/:showId/:season/:episode/sources', async (req, res) => {
  try {
    const { showId, season, episode } = req.params;
    const sources = await movieScraper.getEpisodeSources(
      parseInt(showId), 
      parseInt(season), 
      parseInt(episode)
    );
    res.json({ sources });
  } catch (err) {
    console.error(`[Cinema API] Episode Sources error:`, err.message);
    res.status(500).json({ error: 'Failed to fetch streaming sources for this episode' });
  }
});

module.exports = router;
