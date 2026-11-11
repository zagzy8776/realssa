const crypto = require('crypto');
const WORLD_FEEDS = require('../backend/data/world_feeds.json');

// Feed URLs are intentionally server-side only. The browser receives articles,
// never the RSS network that powers them.
const SITE = 'https://realssanews.com.ng';
const FALLBACK_IMAGE = `${SITE}/images/brand-cover.png`;
const CACHE_TTL = 2 * 60 * 1000;
const FEED_TIMEOUT = 7000;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const BLOCKED_HOSTS = new Set([
  'espn.com', 'skysports.com', 'dailymaverick.co.za', 'edition.cnn.com', 'punchng.com'
]);

// Higher-quality local feeds for priority markets. Everything else falls back
// to the country's entry in backend/data/world_feeds.json.
const OVERRIDES = {
  netherlands: [
    'https://www.dutchnews.nl/feed/',
    'https://nltimes.nl/rss.xml',
    'https://feeds.nos.nl/nosnieuwsalgemeen',
    'https://news.google.com/rss/search?q=Netherlands%20news&hl=en-NL&gl=NL&ceid=NL%3Aen'
  ],
  france: [
    'https://www.france24.com/en/france/rss',
    'https://news.google.com/rss/search?q=France%20news&hl=en-FR&gl=FR&ceid=FR%3Aen'
  ],
  germany: [
    'https://news.google.com/rss/search?q=Germany%20news&hl=en-DE&gl=DE&ceid=DE%3Aen'
  ],
  spain: ['https://news.google.com/rss/search?q=Spain%20news&hl=en-ES&gl=ES&ceid=ES%3Aen'],
  italy: ['https://news.google.com/rss/search?q=Italy%20news&hl=en-IT&gl=IT&ceid=IT%3Aen'],
  belgium: ['https://news.google.com/rss/search?q=Belgium%20news&hl=en-BE&gl=BE&ceid=BE%3Aen'],
  ireland: ['https://news.google.com/rss/search?q=Ireland%20news&hl=en-IE&gl=IE&ceid=IE%3Aen'],
  sweden: ['https://news.google.com/rss/search?q=Sweden%20news&hl=en-SE&gl=SE&ceid=SE%3Aen'],
  switzerland: ['https://news.google.com/rss/search?q=Switzerland%20news&hl=en-CH&gl=CH&ceid=CH%3Aen'],
  portugal: ['https://news.google.com/rss/search?q=Portugal%20news&hl=en-PT&gl=PT&ceid=PT%3Aen'],
  poland: ['https://news.google.com/rss/search?q=Poland%20news&hl=en-PL&gl=PL&ceid=PL%3Aen'],
  austria: ['https://news.google.com/rss/search?q=Austria%20news&hl=en-AT&gl=AT&ceid=AT%3Aen'],
  denmark: ['https://news.google.com/rss/search?q=Denmark%20news&hl=en-DK&gl=DK&ceid=DK%3Aen'],
  norway: ['https://news.google.com/rss/search?q=Norway%20news&hl=en-NO&gl=NO&ceid=NO%3Aen'],
  finland: ['https://news.google.com/rss/search?q=Finland%20news&hl=en-FI&gl=FI&ceid=FI%3Aen']
};

const cache = new Map();

function cleanText(value, max = 1200) {
  return String(value || '')
    .replace(/<!\[CDATA\[/gi, '')
    .replace(/\]\]>/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
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

function articleId(link) {
  return 'rss-' + crypto.createHash('sha1').update(String(link)).digest('hex').slice(0, 16);
}

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

    if (!title || !(link || guid)) continue;
    const externalLink = link || guid;
    const parsedDate = published ? new Date(published) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) continue;
    if (Date.now() - parsedDate.getTime() > MAX_AGE_MS) continue;
    if (parsedDate.getTime() > Date.now() + 6 * 3600 * 1000) continue;
    items.push({ title, externalLink, description, publishedAt: parsedDate, author, image });
  }
  return items;
}

async function fetchFeed(url) {
  try {
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
    console.warn(`[Country Feed] ${url}: ${error.message}`);
    return [];
  }
}

async function getCountryArticles(slug, urls, countryName) {
  const hit = cache.get(slug);
  if (hit?.articles?.length && Date.now() - hit.timestamp < CACHE_TTL) return hit.articles;
  if (hit?.promise) return hit.promise;

  const promise = (async () => {
    const feeds = await Promise.all(urls.slice(0, 6).map(fetchFeed));
    const seen = new Set();
    const articles = [];

    for (const items of feeds) {
      for (const item of items.slice(0, 30)) {
        if (!item.externalLink || blocked(item.externalLink)) continue;
        const key = item.externalLink.split('#')[0];
        if (seen.has(key)) continue;
        seen.add(key);

        const excerpt = cleanText(item.description || item.title, 900);
        const imageMatch = String(item.description || '').match(/<img[^>]+src=["']([^"']+)["']/i);
        const rawImage = /^https?:\/\//i.test(item.image) ? item.image : (imageMatch?.[1] || '');
        const image = /(logo|icon|favicon|placeholder)/i.test(rawImage)
          ? FALLBACK_IMAGE
          : (rawImage || FALLBACK_IMAGE);

        articles.push({
          id: articleId(key),
          title: item.title,
          excerpt,
          content: excerpt,
          category: countryName,
          country: countryName,
          image,
          readTime: '3 min read',
          author: 'RealSSA News',
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

    articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return articles.slice(0, 160);
  })();

  cache.set(slug, { articles: hit?.articles || [], timestamp: hit?.timestamp || 0, promise });
  try {
    const articles = await promise;
    cache.set(slug, { articles, timestamp: Date.now(), promise: null });
    return articles;
  } catch (error) {
    cache.set(slug, { articles: hit?.articles || [], timestamp: hit?.timestamp || 0, promise: null });
    throw error;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const slug = String(req.query?.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!slug) return res.status(400).json({ error: 'slug is required' });

  const country = WORLD_FEEDS[slug];
  if (!country) {
    return res.status(200).json({ articles: [], location: slug, hasCoverage: false });
  }

  const googleFallback = `https://news.google.com/rss/search?q=${encodeURIComponent((country.name || slug) + ' news')}&hl=en&gl=US&ceid=US%3Aen`;
  const urls = [...new Set([...(OVERRIDES[slug] || country.urls || []), googleFallback])];
  const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 24, 1), 48);

  try {
    const all = await getCountryArticles(slug, urls, country.name || slug);
    const articles = all.slice(0, limit);
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    return res.status(200).json({
      articles,
      location: country.name || slug,
      hasCoverage: articles.length > 0,
      totalAvailable: all.length
    });
  } catch (error) {
    console.error('[Country Feed] handler failed:', error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ articles: [], location: country.name || slug, hasCoverage: false });
  }
};
