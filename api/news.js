const Parser = require('rss-parser');

// Public news read path. It does not require PostgreSQL, so a database outage
// cannot turn the homepage into an empty feed.
const FEEDS = {
  'nigerian-news': ['https://www.premiumtimesng.com/rss.xml','https://www.vanguardngr.com/feed/','https://guardian.ng/feed/'],
  world: ['https://feeds.bbci.co.uk/news/world/rss.xml','https://www.aljazeera.com/xml/rss/all.xml','https://www.france24.com/en/rss'],
  sports: ['https://www.completesports.com/feed','https://soccernet.ng/feed','https://www.bbc.co.uk/sport/rss.xml'],
  business: ['https://www.cnbc.com/id/10001147/device/rss/rss.html','https://feeds.bbci.co.uk/news/business/rss.xml','https://howwemadeitinafrica.com/feed'],
  tech: ['https://techcabal.com/feed','https://techpoint.africa/feed','https://techcrunch.com/feed/'],
  crypto: ['https://cointelegraph.com/rss','https://decrypt.co/feed'],
  entertainment: ['https://variety.com/feed/','https://deadline.com/feed/','https://www.pulse.ng/entertainment/rss'],
  culture: ['https://www.bellanaija.com/feed','https://okayafrica.com/feed/','https://musicinafrica.net/feed'],
  lifestyle: ['https://wwd.com/fashion-news/feed/','https://www.theguardian.com/fashion/rss','https://skift.com/feed/'],
  science: ['https://www.nature.com/nature.rss','https://www.sciencenews.org/feed','https://scitechdaily.com/feed/'],
  jobs: ['https://weworkremotely.com/remote-jobs.rss','https://reliefweb.int/jobs/rss.xml','https://remoteok.com/remote-jobs.rss'],
  ghana: ['https://www.graphic.com.gh/rss.xml','https://www.myjoyonline.com/feed/','https://citinewsroom.com/feed'],
  kenya: ['https://www.standardmedia.co.ke/rss/kenya.php','https://www.tuko.co.ke/?service=rss','https://kbc.co.ke/feed'],
  'south-africa': ['https://www.news24.com/news24/rss','https://www.dailymaverick.co.za/dmrss','https://www.sowetanlive.co.za/rss/?publication=sowetan-live'],
  uk: ['https://feeds.bbci.co.uk/news/uk/rss.xml','https://www.theguardian.com/uk/rss','https://feeds.skynews.com/feeds/rss/home.xml'],
  usa: ['http://rss.cnn.com/rss/edition.rss','https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml','https://www.pbs.org/newshour/feeds/rss/headlines']
};

const aliases = { nigerian: 'nigerian-news', nigeria: 'nigerian-news', latest: 'nigerian-news' };
const countryByCategory = {
  'nigerian-news': 'Nigeria', ghana: 'Ghana', kenya: 'Kenya', 'south-africa': 'South Africa',
  uk: 'UK', usa: 'USA', world: 'Global', sports: 'Global', business: 'Global', tech: 'Global',
  crypto: 'Global', entertainment: 'Global', culture: 'Africa', lifestyle: 'Global', science: 'Global', jobs: 'Global'
};
const cleanText = (value, max = 4000) => String(value || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const parser = new Parser({ timeout: 4500, customFields: { item: [['media:content','media:content'],['media:thumbnail','media:thumbnail'],['enclosure','enclosure']] } });

function getImage(item) {
  const values = [item['media:content'], item['media:thumbnail']].flatMap(v => Array.isArray(v) ? v : v ? [v] : []);
  for (const entry of values) {
    const url = entry?.$?.url || entry?.url;
    if (/^https?:\/\//i.test(String(url || ''))) return url;
  }
  if (/^https?:\/\//i.test(String(item.enclosure?.url || ''))) return item.enclosure.url;
  const html = item.content || item['content:encoded'] || item.description || '';
  return String(html).match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || 'https://realssanews.com.ng/logo.png';
}

function publishedDate(item) {
  const date = new Date(item.isoDate || item.pubDate || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function readFeed(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent':'RealSSA-News/1.0 (+https://realssanews.com.ng)', Accept:'application/rss+xml, application/xml, text/xml, */*' },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    return parser.parseString(xml.replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g,'&amp;'));
  } catch (error) {
    console.warn(`[Vercel News] ${url}: ${error.message}`);
    return null;
  }
}

async function collect(category) {
  const normalized = aliases[category] || category;
  const urls = FEEDS[normalized] || FEEDS['nigerian-news'];
  const feeds = await Promise.all(urls.map(readFeed));
  const articles = [];
  const seen = new Set();

  feeds.forEach((feed, feedIndex) => {
    if (!feed?.items) return;
    for (const item of feed.items.slice(0,15)) {
      const link = String(item.link || item.guid || '').trim();
      const title = cleanText(item.title,500);
      if (!link || !title || seen.has(link)) continue;
      seen.add(link);
      const date = publishedDate(item);
      const excerpt = cleanText(item.contentSnippet || item.summary || item.description || title,1000);
      articles.push({
        id: link,
        title,
        excerpt,
        description: excerpt,
        original_excerpt: cleanText(excerpt,4000),
        image: getImage(item),
        author: cleanText(item.creator || item.author || '',200),
        source_name: cleanText(feed.title || new URL(urls[feedIndex]).hostname,200),
        external_link: link,
        published_at: date.toISOString(),
        date: date.toISOString(),
        category: normalized,
        country: countryByCategory[normalized] || 'Global',
        content_type:'article',
        featured:false,
        is_featured:false
      });
    }
  });

  return articles.sort((a,b) => new Date(b.published_at) - new Date(a.published_at));
}

async function collectCombined(categories) {
  const batches = await Promise.all(categories.map(collect));
  const seen = new Set();
  return batches.flat().filter(article => {
    if (seen.has(article.external_link)) return false;
    seen.add(article.external_link);
    return true;
  }).sort((a,b) => new Date(b.published_at) - new Date(a.published_at));
}

module.exports = async function handler(req,res) {
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});

  try {
    const rawPath = String(req.url || '').split('?')[0];
    const isLegacyFeed = /^\/news-feed\/?$/i.test(rawPath);
    const isForYou = /^\/api\/feed\/foryou\/?$/i.test(rawPath);
    const categoryMatch = rawPath.match(/^\/api\/news\/([^/]+)\/?$/i);
    const category = categoryMatch ? decodeURIComponent(categoryMatch[1]).toLowerCase() : '';

    let articles;
    if (isLegacyFeed || isForYou || category === 'breaking' || category === 'latest' || !category) {
      articles = await collectCombined(['nigerian-news','world','sports','business','tech']);
    } else {
      articles = await collect(category);
    }

    const requestedLimit = Number(req.query?.limit || 50);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 50,1),100);
    const result = articles.slice(0,limit);

    res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300');

    // Preserve the legacy /news-feed contract: the existing frontend expects an array.
    if (isLegacyFeed) return res.status(200).json(result);

    return res.status(200).json({
      articles: result,
      nextCursor:null,
      hasMore:false,
      source:'rss-live-fallback',
      category:category || (isForYou ? 'foryou' : 'latest')
    });
  } catch (error) {
    console.error('[Vercel News] handler failed:',error);
    const isLegacyFeed = /^\/news-feed\/?$/i.test(String(req.url || '').split('?')[0]);
    if (isLegacyFeed) return res.status(200).json([]);
    return res.status(200).json({articles:[],nextCursor:null,hasMore:false,source:'rss-live-fallback',error:'News temporarily unavailable'});
  }
};
