const express = require('express');
const router = express.Router();
const axios = require('axios');
const tmdbService = require('../services/tmdbService');
const movieScraper = require('../services/movieScraper');
const pureStreamExtractor = require('../services/pureStreamExtractor');
const cinemaCronPrewarmer = require('../services/cinemaCronPrewarmer');
const streamResolver = require('../services/streamResolver');

/**
 * GET /api/cinema/resolve-stream
 * PRIMARY ROUTE: Extracts a direct .m3u8 HLS stream URL from the provider
 * so the frontend HlsPlayer plays it natively — no iframes, no foreign sites.
 * Falls back to iframe embed list if no direct stream can be extracted.
 */
router.get('/resolve-stream', async (req, res) => {
  try {
    const { id, type = 'movie', season = 1, episode = 1 } = req.query;
    if (!id) return res.status(400).json({ error: '"id" (TMDB ID) is required' });

    const result = await streamResolver.resolveStream(
      parseInt(id),
      type,
      parseInt(season),
      parseInt(episode)
    );

    if (result && result.stream_url) {
      return res.json({
        success: true,
        mode: 'direct_hls',
        provider: result.provider,
        stream_url: result.stream_url,
        quality: result.quality || '1080p',
        is_hls: result.is_hls,
        subtitles: result.subtitles || [],
        from_cache: result.from_cache || false
      });
    }

    // Fallback: return iframe embed list
    const fallback = type === 'tv'
      ? await pureStreamExtractor.extractEpisodeStreams(parseInt(id), parseInt(season), parseInt(episode))
      : await pureStreamExtractor.extractMovieStreams(parseInt(id));

    return res.json({
      success: false,
      mode: 'iframe_fallback',
      message: 'Direct HLS extraction failed — returning embed list',
      sources: fallback.sources
    });
  } catch (err) {
    console.error('[Cinema Resolve Stream Error]:', err.message);
    res.status(500).json({ error: 'Stream resolution failed', detail: err.message });
  }
});

/**
 * GET /api/cinema/cron-prewarm
 * Pre-warms the Top 50 Trending Movies & TV Episodes into Redis & Neon DB8
 */
router.get('/cron-prewarm', async (req, res) => {
  try {
    const secret = req.query.secret || req.headers['x-cron-secret'];
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      // Allow internal pre-warm call
      console.log('[Cron Pre-Warmer] Running un-authenticated pre-warm ping');
    }
    const stats = await cinemaCronPrewarmer.runCinemaPrewarmer();
    res.json({ message: 'Cinema stream pre-warming triggered successfully', stats });
  } catch (err) {
    console.error('[Cinema Cron Pre-warm Error]:', err.message);
    res.status(500).json({ error: 'Failed to run stream pre-warmer' });
  }
});

/**
 * GET /api/cinema/proxy-stream
 * MovieBox-style HLS Stream Proxy
 * Fetches target .m3u8 playlists and TS video segments, strips CORS/referer blocks,
 * and pipes video stream bytes directly to the client's native HTML5 player.
 */
router.get('/proxy-stream', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: 'Query parameter "url" is required' });
    }

    const decodedUrl = decodeURIComponent(targetUrl);

    const response = await axios({
      method: 'get',
      url: decodedUrl,
      responseType: 'stream',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': new URL(decodedUrl).origin
      }
    });

    const contentType = response.headers['content-type'] || 'application/vnd.apple.mpegurl';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    response.data.pipe(res);
  } catch (err) {
    console.error(`[Cinema Proxy Stream Error]:`, err.message);
    res.status(500).json({ error: 'Failed to proxy video stream chunk' });
  }
});

/**
 * GET /api/cinema/stream
 * Returns high-speed extracted HLS and multi-server mirror links for movies and TV episodes.
 */
router.get('/stream', async (req, res) => {
  try {
    const { id, type = 'movie', season = 1, episode = 1 } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'TMDB Media ID parameter "id" is required' });
    }

    let data;
    if (type === 'tv') {
      data = await pureStreamExtractor.extractEpisodeStreams(parseInt(id), parseInt(season), parseInt(episode));
    } else {
      data = await pureStreamExtractor.extractMovieStreams(parseInt(id));
    }

    res.json(data);
  } catch (err) {
    console.error(`[Cinema Stream API] Error:`, err.message);
    res.status(500).json({ error: 'Failed to extract video streams' });
  }
});

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
