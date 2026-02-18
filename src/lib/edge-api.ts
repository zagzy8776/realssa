/**
 * Edge-Optimized API Module
 * Designed for African/European users with parallel fetching and smart caching
 */

// Cache configuration for different data types
const CACHE_CONFIG = {
  headlines: { ttl: 60_000, staleWhileRevalidate: 180_000 }, // 1-4 minutes
  liveScores: { ttl: 30_000, staleWhileRevalidate: 60_000 }, // 30s-1 minute
  newsFeed: { ttl: 120_000, staleWhileRevalidate: 300_000 }, // 2-5 minutes
  static: { ttl: 300_000, staleWhileRevalidate: 600_000 }, // 5-10 minutes
};

// In-memory cache with stale-while-revalidate support
const cache = new Map<string, { data: unknown; timestamp: number; ttl: number; staleWhileRevalidate: number }>();

/**
 * Get data from cache with stale-while-revalidate logic
 */
function getFromCache<T>(key: string): { data: T | null; isStale: boolean; isExpired: boolean } {
  const entry = cache.get(key);
  if (!entry) return { data: null, isStale: false, isExpired: true };
  
  const now = Date.now();
  const age = now - entry.timestamp;
  const isExpired = age > entry.ttl;
  const isStale = age > entry.ttl && age < (entry.ttl + entry.staleWhileRevalidate);
  
  return { data: isExpired ? null : entry.data, isStale, isExpired };
}

/**
 * Set data in cache
 */
function setCache(key: string, data: unknown, config: typeof CACHE_CONFIG.headlines): void {
  cache.set(key, { data, timestamp: Date.now(), ttl: config.ttl, staleWhileRevalidate: config.staleWhileRevalidate });
}

/**
 * Fetch with timeout and graceful fallback
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

/**
 * Fetch from edge-optimized endpoint with caching
 */
async function fetchEdgeAPI<T>(endpoint: string, cacheKey: string, config = CACHE_CONFIG.newsFeed, timeoutMs = 3000): Promise<T> {
  const cacheResult = getFromCache<T>(cacheKey);
  
  if (cacheResult.data && !cacheResult.isExpired) {
    return cacheResult.data;
  }
  
  if (cacheResult.data && cacheResult.isStale) {
    revalidateInBackground(endpoint, cacheKey, config);
    return cacheResult.data;
  }
  
  try {
    const response = await fetchWithTimeout(endpoint, {}, timeoutMs);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const data = await response.json();
    setCache(cacheKey, data, config);
    return data;
  } catch (error) {
    if (cacheResult.data && cacheResult.isStale) {
      console.warn(`Serving stale data for ${cacheKey}`);
      return cacheResult.data;
    }
    throw error;
  }
}

/**
 * Revalidate cache in background without blocking
 */
function revalidateInBackground(endpoint: string, cacheKey: string, config: typeof CACHE_CONFIG.headlines): void {
  fetchEdgeAPI(endpoint, cacheKey, config).catch(err => console.warn(`Background revalidation failed: ${err}`));
}

/**
 * Nigerian news RSS endpoints
 */
const NIGERIAN_RSS_FEEDS = {
  punch: 'https://punchng.com/rss/',
  vanguard: 'https://www.vanguardngr.com/rss/',
};

/**
 * Fetch Nigerian headlines with edge optimization
 */
