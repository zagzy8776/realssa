const crypto = require('crypto');
const Parser = require('rss-parser');
const { getPoolForCategory } = require('../config/multiDb');
const { enforceNewsRetention } = require('./newsRetention');
const { ensureRssSchema } = require('./ensureRssSchema');
const notificationService = require('./notificationService');

// External cron providers (cron-job.org) hard-timeout around 30s.
// Keep this path bounded: parallel feed fetch → bulk insert → return.
// Heavy AI enrichment stays on summarize / worker paths.

const ITEMS_PER_FEED = 18;
const MAX_FEEDS_PER_RUN = 6;
const FEED_TIMEOUT_MS = 5000;

const FEEDS = {
  'nigerian-news': [
    'https://www.premiumtimesng.com/feed/',
    'https://www.vanguardngr.com/feed/',
    'https://guardian.ng/feed/',
    'https://punchng.com/feed/',
    'https://www.channelstv.com/feed/',
    'https://www.thecable.ng/feed',
    'https://saharareporters.com/rss.xml',
    'https://news.google.com/rss/search?q=Nigeria+news&hl=en-NG&gl=NG&ceid=NG:en'
  ],
  ghana: [
    'https://www.myjoyonline.com/feed/',
    'https://citinewsroom.com/feed',
    'https://www.graphic.com.gh/rss.xml',
    'https://www.ghanaweb.com/GhanaHomePage/rss/news.xml',
    'https://news.google.com/rss/search?q=Ghana+news&hl=en&gl=GH&ceid=GH:en'
  ],
  kenya: [
    'https://www.standardmedia.co.ke/rss/kenya.php',
    'https://www.tuko.co.ke/?service=rss',
    'https://nation.africa/kenya/rss',
    'https://www.the-star.co.ke/rss.xml',
    'https://news.google.com/rss/search?q=Kenya+news&hl=en&gl=KE&ceid=KE:en'
  ],
  'south-africa': [
    'https://feeds.news24.com/articles/news24/TopStories/rss',
    'https://www.dailymaverick.co.za/dmrss',
    'https://www.sowetanlive.co.za/rss/?publication=sowetan-live',
    'https://www.iol.co.za/cmlink/1.640',
    'https://news.google.com/rss/search?q=South+Africa+news&hl=en&gl=ZA&ceid=ZA:en'
  ],
  uk: [
    'https://feeds.bbci.co.uk/news/uk/rss.xml',
    'https://www.theguardian.com/uk/rss',
    'https://feeds.skynews.com/feeds/rss/uknews.xml',
    'https://www.independent.co.uk/news/uk/rss',
    'https://news.google.com/rss/search?q=UK+news&hl=en-GB&gl=GB&ceid=GB:en'
  ],
  usa: [
    'https://rss.cnn.com/rss/edition.rss',
    'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
    'https://www.pbs.org/newshour/feeds/rss/headlines',
    'https://feeds.npr.org/1001/rss.xml',
    'https://news.google.com/rss/search?q=US+news&hl=en-US&gl=US&ceid=US:en'
  ],
  world: [
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://www.france24.com/en/rss',
    'https://www.theguardian.com/world/rss',
    'https://news.google.com/rss/search?q=world+news&hl=en&gl=US&ceid=US:en'
  ],
  crypto: [
    'https://cointelegraph.com/rss',
    'https://decrypt.co/feed',
    'https://www.coindesk.com/arc/outboundfeeds/rss/',
    'https://news.google.com/rss/search?q=cryptocurrency+bitcoin&hl=en&gl=US&ceid=US:en'
  ],
  culture: [
    'https://www.bellanaija.com/feed',
    'https://okayafrica.com/feed/',
    'https://musicinafrica.net/feed',
    'https://www.theguardian.com/culture/rss',
    'https://news.google.com/rss/search?q=African+culture+entertainment&hl=en&gl=US&ceid=US:en'
  ],
  entertainment: [
    'https://variety.com/feed/',
    'https://deadline.com/feed/',
    'https://www.pulse.ng/entertainment/rss',
    'https://news.google.com/rss/search?q=entertainment+Nollywood&hl=en&gl=NG&ceid=NG:en'
  ],
  sports: [
    'https://www.completesports.com/feed',
    'https://soccernet.ng/feed',
    'https://feeds.bbci.co.uk/sport/rss.xml',
    'https://news.google.com/rss/search?q=African+football+sports&hl=en&gl=NG&ceid=NG:en'
  ],
  business: [
    'https://feeds.bbci.co.uk/news/business/rss.xml',
    'https://howwemadeitinafrica.com/feed',
    'https://news.google.com/rss/search?q=Africa+business+economy&hl=en&gl=US&ceid=US:en'
  ],
  tech: [
    'https://techcabal.com/feed',
    'https://techpoint.africa/feed',
    'https://techcrunch.com/feed/',
    'https://news.google.com/rss/search?q=Africa+tech+startup&hl=en&gl=US&ceid=US:en'
  ],
  jobs: [
    'https://weworkremotely.com/remote-jobs.rss',
    'https://remoteok.com/remote-jobs.rss',
    'https://reliefweb.int/jobs/rss.xml',
    'https://news.google.com/rss/search?q=Nigeria+jobs+vacancies&hl=en-NG&gl=NG&ceid=NG:en'
  ],
  lifestyle: [
    'https://www.theguardian.com/lifeandstyle/rss',
    'https://news.google.com/rss/search?q=lifestyle+fashion+Africa&hl=en&gl=US&ceid=US:en'
  ],
  science: [
    'https://www.sciencenews.org/feed',
    'https://news.google.com/rss/search?q=science+technology+news&hl=en&gl=US&ceid=US:en'
  ]
};

