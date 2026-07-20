/**
 * RSS Ingestion Service
 * Fetches all RSS feeds, stores new articles in rss_articles table,
 * generates AI summaries, and pings search engines.
 * Called every 30 minutes by the Vercel cron job at GET /api/cron/ingest
 */

const crypto = require('crypto');
const { generateSummary, generateSocialHook, generateAIAnalysis, generateEmbedding } = require('./summariser');
const { pingIndexNow } = require('./indexnow');
const { pingWebSub } = require('./websub');
const { pingGoogleIndexingAPI } = require('./googleIndexing');
const notificationService = require('./notificationService');
const { postToBuffer } = require('./buffer');
const { extractArticle } = require('./extractor');

const SITE_URL = 'https://realssanews.com.ng';

// ── Feed Categories ────────────────────────────────────────────────────────
const FEED_CATEGORIES = [
  {
    category: 'nigerian-news',
    feeds: [
      'https://www.premiumtimesng.com/rss.xml',
      'https://www.vanguardngr.com/feed/',
      'https://guardian.ng/feed/',
      'https://www.channelstv.com/feed/',
      'https://www.thecable.ng/feed/',
      'https://businessday.ng/feed/',
      'https://nairametrics.com/rss',
      'https://infoguidenigeria.com/rss',
      'https://pmnewsnigeria.com/rss',
      'https://asorock.com/rss',
      'https://thenigerianvoice.com/rss'
    ]
  },
  {
    category: 'ghana',
    feeds: [
      'https://www.graphic.com.gh/rss.xml',
      'https://www.myjoyonline.com/feed/',
      'https://www.ghanaweb.com/GhanaHomePage/NewsArchive/rss.xml',
      'https://oneclickghana.com/feed',
      'https://peacefmonline.com/feed',
      'https://citinewsroom.com/feed'
    ]
  },
  {
    category: 'kenya',
    feeds: [
      'https://www.nation.co.ke/rss.xml',
      'https://www.tuko.co.ke/feed/',
      'https://www.pulselive.co.ke/feed/',
      'https://www.capitalfm.co.ke/news/feed/',
      'https://www.kenyans.co.ke/feeds/news',
      'https://citizentv.co.ke/feed'
    ]
  },
  {
    category: 'south-africa',
    feeds: [
      'https://www.news24.com/rss.xml',
      'https://www.timeslive.co.za/rss.xml',
      'https://www.dailymaverick.co.za/rss.xml',
      'https://www.dailymaverick.co.za/dmrss',
      'https://www.citizen.co.za/feed',
      'https://iol.co.za/rss',
      'https://mg.co.za/rss',
      'https://www.citizen.co.za/rss'
    ]
  },
  {
    category: 'uk',
    feeds: [
      'http://feeds.bbci.co.uk/news/uk/rss.xml',
      'https://www.theguardian.com/uk/rss',
      'https://feeds.skynews.com/feeds/rss/home.xml',
      'https://www.independent.co.uk/rss'
    ]
  },
  {
    category: 'sports',
    feeds: [
      'https://allafrica.com/tools/headlines/rdf/sport/headlines.rdf',
      'https://allafrica.com/tools/headlines/rdf/soccer/headlines.rdf',
      'https://allafrica.com/tools/headlines/rdf/athletics/headlines.rdf',
      'https://www.completesports.com/feed',
      'https://soccernet.ng/feed',
      'https://allnigeriasoccer.com/feed',
      'https://gormahia.com/feed',
      'https://africatopsports.com/feed',
      'https://supersport.com/rss',
      'https://ghanasoccernet.com/feed',
      'https://ghanasoccernet.com/rss',
      'https://thenff.com/feed',
      'https://www.espn.com/espn/rss/news',
      'https://www.bbc.co.uk/sport/rss.xml',
      'https://www.skysports.com/rss/12040',
      'https://feeds.bbci.co.uk/sport/football/rss.xml',
      'https://www.90min.com/posts.rss',
      'https://www.foottheball.com/feed/',
      'https://sportslens.com/feed/',
      'https://www.caughtoffside.com/feed/',
      'https://www.soccernews.com/feed/',
      'https://www.saharafootball.net/feed/',
      'https://www.shoot.co.uk/feed/',
      'https://crickettimes.com/feed/',
      'https://cricketaddictor.com/feed/',
      'https://www.crictracker.com/feed/',
      'https://sportzwiki.com/cricket/feed/',
      'https://www.basketballforcoaches.com/feed/',
      'https://thehoopdoctors.com/feed/',
      'https://sneakernews.com/category/basketball/feed/',
      'https://feeds.bbci.co.uk/sport/basketball/rss.xml',
      'https://www.sportsnet.ca/tennis/feed',
      'https://www.standard.co.uk/sport/tennis/rss',
      'https://www.espn.com/espn/rss/tennis/news',
      'https://www.usopen.org/en_US/news/rss/usopen.rss',
      'https://novakdjokovic.com/en/feed/',
      'https://www.theguardian.com/sport/tennis/rss',
      'https://www.tennisfitness.com/blog.rss',
      'https://feeds.bbci.co.uk/sport/tennis/rss.xml',
      'https://www.fia.com/rss/press-release',
      'https://www.nytimes.com/svc/collections/v1/publish/https://www.nytimes.com/topic/organization/formula-one/rss.xml',
      'https://www.mirror.co.uk/sport/formula-1/?service=rss',
      'https://www.independent.co.uk/sport/motor-racing/formula1/rss',
      'https://www.motor1.com/rss/category/motorsport/',
      'https://www.autosport.com/rss/f1/news/',
      'https://racingnews365.com/feed/news.xml',
      'https://www.formula1.com/en/latest/all.xml',
      'https://mlbcomblogs.mlblogs.com/feed',
      'https://www.mlbtraderumors.com/feed',
      'https://blogs.fangraphs.com/feed/',
      'https://d1baseball.com/feed/',
      'https://www.yardbarker.com/rss/sport_merged/1',
      'https://www.baseballprospectus.com/feed/',
      'https://razzball.com/feed/',
      'https://www.drivelinebaseball.com/blog/feed/',
      'https://thehockeynews.com/rss/THNHOME/full',
      'https://theahl.com/feed',
      'https://www.hookedonhockeymagazine.com/feed/',
      'https://www.sbnation.com/rss/hockey/index.xml',
      'https://feeds.feedburner.com/wrestlinginc-news',
      'https://thewrestlingclassic.com/feed/',
      'https://www.ringsidenews.com/feed/',
      'https://prowrestlingstories.com/blog/feed/',
      'https://wrestletalk.com/feed/',
      'https://www.pwmania.com/feed',
      'https://wrestlingheadlines.com/feed/'
    ]
  },
  {
    category: 'usa',
    feeds: [
      'http://rss.cnn.com/rss/edition.rss',
      'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
      'https://www.pbs.org/newshour/feeds/rss/headlines',
      'https://feeds.npr.org/1001/rss.xml',
      'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
      'https://feeds.washingtonpost.com/rss/world',
      'https://www.voanews.com/api/zq$mqkvi_q'
    ]
  },
  {
    category: 'world',
    feeds: [
      'https://africa.com/feed',
      'https://asia.nikkei.com/rss/feed/nar',
      'https://asiatimes.com/feed',
      'https://thediplomat.com/feed',
      'https://asianews.network/feed',
      'https://dailynewsegypt.com/rss',
      'https://dailynews.co.tz/rss',
      'https://africatimes.com/feed',
      'https://namibian.com.na/rss',
      'https://ugnews.net/rss',
      'http://feeds.bbci.co.uk/news/world/rss.xml',
      'https://www.aljazeera.com/xml/rss/all.xml',
      'https://www.france24.com/en/rss',
      'https://rss.dw.com/rdf/rss-en-world',
      'http://api.rtve.es/api/noticias.rss',
      'https://www.abc.net.au/news/feed/51120/rss.xml',
      'https://www.cbc.ca/cmlink/rss-world',
      'https://www.scmp.com/rss/91/feed',
      'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms',
      'https://www.japantimes.co.jp/feed/',
      'https://www.spiegel.de/international/index.rss',
      'https://www.lemonde.fr/en/rss/une.xml',
      'https://yle.fi/uutiset/osasto/news/rss'
    ]
  },
  {
    category: 'crypto',
    feeds: [
      'https://cointelegraph.com/rss',
      'https://decrypt.co/feed'
    ]
  },
  {
    category: 'culture',
    feeds: [
      'https://www.bellanaija.com/nollywood/feed',
      'https://kemifilani.ng/feed',
      'https://fakaza.com/feed/rss',
      'https://okayafrica.com/feed/',
      'https://www.essence.com/feed/',
      'https://www.rollingstone.com/feed/',
      'https://www.bellanaija.com/feed',
      'https://notjustok.com/feed',
      'https://tooxclusive.com/feed',
      'https://mp3bullet.ng/feed',
      'https://afrobeatsintelligence.substack.com/feed',
      'https://nollycritic.com/feed',
      'https://realnollywood.com/feed',
      'https://novice2star.com/feed',
      'https://aipate.com/feed',
      'https://nollywire.com/feed',
      'https://unorthodoxreviews.com/feed',
      'https://musicinafrica.net/feed',
      'https://groove-africa.com/feed',
      'https://musicarenagh.com/feed',
      'https://zambianmusicblog.co/rss'
    ]
  },
  {
    category: 'entertainment',
    feeds: [
      'https://variety.com/feed/',
      'https://deadline.com/feed/',
      'https://www.pulse.ng/entertainment/rss'
    ]
  },
  {
    category: 'jobs',
    feeds: [
      'https://weworkremotely.com/remote-jobs.rss',
      'https://reliefweb.int/jobs/rss.xml',
      'https://remoteok.com/remote-jobs.rss'
    ]
  },
  {
    category: 'tech',
    feeds: [
      'https://techsoma.africa/feed',
      'https://fintechnews.africa/feed',
      'https://siliconcanals.com/feed',
      'https://techcabal.com/feed',
      'https://techpoint.africa/feed',
      'https://techcrunch.com/feed/',
      'https://www.wired.com/feed/rss',
      'https://www.theverge.com/rss/index.xml',
      'https://www.cnet.com/rss/news/',
      'https://feeds.arstechnica.com/arstechnica/index',
      'https://www.techradar.com/feeds.xml'
    ]
  },
  {
    category: 'business',
    feeds: [
      'https://www.africanews.com/feed/rss?themes=business',
      'https://rss.punchng.com/v1/category/business',
      'https://howwemadeitinafrica.com/feed',
      'https://addisfortune.net/rss',
      'https://www.cnbc.com/id/10001147/device/rss/rss.html',
      'https://www.ft.com/rss/home/international',
      'https://feeds.content.dowjones.io/public/rss/WSJcomUSBusiness',
      'https://feeds.bbci.co.uk/news/business/rss.xml',
      'https://economictimes.indiatimes.com/News/rssfeeds/1715249553.cms',
      'https://www.economywatch.com/feed',
      'https://www.newsmax.com/rss/economy/2/',
      'https://feeds.npr.org/1006/rss.xml',
      'https://www.alternet.org/feeds/economy.rss',
      'https://financialpost.com/category/news/economy/feed.xml',
      'https://www.cityam.com/category/economics/feed/',
      'https://www.thehindubusinessline.com/economy/feeder/default.rss',
      'https://www.businessdailyafrica.com/service/rss/bd/1939134/feed.rss'
    ]
  },
  {
    category: 'science',
    feeds: [
      'https://www.news-medical.net/syndication.axd?format=rss',
      'https://feeds-api.dotdashmeredith.com/v1/rss/google/adf185b2-ff7d-4fe3-a978-b59ff8528c53',
      'https://www.nature.com/nature.rss',
      'https://www.sciencenews.org/feed',
      'https://scitechdaily.com/feed/',
      'https://www.sciencedaily.com/rss/all.xml',
      'https://earth.org/feed/',
      'https://www.greenmatters.com/rss',
      'https://www.theguardian.com/world/natural--disasters/rss'
    ]
  },
  {
    category: 'lifestyle',
    feeds: [
      'https://feeds-api.dotdashmeredith.com/v1/rss/google/85fdec1d-95a2-4e50-8641-5e2d0ef816a7',
      'https://wwd.com/fashion-news/feed/',
      'https://www.theguardian.com/fashion/rss',
      'https://www.elle.com/rss/default.xml',
      'https://www.whowhatwear.com/feeds.xml',
      'https://nypost.com/fashion-and-beauty/feed/',
      'https://www.vogue.com/feed/rss',
      'https://www.marieclaire.com/feeds.xml',
      'https://feeds-api.dotdashmeredith.com/v1/rss/google/79365970-e87d-4fb6-966a-1c657b08f44f',
      'https://nypost.com/celebrities/feed/',
      'https://www.thesun.co.uk/tvandshowbiz/celebrities/feed/',
      'https://hollywoodlife.com/feed/',
      'https://www.eater.com/rss/index.xml',
      'https://feeds-api.dotdashmeredith.com/v1/rss/google/90b927aa-066f-4f66-9162-a018ad8ea366',
      'https://skift.com/feed/',
      'https://www.traveldailynews.com/feed/'
    ]
  },
  {
    category: 'local',
    feeds: [
      'https://techpoint.africa/feed/',
      'https://www.lindaikejisblog.com/feed',
      'https://techcabal.com/feed/',
      'https://disrupt-africa.com/feed/'
    ]
  },
  {
    // Social media pull via Nitter RSS (free, no API key needed)
    // Nitter mirrors Twitter/X accounts as RSS feeds
    // Format: https://nitter.net/<handle>/rss
    category: 'social',
    feeds: [
      // African news accounts
      'https://nitter.net/channelstv/rss',
      'https://nitter.net/PremiumTimesng/rss',
      'https://nitter.net/vanguardngrnews/rss',
      'https://nitter.net/thecableng/rss',
      'https://nitter.net/GuardianNigeria/rss',
      'https://nitter.net/BBCAfrica/rss',
      'https://nitter.net/AlJazeera/rss',
      'https://nitter.net/CNNAfrica/rss',
      // Sports accounts
      'https://nitter.net/SuperSport/rss',
      'https://nitter.net/BBCSport/rss',
      'https://nitter.net/SkySports/rss',
      'https://nitter.net/thenff/rss',
      // Hashtag feeds (trending topics)
      'https://nitter.net/search/rss?q=%23Nigeria&f=tweets',
      'https://nitter.net/search/rss?q=%23NigeriaNews&f=tweets',
      'https://nitter.net/search/rss?q=%23NPFL&f=tweets',
      'https://nitter.net/search/rss?q=%23Afrobeats&f=tweets',
    ]
  }
];

