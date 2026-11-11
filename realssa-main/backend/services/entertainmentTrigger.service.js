'use strict';

/**
 * Entertainment Trigger-Response Engine
 * =====================================
 * Detects entertainment stories that are accelerating BEFORE they saturate
 * the feed, then exposes them to the newsroom as ranked signals.
 *
 * Source policy:
 *   ALLOWED - publisher RSS/Atom, Google News RSS, Google Trends RSS,
 *             Reddit public JSON, YouTube Data API (official key), X API v2
 *             recent search (official paid tier key).
 *   NOT ALLOWED - scraping X / TikTok / Instagram HTML or private endpoints.
 *             Those platforms prohibit it and actively block it. TikTok
 *             trends enter only through the official Research API after
 *             approval; Instagram has no public trend-search API.
 *
 * Dependency-free (native fetch + a small RSS reader) so it runs in the
 * Express worker and in a Vercel function without node_modules.
 */

const crypto = require('crypto');

const SCAN_INTERVAL_MS = 8 * 60 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 9000;
const MAX_ITEMS_PER_SOURCE = 20;
const MAX_TRENDS = 30;
const MAX_CLUSTER_COVERAGE = 8;

// ── Source registry ─────────────────────────────────────────────────────────

function googleNews(id, name, region, hl, gl, ceid, query) {
  const params = new URLSearchParams({ q: query, hl, gl, ceid });
  return {
    id,
    name,
    url: `https://news.google.com/rss/search?${params.toString()}`,
    region,
    tier: 'aggregator',
    weight: 0.75,
  };
}

const RSS_SOURCES = [
  // Trade press — the strongest entertainment signal.
  { id: 'variety', name: 'Variety', url: 'https://variety.com/feed/', region: 'global', tier: 'trade', weight: 1.0 },
  { id: 'deadline', name: 'Deadline', url: 'https://deadline.com/feed/', region: 'global', tier: 'trade', weight: 1.0 },
  { id: 'thr', name: 'The Hollywood Reporter', url: 'https://www.hollywoodreporter.com/feed/', region: 'global', tier: 'trade', weight: 0.95 },
  { id: 'billboard', name: 'Billboard', url: 'https://www.billboard.com/feed/', region: 'global', tier: 'trade', weight: 0.9 },
  { id: 'rollingstone', name: 'Rolling Stone', url: 'https://www.rollingstone.com/feed/', region: 'global', tier: 'trade', weight: 0.85 },

  // African entertainment — the home-market advantage.
  { id: 'vanguard-ent', name: 'Vanguard Entertainment', url: 'https://www.vanguardngr.com/category/entertainment/feed/', region: 'nigeria', tier: 'regional', weight: 0.9 },
  { id: 'premiumtimes-ent', name: 'Premium Times', url: 'https://www.premiumtimesng.com/category/entertainment/feed', region: 'nigeria', tier: 'regional', weight: 0.85 },

  // Google News — corroboration across markets, not a primary source.
  googleNews('gnews-us-ent', 'Google News US', 'usa', 'en-US', 'US', 'US:en', 'entertainment'),
  googleNews('gnews-gb-ent', 'Google News UK', 'uk', 'en-GB', 'GB', 'GB:en', 'entertainment'),
  googleNews('gnews-ng-ent', 'Google News Nigeria', 'nigeria', 'en-NG', 'NG', 'NG:en', 'entertainment'),
  googleNews('gnews-za-ent', 'Google News South Africa', 'south-africa', 'en-ZA', 'ZA', 'ZA:en', 'entertainment'),
  googleNews('gnews-ke-ent', 'Google News Kenya', 'kenya', 'en-KE', 'KE', 'KE:en', 'entertainment'),
  googleNews('gnews-gh-ent', 'Google News Ghana', 'ghana', 'en-GH', 'GH', 'GH:en', 'entertainment'),
  googleNews('gnews-nl-ent', 'Google News Netherlands', 'netherlands', 'nl', 'NL', 'NL:nl', 'amusement'),
  googleNews('gnews-de-ent', 'Google News Germany', 'germany', 'de', 'DE', 'DE:de', 'unterhaltung'),
  googleNews('gnews-fr-ent', 'Google News France', 'france', 'fr', 'FR', 'FR:fr', 'divertissement'),
  googleNews('gnews-in-ent', 'Google News India', 'india', 'en-IN', 'IN', 'IN:en', 'entertainment'),
  googleNews('gnews-br-ent', 'Google News Brazil', 'brazil', 'pt-BR', 'BR', 'BR:pt-419', 'entretenimento'),
];

