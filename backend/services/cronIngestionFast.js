const crypto = require('crypto');
const Parser = require('rss-parser');
const { getPoolForCategory } = require('../config/multiDb');
const { enforceNewsRetention } = require('./newsRetention');
const { ensureRssSchema } = require('./ensureRssSchema');
const notificationService = require('./notificationService');

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
  return match?.[1] || 'https://www.realssanews.com.ng/logo.png';
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
        'User-Agent': 'RealSSA-Cron/2.0 (+https://www.realssanews.com.ng)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*'
      },
      signal: AbortSignal.timeout(4500)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    return await parser.parseString(xml.replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g, '&'));
  } catch (error) {
    console.warn(`[Fast Cron] Feed failed ${url}: ${error.message}`);
    return null;
  }
}

function notificationScore(article) {
  const text = `${article.title} ${article.excerpt}`.toLowerCase();
  const urgent = /breaking|urgent|alert|just in|dies|died|killed|attack|explosion|crash|earthquake|war|coup|election|president|minister|terror|kidnap|missing|evacuat|market crash|bitcoin|scam/.test(text);
  const important = /government|court|police|military|economy|bank|oil|fuel|naira|security|transfer|injury|final|championship/.test(text);
  return urgent ? 3 : important ? 2 : 1;
}

async function ensureNotificationTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notified_articles (
      id BIGSERIAL PRIMARY KEY,
      story_hash TEXT UNIQUE,
      notified_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function notifyNewArticles(pool, insertedArticles) {
  if (!pool || !insertedArticles.length) return { attempted: 0, sent: 0 };
  if (!process.env.ONESIGNAL_API_KEY) {
    console.warn('[Fast Cron] OneSignal API key missing; new-article notifications skipped.');
    return { attempted: 0, sent: 0 };
  }

  try {
    await ensureNotificationTable(pool);

    // Keep the notification budget global across all category cron calls.
    // Eight notifications/hour matches the previous ingestion safety limit.
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM notified_articles
       WHERE notified_at > NOW() - INTERVAL '1 hour'`
    );
    let remaining = Math.max(0, 8 - Number(countResult.rows[0]?.count || 0));
    if (!remaining) return { attempted: 0, sent: 0, limited: true };

    const candidates = [...insertedArticles]
      .sort((a, b) => {
        const scoreDiff = notificationScore(b) - notificationScore(a);
        if (scoreDiff) return scoreDiff;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      })
      .slice(0, remaining);

    let attempted = 0;
    let sent = 0;

    for (const article of candidates) {
      const storyHash = hash(`${article.externalLink}|${article.title}`);
      const seen = await pool.query(
        'SELECT 1 FROM notified_articles WHERE story_hash = $1 LIMIT 1',
        [storyHash]
      );
      if (seen.rows.length) continue;

      attempted += 1;
      const score = notificationScore(article);
      try {
        const result = await notificationService.sendBreakingNews({
          id: `rss-${storyHash.slice(0, 16)}`,
          title: article.title,
          excerpt: article.excerpt,
          category: article.category,
          image: article.image,
          externalLink: article.externalLink,
          score,
          source_name: article.sourceName,
        });

        if (result?.success) {
          sent += 1;
          await pool.query(
            `INSERT INTO notified_articles (story_hash, notified_at)
             VALUES ($1, NOW()) ON CONFLICT (story_hash) DO NOTHING`,
            [storyHash]
          );
        } else {
          console.warn(`[Fast Cron] Notification not accepted for "${article.title.slice(0, 70)}": ${result?.error || result?.message || 'unknown error'}`);
        }
      } catch (error) {
        console.warn(`[Fast Cron] Notification failed: ${error.message}`);
      }

      remaining -= 1;
      if (remaining <= 0) break;
    }

    await pool.query(
      `DELETE FROM notified_articles WHERE notified_at < NOW() - INTERVAL '48 hours'`
    ).catch(() => {});

    return { attempted, sent };
  } catch (error) {
    console.warn(`[Fast Cron] Notification subsystem unavailable: ${error.message}`);
    return { attempted: 0, sent: 0, error: error.message };
  }
}

async function ingestCronCategory(category) {
  const normalizedCategory = String(category || '').trim().toLowerCase();
  const pool = getPoolForCategory(normalizedCategory)?.pool;
  if (!pool) throw new Error('Primary news database is not configured');

  // Auto-create rss_articles (+ indexes / notified_articles) on first write path.
  // Production was 500ing every cron because the relation did not exist and
  // Vercel never runs the persistent-worker migrations.
  await ensureRssSchema(pool);

  try {
    await enforceNewsRetention(pool);
  } catch (error) {
    console.warn(`[Fast Cron] Retention guard failed: ${error.message}`);
  }

  const urls = FEEDS[normalizedCategory];
  if (!urls) throw new Error(`Unsupported cron category: ${normalizedCategory}`);

  const startedAt = Date.now();
  const feeds = await Promise.all(urls.map(fetchFeed));
  const successfulFeeds = feeds.filter(Boolean);
  const failedFeeds = urls.filter((_, index) => !feeds[index]);

  if (successfulFeeds.length === 0) {
    throw new Error(`All ${urls.length} feeds failed for ${normalizedCategory}`);
  }

  const candidates = [];
  for (let i = 0; i < feeds.length; i += 1) {
    const feed = feeds[i];
    if (!feed?.items) continue;

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
        publishedAt: publishedDate(item),
        category: normalizedCategory,
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
  const insertedArticles = [];
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

    if (result.rows.length) {
      inserted += 1;
      insertedArticles.push(article);
    }
  }

  // The old full ingestion path handled notifications, but the new bounded
  // Aiven/Vercel ingestion path did not. Restore that missing side effect
  // without making push delivery capable of breaking news ingestion.
  const notificationResult = await notifyNewArticles(pool, insertedArticles);

  const result = {
    category: normalizedCategory,
    feedsAttempted: urls.length,
    feedsSucceeded: successfulFeeds.length,
    feedsFailed: failedFeeds.length,
    candidates: unique.length,
    inserted,
    notificationsAttempted: notificationResult.attempted,
    notificationsSent: notificationResult.sent,
    durationMs: Date.now() - startedAt
  };

  if (failedFeeds.length > 0) {
    console.warn(`[Fast Cron] ${normalizedCategory}: ${failedFeeds.length}/${urls.length} feeds failed; continuing with ${successfulFeeds.length} healthy feed(s).`);
  }

  return result;
}

module.exports = { ingestCronCategory, cronCategories: Object.keys(FEEDS) };