// ── Helpers ────────────────────────────────────────────────────────────────

function hashUrl(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 64);
}

// Keywords that indicate a logo/icon rather than a real article photo
const LOGO_URL_PATTERNS = /logo|icon|brand|placeholder|default[-_]?image|site[-_]?image|gravatar|avatar|badge|sprite|watermark|favicon|punchng\.com\/wp-content\/uploads\/\d{4}\/\d{2}\/cropped-|punch-logo/i;

function isLikelyStoryImage(url) {
  if (!url || !url.startsWith('http')) return false;
  // Specific check to reject Punch's generic fallbacks and brand logo placeholders
  if (url.includes('punchng.com') && (url.includes('cropped-') || url.includes('punch-logo') || url.includes('PUNCH-Logo'))) return false;
  if (LOGO_URL_PATTERNS.test(url)) return false;
  if (url.startsWith('data:')) return false;
  return true;
}

function extractImage(item) {
  const mc = item['media:content'];
  if (mc) {
    const arr = Array.isArray(mc) ? mc : [mc];
    for (const m of arr) {
      const u = (m.$ && m.$.url) || m.url;
      if (isLikelyStoryImage(u)) return u;
    }
  }
  const mt = item['media:thumbnail'];
  if (mt) {
    const arr = Array.isArray(mt) ? mt : [mt];
    for (const m of arr) {
      const u = (m.$ && m.$.url) || m.url;
      if (isLikelyStoryImage(u)) return u;
    }
  }
  if (item.enclosure && isLikelyStoryImage(item.enclosure.url)) return item.enclosure.url;
  const ce = item['content:encoded'] || item.content || item.description || item.summary || '';
  const imgMatch = ce.match(/<img[^>]+src=["']([^"'>\s]+)["']/i);
  if (imgMatch && isLikelyStoryImage(imgMatch[1])) return imgMatch[1];

  // NOTE: item.image.url is intentionally excluded — it is the publication
  // logo (feed-level), never an article photo. Returning null triggers the
  // OG-image fetch below which gets the real story image.
  return null;
}


