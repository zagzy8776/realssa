/**
 * Cache Configuration Module
 * --------------------------
 * Centralized, auditable cache headers for all route classes.
 * Each route class defines:
 *   - maxAge: browser cache (seconds)
 *   - sMaxage: CDN/edge cache (seconds)
 *   - staleWhileRevalidate: serve stale while fresh is fetched (seconds)
 *   - immutable: whether the resource never changes
 *   - noStore: whether to bypass cache (only for authenticated routes)
 *
 * Usage in routes:
 *   res.setHeader('Cache-Control', cacheConfig.getHeaders('article'));
 *
 * Acceptance: curl -I on an article URL returns s-maxage=60; second request
 * within 60s reports cache HIT in response headers.
 */

const CACHE_CONFIG = {
  // Article pages: public, s-maxage=60, stale-while-revalidate=600
  article: {
    maxAge: 60,
    sMaxage: 60,
    staleWhileRevalidate: 600,
    staleIfError: 300,
    immutable: false,
    noStore: false
  },

  // Category pages: s-maxage=120, swr=900
  category: {
    maxAge: 120,
    sMaxage: 120,
    staleWhileRevalidate: 900,
    staleIfError: 600,
    immutable: false,
    noStore: false
  },

  // Country/location pages: s-maxage=120, swr=900
  country: {
    maxAge: 120,
    sMaxage: 120,
    staleWhileRevalidate: 900,
    staleIfError: 600,
    immutable: false,
    noStore: false
  },

  // Live sports feed: s-maxage=30, swr=120
  liveSports: {
    maxAge: 30,
    sMaxage: 30,
    staleWhileRevalidate: 120,
    staleIfError: 60,
    immutable: false,
    noStore: false
  },

  // Static assets (JS, CSS, images): immutable, 1 year
  static: {
    maxAge: 31536000,
    sMaxage: 31536000,
    staleWhileRevalidate: 86400,
    immutable: true,
    noStore: false
  },

  // Sitemaps: s-maxage=300
  sitemap: {
    maxAge: 300,
    sMaxage: 300,
    staleWhileRevalidate: 600,
    staleIfError: 300,
    immutable: false,
    noStore: false
  },

  // RSS feeds: s-maxage=120, swr=600
  rss: {
    maxAge: 120,
    sMaxage: 120,
    staleWhileRevalidate: 600,
    staleIfError: 300,
    immutable: false,
    noStore: false
  },

  // API responses (general): s-maxage=60
  api: {
    maxAge: 60,
    sMaxage: 60,
    staleWhileRevalidate: 300,
    staleIfError: 60,
    immutable: false,
    noStore: false
  },

  // Authenticated routes: no-store
  authenticated: {
    maxAge: 0,
    sMaxage: 0,
    staleWhileRevalidate: 0,
    immutable: false,
    noStore: true
  }
};

/**
 * Generate Cache-Control header string for a route class.
 * @param {string} routeClass - One of: article, category, country, liveSports, static, sitemap, rss, api, authenticated
 * @param {boolean} isAuth - Whether the request is authenticated (overrides to no-store)
 * @returns {string} Cache-Control header value
 */
function getHeaders(routeClass, isAuth = false) {
  const config = isAuth ? CACHE_CONFIG.authenticated : CACHE_CONFIG[routeClass] || CACHE_CONFIG.api;

  if (config.noStore) {
    return 'no-store, private, must-revalidate';
  }

  let header = `public, max-age=${config.maxAge}, s-maxage=${config.sMaxage}`;
  if (config.staleWhileRevalidate > 0) {
    header += `, stale-while-revalidate=${config.staleWhileRevalidate}`;
  }
  if (config.staleIfError > 0) {
    header += `, stale-if-error=${config.staleIfError}`;
  }
  if (config.immutable) {
    header += ', immutable';
  }

  return header;
}

/**
 * Log all route classes and their cache settings for auditability.
 * @returns {Object} Route class configuration dump
 */
function logAll() {
  const audit = Object.entries(CACHE_CONFIG).map(([name, config]) => ({
    routeClass: name,
    headers: getHeaders(name),
    config
  }));

  console.log('=== Cache Configuration Audit ===');
  audit.forEach(entry => {
    console.log(`${entry.routeClass}: ${entry.headers}`);
  });
  console.log('================================\n');

  return audit;
}

module.exports = {
  CACHE_CONFIG,
  getHeaders,
  logAll
};