const TREND_SOURCES = [
  { id: 'gtrends-us', name: 'Google Trends US', url: 'https://trends.google.com/trending/rss?geo=US', region: 'usa', tier: 'trends', weight: 1.05 },
  { id: 'gtrends-gb', name: 'Google Trends UK', url: 'https://trends.google.com/trending/rss?geo=GB', region: 'uk', tier: 'trends', weight: 1.05 },
  { id: 'gtrends-ng', name: 'Google Trends Nigeria', url: 'https://trends.google.com/trending/rss?geo=NG', region: 'nigeria', tier: 'trends', weight: 1.05 },
  { id: 'gtrends-za', name: 'Google Trends South Africa', url: 'https://trends.google.com/trending/rss?geo=ZA', region: 'south-africa', tier: 'trends', weight: 1.0 },
  { id: 'gtrends-nl', name: 'Google Trends Netherlands', url: 'https://trends.google.com/trending/rss?geo=NL', region: 'netherlands', tier: 'trends', weight: 1.0 },
  { id: 'gtrends-de', name: 'Google Trends Germany', url: 'https://trends.google.com/trending/rss?geo=DE', region: 'germany', tier: 'trends', weight: 1.0 },
  { id: 'gtrends-in', name: 'Google Trends India', url: 'https://trends.google.com/trending/rss?geo=IN', region: 'india', tier: 'trends', weight: 1.0 },
  { id: 'gtrends-br', name: 'Google Trends Brazil', url: 'https://trends.google.com/trending/rss?geo=BR', region: 'brazil', tier: 'trends', weight: 1.0 },
];

// One multireddit request instead of five — Reddit rate-limits bursts from a
// single server IP, and the combined feed keeps the same signal.
const REDDIT_MULTI = 'entertainment+movies+television+music+popculturechat';

// ── Small utilities ─────────────────────────────────────────────────────────

function clean(value, max = 600) {
  return String(value || '')
    .replace(/<!\[CDATA\[/gi, '')
    .replace(/\]\]>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#8216;|&#8217;/gi, "'")
    .replace(/&#8220;|&#8221;/gi, '"')
    .replace(/&#8211;/gi, '–')
    .replace(/&#8212;/gi, '—')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function stripHtml(value, max = 1200) {
  const decoded = String(value || '')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

  return clean(
    decoded
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' '),
    max
  );
}

function absoluteUrl(value, base) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw, base || undefined);
    return /^https?:$/i.test(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pickTag(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  return block.match(re)?.[1] || '';
}

function pickAttrLink(block) {
  return (
    block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ||
    block.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i)?.[1] ||
    ''
  );
}

function pickImage(block) {
  return (
    block.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1] ||
    block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1] ||
    block.match(/<enclosure[^>]+url=["']([^"']+)["']/i)?.[1] ||
    block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ||
    ''
  );
}

function stableId(value) {
  return 'et-' + crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 14);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// ── Feed readers ────────────────────────────────────────────────────────────

function parseRss(xml, source) {
  const items = [];
  const blocks = [...String(xml || '').matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];

  for (const match of blocks.slice(0, MAX_ITEMS_PER_SOURCE)) {
    const block = match[2];
    const publisher = clean(pickTag(block, 'source'), 120);
    let title = clean(pickTag(block, 'title'), 320);
    if (publisher && title.toLowerCase().endsWith(` - ${publisher.toLowerCase()}`)) {
      title = title.slice(0, title.length - publisher.length - 3).trim();
    }
    if (!title) continue;

    const link = absoluteUrl(clean(pickAttrLink(block), 800), source.url);
    const description =
      pickTag(block, 'content:encoded') ||
      pickTag(block, 'description') ||
      pickTag(block, 'summary') ||
      pickTag(block, 'content');
    const published =
      pickTag(block, 'pubDate') ||
      pickTag(block, 'published') ||
      pickTag(block, 'updated') ||
      pickTag(block, 'dc:date');

    items.push({
      title,
      snippet: stripHtml(description, 700),
      url: link || source.url,
      publishedAt: (parseDate(clean(published, 120)) || new Date()).toISOString(),
      image: absoluteUrl(clean(pickImage(block), 800), source.url),
      source: publisher || source.name,
      sourceId: source.id,
      sourceName: source.name,
      region: source.region,
      tier: source.tier,
      weight: source.weight,
      metrics: { points: 0, comments: 0, views: 0 },
    });
  }

  return items;
}