// SSRF protection — block private/loopback IP ranges
const dns = require('dns').promises;
const PRIVATE_IP_RE = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1$|fc00:|fd)/;

async function isSafeUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const { address } = await dns.lookup(u.hostname);
    return !PRIVATE_IP_RE.test(address);
  } catch { return false; }
}

// Fetch OG image fallback if RSS has no image
async function fetchOgImage(url) {
  try {
    if (!(await isSafeUrl(url))) return null;
    const res = await fetch(url, { 
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RealSSABot/1.0; +https://realssanews.com.ng)'
      }
    });
    const html = await res.text();
    
    // Try multiple OG image patterns
    const patterns = [
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"'>]+)["']/i,
      /<meta[^>]*content=["']([^"'>]+)["'][^>]*property=["']og:image["']/i,
      /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"'>]+)["']/i,
      /<meta[^>]*property=["']twitter:image["'][^>]*content=["']([^"'>]+)["']/i
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let imgUrl = match[1];
        // Handle relative URLs
        if (imgUrl.startsWith('http')) {
          // Keep as is
        } else if (imgUrl.startsWith('//')) {
          imgUrl = 'https:' + imgUrl;
        } else if (imgUrl.startsWith('/')) {
          const urlObj = new URL(url);
          imgUrl = urlObj.origin + imgUrl;
        }
        
        if (isLikelyStoryImage(imgUrl)) {
          return imgUrl;
        }
      }
    }
  } catch (e) {
    // Ignore timeouts or blocked requests - this is expected for some sites
  }
  return null;
}

// Rate limiter — max 12 calls per minute for Gemini (stays under 15 RPM limit)
const SUMMARY_DELAY_MS = 5000;
async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Notification Worthiness Filter ───────────────────────────────────────
// Hard alerts: high-impact, time-critical events — always notify
const HARD_KEYWORDS = [
  'breaking', 'killed', 'kills', 'dead', 'deaths', 'crash', 'explosion',
  'attack', 'shooting', 'arrested', 'detained', 'coup', 'emergency',
  'earthquake', 'flood', 'fire', 'collapse', 'crisis',
  // High-impact African/Nigerian news triggers
  'impeached', 'suspended', 'convicted', 'sentenced', 'acquitted',
  'sacked', 'resigns', 'resigned', 'appointed', 'elected',
  'protest', 'protests', 'strike', 'riot', 'riots',
  'wins', 'victory', 'defeat', 'qualifies', 'qualified',
  'announces', 'announced', 'signed', 'passes', 'passed',
  'kidnapped', 'abducted', 'rescued', 'missing',
  'fuel', 'naira', 'dollar', 'economy', 'inflation',
  'buhari', 'tinubu', 'presidency', 'senate', 'house of rep',
  'supreme court', 'efcc', 'nnpc', 'cbn',
  // Nigerian Politics & Figures
  'atiku', 'peter obi', 'wike', 'inec', 'apc', 'pdp', 'labour party',
  'obasanjo', 'dangote', 'cbn governor', 'el-rufai', 'ganduje', 'fubara',
  'sowore', 'dss', 'nsa', 'aso rock', 'national assembly', 'governorship',
  'tribunal', 'election petition', 'by-election', 'impeachment',
  // African Leaders & Politics
  'ruto', 'ramaphosa', 'mahama', 'kagame', 'museveni', 'okonjo-iweala',
  'samia', 'mnangagwa', 'lourenco', 'faye', 'ouattara', 'akufo-addo',
  'au summit', 'african union', 'ecowas', 'sadc',
  // Crime, Security & Terrorism
  'bandits', 'terrorists', 'terrorism', 'boko haram', 'iswap', 'ransom',
  'massacre', 'gunmen', 'soldiers killed', 'troops', 'military operation',
  'bomb blast', 'suicide bomber', 'insurgency', 'separatist', 'ipob',
  'oodua', 'secession', 'banditry', 'kidnapping', 'hostage',
  // Economy & Finance
  'devaluation', 'subsidy', 'petrol price', 'electricity tariff', 'blackout',
  'minimum wage', 'unemployment', 'gdp', 'imf', 'world bank', 'debt',
  'forex', 'exchange rate', 'interest rate', 'budget', 'tax', 'customs',
  'stock exchange', 'nse', 'oil price', 'crude oil', 'opec',
  // Global Geopolitics & Leaders
  'trump', 'biden', 'putin', 'zelensky', 'netanyahu', 'macron', 'starmer', 'xi jinping',
  'war', 'missile', 'missiles', 'bombing', 'bombed', 'clash', 'clashes', 'sanctions', 'tariffs',
  'israel', 'gaza', 'ukraine', 'russia', 'nato', 'un', 'united nations',
  // Global Markets, Finance & Tech
  'federal reserve', 'rate cut', 'recession', 'bitcoin', 'crypto', 'btc',
  'cyberattack', 'hacked', 'musk', 'openai', 'artificial intelligence', 'ai ban',
  // Global Disasters & Weather
  'tsunami', 'hurricane', 'typhoon', 'tornado', 'wildfire', 'outbreak', 'pandemic', 'epidemic',
  // Sports — African & Global
  'super eagles', 'afcon', 'caf', 'fifa', 'world cup qualifier', 'world cup',
  'champions league', 'premier league', 'transfer window', 'champions league final',
  'ballon dor', 'olympics', 'commonwealth games', 'npfl', 'chan',
  'osimhen', 'salah', 'mbappe', 'haaland', 'ronaldo', 'messi',
  // Entertainment & Culture
  'burna boy', 'wizkid', 'davido', 'afrobeats', 'nollywood', 'amvca',
  'grammy', 'grammys', 'oscars', 'bet awards', 'headies', 'mtv africa',
  'tiwa savage', 'asake', 'olamide', 'ckay', 'rema', 'ayra starr',
  'netflix', 'prime video', 'disney', 'box office',
];
// Soft alerts: newsworthy but prone to false positives — only notify from authority sources
const SOFT_KEYWORDS = [
  'wins', 'win', 'victory', 'announces', 'announced', 'resigns', 'resigned',
  'appointed', 'sacked', 'fired', 'elected', 'impeached', 'suspended',
  'sentenced', 'convicted', 'acquitted', 'protests', 'strike'
];
// Exclusion words — kill the alert even if a positive keyword matched
const EXCLUSION_WORDS = [
  'throwback', 'recalled', 'predicted', 'allegedly', 'rumour', 'rumor',
  'satire', 'opinion', 'analysis', 'review', 'preview', 'sponsored',
  'how to', 'top 10', 'list of', 'history of', 'throwback'
];
// Authority feeds — soft keywords only fire from these sources (matched against feed URL hostname)
const AUTHORITY_HOSTNAMES = [
  'premiumtimesng.com', 'vanguardngr.com', 'punchng.com', 'guardian.ng',
  'channelstv.com', 'thecable.ng', 'bbc.co.uk', 'bbc.com', 'aljazeera.com',
  'cnn.com', 'reuters.com', 'apnews.com', 'nation.co.ke', 'news24.com',
  'dailymaverick.co.za', 'theafricareport.com'
];

// Keywords short enough to produce false substring matches — use word-boundary regex
const WORD_BOUNDARY_KW = new Set(['fire', 'win', 'wins', 'dead', 'coup', 'strike', 'tax', 'war', 'gdp', 'btc', 'apc', 'pdp', 'au']);

function kwMatch(lower, kw) {
  if (WORD_BOUNDARY_KW.has(kw)) {
    return new RegExp(`\\b${kw}\\b`).exec(lower);
  }
  const idx = lower.indexOf(kw);
  return idx !== -1 ? { index: idx } : null;
}

/**
 * Returns a score > 0 if the article is worth a push notification, 0 if not.
 * Score 3 = hard alert front-loaded, 2 = hard alert buried, 1 = soft alert from authority.
 */
function notificationScore(title, category, feedUrl) {
  const lower = title.toLowerCase();

  // Bail immediately if any exclusion word is present
  if (EXCLUSION_WORDS.some(w => lower.includes(w))) return 0;

  // Hard keyword match — position matters
  for (const kw of HARD_KEYWORDS) {
    const match = kwMatch(lower, kw);
    if (match) return match.index < 40 ? 3 : 2;
  }

  // Soft keyword match — only from authority hostnames
  let isAuthority = false;
  try {
    const hostname = new URL(feedUrl).hostname.replace(/^www\./, '');
    isAuthority = AUTHORITY_HOSTNAMES.some(h => hostname === h || hostname.endsWith('.' + h));
  } catch { /* invalid URL — not authority */ }

  if (isAuthority) {
    for (const kw of SOFT_KEYWORDS) {
      const match = kwMatch(lower, kw);
      if (match) return 1;
    }
    // No soft keyword matched — not worth a notification even from authority source
    return 0;
  }

  return 0;
}

// ── Title De-duplication ───────────────────────────────────────────────────
// Strip stop words and punctuation, return array of meaningful keywords
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','are','was','were','be','been','has','have','had',
  'it','its','as','up','out','into','over','after','says','said','new',
  'just','will','that','this','his','her','their','our','your','about'
]);

