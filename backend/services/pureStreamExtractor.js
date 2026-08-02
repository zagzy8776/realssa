const axios = require('axios');
const redisService = require('./redisService');
const { queryMultiDb } = require('../config/multiDb');

/**
 * Lightweight Pure HTTP Stream Unpacker Engine (Under 30MB RAM)
 * 20 Global Stream Servers — MultiEmbed Torrent CDN leads as Server 1
 */

/**
 * Build the global 20-server movie source list
 * Server 1 = MultiEmbed Torrent CDN (confirmed working, user verified)
 */
function buildMovieSources(tmdbId) {
  return [
    // #1 — Confirmed Working (Torrent CDN)
    {
      source_name: 'Server 1',
      url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 2',
      url: `https://vidsrc.me/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 3',
      url: `https://player.autoembed.cc/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 4',
      url: `https://vidsrc.net/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 5',
      url: `https://player.smashy.stream/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 6',
      url: `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 7',
      url: `https://vidlink.pro/movie/${tmdbId}?primaryColor=ff6b35&autoplay=true`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'US/EU'
    },
    {
      source_name: 'Server 8',
      url: `https://vidsrc.xyz/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 9',
      url: `https://multiembed.to/?video_id=${tmdbId}&tmdb=1`,
      quality: '720p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 10',
      url: `https://vidsrc.vip/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Asia/EU'
    },
    {
      source_name: 'Server 11',
      url: `https://www.2embed.cc/embed/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'US'
    },
    {
      source_name: 'Server 12',
      url: `https://embed.su/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'EU'
    },
    {
      source_name: 'Server 13',
      url: `https://moviesapi.club/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 14',
      url: `https://flixhq.to/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 15',
      url: `https://moviesjoyhd.to/embed/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'EU/Asia'
    },
    {
      source_name: 'Server 16',
      url: `https://www.NontonGo.net/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Asia'
    },
    {
      source_name: 'Server 17',
      url: `https://cinezone.to/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 18',
      url: `https://watchseries-online.io/embed/movie/${tmdbId}`,
      quality: '720p', is_embed: true, type: 'iframe', region: 'US/EU'
    },
    {
      source_name: 'Server 19',
      url: `https://soaper.tv/embed/movie/${tmdbId}`,
      quality: '720p', is_embed: true, type: 'iframe', region: 'Asia'
    },
    {
      source_name: 'Server 20',
      url: `https://vidsrc.pro/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    }
  ];
}

/**
 * Build the global 20-server TV Episode source list
 * Server 1 = MultiEmbed Torrent CDN (confirmed working)
 */
function buildEpisodeSources(tmdbId, season, episode) {
  return [
    {
      source_name: 'Server 1',
      url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 2',
      url: `https://vidsrc.me/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 3',
      url: `https://player.autoembed.cc/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 4',
      url: `https://vidsrc.net/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 5',
      url: `https://player.smashy.stream/tv/${tmdbId}?s=${season}&e=${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 6',
      url: `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 7',
      url: `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?primaryColor=ff6b35&autoplay=true`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'US/EU'
    },
    {
      source_name: 'Server 8',
      url: `https://vidsrc.xyz/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 9',
      url: `https://multiembed.to/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`,
      quality: '720p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 10',
      url: `https://vidsrc.vip/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Asia/EU'
    },
    {
      source_name: 'Server 11',
      url: `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'US'
    },
    {
      source_name: 'Server 12',
      url: `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'EU'
    },
    {
      source_name: 'Server 13',
      url: `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 14',
      url: `https://flixhq.to/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 15',
      url: `https://cinezone.to/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'Server 16',
      url: `https://www.NontonGo.net/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Asia'
    },
    {
      source_name: 'Server 17',
      url: `https://soaper.tv/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '720p', is_embed: true, type: 'iframe', region: 'Asia'
    },
    {
      source_name: 'Server 18',
      url: `https://watchseries-online.io/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '720p', is_embed: true, type: 'iframe', region: 'US/EU'
    },
    {
      source_name: 'Server 19',
      url: `https://www.episodate.com/embed/tvmaze/${tmdbId}/${season}/${episode}`,
      quality: '720p', is_embed: true, type: 'iframe', region: 'EU'
    },
    {
      source_name: 'Server 20',
      url: `https://vidsrc.pro/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    }
  ];
}

/**
 * Pure HTTP Extractor for Movies
 */
async function extractMovieStreams(tmdbId) {
  const cacheKey = `cinema:stream:movie:v6:${tmdbId}`;

  // 1. Check Upstash Redis Memory Layer
  try {
    const cached = await redisService.getCached(cacheKey);
    if (cached && cached.sources && cached.sources.length > 0) {
      return cached;
    }
  } catch (_) {}

  // 2. Assemble 20 Global Sources
  const sources = buildMovieSources(tmdbId);
  const result = { tmdb_id: tmdbId, sources, total_servers: sources.length };

  // 3. Save to Redis asynchronously
  redisService.setCached(cacheKey, result, 3600 * 6).catch(() => {});
  saveToDb8(tmdbId, 'movie', 1, 1, sources).catch(() => {});

  return result;
}

/**
 * Pure HTTP Extractor for TV Episodes
 */
async function extractEpisodeStreams(tmdbId, season, episode) {
  const cacheKey = `cinema:stream:tv:v6:${tmdbId}:${season}:${episode}`;

  // 1. Check Redis
  try {
    const cached = await redisService.getCached(cacheKey);
    if (cached && cached.sources && cached.sources.length > 0) {
      return cached;
    }
  } catch (_) {}

  // 2. Assemble 20 Global Episode Sources
  const sources = buildEpisodeSources(tmdbId, season, episode);
  const result = { tmdb_id: tmdbId, season, episode, sources, total_servers: sources.length };

  // 3. Save to Redis & DB8 asynchronously
  redisService.setCached(cacheKey, result, 3600 * 6).catch(() => {});
  saveToDb8(tmdbId, 'tv', season, episode, sources).catch(() => {});

  return result;
}

/**
 * Persist stream sources to Neon DB8
 */
async function saveToDb8(tmdbId, mediaType, season, episode, sources) {
  try {
    await queryMultiDb(
      `INSERT INTO cinema_sources (tmdb_id, media_type, season, episode, sources, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET sources = EXCLUDED.sources, updated_at = NOW()`,
      [tmdbId, mediaType, season, episode, JSON.stringify(sources)],
      'video_sources'
    );
  } catch (_) {
    // Non-blocking: DB8 write failure is not fatal
  }
}

module.exports = {
  extractMovieStreams,
  extractEpisodeStreams
};
