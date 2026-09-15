const TREND_FEEDS = [
  { geo: 'NG', country: 'Nigeria', url: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=NG' },
  { geo: 'US', country: 'USA', url: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=US' },
  { geo: 'GB', country: 'UK', url: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=GB' },
  { geo: 'IN', country: 'India', url: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=IN' },
];

const clean = (value, max = 1000) => String(value || '')
  .replace(/<!\[CDATA\[/gi, '')
  .replace(/\]\]>/g, '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

function tags(xml, tag) {
  return [...String(xml || '').matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi'))]
    .map(m => clean(m[1], 2000));
}

function parse(xml, source) {
  const items = [];
  const blocks = [...String(xml || '').matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  for (const match of blocks) {
    const block = match[2];
    const title = clean(block.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i)?.[1], 300);
    const traffic = clean(block.match(/<ht:approx_traffic[^>]*>([\s\S]*?)<\/ht:approx_traffic>/i)?.[1], 100);
    const pub = clean(block.match(/<(pubDate|updated|published)[^>]*>([\s\S]*?)<\/\1>/i)?.[2], 100);
    if (!title) continue;
    const date = new Date(pub || Date.now());
    items.push({
      id: `trend-${source.geo}-${encodeURIComponent(title)}`,
      title,
      excerpt: traffic ? `${traffic} searches — trending now in ${source.country}.` : `Trending now in ${source.country}.`,
      description: traffic ? `${traffic} searches — trending now in ${source.country}.` : `Trending now in ${source.country}.`,
      category: 'Trending',
      feed_category: 'trending',
      country: source.country,
      image: 'https://realssanews.com.ng/logo.png',
      readTime: '1 min read',
      author: 'RealSSA Trends',
      source_name: `Google Trends · ${source.country}`,
      source: `Google Trends · ${source.country}`,
      date: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
      published_at: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
      externalLink: `https://www.google.com/search?q=${encodeURIComponent(title)}&tbm=nws`,
      external_link: `https://www.google.com/search?q=${encodeURIComponent(title)}&tbm=nws`,
      trendTraffic: traffic,
    });
  }
  return items;
}

async function read(source) {
  try {
    const response = await fetch(source.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RealSSA-Trends/1.0)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return [];
    return parse(await response.text(), source);
  } catch (error) {
    console.warn(`[Trending API] ${source.geo}: ${error.message}`);
    return [];
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const requested = Number(req.query?.limit || 50);
  const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : 50, 1), 100);

  try {
    const batches = await Promise.all(TREND_FEEDS.map(read));
    const seen = new Set();
    const articles = batches.flat()
      .filter(item => {
        const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
      .slice(0, limit);

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    return res.status(200).json({
      articles,
      nextCursor: null,
      hasMore: false,
      source: 'google-trends-multi-region',
      totalAvailable: articles.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Trending API] failed:', error.message);
    return res.status(200).json({ articles: [], nextCursor: null, hasMore: false, source: 'google-trends-multi-region' });
  }
};