export async function fetchNigerianHeadlines(timeoutMs = 4000): Promise<unknown[]> {
  const cacheKey = 'nigerian-headlines';
  const cacheResult = getFromCache<unknown[]>(cacheKey);
  
  if (cacheResult.data && !cacheResult.isExpired) {
    return cacheResult.data;
  }
  
  const sources = [
    { name: 'Punch', url: NIGERIAN_RSS_FEEDS.punch },
    { name: 'Vanguard', url: NIGERIAN_RSS_FEEDS.vanguard },
  ];
  
  try {
    const results = await Promise.allSettled(
      sources.map(async (source) => {
        const response = await fetchWithTimeout(source.url, {}, timeoutMs);
        if (!response.ok) return { source: source.name, articles: [] };
        const text = await response.text();
        return { source: source.name, articles: parseRSSArticles(text) };
      })
    );
    
    const allArticles = results
      .filter((r): r is PromiseFulfilledResult<unknown> => r.status === 'fulfilled')
      .flatMap(r => (r.value as { articles: unknown[] }).articles.slice(0, 10));
    
    const unique = deduplicateArticles(allArticles as Array<{ title: string; [key: string]: unknown }>);
    const sorted = unique.sort((a, b) => new Date((b as { pubDate: string }).pubDate).getTime() - new Date((a as { pubDate: string }).pubDate).getTime());
    
    setCache(cacheKey, sorted, CACHE_CONFIG.headlines);
    return sorted;
  } catch (error) {
    if (cacheResult.data) return cacheResult.data;
    throw error;
  }
}

/**
 * Parse RSS articles from XML text
 */
function parseRSSArticles(xmlString: string): unknown[] {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    const items = xmlDoc.querySelectorAll('item');
    
    return Array.from(items).slice(0, 15).map(item => ({
      title: item.querySelector('title')?.textContent?.trim() || '',
      link: item.querySelector('link')?.textContent?.trim() || '',
      description: item.querySelector('description')?.textContent?.trim() || '',
      pubDate: item.querySelector('pubDate')?.textContent?.trim() || new Date().toISOString(),
      source: 'RSS',
    }));
  } catch {
    return [];
  }
}

/**
 * Deduplicate articles by title
 */
function deduplicateArticles(articles: Array<{ title: string }>): Array<{ title: string }> {
  const seen = new Set<string>();
  return articles.filter(article => {
    const title = article.title.toLowerCase().trim();
    if (seen.has(title)) return false;
    seen.add(title);
    return true;
  });
}

/**
 * Fetch live sports scores
 */
export async function fetchLiveScores(timeoutMs = 2000): Promise<unknown> {
  const cacheKey = 'live-scores';
  const cacheResult = getFromCache(cacheKey);
  
  if (cacheResult.data) {
    if (cacheResult.isStale) revalidateInBackground('/api/scores', cacheKey, CACHE_CONFIG.liveScores);
    return cacheResult.data;
  }
  
  try {
    return await fetchEdgeAPI('/api/scores', cacheKey, CACHE_CONFIG.liveScores, timeoutMs);
  } catch {
    // Return mock data if fetch fails
    return {
      matches: [
        { league: 'Premier League', home: 'Arsenal', away: 'Liverpool', score: '2-2', time: '74\'', status: 'LIVE' },
        { league: 'La Liga', home: 'Real Madrid', away: 'Barcelona', score: '1-1', time: '32\'', status: 'LIVE' },
      ],
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Fetch all content in parallel for homepage
 */
export async function fetchHomepageContent(): Promise<{ headlines: unknown[]; liveScores: unknown; featured: unknown[] }> {
  const [headlines, liveScores, featured] = await Promise.all([
    fetchNigerianHeadlines().catch(() => []),
    fetchLiveScores().catch(() => null),
    fetchEdgeAPI('/api/articles/featured', 'featured-articles', CACHE_CONFIG.newsFeed).catch(() => []),
  ]);
  
  return { headlines: headlines as unknown[], liveScores: liveScores as unknown, featured: featured as unknown[] };
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus(): Record<string, { age: string; isStale: boolean; isExpired: boolean }> {
  const status: Record<string, { age: string; isStale: boolean; isExpired: boolean }> = {};
  const now = Date.now();
  
  cache.forEach((entry, key) => {
    const age = now - entry.timestamp;
    status[key] = {
      age: `${Math.round(age / 1000)}s`,
      isStale: age > entry.ttl,
      isExpired: age > (entry.ttl + entry.staleWhileRevalidate),
    };
  });
  
  return status;
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  cache.clear();
}

export { fetchEdgeAPI, CACHE_CONFIG };