function titleKeywords(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function titleSimilarity(titleA, titleB) {
  const wordsA = new Set(titleKeywords(titleA));
  const wordsB = new Set(titleKeywords(titleB));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let matches = 0;
  for (const w of wordsA) if (wordsB.has(w)) matches++;
  // Use the smaller set as denominator — catches cases where one title is a subset
  return matches / Math.min(wordsA.size, wordsB.size);
}

// Returns true if a similar story already exists in the recentTitles array
function isDuplicateStory(title, recentTitles) {
  for (const row of recentTitles) {
    if (titleSimilarity(title, row.title) >= 0.65) return true;
  }
  return false;
}

// ── Main Ingestion Function ────────────────────────────────────────────────

const fs = require('fs');
// Removed NODE_TLS_REJECT_UNAUTHORIZED=0 — use per-request CA handling instead
const path = require('path');

async function ingestAllFeeds(pool, rssParser, targetCategory = null) {
  console.log(`🔄 Starting RSS ingestion cycle...${targetCategory ? ` [Category: ${targetCategory}]` : ''}`);
  let newArticleIds = [];
  let summaryCount = 0;
  let aiProcessedCount = 0;
  let bestNotifCandidate = null;
  const MAX_SUMMARIES_PER_CYCLE = 12;

  // Pre-fetch recent titles, url_hashes, and story_hashes for efficient de-duplication
  let recentTitles = [];
  const existingUrlHashes = new Set();
  const existingStoryHashes = new Set();

  if (pool) {
    try {
      const recentRes = await pool.query(
        `SELECT title, url_hash, story_hash FROM rss_articles
         WHERE published_at > NOW() - INTERVAL '24 hours'`
      );
      recentTitles = recentRes.rows; // Keep the full row for title similarity
      for (const row of recentRes.rows) {
        if (row.url_hash) existingUrlHashes.add(row.url_hash);
        if (row.story_hash) existingStoryHashes.add(row.story_hash);
      }
      console.log(`Dedup: Pre-fetched ${recentTitles.length} articles (${existingUrlHashes.size} url_hashes, ${existingStoryHashes.size} story_hashes).`);
    } catch (e) {
      console.error('Dedup pre-fetch error:', e.message);
    }
  }

  // 1. Merge base FEED_CATEGORIES with world_feeds.json
  let allCategories = [...FEED_CATEGORIES];
  try {
    const worldFeedsData = require('../data/world_feeds.json');
    for (const [slug, data] of Object.entries(worldFeedsData)) {
      allCategories.push({
        category: slug,
        feeds: data.urls || (data.url ? [data.url] : []),
        videoFeeds: data.youtube_urls || []
      });
    }
  } catch (err) {
    console.error('Error loading world_feeds.json:', err.message);
  }

  // 'social' runs every cycle alongside core categories — tweets go stale fast
  const mainSlugs = new Set(FEED_CATEGORIES.map(c => c.category));

  // 2. Select categories to fetch this cycle
  let categoriesToFetch = [];

  if (targetCategory) {
    // Explicit override — used by manual cron calls
    categoriesToFetch = allCategories.filter(c => c.category === targetCategory);

  } else {
    // ── Round-Robin Rotation Engine ──────────────────────────────────────────────────
    // Tier 1 (main categories): ALL run every cycle — they update fast and are the core UX
    // Tier 2 (world countries): pick the 3 coldest by last_ingested_at — deterministic rotation
    
    // Fetch all slugs for database mapping
    const allSlugs = allCategories.map(c => c.category);
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS feed_schedule (
          category TEXT PRIMARY KEY,
          tier SMALLINT DEFAULT 2,
          last_ingested_at TIMESTAMPTZ,
          failure_count INT DEFAULT 0,
          quarantined_until TIMESTAMPTZ
        )
      `);
      await pool.query(
        `INSERT INTO feed_schedule (category, tier)
         SELECT u.cat,
                CASE WHEN u.cat = ANY($2::text[]) THEN 1 ELSE 2 END
         FROM unnest($1::text[]) AS u(cat)
         ON CONFLICT (category) DO NOTHING`,
         [allSlugs, [...mainSlugs]]
      );
    } catch (e) {
      console.warn('feed_schedule upsert skipped:', e.message);
    }

    // Fetch active non-quarantined categories
    let activeCategoriesSet = new Set(allSlugs);
    try {
      const activeRes = await pool.query(
        `SELECT category FROM feed_schedule
         WHERE quarantined_until IS NULL OR quarantined_until < NOW()`
      );
      activeCategoriesSet = new Set(activeRes.rows.map(r => r.category));
    } catch (e) {
      console.warn('Failed to query active categories, using all:', e.message);
    }

    const mainCategories = allCategories.filter(c => mainSlugs.has(c.category) && activeCategoriesSet.has(c.category));
    const worldCategories = allCategories.filter(c => !mainSlugs.has(c.category) && activeCategoriesSet.has(c.category));

    // Pick 3 coldest active world categories
    let coldestWorld = [];
    try {
      const res = await pool.query(
        `SELECT category FROM feed_schedule
         WHERE tier = 2
           AND (quarantined_until IS NULL OR quarantined_until < NOW())
         ORDER BY last_ingested_at ASC NULLS FIRST
         LIMIT 3`
      );
      const coldSlugs = new Set(res.rows.map(r => r.category));
      coldestWorld = worldCategories.filter(c => coldSlugs.has(c.category));
    } catch (e) {
      console.warn('feed_schedule query failed, falling back to random world pick:', e.message);
      coldestWorld = worldCategories.sort(() => 0.5 - Math.random()).slice(0, 3);
    }

    // Always include all main categories — never let rotation produce zero feeds
    categoriesToFetch = [...mainCategories, ...coldestWorld];
    if (categoriesToFetch.length === 0) {
      console.warn('Rotation produced 0 categories — falling back to all main categories');
      categoriesToFetch = allCategories.filter(c => mainSlugs.has(c.category));
    }
    console.log(
      `📅 Rotation: all ${mainCategories.length} active main + world [${coldestWorld.map(c => c.category).join(', ')}]`
    );
  }

  // 3. Build feed fetch list
  const allUrls = [];
  for (const { category, feeds, videoFeeds } of categoriesToFetch) {
    // Vercel optimization: cap feeds, Fly.io does all
    const feedLimit = process.env.VERCEL ? 2 : undefined;
    const videoLimit = process.env.VERCEL ? 1 : undefined;

    const pickedFeeds = (feeds || []).slice(0, feedLimit);
    for (const url of pickedFeeds) {
      allUrls.push({ category, url, contentType: 'article' });
    }
    const pickedVideo = (videoFeeds || []).slice(0, videoLimit);
    for (const url of pickedVideo) {
      allUrls.push({ category, url, contentType: 'video' });
    }
  }

  // 4. Wait for all feeds to fetch in parallel and process them immediately to prevent OOM
  const BATCH_SIZE = 10;
  for (let i = 0; i < allUrls.length; i += BATCH_SIZE) {
    const batch = allUrls.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(({ category, url, contentType }) => {
      const startTime = Date.now();
      return fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        },
        signal: AbortSignal.timeout(25000)
      })
      .then(res => {
        if (!res.ok) throw new Error(`Status code ${res.status}`);
        return res.text();
      })
      .then(xmlText => {
        const sanitizedXml = xmlText.replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g, '&amp;');
        return rssParser.parseString(sanitizedXml);
      })
      .then(async feed => {
        const responseTime = Date.now() - startTime;
        if (pool) {
          try {
            await pool.query(
              `INSERT INTO feed_health (feed_url, category, last_success, last_error, error_count, avg_response_ms)
               VALUES ($1, $2, NOW(), NULL, 0, $3)
               ON CONFLICT (feed_url) DO UPDATE
               SET category = EXCLUDED.category,
                   last_success = NOW(),
                   last_error = NULL,
                   error_count = 0,
                   avg_response_ms = ROUND((feed_health.avg_response_ms * 4 + EXCLUDED.avg_response_ms) / 5.0)`,
              [url, category, responseTime]
            );

            await pool.query(
              `UPDATE feed_schedule SET failure_count = 0, quarantined_until = NULL WHERE category = $1`,
              [category]
            );
          } catch (dbErr) {
            console.error(`Failed to update feed success log for ${category}:`, dbErr.message);
          }
        }
        return { category, feed, url, contentType };
      })
      .catch(async err => {
        console.warn(`Feed error (${url}): ${err.message}`);
        const responseTime = Date.now() - startTime;
        if (pool) {
          try {
            await pool.query(
              `INSERT INTO feed_health (feed_url, category, last_success, last_error, error_count, avg_response_ms)
               VALUES ($1, $2, NULL, $3, 1, $4)
               ON CONFLICT (feed_url) DO UPDATE
               SET category = EXCLUDED.category,
                   last_error = EXCLUDED.last_error,
                   error_count = feed_health.error_count + 1,
                   avg_response_ms = ROUND((feed_health.avg_response_ms * 4 + EXCLUDED.avg_response_ms) / 5.0)`,
              [url, category, err.message, responseTime]
            );

            const failRes = await pool.query(
              `UPDATE feed_schedule 
               SET failure_count = failure_count + 1 
               WHERE category = $1 
               RETURNING failure_count`,
              [category]
            );
            if (failRes.rows.length > 0) {
              const count = failRes.rows[0].failure_count;
              if (count >= 3) {
                await pool.query(
                  `UPDATE feed_schedule 
                   SET quarantined_until = NOW() + INTERVAL '24 hours' 
                   WHERE category = $1`,
                  [category]
                );
                console.error(`🚨 Category [${category}] QUARANTINED for 24 hours due to 3 consecutive failures.`);
              }
            }
          } catch (dbErr) {
            console.error(`Failed to update feed failure log for ${category}:`, dbErr.message);
          }
        }
        return null;
      });
    });
    const batchResults = await Promise.all(batchPromises);
    
    // Process this batch immediately
    for (const itemResult of batchResults) {
      if (!itemResult) continue;
      const { category, feed, contentType } = itemResult;
      if (!feed || !feed.items) continue;

      // Free tier: max 15 items per feed to keep cycles fast
      const sliceLimit = process.env.VERCEL ? 2 : 15;
      for (const item of feed.items.slice(0, sliceLimit)) { 
        const externalLink = item.link || item.guid;
        if (!externalLink) continue;

        const urlHash = hashUrl(externalLink);

        // Skip if url_hash already exists (in-memory check)
        if (existingUrlHashes.has(urlHash)) {
          continue;
        }

        const title = item.title || 'Untitled';
        
        // Clean source names from verbose boilerplate suffixes
        const cleanSourceName = (rawName) => {
          if (!rawName) return 'RealSSA News';
          return rawName
            .replace(/\s*(-\s*Latest News|\|\s*Nigeria's Most Widely Read Newspaper|-\s*BBC News|\s*-\s*The Cable|\s*-\s*Vanguard News|\s*-\s*Premium Times).*$/i, '')
            .trim();
        };
        const sourceName = cleanSourceName(feed.title || 'RealSSA News');

        // The Fingerprint Logic (Deduplication)
        const storyHash = crypto.createHash('md5').update(title + sourceName).digest('hex');

        // Skip if story_hash already exists (in-memory check)
        if (existingStoryHashes.has(storyHash)) {
          console.log(`Hash Dedup: skipping "${title.slice(0, 60)}"`);
          continue;
        }

        // Fast keyword deduplication check
        let isKeywordDuplicate = false;
        let isBorderlineDuplicate = false;
        
        for (const row of recentTitles) {
          const sim = titleSimilarity(title, row.title);
          if (sim >= 0.65) {
            isKeywordDuplicate = true;
            break;
          } else if (sim >= 0.35) {
            isBorderlineDuplicate = true;
          }
        }

        if (isKeywordDuplicate) {
          console.log(`Dedup (Keyword): skipping "${title.slice(0, 60)}"`);
          continue;
        }

        // Slow semantic pass for borderline duplicates using pgvector
        if (isBorderlineDuplicate && pool) {
          try {
            const embedding = await generateEmbedding(title);
            if (embedding && Array.isArray(embedding)) {
              const vectorString = `[${embedding.join(',')}]`;
              const semanticRes = await pool.query(
                `SELECT id, title FROM rss_articles 
                 WHERE published_at >= NOW() - INTERVAL '24 hours'
                   AND embedding <=> $1::vector < 0.15 
                 LIMIT 1`,
                [vectorString]
              );
              if (semanticRes.rows.length > 0) {
                console.log(`Dedup (Semantic): skipping "${title.slice(0, 60)}" (matched: "${semanticRes.rows[0].title.slice(0, 40)}")`);
                continue;
              }
            }
          } catch (embedErr) {
            console.error('Semantic dedup check error:', embedErr.message);
          }
        }

        // Add to recentTitles to prevent duplicates within the same fetch cycle
        recentTitles.push({ title });
        existingUrlHashes.add(urlHash);
        existingStoryHashes.add(storyHash);
        const originalExcerpt = (item.contentSnippet || item.summary || '').replace(/<[^>]+>/g, '').slice(0, 500);
        let image = extractImage(item);
        
        // YouTube video thumbnail
        if (contentType === 'video' && externalLink.includes('watch?v=')) {
          const vId = externalLink.split('v=')[1]?.split('&')[0];
          if (vId) {
            image = `https://img.youtube.com/vi/${vId}/hqdefault.jpg`;
          }
        }
        
        // Open Graph Fallback (try to fetch image from article page)
        if (!image) {
          console.log(`No RSS image for "${title}", trying OG fetch...`);
          let ogImage = await fetchOgImage(externalLink);
          if (ogImage && isLikelyStoryImage(ogImage)) {
            image = ogImage;
            console.log(`✅ Found valid OG image: ${image.substring(0, 50)}...`);
          }
        }
        
        // No real image found — use RealSSA default logo instead of skipping
        if (!image) {
          console.log(`No image found for "${title}" — using RealSSA fallback`);
          image = 'https://realssanews.com.ng/logo.png';
        }

        let publishedAt = new Date();
        if (item.pubDate) {
          const parsedDate = new Date(item.pubDate);
          if (!isNaN(parsedDate.getTime())) {
            publishedAt = parsedDate;
          }
        }
        const description = originalExcerpt;
        let imageUrl = image;
        const author = sourceName;
        const isFeatured = notificationScore(title, category, itemResult.url) >= 2;

        // Run the Smart Extractor Engine — ONLY for articles with no RSS excerpt
        // On free tier we skip full extraction to keep DB lean and cycles fast
        let fullContent = null;
        if (contentType === 'article' && !originalExcerpt && !process.env.VERCEL) {
          const extracted = await extractArticle(externalLink);
          if (extracted && extracted.textContent) {
            // Only store a 1000-char summary of full content, not the whole page
            fullContent = extracted.htmlContent ? extracted.htmlContent.slice(0, 2000) : null;
            if (!imageUrl || imageUrl === 'https://realssanews.com.ng/logo.png') {
              if (extracted.image) imageUrl = extracted.image;
            }
          }
        }

        // Run Structured AI analysis (up to 5 articles per cycle to respect free tier rates)
        let aiSummary = null;
        let titleTrans = {};
        let summaryTrans = {};
        let embeddingVal = null;
        let extractedEntities = [];

        if (contentType === 'article' && aiProcessedCount < 20) {
          try {
            console.log(`🤖 Running Gemini AI analysis for: "${title}"`);
            const analysis = await generateAIAnalysis(title, description || originalExcerpt);
            if (analysis) {
              aiSummary = analysis.summary;
              titleTrans = analysis.translations || {};
              summaryTrans = analysis.translations || {};
              extractedEntities = analysis.entities || [];

              // Generate vector embedding
              if (aiSummary) {
                embeddingVal = await generateEmbedding(aiSummary);
              }
              aiProcessedCount++;
            }
          } catch (aiErr) {
            console.error('AI Ingestion error:', aiErr.message);
          }
        }

        // Insert into DB
        try {
          let queryStr, queryValues;
          
          if (!process.env.VERCEL) {
            queryStr = `INSERT INTO rss_articles
               (url_hash, title, original_excerpt, ai_summary, category, image, author, source_name, external_link, published_at, content_type, is_featured, story_hash, full_content, title_translations, summary_translations, embedding)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
             ON CONFLICT (story_hash) DO NOTHING
             RETURNING id`;
            queryValues = [
              urlHash,
              title,
              description,
              aiSummary,
              category,
              imageUrl,
              author,
              sourceName,
              externalLink,
              publishedAt,
              contentType,
              isFeatured,
              storyHash,
              fullContent,
              JSON.stringify(titleTrans),
              JSON.stringify(summaryTrans),
              embeddingVal ? `[${embeddingVal.join(',')}]` : null
            ];
          } else {
            // Legacy Vercel Insert
            queryStr = `INSERT INTO rss_articles
               (url_hash, title, original_excerpt, ai_summary, category, image, author, source_name, external_link, published_at, content_type, is_featured, full_content, title_translations, summary_translations, embedding)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             ON CONFLICT (url_hash) DO NOTHING
             RETURNING id`;
            queryValues = [
              urlHash,
              title,
              description,
              aiSummary,
              category,
              imageUrl,
              author,
              sourceName,
              externalLink,
              publishedAt,
              contentType,
              isFeatured,
              fullContent,
              JSON.stringify(titleTrans),
              JSON.stringify(summaryTrans),
              embeddingVal ? `[${embeddingVal.join(',')}]` : null
            ];
          }

          const result = await pool.query(queryStr, queryValues);

          if (result.rows.length > 0) {
            const articleId = result.rows[0].id;
            newArticleIds.push(`rss-${articleId}`);
            
            // Insert extracted entities
            if (extractedEntities.length > 0) {
              for (const ent of extractedEntities) {
                try {
                  await pool.query(
                    `INSERT INTO article_entities (article_id, entity_name, entity_type)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (article_id, entity_name, entity_type) DO NOTHING`,
                    [articleId, ent.name.trim(), ent.type]
                  );
                } catch (entErr) {
                  console.error('Error inserting entity:', entErr.message);
                }
              }
            }

            // Auto-link to matching events in the next 7 days
            try {
              const matchingEvents = await pool.query(
                `SELECT id, title FROM events 
                 WHERE event_date BETWEEN NOW() - INTERVAL '1 day' AND NOW() + INTERVAL '7 days'`
              );
              for (const evt of matchingEvents.rows) {
                const evtKeywords = evt.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
                const articleText = (title + ' ' + (description || '')).toLowerCase();
                const isMatch = evtKeywords.every(kw => articleText.includes(kw));
                if (isMatch) {
                  await pool.query(
                    `INSERT INTO article_events (article_id, event_id)
                     VALUES ($1, $2)
                     ON CONFLICT DO NOTHING`,
                    [articleId, evt.id]
                  );
                  console.log(`🔗 Auto-linked article ${articleId} to Event "${evt.title}"`);
                }
              }
            } catch (evtLinkErr) {
              console.error('Event auto-linking error:', evtLinkErr.message);
            }

            // Score this article for notification worthiness
            const score = notificationScore(title, category, externalLink);
            if (score > 0) {
              const articleHash = crypto.createHash('md5').update(title + (sourceName || '')).digest('hex');
              try {
                // 1. Deduplication check
                const checkNotified = await pool.query('SELECT 1 FROM notified_articles WHERE story_hash = $1', [articleHash]);
                if (checkNotified.rows.length === 0) {
                  // 2. Rate limiter check: max 8 notifications per hour
                  const limitCheck = await pool.query("SELECT COUNT(*) FROM notified_articles WHERE notified_at > NOW() - INTERVAL '1 hour'");
                  const currentHourCount = parseInt(limitCheck.rows[0].count) || 0;

                  if (currentHourCount < 8) {
                    const notifArticle = {
                      id: `rss-${articleId}`,
                      rawId: articleId,
                      externalLink,
                      title,
                      category,
                      summary: originalExcerpt,
                      image: imageUrl || null,
                      score,
                      source_name: sourceName
                    };
                    console.log(`🔔 Eagerly Notifying [score=${score}]: "${title.slice(0, 60)}"`);
                    await notificationService.sendBreakingNews(notifArticle);
                    // 3. Mark as notified
                    await pool.query('INSERT INTO notified_articles (story_hash, notified_at) VALUES ($1, NOW()) ON CONFLICT DO NOTHING', [articleHash]);
                    // Clean up rows older than 48 hours to preserve space
                    await pool.query("DELETE FROM notified_articles WHERE notified_at < NOW() - INTERVAL '48 hours'");
                  } else {
                    console.log(`📭 Notification rate limiter: hourly limit reached (${currentHourCount}/8). Skipping notification.`);
                  }
                }
              } catch (notifErr) {
                console.error('Error handling eager push notification:', notifErr.message);
              }
            }

          }
          summaryCount++;

          // Social Media Automation — post top new articles to Buffer (Max 10 per 24 hours)
          if (pool) {
            try {
              await pool.query(`
                CREATE TABLE IF NOT EXISTS buffer_posts_log (
                  id SERIAL PRIMARY KEY,
                  story_hash TEXT UNIQUE,
                  posted_at TIMESTAMPTZ DEFAULT NOW()
                )
              `);
              const countRes = await pool.query(
                `SELECT COUNT(*) FROM buffer_posts_log WHERE posted_at >= NOW() - INTERVAL '24 hours'`
              );
              const dailyCount = parseInt(countRes.rows[0].count, 10);

              if (dailyCount < 10) {
                // Check this story hasn't been posted to Buffer before
                const alreadyPosted = await pool.query(
                  `SELECT 1 FROM buffer_posts_log WHERE story_hash = $1`, [storyHash]
                );
                if (alreadyPosted.rows.length === 0) {
                  const hook = await generateSocialHook(title, originalExcerpt);
                  if (hook) {
                    const success = await postToBuffer(hook, `${SITE_URL}/read?url=${encodeURIComponent(externalLink)}`, image);
                    if (success) {
                      await pool.query(
                        `INSERT INTO buffer_posts_log (story_hash) VALUES ($1) ON CONFLICT DO NOTHING`,
                        [storyHash]
                      );
                      console.log(`[Buffer] ✅ Posted. Daily count is now ${dailyCount + 1}/10.`);
                    }
                  }
                }
              } else {
                console.log(`[Buffer] Skipping auto-post: Daily limit of 10 posts already reached.`);
              }
            } catch (bufErr) {
              console.error('Buffer post error:', bufErr.message);
            }
          }
        } catch (e) {
          console.error('DB insert error:', e.message);
        }
      }
    }

    // Rest for 1 second between batches to spare network/memory
    if (i + BATCH_SIZE < allUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`✅ Ingestion complete: ${newArticleIds.length} new articles`);

  // Stamp last_ingested_at for every category we processed this cycle
  if (!targetCategory && categoriesToFetch.length > 0) {
    const processedSlugs = categoriesToFetch.map(c => c.category);
    try {
      await pool.query(
        `UPDATE feed_schedule SET last_ingested_at = NOW()
         WHERE category = ANY($1::text[])`,
        [processedSlugs]
      );
      console.log(`🗓️  Rotation timestamps updated for: ${processedSlugs.join(', ')}`);
    } catch (e) {
      console.warn('feed_schedule timestamp update failed:', e.message);
    }
  }

  // Ping search engines if new articles were added
  if (newArticleIds.length > 0) {
    const fullUrls = newArticleIds.map(id => `${SITE_URL}/article/${id}`);

    // Trigger ping for search engines (IndexNow, etc.)
    
    // Notifications are now handled eagerly inside the loop to avoid Vercel timeouts!


    // Ping search engines (Non-critical, fire-and-forget to prevent Vercel 10s timeout)
    pingIndexNow(fullUrls).catch(e => console.error('IndexNow error', e));
    pingWebSub().catch(e => console.error('WebSub error', e));

    // Google Indexing API — direct ping (up to DAILY_LIMIT per day)
    const googlePingPromises = newArticleIds.slice(0, 20).map(id =>
      pingGoogleIndexingAPI(id).catch(err => {
        console.error(`Google Indexing API error for ${id}:`, err.message);
        return null;
      })
    );
    Promise.all(googlePingPromises).catch(e => console.error('Google Ping error', e));
  }

  // ── Recalculate Freshness Scores ──────────────────────────────────────────
  try {
    await pool.query(`
      UPDATE rss_articles
      SET freshness_score = (
        (view_count * 1) + (reaction_count * 5) + 
        (CASE WHEN is_featured = true THEN 50 ELSE 0 END) +
        (CASE WHEN source_name IN ('BBC News', 'Al Jazeera', 'Premium Times', 'Vanguard') THEN 20 ELSE 0 END)
      ) / POW(EXTRACT(EPOCH FROM (NOW() - published_at))/3600 + 2, 1.8)
      WHERE published_at > NOW() - INTERVAL '2 days'
    `);
  } catch (freshErr) {
    console.error('Freshness score update failed:', freshErr.message);
  }

  // --- Self-Cleaning Database ---
  // Delete articles older than 2 days to keep DB lean on free tier
  try {
    const cleanResult = await pool.query(
      `DELETE FROM rss_articles WHERE published_at < NOW() - INTERVAL '2 days'`
    );
    if (cleanResult.rowCount > 0) {
      console.log(`🧹 Self-cleaning: Deleted ${cleanResult.rowCount} old articles to preserve storage.`);
    }
  } catch (err) {
    console.error('Self-cleaning error:', err.message);
  }

  return { newCount: newArticleIds.length, summaryCount };
}

module.exports = { ingestAllFeeds, FEED_CATEGORIES };
