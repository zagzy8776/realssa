/**
 * Task 8: Manifest Edge Proxy
 * ---------------------------
 * Proxies HLS manifests (.m3u8) and media segments (.ts/.m4s/.aac/.mp4).
 *
 * Guarantees:
 *  - Rewrites Referer + Origin to the source page so hotlink protection passes.
 *  - Binary-safe: segments are streamed as Buffers (never decoded as text).
 *  - Range requests are forwarded upstream (206 Partial Content supported).
 *  - Relative URIs in manifests are rewritten to absolute proxy URLs.
 *  - Caches manifests briefly (5s) and segments longer (60s).
 *  - Emits one structured log line per upstream request.
 */

// Prefer Node's built-in fetch (Node 18+); fall back to node-fetch so this module
// also works on older runtimes. node-fetch is already a project dependency.
const fetchImpl = typeof globalThis.fetch === 'function'
  ? globalThis.fetch
  : require('node-fetch');

const MANIFEST_CACHE_MS = 5 * 1000;
const SEGMENT_CACHE_MS = 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 15000;
const MAX_CACHE_ENTRIES = 2000;

const cache = new Map();

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Base URL used when rewriting manifest URIs. Override via env.
function getProxyBaseUrl() {
  return (
    process.env.STREAM_PROXY_BASE_URL ||
    process.env.PUBLIC_BASE_URL ||
    'https://www.realssanews.com.ng'
  ).replace(/\/+$/, '');
}

function isManifest(url) {
  return /\.m3u8(?:[?#].*)?$/i.test(url);
}

function getCacheKey(url, referer, range) {
  return `${url}::${referer}::${range || ''}`;
}

function clearCacheEntry(url, referer, range) {
  cache.delete(getCacheKey(url, referer, range));
}

function evictIfNeeded() {
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  // Map preserves insertion order → oldest entries are first.
  const toDrop = cache.size - MAX_CACHE_ENTRIES;
  let dropped = 0;
  for (const key of cache.keys()) {
    cache.delete(key);
    if (++dropped >= toDrop) break;
  }
}

/**
 * Rewrite relative URIs inside an HLS manifest to absolute proxy URLs.
 * Handles: segment lines, variant playlist lines, #EXT-X-KEY:URI, #EXT-X-MAP:URI.
 */
function rewriteManifestUrls(manifestContent, baseUrl, proxyBaseUrl) {
  const proxyBase = (proxyBaseUrl || getProxyBaseUrl()).replace(/\/+$/, '');
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return manifestContent;
  }

  const toProxy = (absoluteUrl, kind) => {
    const path = kind === 'segment' ? '/api/proxy/segment' : '/api/proxy/manifest';
    return `${proxyBase}${path}?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(baseUrl)}`;
  };

  const resolve = raw => {
    try {
      return new URL(raw, base).href;
    } catch {
      return null;
    }
  };

  const lines = manifestContent.split(/\r?\n/);

  return lines
    .map(line => {
      // 1. Tagged URIs: #EXT-X-KEY:URI="...", #EXT-X-MAP:URI="...", #EXT-X-MEDIA:URI="..."
      const tagUri = line.match(/^(#EXT-X-(?:KEY|MAP|MEDIA|I-FRAME-STREAM-INF):.*URI=")([^"]+)(".*)$/);
      if (tagUri) {
        const abs = resolve(tagUri[2]);
        if (abs) return `${tagUri[1]}${toProxy(abs, 'segment')}${tagUri[3]}`;
        return line;
      }

      // 2. Non-tag lines are either segment URIs or variant playlist URIs.
      if (line && !line.startsWith('#')) {
        const abs = resolve(line.trim());
        if (!abs) return line;
        const kind = isManifest(abs) ? 'manifest' : 'segment';
        return toProxy(abs, kind);
      }

      return line;
    })
    .join('\n');
}

/**
 * Proxy a manifest or segment.
 *
 * @param {string} url        Upstream URL
 * @param {string} referer    Source page URL (used for Referer/Origin)
 * @param {boolean} isSegment Whether this is a media segment (binary) vs manifest (text)
 * @param {object} options    { range?: string, method?: string }
 * @returns {Promise<{body: Buffer|string, contentType: string, status: number,
 *                    headers: object, fromCache: boolean}>}
 */
async function proxyStream(url, referer, isSegment = false, options = {}) {
  const { range, method = 'GET' } = options;
  const cacheKey = getCacheKey(url, referer, range);
  const ttl = isSegment ? SEGMENT_CACHE_MS : MANIFEST_CACHE_MS;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ttl) {
    return {
      body: cached.body,
      contentType: cached.contentType,
      status: cached.status,
      headers: cached.headers,
      fromCache: true
    };
  }

  let origin = '';
  try {
    origin = new URL(referer).origin;
  } catch {
    origin = '';
  }

  const headers = {
    'Referer': referer,
    'User-Agent': DEFAULT_USER_AGENT,
    'Accept': isSegment ? '*/*' : 'application/vnd.apple.mpegurl, application/x-mpegURL, */*',
    'Accept-Language': 'en-US,en;q=0.9'
  };
  if (origin) headers['Origin'] = origin;
  if (range) headers['Range'] = range;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const res = await fetchImpl(url, { method, headers, signal: controller.signal });
    clearTimeout(timer);

    const upstreamType = res.headers.get('content-type') || '';
    const contentType = upstreamType ||
      (isSegment ? 'video/mp2t' : 'application/vnd.apple.mpegurl');

    const responseHeaders = {
      'Accept-Ranges': 'bytes',
      'Cache-Control': isSegment
        ? `public, max-age=${Math.floor(SEGMENT_CACHE_MS / 1000)}`
        : `public, max-age=${Math.floor(MANIFEST_CACHE_MS / 1000)}`
    };

    const contentRange = res.headers.get('content-range');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;
    const contentLength = res.headers.get('content-length');
    if (contentLength) responseHeaders['Content-Length'] = contentLength;

    let body;
    if (isSegment) {
      // Binary-safe: never decode media segments as text.
      const arrayBuffer = await res.arrayBuffer();
      body = Buffer.from(arrayBuffer);
    } else {
      const text = await res.text();
      body = text.includes('#EXTM3U')
        ? rewriteManifestUrls(text, url, getProxyBaseUrl())
        : text;
      // Content-Length changed after rewriting.
      delete responseHeaders['Content-Length'];
    }

    console.log(
      `[ManifestProxy] ${isSegment ? 'segment' : 'manifest'} ${res.status} ${url} (referer: ${referer}${range ? `, range: ${range}` : ''})`
    );

    const result = {
      body,
      contentType,
      status: res.status,
      headers: responseHeaders,
      fromCache: false
    };

    // Only cache successful responses.
    if (res.ok || res.status === 206) {
      cache.set(cacheKey, { ...result, ts: Date.now() });
      evictIfNeeded();
    }

    return result;
  } catch (err) {
    clearTimeout(timer);
    console.error(`[ManifestProxy] upstream failure ${url}: ${err.message}`);
    return {
      body: Buffer.from(`Proxy error: ${err.message}`),
      contentType: 'text/plain',
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
      fromCache: false
    };
  }
}

module.exports = {
  proxyStream,
  rewriteManifestUrls,
  clearCacheEntry,
  isManifest,
  getProxyBaseUrl,
  MANIFEST_CACHE_MS,
  SEGMENT_CACHE_MS
};
