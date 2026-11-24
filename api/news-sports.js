const crypto = require('crypto');

const FEEDS = [
  'https://www.completesports.com/feed',
  'https://soccernet.ng/feed',
  'https://www.espn.com/espn/rss/news',
  'https://feeds.bbci.co.uk/sport/rss.xml',
  'https://www.skysports.com/rss/12040',
  'https://www.theguardian.com/sport/rss',
  'https://news.google.com/rss/search?q=sports%20news&hl=en&gl=US&ceid=US%3Aen',
];

const BRAND_LOGO = 'https://realssanews.com.ng/logo.png';
const LOGO_RE =
  /logo|icon|brand|favicon|placeholder|avatar|watermark|sprite|punchng.*logo|cropped-punch|PUNCH-Logo|realssanews\.com\.ng\/logo/i;

const clean = (value, max = 2000) =>
  String(value || '')
    .replace(/<!\[CDATA\[/gi, '')
    .replace(/\]\]>/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&/gi, '&')
    .replace(/"/gi, '"')
    .replace(/&#39;|'/gi, "'")
    .replace(/</gi, '<')
    .replace(/>/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

function tag(block, names) {
  for (const name of names) {
    const m = String(block).match(
      new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i')
    );
    if (m?.[1]) return m[1];
  }
  return '';
}

function attr(block, names, name) {
  for (const tagName of names) {
    const m = String(block).match(
      new RegExp(`<${tagName}\\b[^>]*\\b${name}=["']([^"']+)["'][^>]*>`, 'i')
    );
    if (m?.[1]) return clean(m[1], 2000);
  }
  return '';
}

function isBadImage(url) {
  if (!url || !/^https?:\/\//i.test(url)) return true;
  return LOGO_RE.test(url);
}

function parse(xml) {
  const items = [];
  const matches = [...String(xml || '').matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  for (const match of matches) {
    const block = match[2];
    const title = clean(tag(block, ['title']), 500);
    const link = clean(tag(block, ['link']), 4000) || attr(block, ['link'], 'href');
    const guid = clean(tag(block, ['guid', 'id']), 4000);
    const description = tag(block, ['content:encoded', 'content', 'description', 'summary']);
    const pub = clean(tag(block, ['pubDate', 'published', 'updated', 'dc:date']), 200);
    const author = clean(tag(block, ['dc:creator', 'author', 'creator']), 200);

    // Pull every image candidate from the RSS item (media tags + html body)
    const candidates = [];
    const push = (u) => {
      const url = String(u || '').trim();
      if (url && !isBadImage(url)) candidates.push(url);
    };
    push(attr(block, ['enclosure', 'media:content', 'media:thumbnail'], 'url'));
    // media:content can appear multiple times
    for (const m of String(block).matchAll(
      /<(?:media:content|media:thumbnail|enclosure)\b[^>]*\burl=["']([^"']+)["'][^>]*>/gi
    )) {
      push(m[1]);
    }
    for (const m of String(description || '').matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
      push(m[1]);
    }
    // og-style urls sometimes embedded as text in Google News descriptions
    for (const m of String(description || '').matchAll(
      /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/gi
    )) {
      push(m[0]);
    }

    if (title && (link || guid))
      items.push({
        title,
        link: link || guid,
        description,
        pub,
        author,
        image: candidates[0] || '',
        imageCandidates: candidates,
      });
  }
  return items;
}

async function read(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; RealSSA-Sports/1.0; +https://realssanews.com.ng)',
        Accept:
          'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = parse(await response.text());
    if (!items.length) throw new Error('no RSS items');
    return items;
  } catch (error) {
    console.warn(`[RealSSA Sports News] ${url}: ${error?.message || error}`);
    return [];
  }
}

/** Resolve Google News / redirect wrappers to the real publisher URL when possible. */
async function resolveArticleUrl(url) {
  try {
    if (!/news\.google\.com/i.test(url)) return url;
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; RealSSABot/1.0; +https://realssanews.com.ng)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    // Final URL after redirects is usually the publisher
    if (res.url && !/news\.google\.com/i.test(res.url)) return res.url;
    const html = await res.text();
    const m =
      html.match(/<a[^>]+href=["'](https?:\/\/(?!news\.google\.com)[^"']+)["'][^>]*>\s*<span/i) ||
      html.match(/data-n-au=["'](https?:\/\/[^"']+)["']/i) ||
      html.match(/url=(https?:\/\/[^&"']+)/i);
    if (m?.[1]) return decodeURIComponent(m[1]);
    return url;
  } catch {
    return url;
  }
}

async function scrapeImage(articleUrl, title) {
  try {
    const { findBestArticleImage } = require('../backend/services/aggressiveImageScraper');
    const resolved = await resolveArticleUrl(articleUrl);
    const img = await findBestArticleImage(resolved, null, title);
    if (img && !isBadImage(img)) return img;
  } catch (e) {
    console.warn('[Sports News] image scrape failed:', e.message);
  }
  return null;
}

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

async function collect() {
  const batches = await Promise.all(FEEDS.map(read));
  const seen = new Set();
  const articles = [];

  batches.flat().forEach((item) => {
    const externalLink = String(item.link || '').trim();
    const title = clean(item.title, 500);
    if (!externalLink || !title || seen.has(externalLink)) return;
    seen.add(externalLink);

    const published = item.pub ? new Date(item.pub) : null;
    if (
      !published ||
      Number.isNaN(published.getTime()) ||
      Date.now() - published.getTime() > 30 * 24 * 60 * 60 * 1000
    )
      return;
    const date = published;
    const excerpt = clean(item.description || title, 900);
    let image = item.imageCandidates?.find((u) => !isBadImage(u)) || item.image || '';
    if (isBadImage(image)) image = '';

    articles.push({
      id:
        'rss-' +
        crypto.createHash('sha1').update(String(externalLink)).digest('hex').slice(0, 16),
      title,
      excerpt,
      category: 'sports',
      image,
      readTime: '3 min read',
      author: clean(item.author || 'Sports Desk', 200),
      date: date.toISOString(),
      externalLink,
      published_at: date.toISOString(),
      external_link: externalLink,
      source_name: 'Sports RSS',
      feed_category: 'sports',
      _needsImage: !image,
    });
  });

  // Aggressively fill missing images for the top cards users actually see
  const missing = articles.filter((a) => a._needsImage).slice(0, 24);
  await mapPool(missing, 6, async (article) => {
    const img = await scrapeImage(article.externalLink, article.title);
    if (img) {
      article.image = img;
      article._needsImage = false;
    }
  });

  return articles
    .map(({ _needsImage, ...rest }) => ({
      ...rest,
      image: rest.image || BRAND_LOGO,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 200);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const articles = await collect();
    res.setHeader('Cache-Control', 'public, s-maxage=90, stale-while-revalidate=300');
    return res.status(200).json(articles);
  } catch (error) {
    console.error('[RealSSA Sports News] handler failed:', error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json([]);
  }
};
