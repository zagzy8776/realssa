const axios = require('axios');
const redisService = require('./redisService');
const { queryMultiDb } = require('../config/multiDb');

/**
 * Lightweight Pure HTTP Stream Unpacker Engine (Under 30MB RAM)
 * 20 Global Stream Servers across all continents — no Puppeteer, no timeouts
 */

/**
 * Build the global 20-server movie source list
 * Sorted: most reliable first based on community uptime stats
 */
function buildMovieSources(tmdbId) {
  return [
    // === TIER 1: Most Reliable, Fastest Global CDN ===
    {
      source_name: 'AutoEmbed (Ultra Fast)',
      url: `https://player.autoembed.cc/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'SmashyStream (Multi-Server)',
      url: `https://player.smashy.stream/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'VidSrc.me (Global HD)',
      url: `https://vidsrc.me/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'VidSrc.xyz (Mirror)',
      url: `https://vidsrc.xyz/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },

    // === TIER 2: High-Speed Dedicated Mirrors ===
    {
      source_name: 'VidLink Pro (HD Stream)',
      url: `https://vidlink.pro/movie/${tmdbId}?primaryColor=ff6b35&autoplay=true`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'US/EU'
    },
    {
      source_name: 'VidSrc.net (Fast CDN)',
      url: `https://vidsrc.net/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'VidSrc.cc (Primary)',
      url: `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'VidSrc.vip (Speed)',
      url: `https://vidsrc.vip/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Asia/EU'
    },

    // === TIER 3: Classic Reliable Networks ===
    {
      source_name: '2Embed (Classic HD)',
      url: `https://www.2embed.cc/embed/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'US'
    },
    {
      source_name: 'Embed.su (Multi-Host)',
      url: `https://embed.su/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'EU'
    },
    {
      source_name: 'NontonGo (Asian CDN)',
      url: `https://www.NontonGo.net/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Asia'
    },
    {
      source_name: 'MultiEmbed (Torrent CDN)',
      url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },

    // === TIER 4: Alternative High-Quality Mirrors ===
    {
      source_name: 'MoviesAPI (Free CDN)',
      url: `https://moviesapi.club/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'MovieE (Direct Stream)',
      url: `https://moviesjoyhd.to/embed/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'EU/Asia'
    },
    {
      source_name: 'FlixNest (HLS Direct)',
      url: `https://flixhq.to/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'SuperEmbed (Multi CDN)',
      url: `https://multiembed.to/?video_id=${tmdbId}&tmdb=1`,
      quality: '720p', is_embed: true, type: 'iframe', region: 'Global'
    },

    // === TIER 5: Backup Deep Mirror Network ===
    {
      source_name: 'CineZone (Backup)',
      url: `https://cinezone.to/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'WatchSeries (Classic)',
      url: `https://watchseries-online.io/embed/movie/${tmdbId}`,
      quality: '720p', is_embed: true, type: 'iframe', region: 'US/EU'
    },
    {
      source_name: 'SoaperTV (Alternate)',
      url: `https://soaper.tv/embed/movie/${tmdbId}`,
      quality: '720p', is_embed: true, type: 'iframe', region: 'Asia'
    },
    {
      source_name: 'VidSrc.pro (Deep Mirror)',
      url: `https://vidsrc.pro/embed/movie/${tmdbId}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    }
  ];
}

/**
 * Build the global 20-server TV Episode source list
 */
function buildEpisodeSources(tmdbId, season, episode) {
  return [
    // === TIER 1: Most Reliable, Fastest Global CDN ===
    {
      source_name: 'AutoEmbed (Ultra Fast)',
      url: `https://player.autoembed.cc/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'SmashyStream (Multi-Server)',
      url: `https://player.smashy.stream/tv/${tmdbId}?s=${season}&e=${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'VidSrc.me (Global HD)',
      url: `https://vidsrc.me/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'VidSrc.xyz (Mirror)',
      url: `https://vidsrc.xyz/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },

    // === TIER 2: High-Speed Dedicated Mirrors ===
    {
      source_name: 'VidLink Pro (HD Stream)',
      url: `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?primaryColor=ff6b35&autoplay=true`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'US/EU'
    },
    {
      source_name: 'VidSrc.net (Fast CDN)',
      url: `https://vidsrc.net/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'VidSrc.cc (Primary)',
      url: `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'VidSrc.vip (Speed)',
      url: `https://vidsrc.vip/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Asia/EU'
    },

    // === TIER 3: Classic Reliable Networks ===
    {
      source_name: '2Embed (Classic HD)',
      url: `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'US'
    },
    {
      source_name: 'Embed.su (Multi-Host)',
      url: `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'EU'
    },
    {
      source_name: 'NontonGo (Asian CDN)',
      url: `https://www.NontonGo.net/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Asia'
    },
    {
      source_name: 'MultiEmbed (Torrent CDN)',
      url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },

    // === TIER 4: Alternative High-Quality Mirrors ===
    {
      source_name: 'MoviesAPI (Free CDN)',
      url: `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'FlixNest (HLS Direct)',
      url: `https://flixhq.to/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'SuperEmbed (Multi CDN)',
      url: `https://multiembed.to/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`,
      quality: '720p', is_embed: true, type: 'iframe', region: 'Global'
    },
    {
      source_name: 'CineZone (Backup)',
      url: `https://cinezone.to/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    },

    // === TIER 5: Backup Deep Mirror Network ===
    {
      source_name: 'SoaperTV (Asia Mirror)',
      url: `https://soaper.tv/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '720p', is_embed: true, type: 'iframe', region: 'Asia'
    },
    {
      source_name: 'WatchSeries (Classic)',
      url: `https://watchseries-online.io/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '720p', is_embed: true, type: 'iframe', region: 'US/EU'
    },
    {
      source_name: 'EpisodeTV (Mirror)',
      url: `https://www.episodate.com/embed/tvmaze/${tmdbId}/${season}/${episode}`,
      quality: '720p', is_embed: true, type: 'iframe', region: 'EU'
    },
    {
      source_name: 'VidSrc.pro (Deep Mirror)',
      url: `https://vidsrc.pro/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p', is_embed: true, type: 'iframe', region: 'Global'
    }
  ];
}

/**
 * Pure HTTP Extractor for Movies
 */
async function extractMovieStreams(tmdbId) {
  const cacheKey = `cinema:stream:movie:v5:${tmdbId}`;

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
  const cacheKey = `cinema:stream:tv:v5:${tmdbId}:${season}:${episode}`;

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
