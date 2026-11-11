/*
 * RealSSA home feed — resilient homepage read path.
 *
 * Security layer (see api/security.js):
 *   - Opaque cursors: base64url(AES-GCM) + HMAC, 2h TTL. No date enumeration.
 *   - Field stripping: no source_url, no author, no source, no scores.
 *   - Server-side ranking: recency-decayed, not raw published_at.
 *   - Ingest jitter: 0-240s per feed so cadence is not a clean 30s interval.
 *   - Simhash dedup: 64-bit, hamming <= 3, on ingest.
 *   - Canary watermarking: deterministic synthetic variants per ASN /24.
 *   - Poison for bots: stale + reordered feed for known scrapers.
 *   - Fingerprint rate limiting: hash(ja3 + ua + accept-lang + asn).
 *
 * Internal exports (getHomeArticles, findHomeArticleById) return FULL data
 * for server-side use (article page, featured). Public handler strips.
 */

const crypto = require('crypto');
const security = require('./security');

// ── Feed sources ──────────────────────────────────────────────────────────
const FEEDS = {
  'nigerian-news': [
    'https://www.premiumtimesng.com/rss.xml',
    'https://www.vanguardngr.com/feed/',
    'https://guardian.ng/feed/'
  ],
  politics: [
    'https://www.vanguardngr.com/category/politics/feed/',
    'https://www.premiumtimesng.com/category/news/politics/feed',
    'https://news.google.com/rss/search?q=Nigeria%20politics&hl=en-NG&gl=NG&ceid=NG%3Aen'
  ],
  world: [
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://www.theguardian.com/world/rss'
  ],
  africa: [
    'https://feeds.bbci.co.uk/news/world/africa/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml'
  ],
  ghana: [
    'https://www.graphic.com.gh/rss.xml',
    'https://www.myjoyonline.com/feed/'
  ],
  kenya: [
    'https://www.nation.co.ke/rss.xml',
    'https://www.standardmedia.co.ke/rss/kenya.php'
  ],
  'south-africa': [
    'https://www.news24.com/rss.xml',
    'https://www.timeslive.co.za/rss.xml'
  ],
  uk: [
    'http://feeds.bbci.co.uk/news/uk/rss.xml',
    'https://www.theguardian.com/uk/rss'
  ],
  usa: [
    'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml'
  ],
  canada: [
    'https://www.cbc.ca/cmlink/rss-topstories',
    'https://globalnews.ca/feed/'
  ],
  australia: [
    'https://www.abc.net.au/news/feed/51120/rss.xml',
    'https://www.theguardian.com/australia-news/rss'
  ],
  india: [
    'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
    'https://www.thehindu.com/news/national/feeder/default.rss'
  ],
  china: [
    'https://www.scmp.com/rss/91/feed',
    'https://news.google.com/rss/search?q=China%20news&hl=en&gl=US&ceid=US%3Aen'
  ],
  japan: [
    'https://www.japantimes.co.jp/feed/',
    'https://news.google.com/rss/search?q=Japan%20news&hl=en&gl=JP&ceid=JP%3Aen'
  ],
  sports: [
    'https://www.completesports.com/feed',
    'https://soccernet.ng/feed',
    'https://feeds.bbci.co.uk/sport/rss.xml'
  ],
  business: [
    'https://www.cnbc.com/id/10001147/device/rss/rss.html',
    'https://feeds.bbci.co.uk/news/business/rss.xml',
    'https://howwemadeitinafrica.com/feed'
  ],
  tech: [
    'https://techcabal.com/feed',
    'https://techpoint.africa/feed',
    'https://techcrunch.com/feed/'
  ],
  crypto: [
    'https://cointelegraph.com/rss',
    'https://decrypt.co/feed'
  ],
  entertainment: [
    'https://variety.com/feed/',
    'https://deadline.com/feed/',
    'https://www.hollywoodreporter.com/feed/'
  ],
  culture: [
    'https://www.bellanaija.com/feed',
    'https://okayafrica.com/feed/',
    'https://musicinafrica.net/feed'
  ],
  lifestyle: [
    'https://www.theguardian.com/fashion/rss',
    'https://skift.com/feed/',
    'https://www.eater.com/rss/index.xml'
  ],
  science: [
    'https://www.nature.com/nature.rss',
    'https://www.sciencenews.org/feed',
    'https://www.sciencedaily.com/rss/all.xml'
  ],
  health: [
    'https://feeds.bbci.co.uk/news/health/rss.xml',
    'https://www.theguardian.com/society/health/rss'
  ],
  jobs: [
    'https://weworkremotely.com/remote-jobs.rss',
    'https://reliefweb.int/jobs/rss.xml'
  ],
  netherlands: [
    'https://www.dutchnews.nl/feed/',
    'https://nltimes.nl/rss.xml',
    'https://feeds.nos.nl/nosnieuwsalgemeen',
    'https://www.telegraaf.com/rss',
    'https://www.nu.nl/rss',
    'https://www.rtl.nl/rss',
    'https://www.ad.nl/rss',
    'https://www.parool.nl/rss',
    'https://www.volkskrant.nl/rss',
    'https://www.deredactie.be/rss',
    'https://www.hln.be/rss',
    'https://www.standaard.be/rss',
    'https://www.lacourrier.be/rss',
    'https://www.lesoir.be/rss',
    'https://www.sudinfo.be/rss',
    'https://www.7sur7.be/rss',
    'https://www.vrt.be/vrtnieuws/rss',
    'https://www.belga.com/rss',
    'https://www.euronews.com/rss',
    'https://news.google.com/rss/search?q=Netherlands%20news&hl=en-NL&gl=NL&ceid=NL%3Aen'
  ],
  germany: [
    'https://news.google.com/rss/search?q=Germany%20news&hl=en-DE&gl=DE&ceid=DE%3Aen'
  ],
  france: [
    'https://www.france24.com/en/france/rss',
    'https://news.google.com/rss/search?q=France%20news&hl=en-FR&gl=FR&ceid=FR%3Aen'
  ],
  spain: [
    'https://news.google.com/rss/search?q=Spain%20news&hl=en-ES&gl=ES&ceid=ES%3Aen'
  ],
  italy: [
    'https://news.google.com/rss/search?q=Italy%20news&hl=en-IT&gl=IT&ceid=IT%3Aen'
  ],
  belgium: [
    'https://news.google.com/rss/search?q=Belgium%20news&hl=en-BE&gl=BE&ceid=BE%3Aen'
  ],
  ireland: [
    'https://news.google.com/rss/search?q=Ireland%20news&hl=en-IE&gl=IE&ceid=IE%3Aen'
  ],
  sweden: [
    'https://news.google.com/rss/search?q=Sweden%20news&hl=en-SE&gl=SE&ceid=SE%3Aen'
  ],
  switzerland: [
    'https://news.google.com/rss/search?q=Switzerland%20news&hl=en-CH&gl=CH&ceid=CH%3Aen'
  ],
  portugal: [
    'https://news.google.com/rss/search?q=Portugal%20news&hl=en-PT&gl=PT&ceid=PT%3Aen'
  ],
  poland: [
    'https://news.google.com/rss/search?q=Poland%20news&hl=en-PL&gl=PL&ceid=PL%3Aen'
  ],
  austria: [
    'https://news.google.com/rss/search?q=Austria%20news&hl=en-AT&gl=AT&ceid=AT%3Aen'
  ],
  denmark: [
    'https://news.google.com/rss/search?q=Denmark%20news&hl=en-DK&gl=DK&ceid=DK%3Aen'
  ],
  norway: [
    'https://news.google.com/rss/search?q=Norway%20news&hl=en-NO&gl=NO&ceid=NO%3Aen'
  ],
  finland: [
    'https://news.google.com/rss/search?q=Finland%20news&hl=en-FI&gl=FI&ceid=FI%3Aen'
  ]
};

