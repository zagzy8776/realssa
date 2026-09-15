// Public news read path. It is intentionally independent of PostgreSQL.
// The parser below is dependency-light and tolerant of publisher RSS quirks.

const FEEDS = {
  'nigerian-news': [
    'https://www.premiumtimesng.com/feed',
    'https://www.vanguardngr.com/feed/',
    'https://guardian.ng/feed/',
    'https://news.google.com/rss/search?q=Nigeria%20news&hl=en-NG&gl=NG&ceid=NG%3Aen'
  ],
  politics: [
    'https://rss.punchng.com/v1/category/politics',
    'https://www.vanguardngr.com/feed/',
    'https://guardian.ng/feed/',
    'https://news.google.com/rss/search?q=Nigeria%20politics&hl=en-NG&gl=NG&ceid=NG%3Aen'
  ],
  world: [
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://www.france24.com/en/rss',
    'https://news.google.com/rss/search?q=world%20news&hl=en&gl=US&ceid=US%3Aen'
  ],
  sports: [
    'https://www.completesports.com/feed',
    'https://soccernet.ng/feed',
    'https://www.espn.com/espn/rss/news',
    'https://news.google.com/rss/search?q=Nigeria%20sports&hl=en-NG&gl=NG&ceid=NG%3Aen'
  ],
  business: [
    'https://www.cnbc.com/id/10001147/device/rss/rss.html',
    'https://feeds.bbci.co.uk/news/business/rss.xml',
    'https://howwemadeitinafrica.com/feed',
    'https://news.google.com/rss/search?q=business%20Nigeria&hl=en-NG&gl=NG&ceid=NG%3Aen'
  ],
  tech: [
    'https://techcabal.com/feed',
    'https://techpoint.africa/feed',
    'https://techcrunch.com/feed/',
    'https://news.google.com/rss/search?q=technology%20Nigeria&hl=en-NG&gl=NG&ceid=NG%3Aen'
  ],
  crypto: [
    'https://cointelegraph.com/rss',
    'https://decrypt.co/feed',
    'https://news.google.com/rss/search?q=crypto%20bitcoin&hl=en&gl=US&ceid=US%3Aen'
  ],
  entertainment: [
    'https://variety.com/feed/',
    'https://deadline.com/feed/',
    'https://www.pulse.ng/entertainment/rss',
    'https://news.google.com/rss/search?q=Nigeria%20entertainment&hl=en-NG&gl=NG&ceid=NG%3Aen'
  ],
  culture: [
    'https://www.bellanaija.com/feed',
    'https://okayafrica.com/feed/',
    'https://musicinafrica.net/feed',
    'https://news.google.com/rss/search?q=Africa%20culture&hl=en&gl=US&ceid=US%3Aen'
  ],
  lifestyle: [
    'https://wwd.com/fashion-news/feed/',
    'https://www.theguardian.com/fashion/rss',
    'https://skift.com/feed/',
    'https://news.google.com/rss/search?q=lifestyle%20Nigeria&hl=en-NG&gl=NG&ceid=NG%3Aen'
  ],
  science: [
    'https://www.nature.com/nature.rss',
    'https://www.sciencenews.org/feed',
    'https://scitechdaily.com/feed/',
    'https://news.google.com/rss/search?q=science%20news&hl=en&gl=US&ceid=US%3Aen'
  ],
  jobs: [
    'https://weworkremotely.com/remote-jobs.rss',
    'https://reliefweb.int/jobs/rss.xml',
    'https://remoteok.com/remote-jobs.rss',
    'https://news.google.com/rss/search?q=jobs%20Nigeria&hl=en-NG&gl=NG&ceid=NG%3Aen'
  ],
  ghana: [
    'https://www.graphic.com.gh/rss.xml',
    'https://www.myjoyonline.com/feed/',
    'https://citinewsroom.com/feed',
    'https://news.google.com/rss/search?q=Ghana%20news&hl=en&gl=GH&ceid=GH%3Aen'
  ],
  kenya: [
    'https://www.standardmedia.co.ke/rss/kenya.php',
    'https://www.tuko.co.ke/?service=rss',
    'https://kbc.co.ke/feed',
    'https://news.google.com/rss/search?q=Kenya%20news&hl=en&gl=KE&ceid=KE%3Aen'
  ],
  'south-africa': [
    'https://www.news24.com/news24/rss',
    'https://www.dailymaverick.co.za/dmrss',
    'https://www.sowetanlive.co.za/rss/?publication=sowetan-live',
    'https://news.google.com/rss/search?q=South%20Africa%20news&hl=en&gl=ZA&ceid=ZA%3Aen'
  ],
  uk: [
    'https://feeds.bbci.co.uk/news/uk/rss.xml',
    'https://www.theguardian.com/uk/rss',
    'https://feeds.skynews.com/feeds/rss/home.xml',
    'https://news.google.com/rss/search?q=UK%20news&hl=en-GB&gl=GB&ceid=GB%3Aen'
  ],
  usa: [
    'https://rss.cnn.com/rss/edition.rss',
    'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
    'https://www.pbs.org/newshour/feeds/rss/headlines',
    'https://news.google.com/rss/search?q=US%20news&hl=en-US&gl=US&ceid=US%3Aen'
  ]
};