const parser = new Parser({
  timeout: FEED_TIMEOUT_MS,
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
  const match = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] || 'https://www.realssanews.com.ng/logo.png';
}

function cleanText(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[/gi, '')
    .replace(/\]\]>/g, '')
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

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function fetchFeed(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RealSSA-Cron/2.1 (+https://www.realssanews.com.ng)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*'
      },
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      redirect: 'follow'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    if (!xml || xml.length < 40) throw new Error('empty feed body');
    return await parser.parseString(xml.replace(/&(?!amp;|lt;|gt;|quot;|#39;|#\d+;)/g, '&'));
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
    return { attempted: 0, sent: 0, skipped: 'no_onesignal' };
  }

  try {
    await ensureNotificationTable(pool);

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

  await ensureRssSchema(pool);

  try {
    await enforceNewsRetention(pool);
  } catch (error) {
    console.warn(`[Fast Cron] Retention guard failed: ${error.message}`);
  }

  const allUrls = FEEDS[normalizedCategory];
  if (!allUrls || !allUrls.length) {
    throw new Error(`Unsupported cron category: ${normalizedCategory}`);
  }

  // Rotate which feeds we hit so successive cron runs cover the full set
  // without blowing the 30s external cron timeout.
  const urls = shuffle(allUrls).slice(0, Math.min(MAX_FEEDS_PER_RUN, allUrls.length));
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

    for (const item of feed.items.slice(0, ITEMS_PER_FEED)) {
      const externalLink = item.link || item.guid;
      const title = cleanText(item.title || 'Untitled');
      if (!externalLink || !title || title.length < 8) continue;

      let sourceName;
      try {
        sourceName = cleanText(feed.title || new URL(urls[i]).hostname).slice(0, 255);
      } catch {
        sourceName = 'RealSSA';
      }

      candidates.push({
        urlHash: hash(String(externalLink)),
        title: title.slice(0, 1000),
        excerpt: cleanText(item.contentSnippet || item.summary || item.content || item.description).slice(0, 4000),
        image: pickImage(item),
        sourceName,
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

  const hashes = unique.map((a) => a.urlHash);
  const existing = new Set();
  if (hashes.length) {
    const existingResult = await pool.query(
      'SELECT url_hash FROM rss_articles WHERE url_hash = ANY($1::text[])',
      [hashes]
    );
    for (const row of existingResult.rows) existing.add(row.url_hash);
  }

  const toInsert = unique.filter((a) => !existing.has(a.urlHash));

  for (const article of toInsert) {
    try {
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
    } catch (error) {
      console.warn(`[Fast Cron] Insert failed for ${article.title.slice(0, 40)}: ${error.message}`);
    }
  }

  const notificationResult = await notifyNewArticles(pool, insertedArticles);

  const result = {
    category: normalizedCategory,
    feedsAvailable: allUrls.length,
    feedsAttempted: urls.length,
    feedsSucceeded: successfulFeeds.length,
    feedsFailed: failedFeeds.length,
    candidates: unique.length,
    alreadyStored: existing.size,
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