const BLOCKED_HOSTS = new Set(['espn.com', 'skysports.com', 'dailymaverick.co.za', 'edition.cnn.com', 'punchng.com']);
const cache = { articles: [], timestamp: 0, promise: null };
const CACHE_TTL = 45 * 1000;
const MAX_ARTICLE_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const FEED_TIMEOUT = 5000;

// ── Ingest jitter: 0-240s per feed so cadence isn't a clean */30 ─────────
const feedJitter = new Map();
function getFeedJitter(url) {
  if (!feedJitter.has(url)) {
    feedJitter.set(url, Math.floor(Math.random() * 240000));
  }
  return feedJitter.get(url);
}

// ── Simhash dedup state (on ingest, not on read) ─────────────────────────
const seenSimhashes = [];

// ── Text cleaning ─────────────────────────────────────────────────────────
function cleanText(value, max = 1200) {
  return String(value || '')
    .replace(/<!\[CDATA\[/gi, '')
    .replace(/\]\]>/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&/gi, '&')
    .replace(/"/gi, '"')
    .replace(/'|'/gi, "'")
    .replace(/</gi, '<')
    .replace(/>/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function hostOf(link) {
  try { return new URL(link).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}

function blocked(link) {
  const host = hostOf(link);
  return !host || [...BLOCKED_HOSTS].some(h => host === h || host.endsWith(`.${h}`));
}

// ── RSS parsing ──────────────────────────────────────────────────────────
function parseFeed(xml) {
  const items = [];
  const matches = [...String(xml || '').matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  const tag = (block, name) => {
    const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    return m?.[1] || '';
  };
  const attr = (block, name, key) => {
    const m = block.match(new RegExp(`<${name}\\b[^>]*\\b${key}=["']([^"']+)["'][^>]*>`, 'i'));
    return m?.[1] || '';
  };

  for (const match of matches) {
    const block = match[2];
    const title = cleanText(tag(block, 'title'), 500);
    const link = cleanText(tag(block, 'link')) || cleanText(attr(block, 'link', 'href'));
    const guid = cleanText(tag(block, 'guid') || tag(block, 'id'));
    const description = tag(block, 'content:encoded') || tag(block, 'content') || tag(block, 'description') || tag(block, 'summary');
    const published = cleanText(tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || tag(block, 'dc:date'));
    const author = cleanText(tag(block, 'dc:creator') || tag(block, 'author') || tag(block, 'creator'), 160);
    const image = cleanText(
      attr(block, 'media:content', 'url') ||
      attr(block, 'media:thumbnail', 'url') ||
      attr(block, 'enclosure', 'url') ||
      String(description).match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || ''
    );

    if (title && (link || guid)) {
      const externalLink = link || guid;
      const parsedDate = published ? new Date(published) : null;
      items.push({
        title, externalLink, description,
        publishedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
        author, image
      });
    }
  }
  return items;
}

// ── Feed fetching with jitter ────────────────────────────────────────────
async function fetchFeed(url) {
  try {
    // Ingest jitter: 0-240s per feed so our cadence isn't a clean */30
    const jitter = getFeedJitter(url);
    if (jitter > 0) await new Promise(r => setTimeout(r, jitter));

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RealSSA-News/2.2; +https://realssanews.com.ng)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      },
      signal: AbortSignal.timeout(FEED_TIMEOUT)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseFeed(await response.text());
  } catch (error) {
    console.warn(`[Home RSS] ${url}: ${error.message}`);
    return [];
  }
}

// ── Cache refresh with simhash dedup ─────────────────────────────────────
async function refreshCache() {
  if (cache.promise) return cache.promise;
  cache.promise = (async () => {
    const jobs = Object.entries(FEEDS).flatMap(([category, urls]) =>
      urls.map(url => fetchFeed(url).then(items => ({ category, items })))
    );
    const results = await Promise.allSettled(jobs);
    const articles = [];
    const seen = new Set();
    // Reset simhash state on each refresh
    seenSimhashes.length = 0;

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { category, items } = result.value;
      for (const item of items.slice(0, 15)) {
        if (!item.externalLink || blocked(item.externalLink)) continue;
        if (!item.publishedAt || Date.now() - item.publishedAt.getTime() > MAX_ARTICLE_AGE_MS || item.publishedAt.getTime() > Date.now() + 6 * 3600 * 1000) continue;
        const key = item.externalLink.split('#')[0];
        if (seen.has(key)) continue;
        seen.add(key);

        // Simhash dedup: 64-bit, hamming <= 3 = duplicate
        const excerpt = cleanText(item.description || item.title, 900);
        const simKey = security.dedupeKey({ title: item.title, excerpt });
        if (security.isDuplicate(simKey, seenSimhashes)) continue;
        seenSimhashes.push(simKey);

        const imageMatch = String(item.description || '').match(/<img[^>]+src=["']([^"']+)["']/i);
        const image = /^https?:\/\//i.test(item.image) ? item.image : (imageMatch?.[1] || 'https://realssanews.com.ng/images/brand-cover.png');
        articles.push({
          id: 'rss-' + crypto.createHash('sha1').update(key).digest('hex').slice(0, 16),
          title: item.title,
          excerpt,
          content: excerpt,
          category,
          image,
          readTime: '3 min read',
          author: item.author || hostOf(item.externalLink) || 'RSS Source',
          source: 'rss-live',
          externalLink: item.externalLink,
          date: item.publishedAt.toISOString(),
          published_at: item.publishedAt.toISOString(),
          contentType: 'article',
          status: 'published',
          featured: false
        });
      }
    }

    // Server-side ranking: recency-decayed, not raw published_at.
    // Half-life of 6h means a 6h-old article scores ~0.5x of a fresh one.
    // This prevents the "top of page = whatever most recently arrived" problem.
    const now = Date.now();
    const HALF_LIFE_MS = 6 * 3600 * 1000;
    articles.forEach(a => {
      const age = now - new Date(a.date).getTime();
      a._score = Math.exp(-Math.max(age, 0) / HALF_LIFE_MS);
    });
    articles.sort((a, b) => b._score - a._score);

    cache.articles = articles.slice(0, 1200);
    cache.timestamp = Date.now();
    return cache.articles;
  })().finally(() => { cache.promise = null; });

  return cache.promise;
}

async function getHomeArticles() {
  if (cache.articles.length && Date.now() - cache.timestamp < CACHE_TTL) return cache.articles;
  return refreshCache();
}

// ── Server-side ranking with per-user slot randomization ─────────────────
// Same story set, different order per user. Two people screenshotting the
// feed don't produce identical pages.
function rankArticles(articles, { deviceId } = {}) {
  if (!articles.length) return articles;

  // Already sorted by _score from refreshCache. Apply per-user shuffle.
  if (!deviceId) return articles;

  const seed = crypto.createHash('sha256').update(deviceId).digest();
  const shuffled = [...articles];
  // Fisher-Yates with deterministic seed
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = seed[i % seed.length] % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ── Poison for known bots: stale + reordered ─────────────────────────────
// Real users never notice; clones get yesterday's news and a scrambled order
// that makes our ranking look random.
function poisonFeed(articles, req) {
  if (!articles.length) return articles;
  const now = Date.now();
  // Shift timestamps back 3-6 hours (deterministic per ASN)
  const asnSeed = security.asnSeed(req);
  const shiftHours = 3 + (parseInt(asnSeed.slice(0, 4), 16) % 4);
  const shiftMs = shiftHours * 3600 * 1000;

  const stale = articles.map(a => ({
    ...a,
    date: new Date(new Date(a.date).getTime() - shiftMs).toISOString(),
    published_at: new Date(new Date(a.published_at).getTime() - shiftMs).toISOString()
  }));

  // Deterministic reorder by ASN seed
  const seed = crypto.createHash('sha256').update(asnSeed).digest();
  const shuffled = [...stale];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = seed[i % seed.length] % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ── Public response shaping: strip + canary ──────────────────────────────
// The clone must re-derive provenance per article instead of copying our rows.
// Only the canonical realssanews.com.ng URL + an opaque source_id are exposed.
function shapeForPublic(article, req) {
  let shaped = article;
  // Apply canary watermark to ~5% of articles, deterministic per ASN /24
  const variant = security.canaryVariantFor(req);
  if (variant > 0) {
    // Use article ID hash to deterministically pick which articles get watermarked
    const idHash = parseInt(crypto.createHash('md5').update(article.id).digest('hex').slice(0, 8), 16);
    if (idHash % 20 === variant) {
      shaped = security.applyCanary(article, variant);
    }
  }
  return security.stripForPublic(shaped);
}

// ── Handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Fingerprint rate limiting: hash(ja3 + ua + accept-lang + asn)
  const rate = security.checkRateLimit(req);
  if (!rate.allowed) {
    res.setHeader('Retry-After', '60');
    res.setHeader('X-RateLimit-Remaining', '0');
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in 60s.' });
  }

  try {
    const rawPath = String(req.url || '').split('?')[0];
    const isForYou = rawPath.startsWith('/api/feed/foryou');
    const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 100);
    const deviceId = req.query?.deviceId ? String(req.query.deviceId) : null;

    // Get internal articles (full data, server-side)
    let all = await getHomeArticles();

    // Bot detection + poison
    const isBot = security.isLikelyBot(req);
    if (isBot) {
      all = poisonFeed(all, req);
    }

    // Server-side ranking with per-user slot randomization
    all = rankArticles(all, { deviceId });

    // Opaque cursor pagination: ?c=<base64url(AES-GCM({o, seed, cc, cat, ts}))>
    let offset = 0;
    const cursorToken = req.query?.c ? String(req.query.c) : null;
    if (cursorToken) {
      const cursor = security.verifyCursor(cursorToken);
      if (!cursor) {
        return res.status(400).json({ error: 'Invalid or expired cursor' });
      }
      offset = cursor.o;
    }

    // Legacy date-based cursor (backward compat, deprecated)
    const legacyCursor = req.query?.cursor ? new Date(String(req.query.cursor)) : null;
    if (legacyCursor && !Number.isNaN(legacyCursor.getTime()) && !cursorToken) {
      const cursorTime = legacyCursor.getTime();
      all = all.filter(a => new Date(a.date).getTime() < cursorTime);
    }

    // Exclude list (safety net for client-side dedup)
    const exclude = new Set(String(req.query?.exclude || '').split(',').filter(Boolean));
    if (exclude.size) all = all.filter(a => !exclude.has(a.id));

    // Paginate
    const page = all.slice(offset, offset + limit);
    const nextOffset = offset + limit;
    const hasMore = nextOffset < all.length;
    const nextCursor = hasMore
      ? security.issueCursor({ offset: nextOffset, seed: 0, cc: 'global', cat: isForYou ? 'foryou' : 'home' })
      : null;

    // Shape for public: strip sensitive fields, apply canary watermark
    const publicPage = page.map(a => shapeForPublic(a, req));

    res.setHeader('Cache-Control', isForYou ? 'private, no-store' : 'public, s-maxage=30, stale-while-revalidate=60');
    if (isForYou) {
      return res.status(200).json({
        articles: publicPage,
        nextCursor,
        hasMore
      });
    }

    return res.status(200).json(publicPage);
  } catch (error) {
    console.error('[Home RSS] handler failed:', error);
    const rawPath = String(req.url || '').split('?')[0];
    if (rawPath.startsWith('/api/feed/foryou')) {
      return res.status(200).json({ articles: [], nextCursor: null, hasMore: false });
    }
    return res.status(200).json([]);
  }
};

// ── Internal exports (full data, for server-side use) ────────────────────
// These return the FULL article including externalLink, author, source.
// They are used by:
//   - server.js /api/articles/:id (article page needs externalLink for reader)
//   - home-featured.js (featured articles)
module.exports.getHomeArticles = getHomeArticles;

// Resolve a live RSS article by its deterministic home-feed id (rss-<sha1>).
// This keeps /article/rss-<hash> working even though the article is not stored
// in PostgreSQL yet.
module.exports.findHomeArticleById = async function findHomeArticleById(id) {
  if (!id) return null;
  const articles = await getHomeArticles();
  return articles.find(article => article.id === id) || null;
};