const aliases = { nigerian: 'nigerian-news', nigeria: 'nigerian-news', latest: 'nigerian-news' };
const labels = {
  'nigerian-news':'Nigeria', politics:'Politics', world:'World', sports:'Sports', business:'Business',
  tech:'Technology', crypto:'Crypto', entertainment:'Entertainment', culture:'Culture', lifestyle:'Lifestyle',
  science:'Science', jobs:'Jobs', ghana:'Ghana', kenya:'Kenya', 'south-africa':'South Africa', uk:'UK', usa:'USA'
};
const countryByCategory = {
  'nigerian-news':'Nigeria', politics:'Nigeria', ghana:'Ghana', kenya:'Kenya', 'south-africa':'South Africa',
  uk:'UK', usa:'USA', world:'Global', sports:'Global', business:'Global', tech:'Global', crypto:'Global',
  entertainment:'Global', culture:'Africa', lifestyle:'Global', science:'Global', jobs:'Global'
};

const cleanText = (value, max = 4000) => String(value || '')
  .replace(/<!\[CDATA\[/gi,'')
  .replace(/\]\]>/g,'')
  .replace(/<[^>]*>/g,' ')
  .replace(/&nbsp;/gi,' ')
  .replace(/&amp;/gi,'&')
  .replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'")
  .replace(/&lt;/gi,'<')
  .replace(/&gt;/gi,'>')
  .replace(/\s+/g,' ')
  .trim()
  .slice(0,max);

const decodeXml = value => cleanText(value, 12000);

function firstTag(block, tagNames) {
  for (const tag of tagNames) {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = block.match(re);
    if (match?.[1]) return match[1];
  }
  return '';
}

function firstAttr(block, tagNames, attr) {
  for (const tag of tagNames) {
    const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']+)["'][^>]*>`, 'i');
    const match = block.match(re);
    if (match?.[1]) return decodeXml(match[1]);
  }
  return '';
}

function parseXmlFeed(xml) {
  const items = [];
  const itemMatches = [...String(xml || '').matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];

  for (const match of itemMatches) {
    const block = match[2];
    const title = decodeXml(firstTag(block, ['title']));
    const link = decodeXml(firstTag(block, ['link'])) || firstAttr(block, ['link'], 'href');
    const guid = decodeXml(firstTag(block, ['guid','id']));
    const description = firstTag(block, ['content:encoded','content','description','summary']);
    const pubDate = decodeXml(firstTag(block, ['pubDate','published','updated','dc:date']));
    const author = decodeXml(firstTag(block, ['dc:creator','author','creator']));
    const source = decodeXml(firstTag(block, ['source']));
    const enclosure = firstAttr(block, ['enclosure','media:content','media:thumbnail'], 'url');
    const image = enclosure || decodeXml(String(description || '').match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || '');

    if (title && (link || guid)) items.push({ title, link: link || guid, guid, description, pubDate, author, source, image });
  }

  const channelTitle = decodeXml(firstTag(String(xml || ''), ['title']));
  return { title: channelTitle, items };
}

async function readFeed(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RealSSA-News/2.0; +https://realssanews.com.ng)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/plain, */*'
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    const feed = parseXmlFeed(xml);
    if (!feed.items.length) throw new Error('Feed parsed but contained no items');
    return feed;
  } catch (error) {
    console.warn(`[Vercel News] ${url}: ${error?.message || error}`);
    return null;
  }
}

function publishedDate(item) {
  const date = new Date(item.pubDate || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getImage(item) {
  if (/^https?:\/\//i.test(String(item.image || ''))) return item.image;
  const html = String(item.description || '');
  return html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || 'https://realssanews.com.ng/logo.png';
}

async function collect(category) {
  const normalized = aliases[category] || category;
  const urls = FEEDS[normalized] || FEEDS['nigerian-news'];
  const feeds = await Promise.all(urls.map(readFeed));
  const articles = [];
  const seen = new Set();

  feeds.forEach((feed, feedIndex) => {
    if (!feed || !Array.isArray(feed.items)) return;
    for (const item of feed.items.slice(0,20)) {
      const link = String(item.link || item.guid || '').trim();
      const title = cleanText(item.title,500);
      if (!link || !title || seen.has(link)) continue;
      seen.add(link);
      const date = publishedDate(item);
      const excerpt = cleanText(item.description || title,1000);
      const sourceFallback = urls[feedIndex] ? new URL(urls[feedIndex]).hostname.replace(/^www\./,'') : 'RSS';
      articles.push({
        id: link,
        title,
        excerpt,
        description: excerpt,
        original_excerpt: cleanText(excerpt,4000),
        image: getImage(item),
        author: cleanText(item.author,200),
        source_name: cleanText(item.source || feed.title || sourceFallback,200),
        external_link: link,
        published_at: date.toISOString(),
        date: date.toISOString(),
        category: labels[normalized] || normalized,
        feed_category: normalized,
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
  const batches = await Promise.all(categories.map(async category => {
    try { return await collect(category); } catch (error) {
      console.error(`[Vercel News] category ${category} failed:`, error?.message || error);
      return [];
    }
  }));
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
      articles = await collectCombined(['nigerian-news','politics','world','sports','business','tech']);
    } else {
      articles = await collect(category);
    }

    const requestedLimit = Number(req.query?.limit || 50);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 50,1),100);
    const result = articles.slice(0,limit);

    res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300');
    if (isLegacyFeed) return res.status(200).json(result);
    return res.status(200).json({articles:result,nextCursor:null,hasMore:false,source:'rss-live-fallback',category:category || (isForYou ? 'foryou' : 'latest')});
  } catch (error) {
    console.error('[Vercel News] handler failed:',error);
    const isLegacyFeed = /^\/news-feed\/?$/i.test(String(req.url || '').split('?')[0]);
    if (isLegacyFeed) return res.status(200).json([]);
    return res.status(200).json({articles:[],nextCursor:null,hasMore:false,source:'rss-live-fallback',error:'News temporarily unavailable'});
  }
};
