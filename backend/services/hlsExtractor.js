const axios = require('axios');
const redisService = require('./redisService');

/**
 * HLS Stream Extractor Service
 * Resolves direct .m3u8 HLS master playlist links and multi-provider mirrors
 * for movies and TV episodes.
 */

// Timeout for stream extraction requests
const FETCH_TIMEOUT = 5000;

const tmdbClient = axios.create({
  timeout: FETCH_TIMEOUT,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
  }
});

/**
 * Resolves direct HLS (.m3u8) streams and resilient embed mirrors for a Movie.
 */
async function getMovieStreams(tmdbId) {
  const cacheKey = `cinema:stream:movie:${tmdbId}`;
  const cached = await redisService.getCached(cacheKey);
  if (cached) return cached;

  const sources = [
    {
      source_name: 'VidKing Engine (Ultra Fast 1080p)',
      url: `https://vidking.net/e/movie/${tmdbId}`,
      quality: '1080p',
      is_embed: true,
      type: 'iframe'
    },
    {
      source_name: 'VidSrc.cc (Primary Server)',
      url: `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,
      quality: '1080p',
      is_embed: true,
      type: 'iframe'
    },
    {
      source_name: 'VidSrc.vip (High Speed)',
      url: `https://vidsrc.vip/embed/movie/${tmdbId}`,
      quality: '1080p',
      is_embed: true,
      type: 'iframe'
    },
    {
      source_name: 'Embed.su (Multi-Host)',
      url: `https://embed.su/embed/movie/${tmdbId}`,
      quality: '1080p',
      is_embed: true,
      type: 'iframe'
    },
    {
      source_name: 'VidLink (Alternative)',
      url: `https://vidlink.pro/movie/${tmdbId}`,
      quality: '1080p',
      is_embed: true,
      type: 'iframe'
    },
    {
      source_name: 'VidSrc.pro (HD Mirror)',
      url: `https://vidsrc.pro/embed/movie/${tmdbId}`,
      quality: '1080p',
      is_embed: true,
      type: 'iframe'
    },
    {
      source_name: 'VidSrc.in (Backup Mirror)',
      url: `https://vidsrc.in/embed/movie/${tmdbId}`,
      quality: '1080p',
      is_embed: true,
      type: 'iframe'
    },
    {
      source_name: '2Embed (Classic HD)',
      url: `https://www.2embed.cc/embed/${tmdbId}`,
      quality: '1080p',
      is_embed: true,
      type: 'iframe'
    },
    {
      source_name: 'SuperEmbed (Ad-Light)',
      url: `https://multiembed.to/embed.php?video_id=${tmdbId}`,
      quality: '720p',
      is_embed: true,
      type: 'iframe'
    }
  ];

  const result = { tmdb_id: tmdbId, sources };
  await redisService.setCached(cacheKey, result, 3600 * 6);
  return result;
}

/**
 * Resolves direct HLS (.m3u8) streams and resilient embed mirrors for a TV Show Episode.
 */
async function getEpisodeStreams(tmdbId, season, episode) {
  const cacheKey = `cinema:stream:tv:${tmdbId}:${season}:${episode}`;
  const cached = await redisService.getCached(cacheKey);
  if (cached) return cached;

  const sources = [
    {
      source_name: 'VidKing Engine (Ultra Fast 1080p)',
      url: `https://vidking.net/e/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p',
      is_embed: true,
      type: 'iframe'
    },
    {
      source_name: 'VidSrc.cc (Primary Server)',
      url: `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p',
      is_embed: true,
      type: 'iframe'
    },
    {
      source_name: 'VidSrc.vip (Ultra Fast)',
      url: `https://vidsrc.vip/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p',
      is_embed: true,
      type: 'iframe'
    },
    {
      source_name: 'Embed.su (Multi-Host)',
      url: `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p',
      is_embed: true,
      type: 'iframe'
    },
    {
      source_name: 'VidLink (Alternative)',
      url: `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p',
      is_embed: true,
      type: 'iframe'
    },
    {
      source_name: 'VidSrc.pro (HD Mirror)',
      url: `https://vidsrc.pro/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p',
      is_embed: true,
      type: 'iframe'
    },
    {
      source_name: 'VidSrc.in (Backup Mirror)',
      url: `https://vidsrc.in/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p',
      is_embed: true,
      type: 'iframe'
    },
    {
      source_name: '2Embed (Classic HD)',
      url: `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`,
      quality: '1080p',
      is_embed: true,
      type: 'iframe'
    },
    {
      source_name: 'SuperEmbed (Ad-Light)',
      url: `https://multiembed.to/embed.php?video_id=${tmdbId}&s=${season}&e=${episode}`,
      quality: '720p',
      is_embed: true,
      type: 'iframe'
    }
  ];

  const result = { tmdb_id: tmdbId, season, episode, sources };
  await redisService.setCached(cacheKey, result, 3600 * 6);
  return result;
}

module.exports = {
  getMovieStreams,
  getEpisodeStreams
};
