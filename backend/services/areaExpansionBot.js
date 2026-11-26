/**
 * Area Expansion Bot
 * ------------------
 * Pushes RealSSA into more geographic and topical "areas" so the site can be
 * discovered for long-tail searches such as "news in Kumasi" or "Lagos news":
 *
 * 1. Builds an area registry from `backend/data/world_feeds.json` (203
 *    markets), African cities, Nigerian states and category hubs.
 * 2. Persists the registry in `seo_areas` with keyword variants and a priority
 *    score based on how much coverage the site already has.
 * 3. Submits area landing pages to IndexNow (Bing, Yandex, Seznam, Naver) in
 *    batches of 100 and pings sitemap directories (Google, Bing, Ping-O-Matic).
 *
 * Every stage is bounded and polite; repeated runs are safe.
 */

const WORLD_FEEDS = require('../data/world_feeds.json');
const { AFRICAN_COUNTRIES } = require('../data/africaCountries');

const SITE = process.env.SEO_SITE_URL || 'https://www.realssanews.com.ng';
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'realssanews2026a8f3b4c5d6e7f89012';
const PING_TIMEOUT_MS = 8000;

const CITY_AREAS = [
  ['Lagos', 'nigeria'], ['Abuja', 'nigeria'], ['Port Harcourt', 'nigeria'],
  ['Kano', 'nigeria'], ['Ibadan', 'nigeria'], ['Benin City', 'nigeria'],
  ['Enugu', 'nigeria'], ['Aba', 'nigeria'], ['Onitsha', 'nigeria'],
  ['Jos', 'nigeria'], ['Kaduna', 'nigeria'], ['Maiduguri', 'nigeria'],
  ['Ilorin', 'nigeria'], ['Warri', 'nigeria'], ['Uyo', 'nigeria'],
  ['Abeokuta', 'nigeria'], ['Akure', 'nigeria'], ['Owerri', 'nigeria'],
  ['Accra', 'ghana'], ['Kumasi', 'ghana'], ['Tamale', 'ghana'],
  ['Takoradi', 'ghana'], ['Cape Coast', 'ghana'],
  ['Nairobi', 'kenya'], ['Mombasa', 'kenya'], ['Kisumu', 'kenya'],
  ['Nakuru', 'kenya'], ['Eldoret', 'kenya'],
  ['Johannesburg', 'south-africa'], ['Cape Town', 'south-africa'],
  ['Durban', 'south-africa'], ['Pretoria', 'south-africa'],
  ['Port Elizabeth', 'south-africa'],
  ['Cairo', 'egypt'], ['Alexandria', 'egypt'], ['Giza', 'egypt'],
  ['Abidjan', 'ivory-coast'], ['Dakar', 'senegal'], ['Touba', 'senegal'],
  ['Kampala', 'uganda'], ['Entebbe', 'uganda'], ['Dar es Salaam', 'tanzania'],
  ['Dodoma', 'tanzania'], ['Arusha', 'tanzania'], ['Kigali', 'rwanda'],
  ['Lusaka', 'zambia'], ['Harare', 'zimbabwe'], ['Bulawayo', 'zimbabwe'],
  ['Gaborone', 'botswana'], ['Windhoek', 'namibia'], ['Maputo', 'mozambique'],
  ['Luanda', 'angola'], ['Kinshasa', 'democratic-republic-of-the-congo'],
  ['Lubumbashi', 'democratic-republic-of-the-congo'], ['Douala', 'cameroon'],
  ['Yaounde', 'cameroon'], ['Casablanca', 'morocco'], ['Rabat', 'morocco'],
  ['Algiers', 'algeria'], ['Tunis', 'tunisia'], ['Addis Ababa', 'ethiopia'],
  ['Khartoum', 'sudan'], ['Juba', 'south-sudan'], ['Mogadishu', 'somalia'],
  ['Freetown', 'sierra-leone'], ['Monrovia', 'liberia'], ['Conakry', 'guinea'],
  ['Bamako', 'mali'], ['Ouagadougou', 'burkina-faso'], ['Niamey', 'niger'],
  ['Cotonou', 'benin'], ['Lome', 'togo'], ['Antananarivo', 'madagascar'],
  ['Port Louis', 'mauritius'], ['London', 'united-kingdom'], ['Paris', 'france'],
  ['Berlin', 'germany'], ['Toronto', 'canada'], ['New York', 'united-states'],
  ['Atlanta', 'united-states'], ['Houston', 'united-states'],
  ['Washington', 'united-states'], ['Dubai', 'uae']
];