function parseTraffic(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

function parseTrendsRss(xml, source) {
  const items = [];
  const blocks = [...String(xml || '').matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];

  for (const match of blocks.slice(0, MAX_ITEMS_PER_SOURCE)) {
    const block = match[2];
    const title = clean(pickTag(block, 'title'), 260);
    if (!title) continue;

    const newsBlocks = [...block.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/gi)];
    const firstNews = newsBlocks[0]?.[1] || '';
    const newsTitle = clean(pickTag(firstNews, 'ht:news_item_title'), 320);
    const newsUrl = clean(pickTag(firstNews, 'ht:news_item_url'), 800);
    const newsSnippet = clean(pickTag(firstNews, 'ht:news_item_snippet'), 500);
    const newsSource = clean(pickTag(firstNews, 'ht:news_item_source'), 120);
    const traffic = parseTraffic(pickTag(block, 'ht:approx_traffic'));
    const published = pickTag(block, 'pubDate') || pickTag(block, 'published');

    items.push({
      title,
      snippet: newsSnippet || `Trending in ${source.region.replace(/-/g, ' ')}`,
      url:
        absoluteUrl(newsUrl, source.url) ||
        `https://trends.google.com/trends/explore?geo=${source.region}&q=${encodeURIComponent(title)}`,
      publishedAt: (parseDate(clean(published, 120)) || new Date()).toISOString(),
      image:
        absoluteUrl(clean(pickTag(block, 'ht:picture'), 800), source.url) ||
        absoluteUrl(clean(pickTag(firstNews, 'ht:news_item_picture'), 800), source.url) ||
        '',
      source: newsSource || source.name,
      sourceId: source.id,
      sourceName: source.name,
      region: source.region,
      tier: source.tier,
      weight: source.weight,
      metrics: { points: traffic, comments: 0, views: 0 },
      trendTitle: title,
      newsTitle,
    });
  }

  return items;
}

// ── Network layer ───────────────────────────────────────────────────────────

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (compatible; RealSSA-EntertainmentEngine/1.0; +https://www.realssanews.com.ng)',
  Accept: 'application/rss+xml, application/xml, application/json, text/xml, */*',
};

