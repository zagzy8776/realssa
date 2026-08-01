const axios = require('axios');
const redisService = require('./redisService');
const r2Service = require('./r2Service');

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'c45fd7812c8980c108390153b0041416';
const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjNDVmZDc4MTJjODk4MGMxMDgzOTAxNTNiMDA0MTQxNiIsIm5iZiI6MTc4NTM4NDk2Ny4zMDcwMDAyLCJzdWIiOiI2YTZhZDAwN2lyZjAyMDJjMTMwZTdiNzgiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.f9r903H07S-TMyG5LCIMNF4uJ-bZytYSWgIWZGJS6ik';
const BASE_URL = 'https://api.themoviedb.org/3';

// Set up Axios instance with defaults
const tmdbClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    Accept: 'application/json'
  }
});

// Always include the api_key query parameter
const getParams = (extraParams = {}) => {
  const params = { ...extraParams };
  params.api_key = TMDB_API_KEY;
  return params;
};

/**
 * Helper to cache TMDB images (posters/backdrops) to Cloudflare R2
 */
async function processMediaImages(item) {
  if (!item) return item;
  
  if (item.poster_path) {
    item.r2_poster_url = item.poster_path.startsWith('http')
      ? item.poster_path
      : `https://image.tmdb.org/t/p/w500${item.poster_path}`;
  } else {
    item.r2_poster_url = 'https://realssanews.com.ng/logo.png';
  }

  if (item.backdrop_path) {
    item.r2_backdrop_url = item.backdrop_path.startsWith('http')
      ? item.backdrop_path
      : `https://image.tmdb.org/t/p/original${item.backdrop_path}`;
  } else {
    item.r2_backdrop_url = 'https://realssanews.com.ng/logo.png';
  }

  return item;
}

/**
 * Fetch and Cache Trending movies/TV shows
 */
async function getTrending(mediaType = 'all', timeWindow = 'day') {
  const cacheKey = `tmdb:trending:${mediaType}:${timeWindow}`;
  const cached = await redisService.getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await tmdbClient.get(`/trending/${mediaType}/${timeWindow}`, {
      params: getParams()
    });
    
    // Process images in parallel
    const results = response.data.results || [];
    const processedResults = await Promise.all(results.map(item => processMediaImages(item)));
    
    const finalData = { ...response.data, results: processedResults };
    await redisService.setCached(cacheKey, finalData, 3600 * 6); // Cache trending for 6 hours
    return finalData;
  } catch (err) {
    console.error(`❌ [TMDB getTrending Error]:`, err.message);
    throw err;
  }
}

/**
 * Search TMDB Movie Catalog
 */
async function searchCatalog(query, type = 'multi') {
  const cacheKey = `tmdb:search:${type}:${query.toLowerCase().replace(/\s+/g, '-')}`;
  const cached = await redisService.getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await tmdbClient.get(`/search/${type}`, {
      params: getParams({ query })
    });

    const results = response.data.results || [];
    const processedResults = await Promise.all(results.map(item => processMediaImages(item)));
    
    const finalData = { ...response.data, results: processedResults };
    await redisService.setCached(cacheKey, finalData, 3600 * 2); // Cache search for 2 hours
    return finalData;
  } catch (err) {
    console.error(`❌ [TMDB Search Error]:`, err.message);
    throw err;
  }
}

/**
 * Fetch Movie Details by ID
 */
async function getMovieDetails(movieId) {
  const cacheKey = `tmdb:movie:${movieId}`;
  const cached = await redisService.getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await tmdbClient.get(`/movie/${movieId}`, {
      params: getParams({ append_to_response: 'videos,credits,recommendations' })
    });

    const processed = await processMediaImages(response.data);
    
    // Process recommendations images
    if (processed.recommendations && processed.recommendations.results) {
      processed.recommendations.results = await Promise.all(
        processed.recommendations.results.map(item => processMediaImages(item))
      );
    }

    await redisService.setCached(cacheKey, processed, 3600 * 24); // Cache details for 24 hours
    return processed;
  } catch (err) {
    console.error(`❌ [TMDB getMovieDetails Error]:`, err.message);
    throw err;
  }
}

/**
 * Fetch TV Show Details by ID
 */
async function getShowDetails(showId) {
  const cacheKey = `tmdb:show:${showId}`;
  const cached = await redisService.getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await tmdbClient.get(`/tv/${showId}`, {
      params: getParams({ append_to_response: 'videos,credits,recommendations' })
    });

    const processed = await processMediaImages(response.data);
    
    // Process recommendations images
    if (processed.recommendations && processed.recommendations.results) {
      processed.recommendations.results = await Promise.all(
        processed.recommendations.results.map(item => processMediaImages(item))
      );
    }

    await redisService.setCached(cacheKey, processed, 3600 * 24); // Cache details for 24 hours
    return processed;
  } catch (err) {
    console.error(`❌ [TMDB getShowDetails Error]:`, err.message);
    throw err;
  }
}

/**
 * Fetch TV Season Details
 */
async function getShowSeason(showId, seasonNumber) {
  const cacheKey = `tmdb:show:${showId}:season:${seasonNumber}`;
  const cached = await redisService.getCached(cacheKey);
  if (cached) return cached;

  try {
    const response = await tmdbClient.get(`/tv/${showId}/season/${seasonNumber}`, {
      params: getParams()
    });

    const episodes = response.data.episodes || [];
    const processedEpisodes = await Promise.all(episodes.map(async (ep) => {
      if (ep.still_path) {
        const originalUrl = `https://image.tmdb.org/t/p/w300${ep.still_path}`;
        const cleanKey = `cinema/episodes${ep.still_path}`;
        ep.r2_still_url = await r2Service.cacheImageToR2(originalUrl, cleanKey);
      } else {
        ep.r2_still_url = 'https://realssanews.com.ng/logo.png';
      }
      return ep;
    }));

    const finalData = { ...response.data, episodes: processedEpisodes };
    await redisService.setCached(cacheKey, finalData, 3600 * 24); // Cache season for 24 hours
    return finalData;
  } catch (err) {
    console.error(`❌ [TMDB getShowSeason Error]:`, err.message);
    throw err;
  }
}

module.exports = {
  getTrending,
  searchCatalog,
  getMovieDetails,
  getShowDetails,
  getShowSeason
};
