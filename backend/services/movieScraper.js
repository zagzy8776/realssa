const { getPoolForCategory } = require('../config/multiDb');
const redisService = require('./redisService');

/**
 * Resolves standard free stream embed URLs for a Movie by its TMDB ID.
 */
function resolveMovieEmbeds(tmdbId) {
  return [
    {
      source_name: 'VidSrc.cc (Primary Server)',
      url: `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,
      quality: '1080p',
      is_embed: true
    },
    {
      source_name: 'VidSrc.vip (Ultra Fast)',
      url: `https://vidsrc.vip/embed/movie/${tmdbId}`,
      quality: '1080p',
      is_embed: true
    },
    {
      source_name: 'Embed.su (Multi-host)',
      url: `https://embed.su/embed/movie/${tmdbId}`,
      quality: '1080p',
      is_embed: true
    },
    {
      source_name: 'VidLink (Alternative)',
      url: `https://vidlink.pro/movie/${tmdbId}`,
      quality: '1080p',
      is_embed: true
    },
    {
      source_name: '2Embed (HD Stream)',
      url: `https://www.2embed.cc/embed/${tmdbId}`,
      quality: '1080p',
      is_embed: true
    },
    {
      source_name: 'VidSrc.pro (High Speed)',
      url: `https://vidsrc.pro/embed/movie/${tmdbId}`,
      quality: '1080p',
      is_embed: true
    },
    {
      source_name: 'VidSrc.in (Mirror)',
      url: `https://vidsrc.in/embed/movie/${tmdbId}`,
      quality: '1080p',
      is_embed: true
    },
    {
      source_name: 'SuperEmbed (Ad-light)',
      url: `https://multiembed.to/embed.php?video_id=${tmdbId}`,
      quality: '720p',
      is_embed: true
    }
  ];
}

/**
 * Resolves standard free stream embed URLs for a TV Show Episode by TMDB ID, Season, and Episode.
 */
function resolveEpisodeEmbeds(tmdbId, season, episode) {
  return [
    {
      source_name: 'VidSrc.cc (Primary Server)',
      url: `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p',
      is_embed: true
    },
    {
      source_name: 'VidSrc.vip (Ultra Fast)',
      url: `https://vidsrc.vip/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p',
      is_embed: true
    },
    {
      source_name: 'Embed.su (Multi-host)',
      url: `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p',
      is_embed: true
    },
    {
      source_name: 'VidLink (Alternative)',
      url: `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p',
      is_embed: true
    },
    {
      source_name: '2Embed (HD Stream)',
      url: `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`,
      quality: '1080p',
      is_embed: true
    },
    {
      source_name: 'VidSrc.pro (High Speed)',
      url: `https://vidsrc.pro/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p',
      is_embed: true
    },
    {
      source_name: 'VidSrc.in (Mirror)',
      url: `https://vidsrc.in/embed/tv/${tmdbId}/${season}/${episode}`,
      quality: '1080p',
      is_embed: true
    },
    {
      source_name: 'SuperEmbed (Ad-light)',
      url: `https://multiembed.to/embed.php?video_id=${tmdbId}&s=${season}&e=${episode}`,
      quality: '720p',
      is_embed: true
    }
  ];
}

/**
 * Fetch movie streaming sources, caching them in Redis and persisting in DB8.
 */