async function fetchText(url, headers = {}) {
  const response = await fetch(url, {
    headers: { ...REQUEST_HEADERS, ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function fetchJson(url, headers = {}) {
  const text = await fetchText(url, headers);
  return JSON.parse(text);
}

async function readRssSource(source) {
  const xml = await fetchText(source.url);
  const items = source.tier === 'trends' ? parseTrendsRss(xml, source) : parseRss(xml, source);
  return { source, items };
}

async function readReddit() {
  const source = {
    id: 'reddit-entertainment',
    name: 'Reddit Entertainment',
    url: `https://www.reddit.com/r/${REDDIT_MULTI}/hot/.rss`,
    region: 'global',
    tier: 'social',
    weight: 0.9,
  };

  // Reddit blocks its JSON endpoints for unauthenticated server traffic, but
  // the public Atom feed remains available. No credentials are stored.
  const xml = await fetchText(source.url, {
    Accept: 'application/atom+xml, application/xml, text/xml',
  });

  const items = parseRss(xml, source).map((item) => ({
    ...item,
    source: 'Reddit',
    sourceName: 'Reddit Entertainment',
    tier: 'social',
    weight: source.weight,
  }));

  return { source, items };
}

async function readYouTube() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { source: { id: 'youtube', name: 'YouTube' }, items: [], skipped: 'no_key' };

  const regions = String(process.env.YOUTUBE_TREND_REGIONS || 'US,NG,GB,ZA')
    .split(',')
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 5);

  const results = await Promise.allSettled(
    regions.map(async (region) => {
      const params = new URLSearchParams({
        part: 'snippet,statistics',
        chart: 'mostPopular',
        regionCode: region,
        videoCategoryId: '24',
        maxResults: '15',
        key,
      });
      const data = await fetchJson(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
      return (data?.items || []).map((video) => ({
        title: clean(video.snippet?.title, 320),
        snippet: clean(video.snippet?.description, 500),
        url: `https://www.youtube.com/watch?v=${video.id}`,
        publishedAt: parseDate(video.snippet?.publishedAt)?.toISOString() || new Date().toISOString(),
        image: video.snippet?.thumbnails?.high?.url || video.snippet?.thumbnails?.default?.url || '',
        source: `YouTube · ${region}`,
        sourceId: `youtube-${region}`,
        sourceName: 'YouTube',
        region: region.toLowerCase(),
        tier: 'video',
        weight: 0.95,
        metrics: {
          points: Number(video.statistics?.likeCount) || 0,
          comments: Number(video.statistics?.commentCount) || 0,
          views: Number(video.statistics?.viewCount) || 0,
        },
      }));
    })
  );

  return {
    source: { id: 'youtube', name: 'YouTube' },
    items: results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
  };
}

async function readX() {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return { source: { id: 'x', name: 'X/Twitter' }, items: [], skipped: 'no_key' };

  const query = encodeURIComponent(
    '(movie OR film OR album OR tour OR celebrity OR trailer OR series) -is:retweet lang:en'
  );
  const data = await fetchJson(
    `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=25&tweet.fields=created_at,public_metrics`,
    { Authorization: `Bearer ${token}` }
  );

  const items = (data?.data || []).map((tweet) => {
    const m = tweet.public_metrics || {};
    return {
      title: clean(tweet.text, 240),
      snippet: clean(tweet.text, 400),
      url: `https://x.com/i/web/status/${tweet.id}`,
      publishedAt: parseDate(tweet.created_at)?.toISOString() || new Date().toISOString(),
      image: '',
      source: 'X/Twitter',
      sourceId: 'x',
      sourceName: 'X/Twitter',
      region: 'global',
      tier: 'social',
      weight: 0.95,
      metrics: {
        points: (Number(m.like_count) || 0) + (Number(m.retweet_count) || 0) * 2,
        comments: Number(m.reply_count) || 0,
        views: Number(m.impression_count) || 0,
      },
    };
  });

  return { source: { id: 'x', name: 'X/Twitter' }, items };
}

// ── Relevance, clustering, scoring ──────────────────────────────────────────

const STOP_WORDS = new Set(
  (
    'a an and are as at be been but by can could did do does for from had has have he her here hers ' +
    'him his how i if in into is it its just like may me more most my no not now of on once only or ' +
    'other our out over own same she should so some such than that the their them then there these ' +
    'they this those through to too under until up very was we were what when where which while who ' +
    'whom why will with would you your'
  ).split(' ')
);

const GENERIC_TOKENS = new Set(
  (
    'entertainment news report reports says said new video watch photos photo exclusive update updates ' +
    'breaking live today latest first after before amid ahead behind gets get got make makes made ' +
    'reveals reveal revealed announces announce announced confirms confirmed talks talk star stars ' +
    'celebrity celebrities hollywood world global'
  ).split(' ')
);

const ENTERTAINMENT_SIGNALS = [
  'movie', 'film', 'tv series', 'limited series', 'episode', 'trailer', 'teaser', 'casting',
  'actor', 'actress', 'director', 'producer', 'studio', 'box office', 'netflix', 'disney',
  'marvel', 'hbo', 'hulu', 'prime video', 'apple tv', 'paramount', 'warner', 'sony', 'oscar',
  'academy award', 'grammy', 'emmy', 'golden globe', 'bafta', 'album', 'song', 'tour',
  'concert', 'festival', 'music', 'singer', 'rapper', 'record label', 'billboard', 'spotify',
  'apple music', 'afrobeats', 'amapiano', 'nollywood', 'bollywood', 'k-pop', 'celebrity',
  'red carpet', 'premiere', 'fashion', 'met gala', 'reality tv', 'tv show', 'sitcom',
  'documentary',
];

const NON_ENTERTAINMENT_SIGNALS = [
  'election', 'senate', 'governor', 'president', 'minister', 'parliament', 'court', 'lawsuit',
  'police', 'arrest', 'murder', 'killed', 'war', 'military', 'inflation', 'stock market', 'crypto',
  'interest rate', 'weather', 'earthquake', 'flood', 'vaccine', 'hospital',
];

// A trend headline must contain one of these, or clear up in at least two
// weaker signals. This keeps football fixtures and political searches out of
// the entertainment queue even when a related article mentions a concert.
const STRONG_TITLE_SIGNALS = [
  'movie', 'film', 'album', 'song', 'tour', 'concert', 'trailer', 'netflix', 'tv series',
  'limited series', 'episode', 'actor', 'actress', 'director', 'music', 'grammy', 'oscar',
  'emmy', 'billboard', 'nollywood', 'afrobeats', 'celebrity', 'premiere', 'festival',
  'box office', 'casting', 'sitcom', 'documentary',
];

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  const tokens = new Set();
  for (const token of normalizeText(value).split(' ')) {
    if (token.length < 3) continue;
    if (STOP_WORDS.has(token) || GENERIC_TOKENS.has(token)) continue;
    tokens.add(token);
  }
  return tokens;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function hasSignal(haystack, signal) {
  const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(haystack);
}

function isEntertainmentSignal({ title, snippet, source, newsTitle }) {
  const titleHaystack = normalizeText(`${title} ${newsTitle}`);
  const haystack = normalizeText(`${title} ${snippet} ${source} ${newsTitle}`);

  const strong = STRONG_TITLE_SIGNALS.filter((signal) => hasSignal(titleHaystack, signal)).length;
  if (strong > 0) return true;

  const positive = ENTERTAINMENT_SIGNALS.filter((signal) => hasSignal(haystack, signal)).length;
  const negative = NON_ENTERTAINMENT_SIGNALS.filter((signal) => hasSignal(haystack, signal)).length;
  return positive >= 2 && negative === 0;
}

function clusterKey(cluster) {
  const representative = [...cluster.items].sort(
    (a, b) => (b.weight || 0) - (a.weight || 0) || (b.snippet || '').length - (a.snippet || '').length
  )[0];
  return [
    ...tokenize(`${representative?.title || ''} ${representative?.newsTitle || ''}`),
  ]
    .sort()
    .slice(0, 6)
    .join(' ');
}

function clusterItems(items) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    if (!item?.title) continue;
    const urlKey = String(item.url || '').split('#')[0];
    const titleKey = normalizeText(item.title).slice(0, 140);
    if ((urlKey && seen.has(urlKey)) || (titleKey && seen.has(titleKey))) continue;
    if (urlKey) seen.add(urlKey);
    if (titleKey) seen.add(titleKey);

    const tokens = tokenize(
      `${item.title} ${item.newsTitle || ''} ${item.trendTitle || ''}`
    );
    if (!tokens.size) continue;
    unique.push({ ...item, tokens });
  }

  const clusters = [];
  for (const item of unique) {
    let best = null;
    let bestScore = 0;
    for (const cluster of clusters) {
      const score = jaccard(item.tokens, cluster.tokens);
      if (score > bestScore) {
        bestScore = score;
        best = cluster;
      }
    }

    if (best && bestScore >= 0.42) {
      best.items.push(item);
      for (const token of item.tokens) best.tokens.add(token);
      if (best.tokens.size > 40) best.tokens = new Set([...best.tokens].slice(0, 40));
    } else {
      clusters.push({ items: [item], tokens: new Set(item.tokens) });
    }
  }

  return clusters;
}

function topKeywords(items, limit = 6) {
  const counts = new Map();
  for (const item of items) {
    for (const token of tokenize(
      `${item.title} ${item.newsTitle || ''} ${item.trendTitle || ''}`
    )) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([keyword]) => keyword);
}

function pickRepresentative(items) {
  return [...items].sort((a, b) => {
    const weightDelta = (b.weight || 0) - (a.weight || 0);
    if (weightDelta) return weightDelta;
    return (b.snippet || '').length - (a.snippet || '').length;
  })[0];
}

function buildTrend(cluster, now, previous) {
  const items = cluster.items;
  const representative = pickRepresentative(items);
  const sources = [...new Set(items.map((item) => item.sourceName || item.source))];
  const sourceIds = [...new Set(items.map((item) => item.sourceId))];

  const times = items.map((item) => Date.parse(item.publishedAt)).filter(Number.isFinite);
  const newest = times.length ? Math.max(...times) : now;
  const oldest = times.length ? Math.min(...times) : now;
  const ageHours = Math.max(0, (now - newest) / 3_600_000);

  const recency = Math.exp(-ageHours / 10);
  const engagementRaw = items.reduce((sum, item) => {
    const metrics = item.metrics || {};
    return sum + Math.log1p((metrics.points || 0) + (metrics.comments || 0) * 2 + (metrics.views || 0) / 100);
  }, 0);
  const engagement = Math.min(1, engagementRaw / Math.log1p(20_000));
  const corroboration = Math.min(1, Math.max(0, sourceIds.length - 1) / 4);

  const key = clusterKey(cluster);
  const previousState = previous.get(key);
  const addedMentions = previousState ? Math.max(0, items.length - previousState.items) : 0;
  const elapsedHours = previousState ? Math.max(0.25, (now - previousState.at) / 3_600_000) : 0;
  const velocity = elapsedHours ? addedMentions / elapsedHours : 0;
  const velocityNorm = Math.min(1, velocity / 4);

  const heat = Math.max(
    1,
    Math.round(
      100 * (0.38 * recency + 0.24 * engagement + 0.22 * corroboration + 0.16 * velocityNorm)
    )
  );

  const longestSnippet = [...items]
    .sort((a, b) => (b.snippet || '').length - (a.snippet || '').length)[0]?.snippet || '';

  // Google Trends returns a search phrase, which is often a venue or a name.
  // The related news headline is more useful to an editor when it is longer.
  const trendPhrase = clean(representative.trendTitle || '', 240);
  const relatedHeadline = clean(representative.newsTitle || '', 240);
  const title =
    (trendPhrase && relatedHeadline.length > trendPhrase.length + 12
      ? relatedHeadline
      : trendPhrase) ||
    clean(representative.title, 240);
  const snippet = clean(longestSnippet, 500);
  const regionCounts = new Map();
  for (const item of items) regionCounts.set(item.region, (regionCounts.get(item.region) || 0) + 1);
  const region = [...regionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'global';

  const coverage = [...items]
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))
    .slice(0, MAX_CLUSTER_COVERAGE)
    .map((item) => ({
      source: item.sourceName || item.source,
      title: item.title,
      url: item.url,
      publishedAt: item.publishedAt,
      tier: item.tier,
    }));

  const whyHot = [];
  if (sourceIds.length >= 2) {
    whyHot.push(`${sourceIds.length} independent sources are covering this`);
  } else {
    whyHot.push('Early single-source signal');
  }
  if (ageHours < 2) whyHot.push('Published in the last 2 hours');
  else if (ageHours < 6) whyHot.push(`Newest item is ${Math.round(ageHours)}h old`);
  if (velocity > 0) whyHot.push(`Accelerating at +${velocity.toFixed(1)} mentions/hour`);
  if (engagement >= 0.5) {
    whyHot.push(
      representative.tier === 'trends'
        ? 'High search volume in the last day'
        : 'High social engagement on the source posts'
    );
  }

  return {
    id: stableId(key || title),
    clusterKey: key,
    title,
    snippet,
    image: items.find((item) => item.image)?.image || '',
    heat,
    region,
    mentions: items.length,
    sourceCount: sourceIds.length,
    sources,
    coverage,
    keywords: topKeywords(items),
    publishedAt: new Date(newest).toISOString(),
    firstSeenAt: new Date(oldest).toISOString(),
    lastSeenAt: new Date(newest).toISOString(),
    velocity: Math.round(velocity * 100) / 100,
    signals: {
      recency: Math.round(recency * 100) / 100,
      engagement: Math.round(engagement * 100) / 100,
      corroboration: sourceIds.length,
      velocity: Math.round(velocity * 100) / 100,
    },
    whyHot,
    searchUrl: `/search?q=${encodeURIComponent(title)}`,
    tier: representative.tier,
  };
}

