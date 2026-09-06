const crypto = require('crypto');
const Parser = require('rss-parser');
const { getPoolForCategory } = require('../config/multiDb');

// External cron providers such as cron-job.org have a hard 30-second request
// timeout. The full ingestion pipeline intentionally does much more work
// (AI, OG-image scraping, indexing, notifications, cleanup), so it must not
// be used as the HTTP request handler for those jobs.
//
// This path is deliberately small and bounded: fetch trusted feeds in
// parallel, insert a useful batch of recent items, and return. The persistent
// worker can do the heavy enrichment work separately.
const FEEDS = {
  'nigerian-news': [
    'https://www.premiumtimesng.com/rss.xml',
    'https://www.vanguardngr.com/feed/',
    'https://guardian.ng/feed/'
  ],
  ghana: [
    'https://www.graphic.com.gh/rss.xml',
    'https://www.myjoyonline.com/feed/',
    'https://citinewsroom.com/feed'
  ],
  kenya: [
    'https://www.standardmedia.co.ke/rss/kenya.php',
    'https://www.tuko.co.ke/?service=rss',
    'https://kbc.co.ke/feed'
  ],
  'south-africa': [
    'http://feeds.news24.com/articles/news24/TopStories/rss',
    'https://www.dailymaverick.co.za/dmrss',
    'https://www.sowetanlive.co.za/rss/?publication=sowetan-live'
  ],
  uk: [
    'http://feeds.bbci.co.uk/news/uk/rss.xml',
    'https://www.theguardian.com/uk/rss',
    'https://feeds.skynews.com/feeds/rss/home.xml'
  ],
  usa: [
    'http://rss.cnn.com/rss/edition.rss',
    'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
    'https://www.pbs.org/newshour/feeds/rss/headlines'
  ],
  world: [
    'http://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://www.france24.com/en/rss'
  ],
  crypto: [
    'https://cointelegraph.com/rss',
    'https://decrypt.co/feed'
  ],
  culture: [
    'https://www.bellanaija.com/feed',
    'https://okayafrica.com/feed/',
    'https://musicinafrica.net/feed'
  ],
  entertainment: [
    'https://variety.com/feed/',
    'https://deadline.com/feed/',
    'https://www.pulse.ng/entertainment/rss'
  ],
  sports: [
    'https://www.completesports.com/feed',
    'https://soccernet.ng/feed',
    'https://www.bbc.co.uk/sport/rss.xml'
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
  jobs: [
    'https://weworkremotely.com/remote-jobs.rss',
    'https://reliefweb.int/jobs/rss.xml',
    'https://remoteok.com/remote-jobs.rss'
  ],
  lifestyle: [
    'https://wwd.com/fashion-news/feed/',
    'https://www.theguardian.com/fashion/rss',
    'https://skift.com/feed/'
  ],
  science: [
    'https://www.nature.com/nature.rss',
    'https://www.sciencenews.org/feed',
    'https://scitechdaily.com/feed/'
  ]
};

const parser = new Parser({
  timeout: 4500,
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['enclosure', 'enclosure']
    ]
  }
});

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function pickImage(item) {
  const media = item['media:content'];
  const mediaItems = Array.isArray(media) ? media : media ? [media] : [];
  for (const entry of mediaItems) {
    const url = entry?.$?.url || entry?.url;
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) return url;
  }

  const thumb = item['media:thumbnail'];
  const thumbs = Array.isArray(thumb) ? thumb : thumb ? [thumb] : [];
  for (const entry of thumbs) {
    const url = entry?.$?.url || entry?.url;
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) return url;
  }

  if (item.enclosure?.url && /^https?:\/\//i.test(item.enclosure.url)) {
    return item.enclosure.url;
  }

  const html = item.content || item['content:encoded'] || item.description || '';
  const match = String(html).match(/<img[^>]+src=[\"']([^\"']+)[\"']/i);
  return match?.[1] || 'https://realssanews.com.ng/logo.png';
}

function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

function publishedDate(item) {
  const value = item.pubDate || item.isoDate;
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function fetchFeed(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RealSSA-Cron/2.0 (+https://realssanews.com.ng)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*'
      },
      signal: AbortSignal.timeout(4500)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    return await parser.parseString(xml.replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g, '&amp;'));
  } catch (error) {
    console.warn(`[Fast Cron] Feed failed ${url}: ${error.message}`);
    return null;
  }
}

async function ingestCronCategory(category) {
  const normalizedCategory = String(category || '').trim().toLowerCase();
  const pool = getPoolForCategory(normalizedCategory)?.pool;
  if (!pool) throw new Error('Primary news database is not configured');

  const urls = FEEDS[normalizedCategory];
  if (!urls) throw new Error(`Unsupported cron category: ${normalizedCategory}`);

  const startedAt = Date.now();
  const feeds = await Promise.all(urls.map(fetchFeed));
  const successfulFeeds = feeds.filter(Boolean);
  const failedFeeds = urls.filter((_, index) => !feeds[index]);

  // Never report a successful ingestion when every upstream feed failed.
  if (successfulFeeds.length === 0) {
    throw new Error(`All ${urls.length} feeds failed for ${normalizedCategory}`);
  }

  const candidates = [];

  for (let i = 0; i < feeds.length; i += 1) {
    const feed = feeds[i];
    if (!feed?.items) continue;

    // Ten recent items per feed restores useful catalogue depth without
    // bringing back the old unbounded ingestion workload.
    for (const item of feed.items.slice(0, 10)) {
      const externalLink = item.link || item.guid;
      const title = cleanText(item.title || 'Untitled');
      if (!externalLink || !title) continue;

      candidates.push({
        urlHash: hash(externalLink),
        title: title.slice(0, 1000),
        excerpt: cleanText(item.contentSnippet || item.summary || item.content || item.description).slice(0, 4000),
        image: pickImage(item),
        sourceName: cleanText(feed.title || new URL(urls[i]).hostname).slice(0, 255),
        externalLink: String(externalLink).slice(0, 2000),
        publishedAt: publishedDate(item)
      });
    }
  }

  const unique = [];
  const seen = new Set();
  for (const candidate of candidates) {
    if (seen.has(candidate.urlHash)) continue;
    seen.add(candidate.urlHash);
    unique.push(candidate);
  }

  let inserted = 0;
  for (const article of unique) {
    const result = await pool.query(
      `INSERT INTO rss_articles
        (url_hash, title, original_excerpt, category, image, author, source_name,
         external_link, published_at, content_type, is_featured)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'article', false)
       ON CONFLICT (url_hash) DO NOTHING
       RETURNING id`,
      [
        article.urlHash,
        article.title,
        article.excerpt || article.title,
        normalizedCategory,
        article.image,
        article.sourceName,
        article.sourceName,
        article.externalLink,
        article.publishedAt
      ]
    );

    if (result.rows.length) inserted += 1;
  }

  const result = {
    category: normalizedCategory,
    feedsAttempted: urls.length,
    feedsSucceeded: successfulFeeds.length,
    feedsFailed: failedFeeds.length,
    candidates: unique.length,
    inserted,
    durationMs: Date.now() - startedAt
  };

  if (failedFeeds.length > 0) {
    console.warn(`[Fast Cron] ${normalizedCategory}: ${failedFeeds.length}/${urls.length} feeds failed; continuing with ${successfulFeeds.length} healthy feed(s).`);
  }

  return result;
}

module.exports = { ingestCronCategory, cronCategories: Object.keys(FEEDS) };