async function getMovieSources(tmdbId) {
  const cacheKey = `cinema:sources:movie:${tmdbId}`;
  const cached = await redisService.getCached(cacheKey);
  if (cached) return cached;

  const pool = getPoolForCategory('video_sources');
  try {
    // 1. Check DB8 (Cinema Sources)
    const dbRes = await pool.query(
      `SELECT source_name, url, quality, is_embed 
       FROM video_sources 
       WHERE media_type = 'movie' AND media_id = $1`,
      [tmdbId]
    );

    let sources = dbRes.rows;

    // 2. If not in DB, resolve static embeds and save to DB
    if (sources.length === 0) {
      sources = resolveMovieEmbeds(tmdbId);
      
      // Save in background
      for (const src of sources) {
        pool.query(
          `INSERT INTO video_sources (media_type, media_id, source_name, url, quality, is_embed)
           VALUES ('movie', $1, $2, $3, $4, $5)
           ON CONFLICT (media_type, media_id, source_name) DO UPDATE 
           SET url = EXCLUDED.url, last_verified_at = NOW()`,
          [tmdbId, src.source_name, src.url, src.quality, src.is_embed]
        ).catch(dbErr => console.warn('⚠️ [MovieScraper DB Insert Fail]:', dbErr.message));
      }
    }

    await redisService.setCached(cacheKey, sources, 3600 * 12); // Cache sources for 12 hours
    return sources;
  } catch (err) {
    console.warn(`⚠️ [MovieScraper DB Query Fail] falling back to resolver:`, err.message);
    return resolveMovieEmbeds(tmdbId);
  }
}

/**
 * Fetch episode streaming sources, caching them in Redis and persisting in DB8.
 */
async function getEpisodeSources(tmdbId, season, episode) {
  const cacheKey = `cinema:sources:show:${tmdbId}:s${season}:e${episode}`;
  const cached = await redisService.getCached(cacheKey);
  if (cached) return cached;

  const pool = getPoolForCategory('video_sources');
  try {
    // Get corresponding episode entry from DB7 (if we want to map it to episode's id)
    // For simplicity, we use a composite key for video_sources: media_id is tv_show's TMDB ID, and we can key it differently
    // Or we store with a composite key. Let's make media_id a hashed representation of showId_season_episode, or store showId and look up
    // In our schema, media_id is INTEGER. Let's use TMDB ID as showId, but how do we know season & episode?
    // We can store media_id as TMDB ID, and for episodes, prepend or key by the episode_id from DB7.
    // Let's first look up the episode ID in DB7 (Cinema Shows)
    const showsPool = getPoolForCategory('episodes');
    const epRes = await showsPool.query(
      `SELECT id FROM episodes WHERE show_id = $1 AND season_number = $2 AND episode_number = $3`,
      [tmdbId, season, episode]
    );

    let episodeId = null;
    if (epRes.rows.length > 0) {
      episodeId = epRes.rows[0].id;
    }

    // Fallback if episode is not scraped/seeded yet in DB7, generate a synthetic negative ID based on season/episode
    if (!episodeId) {
      episodeId = -(tmdbId * 10000 + season * 100 + episode);
    }

    // 1. Check DB8 (Cinema Sources)
    const dbRes = await pool.query(
      `SELECT source_name, url, quality, is_embed 
       FROM video_sources 
       WHERE media_type = 'episode' AND media_id = $1`,
      [episodeId]
    );

    let sources = dbRes.rows;

    // 2. If not in DB, resolve static embeds and save to DB
    if (sources.length === 0) {
      sources = resolveEpisodeEmbeds(tmdbId, season, episode);
      
      // Save in background
      for (const src of sources) {
        pool.query(
          `INSERT INTO video_sources (media_type, media_id, source_name, url, quality, is_embed)
           VALUES ('episode', $1, $2, $3, $4, $5)
           ON CONFLICT (media_type, media_id, source_name) DO UPDATE 
           SET url = EXCLUDED.url, last_verified_at = NOW()`,
          [episodeId, src.source_name, src.url, src.quality, src.is_embed]
        ).catch(dbErr => console.warn('⚠️ [EpisodeScraper DB Insert Fail]:', dbErr.message));
      }
    }

    await redisService.setCached(cacheKey, sources, 3600 * 12); // Cache sources for 12 hours
    return sources;
  } catch (err) {
    console.warn(`⚠️ [EpisodeScraper DB Query Fail] falling back to resolver:`, err.message);
    return resolveEpisodeEmbeds(tmdbId, season, episode);
  }
}

module.exports = {
  getMovieSources,
  getEpisodeSources
};
