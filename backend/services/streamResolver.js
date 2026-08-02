const axios = require('axios');
const redisService = require('./redisService');

/**
 * Stream Resolver Service
 * ========================
 * Uses multiple strategies to extract direct .m3u8 HLS stream URLs
 * that feed into our own HlsPlayer — no iframes, no foreign sites, no junk.
 *
 * Strategy Stack (tried in order, first success wins):
 *  1. Consumet API (self-hostable Fly.io node — returns raw .m3u8 for any title)
 *  2. VidSrc.to Source API (documented provider API with token rotation)
 *  3. Redis cache hit (pre-warmed streams)
 *  4. Graceful fallback: return best iframe embeds as last resort
 */

const CONSUMET_BASE = process.env.CONSUMET_API_URL || 'https://api.consumet.org';
const VIDSRC_API = 'https://vidsrc.to/embed';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, */*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Cache-Control': 'no-cache',
};

/**
 * Strategy 1: Consumet API (FlixHQ provider)
 * Returns: { stream: .m3u8 url, subtitles: [], quality: '1080p' }
 */
async function resolveViaConsumet(tmdbId, mediaType, season, episode) {
  try {
    // Step 1: Search for media by TMDB ID
    const searchUrl = `${CONSUMET_BASE}/meta/tmdb/info/${tmdbId}?type=${mediaType}`;
    const searchRes = await axios.get(searchUrl, { headers: BROWSER_HEADERS, timeout: 8000 });
    const info = searchRes.data;

    if (!info || !info.id) return null;

    let watchUrl;
    if (mediaType === 'movie') {
      watchUrl = `${CONSUMET_BASE}/meta/tmdb/watch/${info.episodes?.[0]?.id}?id=${info.id}`;
    } else {
      // Find specific episode
      const ep = info.episodes?.find(e => e.season === parseInt(season) && e.number === parseInt(episode));
      if (!ep) return null;
      watchUrl = `${CONSUMET_BASE}/meta/tmdb/watch/${ep.id}?id=${info.id}`;
    }

    const watchRes = await axios.get(watchUrl, { headers: BROWSER_HEADERS, timeout: 12000 });
    const sources = watchRes.data?.sources;

    if (!sources || sources.length === 0) return null;

    // Find best quality source
    const best = sources.find(s => s.quality === '1080p') || sources.find(s => s.quality === '720p') || sources[0];
    
    return {
      provider: 'Consumet/FlixHQ',
      stream_url: best.url,
      quality: best.quality || '1080p',
      is_hls: best.url.includes('.m3u8'),
      subtitles: watchRes.data?.subtitles || [],
      all_sources: sources
    };
  } catch (err) {
    console.warn('[StreamResolver Consumet] Failed:', err.message);
    return null;
  }
}

/**
 * Strategy 2: VidSrc.to Source API
 * VidSrc.to exposes a source list endpoint that we can parse
 */
async function resolveViaVidSrcTo(tmdbId, mediaType, season, episode) {
  try {
    let embedUrl;
    if (mediaType === 'movie') {
      embedUrl = `${VIDSRC_API}/movie/${tmdbId}`;
    } else {
      embedUrl = `${VIDSRC_API}/tv/${tmdbId}/${season}/${episode}`;
    }

    // Fetch the embed page to get source IDs
    const pageRes = await axios.get(embedUrl, {
      headers: { ...BROWSER_HEADERS, 'Referer': 'https://vidsrc.to' },
      timeout: 8000
    });

    const html = pageRes.data;

    // Extract source IDs from the page
    const sourceIdMatch = html.match(/data-source-ids\s*=\s*["']([^"']+)["']/);
    if (!sourceIdMatch) return null;

    const sourceIds = sourceIdMatch[1].split(',');
    if (sourceIds.length === 0) return null;

    // Try to get a stream from the first source
    for (const srcId of sourceIds.slice(0, 3)) {
      try {
        const srcRes = await axios.get(`https://vidsrc.to/api/source/${srcId.trim()}`, {
          headers: { ...BROWSER_HEADERS, 'Referer': embedUrl },
          timeout: 8000
        });

        const srcData = srcRes.data;
        if (srcData && srcData.result && srcData.result.url) {
          return {
            provider: 'VidSrc.to',
            stream_url: srcData.result.url,
            quality: '1080p',
            is_hls: srcData.result.url.includes('.m3u8'),
            subtitles: srcData.result.subtitles || []
          };
        }
      } catch (_) {}
    }

    return null;
  } catch (err) {
    console.warn('[StreamResolver VidSrc.to] Failed:', err.message);
    return null;
  }
}