// ── Orchestration ───────────────────────────────────────────────────────────

async function collectAll() {
  const tasks = [
    ...RSS_SOURCES.map((source) => ({ label: source.name, run: () => readRssSource(source) })),
    ...TREND_SOURCES.map((source) => ({ label: source.name, run: () => readRssSource(source) })),
    { label: 'Reddit', run: readReddit },
    { label: 'YouTube', run: readYouTube },
    { label: 'X/Twitter', run: readX },
  ];

  const results = await Promise.allSettled(tasks.map((task) => task.run()));
  const items = [];
  const stats = {
    sourcesOk: 0,
    sourcesFailed: 0,
    sourcesSkipped: 0,
    failed: [],
    skipped: [],
  };

  results.forEach((result, index) => {
    const label = tasks[index].label;
    if (result.status === 'rejected') {
      stats.sourcesFailed += 1;
      stats.failed.push({ source: label, error: result.reason?.message || String(result.reason) });
      return;
    }

    const payload = result.value || {};
    if (payload.skipped) {
      stats.sourcesSkipped += 1;
      stats.skipped.push({ source: label, reason: payload.skipped });
    }

    if (payload.items?.length) {
      stats.sourcesOk += 1;
      items.push(...payload.items);
    } else if (!payload.skipped) {
      stats.sourcesFailed += 1;
      stats.failed.push({ source: label, error: 'no items' });
    }
  });

  return { items, stats };
}

