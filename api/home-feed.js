const crypto = require('crypto');

// Resilient homepage read path. It does not depend on PostgreSQL being populated.
// Aiven remains the persistence/analytics store, while this endpoint can always
// assemble a fresh homepage from the public RSS network.
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
    'http://rss.cnn.com/rss/edition.rss',
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
  ]
};

const BLOCKED_HOSTS = new Set(['espn.com', 'skysports.com', 'dailymaverick.co.za', 'edition.cnn.com']);
const cache = { articles: [], timestamp: 0, promise: null };
const CACHE_TTL = 45 * 1000;
const FEED_TIMEOUT = 5000;

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
      const parsedDate = new Date(published || Date.now());
      items.push({ title, externalLink, description, publishedAt: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate, author, image });
    }
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
    console.warn(`[Home RSS] ${url}: ${error.message}`);
    return [];
  }
}

async function refreshCache() {
  if (cache.promise) return cache.promise;
  cache.promise = (async () => {
    const jobs = Object.entries(FEEDS).flatMap(([category, urls]) =>
      urls.map(url => fetchFeed(url).then(items => ({ category, items })))
    );
    const results = await Promise.allSettled(jobs);
    const articles = [];
    const seen = new Set();

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { category, items } = result.value;
      for (const item of items.slice(0, 15)) {
        if (!item.externalLink || blocked(item.externalLink)) continue;
        const key = item.externalLink.split('#')[0];
        if (seen.has(key)) continue;
        seen.add(key);
        const excerpt = cleanText(item.description || item.title, 900);
        const imageMatch = String(item.description || '').match(/<img[^>]+src=["']([^"']+)["']/i);
        const image = /^https?:\/\//i.test(item.image) ? item.image : (imageMatch?.[1] || 'https://realssanews.com.ng/logo.png');
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

    articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const all = await getHomeArticles();
    const rawPath = String(req.url || '').split('?')[0];
    const isForYou = rawPath.startsWith('/api/feed/foryou');
    const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || (isForYou ? 20 : 20), 1), 100);
    const cursor = req.query?.cursor ? new Date(String(req.query.cursor)) : null;
    const exclude = new Set(String(req.query?.exclude || '').split(',').filter(Boolean));

    let filtered = all.filter(a => !exclude.has(a.id));
    if (cursor && !Number.isNaN(cursor.getTime())) {
      filtered = filtered.filter(a => new Date(a.date).getTime() < cursor.getTime());
    }

    const page = filtered.slice(0, limit);
    const nextCursor = page.length === limit && filtered.length > limit ? page[page.length - 1].date : null;

    res.setHeader('Cache-Control', isForYou ? 'private, no-store' : 'public, s-maxage=30, stale-while-revalidate=60');
    if (isForYou) {
      return res.status(200).json({
        articles: page,
        nextCursor,
        hasMore: Boolean(nextCursor),
        source: 'rss-live-home-network',
        totalAvailable: all.length
      });
    }

    return res.status(200).json(page);
  } catch (error) {
    console.error('[Home RSS] handler failed:', error);
    const rawPath = String(req.url || '').split('?')[0];
    if (rawPath.startsWith('/api/feed/foryou')) {
      return res.status(200).json({ articles: [], nextCursor: null, hasMore: false, source: 'rss-live-home-network' });
    }
    return res.status(200).json([]);
  }
};

module.exports.getHomeArticles = getHomeArticles;