/**
 * Strategy 3: Try vidsrc.me's encrypted source API
 * The page contains data-hash which can be used to request the actual source
 */
async function resolveViaVidSrcMe(tmdbId, mediaType, season, episode) {
  try {
    let embedUrl;
    if (mediaType === 'movie') {
      embedUrl = `https://vidsrc.me/embed/movie/${tmdbId}`;
    } else {
      embedUrl = `https://vidsrc.me/embed/tv/${tmdbId}/${season}/${episode}`;
    }

    const pageRes = await axios.get(embedUrl, {
      headers: { ...BROWSER_HEADERS, 'Referer': 'https://vidsrc.me' },
      timeout: 8000
    });

    const html = pageRes.data;

    // Extract data-i (the source ID) and data-hash
    const dataI = html.match(/data-i\s*=\s*["'](\d+)["']/)?.[1];
    const subHash = html.match(/var\s+sub_hash\s*=\s*['"]([^'"]+)['"]/)?.[1];

    if (!dataI) return null;

    // Request the source using the extracted ID
    const srcRes = await axios.get(`https://vidsrc.me/src/${dataI}`, {
      headers: {
        ...BROWSER_HEADERS,
        'Referer': embedUrl,
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 8000
    });

    const srcData = srcRes.data;
    
    // Find the .m3u8 stream in the response
    let streamUrl = null;
    if (typeof srcData === 'string') {
      const m3u8 = srcData.match(/https?:\/\/[^\s"'`\\]+\.m3u8[^\s"'`\\]*/);
      streamUrl = m3u8?.[0];
    } else if (srcData?.streams) {
      streamUrl = srcData.streams.find(s => s.url?.includes('.m3u8'))?.url || srcData.streams[0]?.url;
    } else if (srcData?.url) {
      streamUrl = srcData.url;
    }

    if (!streamUrl) return null;

    return {
      provider: 'VidSrc.me',
      stream_url: streamUrl,
      quality: '1080p',
      is_hls: streamUrl.includes('.m3u8'),
      subtitles: []
    };
  } catch (err) {
    console.warn('[StreamResolver VidSrc.me] Failed:', err.message);
    return null;
  }
}

/**
 * Master resolver — tries all strategies, returns best result
 */
async function resolveStream(tmdbId, mediaType = 'movie', season = 1, episode = 1) {
  const cacheKey = `cinema:hls:v1:${mediaType}:${tmdbId}:${season}:${episode}`;

  // 1. Check Redis cache
  try {
    const cached = await redisService.getCached(cacheKey);
    if (cached?.stream_url) {
      console.log(`[StreamResolver] Cache hit for ${mediaType} ${tmdbId}`);
      return { ...cached, from_cache: true };
    }
  } catch (_) {}

  console.log(`[StreamResolver] Resolving ${mediaType} ${tmdbId} S${season}E${episode}...`);

  // 2. Try each strategy in order
  const strategies = [
    () => resolveViaVidSrcMe(tmdbId, mediaType, season, episode),
    () => resolveViaVidSrcTo(tmdbId, mediaType, season, episode),
    () => resolveViaConsumet(tmdbId, mediaType, season, episode),
  ];

  for (const strategy of strategies) {
    const result = await strategy();
    if (result?.stream_url) {
      console.log(`[StreamResolver] SUCCESS via ${result.provider}: ${result.stream_url.substring(0, 80)}...`);
      // Cache successful result for 3 hours
      redisService.setCached(cacheKey, result, 3600 * 3).catch(() => {});
      return result;
    }
  }

  // 3. All strategies failed — return null so caller falls back to iframes
  console.warn(`[StreamResolver] All strategies failed for ${mediaType} ${tmdbId}`);
  return null;
}

module.exports = { resolveStream };