function keepItem(item, now) {
  if (!item?.title || item.title.length < 15) return false;
  if (!item.url || !/^https?:\/\//i.test(item.url)) return false;

  const published = Date.parse(item.publishedAt);
  if (Number.isFinite(published) && published > now + 6 * 3_600_000) return false;

  // Google Trends is noisy. Only keep entertainment-shaped trends.
  if (item.tier === 'trends') {
    return isEntertainmentSignal({
      title: item.trendTitle || item.title,
      snippet: item.snippet,
      source: item.source,
      newsTitle: item.newsTitle,
    });
  }

  return true;
}

async function persistTrends(trends) {
  if (process.env.ENTERTAINMENT_TRENDS_PERSIST !== '1') {
    return { persisted: 0, skipped: 'disabled' };
  }

  try {
    const { pgRun } = require('./pg');

    await pgRun(`
      CREATE TABLE IF NOT EXISTS entertainment_trends (
        id SERIAL PRIMARY KEY,
        trend_key TEXT UNIQUE NOT NULL,
        title TEXT,
        snippet TEXT,
        heat DOUBLE PRECISION DEFAULT 0,
        velocity DOUBLE PRECISION DEFAULT 0,
        mentions INTEGER DEFAULT 0,
        source_count INTEGER DEFAULT 0,
        region TEXT,
        keywords JSONB,
        coverage JSONB,
        first_seen_at TIMESTAMPTZ,
        last_seen_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    let persisted = 0;
    for (const trend of trends) {
      await pgRun(
        `INSERT INTO entertainment_trends
           (trend_key, title, snippet, heat, velocity, mentions, source_count, region, keywords, coverage, first_seen_at, last_seen_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,NOW())
         ON CONFLICT (trend_key) DO UPDATE SET
           title = EXCLUDED.title,
           snippet = EXCLUDED.snippet,
           heat = EXCLUDED.heat,
           velocity = EXCLUDED.velocity,
           mentions = EXCLUDED.mentions,
           source_count = EXCLUDED.source_count,
           region = EXCLUDED.region,
           keywords = EXCLUDED.keywords,
           coverage = EXCLUDED.coverage,
           last_seen_at = EXCLUDED.last_seen_at,
           updated_at = NOW()`,
        [
          trend.clusterKey || trend.id,
          trend.title,
          trend.snippet,
          trend.heat,
          trend.velocity,
          trend.mentions,
          trend.sourceCount,
          trend.region,
          JSON.stringify(trend.keywords || []),
          JSON.stringify(trend.coverage || []),
          trend.firstSeenAt,
          trend.lastSeenAt,
        ]
      );
      persisted += 1;
    }

    return { persisted };
  } catch (error) {
    return { persisted: 0, error: error.message };
  }
}

let lastSnapshot = { trends: [], scannedAt: null, stats: null };
let inflight = null;

async function scan({ persist = false, reason = 'manual' } = {}) {
  if (inflight) return inflight;

  inflight = (async () => {
    const startedAt = Date.now();
    const previous = new Map(
      (lastSnapshot.trends || []).map((trend) => [
        trend.clusterKey,
        { items: trend.mentions, at: Date.parse(lastSnapshot.scannedAt) || startedAt },
      ])
    );

    const { items, stats } = await collectAll();
    const filtered = items.filter((item) => keepItem(item, startedAt));
    const clusters = clusterItems(filtered);

    const trends = clusters
      .map((cluster) => buildTrend(cluster, startedAt, previous))
      .filter((trend) => trend.heat >= 5)
      .sort((a, b) => b.heat - a.heat)
      .slice(0, MAX_TRENDS);

    const persistence = persist ? await persistTrends(trends) : { persisted: 0, skipped: 'request' };

    lastSnapshot = {
      trends,
      scannedAt: new Date(startedAt).toISOString(),
      stats: {
        ...stats,
        itemsCollected: filtered.length,
        itemsDropped: items.length - filtered.length,
        clusters: clusters.length,
        durationMs: Date.now() - startedAt,
        reason,
        persistence,
      },
    };

    return lastSnapshot;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

async function ensureFresh({ maxAgeMs = CACHE_TTL_MS } = {}) {
  const age = lastSnapshot.scannedAt ? Date.now() - Date.parse(lastSnapshot.scannedAt) : Infinity;
  if (lastSnapshot.trends.length && age < maxAgeMs) return lastSnapshot;
  return scan({ persist: false, reason: 'cache_miss' });
}

function getSnapshot() {
  return {
    trends: lastSnapshot.trends || [],
    scannedAt: lastSnapshot.scannedAt,
    stats: lastSnapshot.stats,
  };
}

function getTrend(id) {
  return (lastSnapshot.trends || []).find((trend) => trend.id === id || trend.clusterKey === id) || null;
}

function getTrends({ limit = 12, region = '', minHeat = 0, includeCoverage = false } = {}) {
  let trends = lastSnapshot.trends || [];
  if (region && region !== 'global') trends = trends.filter((trend) => trend.region === region);
  if (minHeat > 0) trends = trends.filter((trend) => trend.heat >= minHeat);

  return {
    scannedAt: lastSnapshot.scannedAt,
    stats: lastSnapshot.stats,
    trends: trends.slice(0, clamp(Number(limit) || 12, 1, MAX_TRENDS)).map((trend) => {
      if (includeCoverage) return trend;
      const publicTrend = { ...trend };
      delete publicTrend.coverage;
      delete publicTrend.sources;
      return publicTrend;
    }),
  };
}

let timer = null;

function start() {
  if (timer) return;
  if (process.env.ENTERTAINMENT_TRIGGER_ENABLED === '0') {
    console.log('[EntertainmentTrigger] disabled (ENTERTAINMENT_TRIGGER_ENABLED=0)');
    return;
  }

  scan({ persist: process.env.ENTERTAINMENT_TRENDS_PERSIST === '1', reason: 'startup' }).catch(() => {});
  timer = setInterval(() => {
    scan({ persist: process.env.ENTERTAINMENT_TRENDS_PERSIST === '1', reason: 'interval' }).catch(() => {});
  }, SCAN_INTERVAL_MS);
  if (timer.unref) timer.unref();

  console.log(`[EntertainmentTrigger] started (scan every ${SCAN_INTERVAL_MS / 60_000} min)`);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

const sourcePolicy = {
  allowed: [
    'publisher RSS/Atom feeds',
    'Google News RSS',
    'Google Trends daily RSS',
    'Reddit public JSON',
    'YouTube Data API v3 (official key)',
    'X API v2 recent search (official paid tier key)',
  ],
  notAllowed: [
    'scraping X / TikTok / Instagram HTML or private endpoints',
    'TikTok trends without Research API approval',
    'Instagram trend search (no public API)',
  ],
};

module.exports = {
  scan,
  ensureFresh,
  getSnapshot,
  getTrend,
  getTrends,
  start,
  stop,
  sourcePolicy,
  _internals: {
    parseRss,
    parseTrendsRss,
    clusterItems,
    buildTrend,
    tokenize,
    isEntertainmentSignal,
    keepItem,
    stableId,
  },
};
