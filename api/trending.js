const TREND_FEEDS = [
  { geo: 'NG', country: 'Nigeria', url: 'https://news.google.com/rss?hl=en-NG&gl=NG&ceid=NG:en' },
  { geo: 'US', country: 'USA', url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en' },
  { geo: 'GB', country: 'UK', url: 'https://news.google.com/rss?hl=en-GB&gl=GB&ceid=GB:en' },
  { geo: 'ZA', country: 'South Africa', url: 'https://news.google.com/rss?hl=en-ZA&gl=ZA&ceid=ZA:en' },
  { geo: 'GH', country: 'Ghana', url: 'https://news.google.com/rss?hl=en-GH&gl=GH&ceid=GH:en' },
];

const FALLBACK_NEWS_URLS = [
  'https://www.vanguardngr.com/feed/',
  'https://punchng.com/feed/',
  'https://www.premiumtimesng.com/feed/',
  'https://www.thecable.ng/feed/',
  'https://www.myjoyonline.com/feed/',
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
  .replace(/&#8211;/gi, '–')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

function parse(xml, source) {
  const items = [];
  const blocks = [...String(xml || '').matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  for (const match of blocks) {
    const block = match[2];
    const title = clean(block.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i)?.[1], 300);
    const link = clean(block.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i)?.[1] || block.match(/<link[^>]+href=["']([^"']+)/i)?.[1], 500);
    const desc = clean(block.match(/<(description|summary|content)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/i)?.[2], 400);
    const pub = clean(block.match(/<(pubDate|updated|published)[^>]*>([\s\S]*?)<\/\1>/i)?.[2], 100);
    const img =
      block.match(/<media:content[^>]+url=["']([^"']+)/i)?.[1] ||
      block.match(/<media:thumbnail[^>]+url=["']([^"']+)/i)?.[1] ||
      block.match(/<enclosure[^>]+url=["']([^"']+)/i)?.[1] ||
      'https://realssanews.com.ng/logo.png';
    if (!title) continue;
    const date = new Date(pub || Date.now());
    items.push({
      id: `trend-${source.geo}-${encodeURIComponent(title).slice(0, 80)}`,
      title,
      excerpt: desc || `Trending now in ${source.country}.`,
      description: desc || `Trending now in ${source.country}.`,
      category: 'Trending',
      feed_category: 'trending',
      country: source.country,
      image: img,
      readTime: '2 min read',
      author: source.country === 'fallback' ? 'RealSSA News' : `Trends · ${source.country}`,
      source_name: source.label || `Google News · ${source.country}`,
      source: source.label || `Google News · ${source.country}`,
      date: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
      published_at: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
      externalLink: link || `https://www.google.com/search?q=${encodeURIComponent(title)}&tbm=nws`,
      external_link: link || `https://www.google.com/search?q=${encodeURIComponent(title)}&tbm=nws`,
    });
  }
  return items;
}

async function read(source) {
  try {
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RealSSA-Trends/2.0; +https://www.realssanews.com.ng)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(8000),
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
    let batches = await Promise.all(TREND_FEEDS.map(read));
    let articles = batches.flat();

    if (articles.length < 8) {
      const extra = await Promise.all(
        FALLBACK_NEWS_URLS.map((url, i) =>
          read({ geo: `FB${i}`, country: 'Nigeria', label: 'Top headlines', url })
        )
      );
      articles = articles.concat(extra.flat());
    }

    const seen = new Set();
    articles = articles
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
      hasMore: articles.length >= limit,
      source: articles.length ? 'google-news-rss+fallback' : 'empty',
      totalAvailable: articles.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Trending API] failed:', error.message);
    return res.status(200).json({ articles: [], nextCursor: null, hasMore: false, source: 'error', error: error.message });
  }
};
