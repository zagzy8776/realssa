/**
 * Watchmode Service
 * API Key required - stored in env as WATCHMODE_API_KEY
 * Used to show "Available on Netflix / Prime / etc." badges on movie details.
 * Free plan: 1,000 requests/month — we cache heavily (24h) to stay within limits.
 */
const axios = require('axios');

const WATCHMODE_KEY = process.env.WATCHMODE_API_KEY || '';

const client = axios.create({
  baseURL: 'https://api.watchmode.com/v1',
  timeout: 10000,
});

// These are the platforms most relevant to Nigerian users (available internationally)
const PRIORITY_SOURCES = new Set([
  'Netflix', 'Prime Video', 'Disney+', 'HBO Max', 'Apple TV+',
  'Paramount+', 'Peacock', 'Tubi TV', 'YouTube', 'Crunchyroll',
  'AMC+', 'Discovery+', 'Hulu'
]);

/**
 * Find the Watchmode title ID by TMDB ID and media type.
 * Cached 7 days — ID mappings rarely change.
 */
async function findWatchmodeId(tmdbId, mediaType = 'movie', redisService) {
  if (!WATCHMODE_KEY) return null;

  const cacheKey = `watchmode:id:${mediaType}:${tmdbId}`;
  if (redisService) {
    const cached = await redisService.getCached(cacheKey);
    if (cached !== null) return cached;
  }

  try {
    const field = mediaType === 'tv' ? 'tmdb_tv_id' : 'tmdb_movie_id';
    const response = await client.get('/search/', {
      params: { apiKey: WATCHMODE_KEY, search_field: field, search_value: tmdbId }
    });
    const results = response.data?.title_results || [];
    const id = results.length > 0 ? results[0].id : null;

    if (redisService && id) {
      await redisService.setCached(cacheKey, id, 3600 * 24 * 7); // 7 days
    }
    return id;
  } catch (err) {
    console.error('❌ [Watchmode ID Lookup Error]:', err.message);
    return null;
  }
}

/**
 * Get streaming availability sources for a title.
 * Returns a cleaned array of { name, type, web_url } objects.
 * Cached 24h.
 */
async function getStreamingSources(tmdbId, mediaType = 'movie', redisService) {
  if (!WATCHMODE_KEY) return [];

  const cacheKey = `watchmode:sources:${mediaType}:${tmdbId}`;
  if (redisService) {
    const cached = await redisService.getCached(cacheKey);
    if (cached !== null) return cached;
  }

  try {
    const watchmodeId = await findWatchmodeId(tmdbId, mediaType, redisService);
    if (!watchmodeId) return [];

    const response = await client.get(`/title/${watchmodeId}/sources/`, {
      params: { apiKey: WATCHMODE_KEY, regions: 'US' }
    });

    const sources = response.data || [];

    // Filter to subscription/free only (skip buy/rent), prioritize known platforms
    const cleaned = sources
      .filter(s => s.type === 'sub' || s.type === 'free')
      .map(s => ({
        name: s.name,
        type: s.type,       // 'sub' or 'free'
        web_url: s.web_url,
        logo: `https://cdn.watchmode.com/provider_logos/${s.name.toLowerCase().replace(/\s+/g, '_')}_100px.png`,
      }))
      // Prioritize well-known platforms first
      .sort((a, b) => {
        const aPriority = PRIORITY_SOURCES.has(a.name) ? 0 : 1;
        const bPriority = PRIORITY_SOURCES.has(b.name) ? 0 : 1;
        return aPriority - bPriority;
      })
      .slice(0, 6); // Max 6 badges to keep UI clean

    if (redisService) {
      await redisService.setCached(cacheKey, cleaned, 3600 * 24); // 24h cache
    }
    return cleaned;
  } catch (err) {
    console.error('❌ [Watchmode Sources Error]:', err.message);
    return [];
  }
}

module.exports = { getStreamingSources, findWatchmodeId };
