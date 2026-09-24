const crypto = require('crypto');
const FEEDS = [
  'https://www.completesports.com/feed',
  'https://soccernet.ng/feed',
  'https://www.espn.com/espn/rss/news',
  'https://feeds.bbci.co.uk/sport/rss.xml',
  'https://www.skysports.com/rss/12040',
  'https://www.theguardian.com/sport/rss',
  'https://news.google.com/rss/search?q=sports%20news&hl=en&gl=US&ceid=US%3Aen'
];

const clean = (value, max = 2000) => String(value || '')
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

function tag(block, names) {
  for (const name of names) {
    const m = String(block).match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (m?.[1]) return m[1];
  }
  return '';
}

function attr(block, names, name) {
  for (const tagName of names) {
    const m = String(block).match(new RegExp(`<${tagName}\\b[^>]*\\b${name}=["']([^"']+)["'][^>]*>`, 'i'));
    if (m?.[1]) return clean(m[1], 2000);
  }
  return '';
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
    const image = attr(block, ['enclosure', 'media:content', 'media:thumbnail'], 'url') ||
      String(description || '').match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || '';
    if (title && (link || guid)) items.push({ title, link: link || guid, description, pub, author, image });
  }
  return items;
}

async function read(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RealSSA-Sports/1.0; +https://realssanews.com.ng)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      },
      signal: AbortSignal.timeout(7000)
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

async function collect() {
  const batches = await Promise.all(FEEDS.map(read));
  const seen = new Set();
  const articles = [];

  batches.flat().forEach(item => {
    const externalLink = String(item.link || '').trim();
    const title = clean(item.title, 500);
    if (!externalLink || !title || seen.has(externalLink)) return;
    seen.add(externalLink);

    const published = item.pub ? new Date(item.pub) : null;
    if (!published || Number.isNaN(published.getTime()) || Date.now() - published.getTime() > 30 * 24 * 60 * 60 * 1000) return;
    const date = published;
    const excerpt = clean(item.description || title, 900);
    const image = /^https?:\/\//i.test(String(item.image || ''))
      ? item.image
      : 'https://realssanews.com.ng/logo.png';

    articles.push({
      id: 'rss-' + crypto.createHash('sha1').update(String(externalLink)).digest('hex').slice(0, 16),
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
      feed_category: 'sports'
    });
  });

  return articles
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 200);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const articles = await collect();
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(articles);
  } catch (error) {
    console.error('[RealSSA Sports News] handler failed:', error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json([]);
  }
};