const STATE_AREAS = [
  ['Lagos State', 'lagos'], ['Abuja FCT', 'abuja-fct'], ['Kano State', 'kano'],
  ['Rivers State', 'rivers'], ['Oyo State', 'oyo'], ['Kaduna State', 'kaduna'],
  ['Enugu State', 'enugu'], ['Anambra State', 'anambra'], ['Delta State', 'delta'],
  ['Akwa Ibom State', 'akwa-ibom'], ['Edo State', 'edo'], ['Ogun State', 'ogun'],
  ['Osun State', 'osun'], ['Ondo State', 'ondo'], ['Ekiti State', 'ekiti'],
  ['Kwara State', 'kwara'], ['Kogi State', 'kogi'], ['Benue State', 'benue'],
  ['Plateau State', 'plateau'], ['Niger State', 'niger-state'],
  ['Borno State', 'borno'], ['Adamawa State', 'adamawa'],
  ['Bauchi State', 'bauchi'], ['Gombe State', 'gombe'], ['Yobe State', 'yobe'],
  ['Taraba State', 'taraba'], ['Zamfara State', 'zamfara'],
  ['Sokoto State', 'sokoto'], ['Kebbi State', 'kebbi'], ['Katsina State', 'katsina'],
  ['Jigawa State', 'jigawa'], ['Nasarawa State', 'nasarawa'],
  ['Bayelsa State', 'bayelsa'], ['Cross River State', 'cross-river'],
  ['Abia State', 'abia'], ['Imo State', 'imo'], ['Ebonyi State', 'ebonyi']
];

const CATEGORY_AREAS = [
  { slug: 'nigeria', name: 'Nigeria', path: '/nigeria', score: 90 },
  { slug: 'nigerian-news', name: 'Nigerian News', path: '/nigerian-news', score: 84 },
  { slug: 'world-news', name: 'World News', path: '/world-news', score: 80 },
  { slug: 'sports', name: 'Sports', path: '/sports', score: 86 },
  { slug: 'crypto', name: 'Crypto', path: '/crypto', score: 72 },
  { slug: 'entertainment', name: 'Entertainment', path: '/entertainment', score: 70 },
  { slug: 'videos', name: 'Videos', path: '/videos', score: 70 },
  { slug: 'video-news', name: 'Live TV', path: '/video-news', score: 68 },
  { slug: 'trending', name: 'Trending', path: '/trending', score: 76 },
  { slug: 'market', name: 'Market', path: '/market', score: 66 },
  { slug: 'africa', name: 'Africa', path: '/africa', score: 88 }
];

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleFromSlug(slug) {
  return String(slug || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
    .trim();
}

/** Keyword variants an area page should be discoverable for. */
function keywordVariants(name) {
  const label = String(name || '').trim().toLowerCase();
  if (!label) return [];
  return [
    `${label} news`, `news in ${label}`, `${label} breaking news`,
    `${label} news today`, `latest ${label} news`, `realssa ${label} news`
  ];
}

/** Build the full, de-duplicated area registry. Pure and testable. */
function buildAreas() {
  const byKey = new Map();
  const add = area => {
    if (!area || !area.slug || !area.name) return;
    if (!byKey.has(area.slug)) {
      byKey.set(area.slug, {
        slug: area.slug,
        name: area.name,
        kind: area.kind,
        country: area.country || null,
        language: area.language || null,
        path: area.path,
        score: Number(area.score) || 20,
        keywords: keywordVariants(area.name)
      });
    }
  };

  const countrySlugs = new Set(AFRICAN_COUNTRIES.map(country => country.slug));
  for (const [key, data] of Object.entries(WORLD_FEEDS)) {
    const name = data && data.name ? data.name : titleFromSlug(key);
    const language = data && (data.language || (data.urls && data.urls.length ? 'en' : null));
    const isAfrican = countrySlugs.has(key) || (data && data.continent === 'Africa');
    add({
      slug: `country:${key}`,
      name,
      kind: 'country',
      country: key,
      language,
      path: `/country/${key}`,
      score: isAfrican ? 70 : 52
    });
  }

  for (const country of AFRICAN_COUNTRIES) {
    add({
      slug: `country:${country.slug}`,
      name: country.name,
      kind: 'country',
      country: country.slug,
      language: 'en',
      path: `/country/${country.slug}`,
      score: 72
    });
  }

  for (const [name, country] of CITY_AREAS) {
    const slug = slugify(name);
    add({
      slug: `city:${slug}`,
      name,
      kind: 'city',
      country,
      language: 'en',
      path: `/city/${slug}`,
      score: 56
    });
  }

  for (const [name, slug] of STATE_AREAS) {
    add({
      slug: `state:${slug}`,
      name,
      kind: 'state',
      country: 'nigeria',
      language: 'en',
      path: `/state/${slug}`,
      score: 58
    });
  }

  for (const category of CATEGORY_AREAS) {
    add({
      slug: `category:${category.slug}`,
      name: category.name,
      kind: 'category',
      country: null,
      language: 'en',
      path: category.path,
      score: category.score
    });
  }

  return [...byKey.values()];
}

function areaUrl(area, site = SITE) {
  const pathname = area && (area.path || (area.slug && area.slug.startsWith('/') ? area.slug : null));
  return new URL(pathname || '/', site).href;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS seo_areas (
     slug TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     kind TEXT NOT NULL,
     country TEXT,
     language TEXT,
     path TEXT NOT NULL,
     keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
     score NUMERIC(6,2) NOT NULL DEFAULT 0,
     indexed_at TIMESTAMPTZ,
     index_status TEXT,
     last_traffic_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  'CREATE INDEX IF NOT EXISTS seo_areas_due ON seo_areas(indexed_at)',
  'CREATE INDEX IF NOT EXISTS seo_areas_traffic ON seo_areas(last_traffic_at)'
].join(';');

async function ensureAreaSchema(pool) {
  if (!pool) return false;
  await pool.query(SCHEMA);
  return true;
}

async function coverageByArea(pool, areas) {
  if (!pool) return new Map();
  const records = areas.map(area => ({ slug: area.slug, name: area.name }));
  try {
    const result = await pool.query(
      `SELECT x.slug, COUNT(a.id)::int AS coverage
       FROM jsonb_to_recordset($1::jsonb) AS x(slug text, name text)
       LEFT JOIN rss_articles a
         ON a.title ILIKE '%' || x.name || '%'
        AND a.published_at > NOW() - INTERVAL '14 days'
       GROUP BY x.slug`,
      [JSON.stringify(records)]
    );
    return new Map(result.rows.map(row => [row.slug, Number(row.coverage) || 0]));
  } catch {
    return new Map();
  }
}

function countKinds(areas) {
  const kinds = {};
  for (const area of areas) kinds[area.kind] = (kinds[area.kind] || 0) + 1;
  return kinds;
}

/**
 * Persist the area registry, raising the priority of areas that already have
 * matching news so crawlers spend budget where pages are not thin.
 */
async function syncAreas(pool, { areas = null } = {}) {
  const registry = areas || buildAreas();
  if (!pool) {
    return { status: 'no_database', areas: registry.length, kinds: countKinds(registry) };
  }
  const coverage = await coverageByArea(pool, registry);
  const records = registry.map(area => ({
    slug: area.slug,
    name: area.name,
    kind: area.kind,
    country: area.country,
    language: area.language,
    path: area.path,
    keywords: area.keywords,
    score: Math.min(100, Number(area.score) + Math.min(30, (coverage.get(area.slug) || 0) * 4))
  }));
  await ensureAreaSchema(pool);
  const result = await pool.query(
    `INSERT INTO seo_areas(slug, name, kind, country, language, path, keywords, score)
     SELECT x.slug, x.name, x.kind, x.country, x.language, x.path, x.keywords::jsonb, x.score
     FROM jsonb_to_recordset($1::jsonb) AS x(
       slug text, name text, kind text, country text, language text,
       path text, keywords jsonb, score numeric
     )
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       kind = EXCLUDED.kind,
       country = EXCLUDED.country,
       language = EXCLUDED.language,
       path = EXCLUDED.path,
       keywords = EXCLUDED.keywords,
       score = GREATEST(seo_areas.score, EXCLUDED.score),
       updated_at = NOW()`,
    [JSON.stringify(records)]
  );
  return {
    status: 'ok',
    areas: records.length,
    upserted: result.rowCount || 0,
    kinds: countKinds(records),
    withCoverage: records.filter(area => (coverage.get(area.slug) || 0) > 0).length
  };
}

async function dueAreas(pool, limit = 100) {
  if (pool) {
    try {
      const result = await pool.query(
        `SELECT slug, name, kind, country, language, path, score
         FROM seo_areas
         WHERE indexed_at IS NULL OR indexed_at < NOW() - INTERVAL '7 days'
         ORDER BY score DESC, indexed_at ASC NULLS FIRST
         LIMIT $1`,
        [limit]
      );
      if (result.rows.length) return result.rows;
    } catch {
      // Fall through to the static registry when the table is not ready.
    }
  }
  return buildAreas()
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(area => ({ ...area, indexed_at: null }));
}

/**
 * Submit due area pages to IndexNow and record the outcome.
 * `pinger` is injectable for tests.
 */
async function pushAreas(pool, {
  limit = 100,
  site = SITE,
  pinger = null,
  includeDirectories = true,
  fetcher = globalThis.fetch
} = {}) {
  const areas = await dueAreas(pool, limit);
  const urls = areas.map(area => areaUrl(area, site));
  let indexStatus = null;

  if (urls.length) {
    try {
      const ping = pinger || require('./indexnow').pingIndexNow;
      indexStatus = await ping(urls);
    } catch {
      indexStatus = null;
    }
  }

  if (pool && areas.length) {
    try {
      await pool.query(
        `UPDATE seo_areas
         SET indexed_at = NOW(), index_status = $2, updated_at = NOW()
         WHERE slug = ANY($1::text[])`,
        [areas.map(area => area.slug), indexStatus ? String(indexStatus) : 'error']
      );
    } catch {
      // Areas stay due and will be retried on the next pass.
    }
  }

  const directories = includeDirectories
    ? await pingDirectories({ fetcher, site })
    : { status: 'skipped', pings: [] };

  return {
    status: 'ok',
    submitted: urls.length,
    indexNowStatus: indexStatus,
    kinds: countKinds(areas),
    directories
  };
}

/**
 * Ping sitemap directories and IndexNow endpoints for sitemap URLs.
 * Google/Bing sitemap ping endpoints are legacy but still accepted; IndexNow
 * covers Bing/Yandex/Seznam/Naver in one request.
 */
async function pingDirectories({ fetcher = globalThis.fetch, site = SITE, indexnowKey = INDEXNOW_KEY } = {}) {
  const sitemaps = ['sitemap.xml', 'news-sitemap.xml', 'areas-sitemap.xml', 'pages-sitemap.xml', 'locations-sitemap.xml'];
  const encoded = sitemaps.map(name => encodeURIComponent(new URL(`/${name}`, site).href));
  const home = new URL('/', site).href;
  const feed = new URL('/rss/all.xml', site).href;

  const calls = [
    { name: 'google-sitemap', url: `https://www.google.com/ping?sitemap=${encoded[0]}` },
    { name: 'bing-sitemap', url: `https://www.bing.com/ping?sitemap=${encoded[0]}` },
    { name: 'yandex-indexnow', url: `https://yandex.com/indexnow?url=${encoded[0]}&key=${encodeURIComponent(indexnowKey)}` },
    { name: 'seznam-indexnow', url: `https://search.seznam.cz/indexnow?url=${encoded[0]}&key=${encodeURIComponent(indexnowKey)}` },
    {
      name: 'ping-o-matic',
      url: 'https://rpc.pingomatic.com/',
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: `<?xml version="1.0"?><methodCall><methodName>weblogUpdates.ping</methodName><params>` +
        `<param><value><string>RealSSA News</string></value></param>` +
        `<param><value><string>${home}</string></value></param>` +
        `<param><value><string>${feed}</string></value></param>` +
        `</params></methodCall>`
    }
  ];

  const results = await Promise.allSettled(calls.map(async call => {
    const response = await fetcher(call.url, {
      method: call.method || 'GET',
      headers: { 'User-Agent': 'RealSSA-Growth/1.0 (+https://www.realssanews.com.ng)', ...(call.headers || {}) },
      body: call.body,
      signal: AbortSignal.timeout(PING_TIMEOUT_MS)
    });
    return { name: call.name, status: response ? response.status : 0 };
  }));

  return {
    status: 'ok',
    pings: results.map((result, index) => result.status === 'fulfilled'
      ? result.value
      : { name: calls[index].name, status: 0, error: result.reason?.message || 'ping failed' })
  };
}

async function runAreaExpansion(pool, options = {}) {
  const sync = await syncAreas(pool, options);
  const push = await pushAreas(pool, options);
  return { status: 'ok', sync, push };
}

module.exports = {
  SITE,
  CITY_AREAS,
  STATE_AREAS,
  CATEGORY_AREAS,
  slugify,
  keywordVariants,
  buildAreas,
  areaUrl,
  ensureAreaSchema,
  syncAreas,
  dueAreas,
  pushAreas,
  pingDirectories,
  runAreaExpansion
};
