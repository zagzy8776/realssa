/**
 * SEO Autocomplete Engine + Suggestion Seeding Bot
 * -------------------------------------------------
 * Goal: whatever a reader types, RealSSA's own brand/content is offered as a
 * suggestion, and the suggestion list is backed by data the bots keep fresh.
 *
 * How it works
 * 1. `suggest()` merges four candidate pools:
 *      - branded phrases ("realssa news <q>", "<q> realssa", "<q> news today")
 *      - editorial seeds (brand, categories, areas) seeded by the bot
 *      - learned suggestions stored in `search_suggestions` (article titles,
 *        rising queries, real user clicks)
 *      - live Google / Bing / DuckDuckGo suggestion APIs (best effort)
 *    Branded candidates are scored above third-party terms so the site itself
 *    always appears in the dropdown.
 * 2. `seedAutocomplete()` (bot) harvests recent headlines, area keywords and
 *    rising queries into `search_suggestions`.
 * 3. `probeBrandSuggestions()` asks Google/Bing/DDG what they suggest for our
 *    target queries and records how often "realssa" appears (`brand_hits`).
 *
 * Honest limitation: search engines personalise and region-lock their
 * suggestion APIs, and no public API can force a competitor-independent
 * autocomplete entry. This bot measures brand visibility and builds branded
 * query demand; it does not guarantee a Google dropdown slot.
 */

const DEFAULT_SITE = process.env.SEO_SITE_URL || 'https://www.realssanews.com.ng';
const BRAND = 'realssa';
const BRAND_TITLE = 'RealSSA News';
const MAX_TERM_LENGTH = 90;
const ENGINE_TIMEOUT_MS = 1400;

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'has', 'had',
  'will', 'would', 'could', 'should', 'after', 'before', 'over', 'into',
  'about', 'says', 'said', 'amid', 'more', 'than', 'then', 'they', 'their',
  'there', 'here', 'your', 'you', 'its', 'was', 'were', 'are', 'but', 'not',
  'all', 'can', 'out', 'who', 'how', 'why', 'what', 'when', 'where', 'his',
  'her', 'him', 'she', 'he', 'new', 'news', 'today', 'update', 'updates'
]);

const EDITORIAL_SEEDS = [
  'realssa news', 'realssa news today', 'realssanews.com.ng', 'realssa breaking news',
  'realssa sports', 'realssa live tv', 'realssa market prices', 'realssa crypto news',
  'nigeria news', 'nigeria breaking news', 'africa news', 'africa breaking news',
  'world news', 'politics', 'business', 'economy', 'stock market', 'crypto',
  'bitcoin', 'sports', 'football', 'super eagles', 'afcon', 'premier league',
  'transfer news', 'entertainment', 'nollywood', 'afrobeats', 'movies', 'cinema',
  'health', 'education', 'technology', 'startups', 'breaking news', 'trending news'
];

const CATEGORY_AREAS = [
  { slug: 'nigeria', name: 'Nigeria' },
  { slug: 'nigerian-news', name: 'Nigerian News' },
  { slug: 'world-news', name: 'World News' },
  { slug: 'sports', name: 'Sports' },
  { slug: 'crypto', name: 'Crypto' },
  { slug: 'entertainment', name: 'Entertainment' },
  { slug: 'videos', name: 'Videos' },
  { slug: 'video-news', name: 'Live TV' },
  { slug: 'trending', name: 'Trending' },
  { slug: 'market', name: 'Market' }
];

/** Lowercase, strip markup/punctuation noise and clamp length. */
function normalizeTerm(value) {
  const cleaned = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[|•·»«“”"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return cleaned.slice(0, MAX_TERM_LENGTH).trim();
}

function titleCase(term) {
  return String(term || '')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Branded query variants for a typed term, highest score first. */
function brandVariants(term) {
  const q = normalizeTerm(term);
  if (!q) return [];
  const variants = [
    { term: `realssa news ${q}`, score: 122 },
    { term: `${q} realssa news`, score: 118 },
    { term: `realssa ${q}`, score: 112 }
  ];
  return variants.filter((item, index) => variants.findIndex(other => other.term === item.term) === index);
}

/** Natural-language variants that do not carry the brand (secondary pool). */
function trendVariants(term) {
  const q = normalizeTerm(term);
  if (!q) return [];
  return [
    { term: `${q} news today`, score: 92 },
    { term: `latest ${q} news`, score: 88 }
  ];
}

/** Terms returned by Google/Bing `[query, [terms]]` payloads. */
function parseOsjsonPayload(payload) {
  try {
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!Array.isArray(parsed)) return [];
    if (Array.isArray(parsed[1])) {
      return parsed[1].filter(item => typeof item === 'string');
    }
    return parsed
      .map(item => (item && typeof item === 'object' ? item.phrase || item.term || item.title : item))
      .filter(item => typeof item === 'string');
  } catch {
    return [];
  }
}

/** DuckDuckGo's `[{ phrase: "..." }]` payload. */
function parseDuckDuckGoPayload(payload) {
  try {
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => (item && typeof item === 'object' ? item.phrase || item.term : item))
      .filter(item => typeof item === 'string');
  } catch {
    return [];
  }
}

/**
 * Merge, dedupe and rank suggestion candidates.
 * Branded terms are boosted so the site always appears in the dropdown.
 */
function rankSuggestions(query, candidates = [], limit = 8) {
  const q = normalizeTerm(query);
  const byTerm = new Map();
  const add = candidate => {
    const normalized = normalizeTerm(candidate.term);
    if (!normalized || normalized.length < 2) return;
    const previous = byTerm.get(normalized);
    if (previous) {
      previous.score = Math.max(previous.score, Number(candidate.score) || 0);
      previous.sources = new Set([...(previous.sources || []), candidate.source || 'unknown']);
      return;
    }
    byTerm.set(normalized, {
      term: normalized,
      score: Number(candidate.score) || 0,
      source: candidate.source || 'unknown',
      sources: new Set([candidate.source || 'unknown'])
    });
  };

  for (const candidate of candidates) add(candidate);
  for (const variant of brandVariants(q)) add({ ...variant, source: 'brand' });
  for (const variant of trendVariants(q)) add({ ...variant, source: 'trend' });

  const ranked = [...byTerm.values()].map(item => {
    let score = item.score;
    if (q && item.term.startsWith(q)) score += 6;
    if (q && item.term.includes(q)) score += 2;
    if (item.term.includes(BRAND)) score += 100;
    if (item.term === BRAND) score += 10;
    if (item.term.length > 55) score -= 2;
    return {
      term: item.term,
      title: item.term === BRAND ? BRAND_TITLE : titleCase(item.term),
      score: Number(score.toFixed(2)),
      sources: [...item.sources]
    };
  });

  ranked.sort((a, b) => b.score - a.score || a.term.length - b.term.length || a.term.localeCompare(b.term));

  // Guarantee at least one branded suggestion even when other pools are empty.
  if (q && !ranked.some(item => item.term.includes(BRAND))) {
    ranked.unshift({ term: `realssa news ${q}`, title: titleCase(`realssa news ${q}`), score: 120, sources: ['brand'] });
  }
  return ranked.slice(0, Math.max(1, limit));
}

async function fetchEngineTerms(query, { fetcher = globalThis.fetch, timeoutMs = ENGINE_TIMEOUT_MS } = {}) {
  if (typeof fetcher !== 'function') return [];
  const endpoints = [
    { url: `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`, parse: parseOsjsonPayload },
    { url: `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}`, parse: parseOsjsonPayload },
    { url: `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`, parse: parseDuckDuckGoPayload }
  ];
  const results = await Promise.allSettled(endpoints.map(async endpoint => {
    const response = await fetcher(endpoint.url, {
      headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response || !response.ok) return [];
    const body = await response.text();
    return endpoint.parse(body);
  }));
  const terms = [];
  for (const result of results) {
    if (result.status === 'fulfilled') terms.push(...result.value);
  }
  return [...new Set(terms.map(normalizeTerm).filter(Boolean))];
}

/** Load learned suggestions from the database (best effort; pool may be null). */
async function loadLearnedSuggestions(pool, query, limit = 20) {
  if (!pool) return [];
  const normalized = normalizeTerm(query);
  if (!normalized) return [];
  try {
    const result = await pool.query(
      `SELECT term, score, source FROM search_suggestions
       WHERE normalized LIKE $1
       ORDER BY score DESC, length(term) ASC
       LIMIT $2`,
      [`%${normalized}%`, limit]
    );
    return result.rows.map(row => ({
      term: row.term,
      score: Number(row.score) || 0,
      source: row.source || 'learned'
    }));
  } catch {
    return [];
  }
}

function staticAreas() {
  try {
    const { buildAreas } = require('./areaExpansionBot');
    return buildAreas();
  } catch {
    return CATEGORY_AREAS;
  }
}

function buildSeedCandidates(query, areas = []) {
  const q = normalizeTerm(query);
  const candidates = EDITORIAL_SEEDS.map(term => ({ term, score: 70, source: 'editorial' }));
  for (const area of areas) {
    if (!area || !area.name) continue;
    const name = normalizeTerm(area.name);
    if (!name) continue;
    candidates.push({ term: `news in ${name}`, score: 66, source: 'area' });
    if (q && name.includes(q)) candidates.push({ term: `realssa news ${name}`, score: 96, source: 'area' });
  }
  return candidates;
}

async function loadArticleMatches(pool, query, limit = 6) {
  if (!pool) return [];
  try {
    const result = await pool.query(
      `SELECT 'rss-' || id AS id, title, category, image
       FROM rss_articles
       WHERE title ILIKE $1
       ORDER BY published_at DESC
       LIMIT $2`,
      [`%${query}%`, limit]
    );
    return result.rows;
  } catch {
    return [];
  }
}

/**
 * Full suggestion payload used by `/api/search/suggest/v2` and the bots.
 * @returns {Promise<{query:string,terms:string[],site:Array,articles:Array}>}
 */
async function suggest(pool, query, {
  limit = 8,
  includeArticles = false,
  includeEngines = true,
  fetcher = globalThis.fetch,
  timeoutMs = ENGINE_TIMEOUT_MS,
  areas = null
} = {}) {
  const q = normalizeTerm(query);
  if (q.length < 2) return { query: q, terms: [], site: [], articles: [] };

  const areaList = areas || staticAreas();
  const [learned, engineTerms] = await Promise.all([
    loadLearnedSuggestions(pool, q, 20),
    includeEngines ? fetchEngineTerms(q, { fetcher, timeoutMs }) : Promise.resolve([])
  ]);

  const candidates = [
    ...buildSeedCandidates(q, areaList),
    ...learned,
    ...engineTerms.map(term => ({ term, score: 60, source: 'engine' }))
  ];

  const ranked = rankSuggestions(q, candidates, Math.max(limit, 6));
  const site = ranked.map(item => ({
    term: item.term,
    title: item.title,
    score: item.score,
    sources: item.sources,
    url: `${DEFAULT_SITE}/search?q=${encodeURIComponent(item.term)}`
  }));

  const articles = includeArticles ? await loadArticleMatches(pool, q) : [];

  // Keep branded terms first, then live engine terms, then the rest.
  const branded = ranked.filter(item => item.term.includes(BRAND)).slice(0, 3).map(item => item.term);
  const rest = ranked.filter(item => !item.term.includes(BRAND)).map(item => item.term);
  const terms = [...new Set([...branded, ...engineTerms, ...rest])].slice(0, Math.max(limit, 6));

  return { query: q, terms, site, articles };
}

/** Convert recent headlines into short, suggestible phrases. */
function recentHeadlinePhrases(titles, limit = 240) {
  const phrases = new Map();
  const push = (term, score, source) => {
    const normalized = normalizeTerm(term);
    if (!normalized || normalized.length < 4) return;
    const previous = phrases.get(normalized);
    if (!previous || previous.score < score) {
      phrases.set(normalized, { term: normalized, normalized, score, source });
    }
  };
  for (const title of titles.slice(0, limit)) {
    const clean = String(title || '').replace(/\s+[-|–]\s+.*$/, '').trim();
    if (!clean) continue;
    push(clean, 74, 'article');
    const words = normalizeTerm(clean).match(/[a-z0-9]{4,}/g) || [];
    for (const word of [...new Set(words)].slice(0, 3)) {
      if (STOPWORDS.has(word)) continue;
      push(`${word} news`, 58, 'article');
      push(`realssa ${word}`, 64, 'article');
    }
  }
  return [...phrases.values()];
}

/**
 * Bot stage 1: harvest headlines, areas, editorial seeds and rising queries
 * into `search_suggestions` so autocomplete is data-backed and branded.
 */
async function seedAutocomplete(pool, {
  areaLimit = 400,
  titleLimit = 240,
  includeRising = true
} = {}) {
  if (!pool) return { status: 'no_database', seeded: 0 };
  const records = new Map();
  const add = (term, score, source) => {
    const normalized = normalizeTerm(term);
    if (!normalized || normalized.length < 4) return;
    const previous = records.get(normalized);
    if (!previous || previous.score < score) {
      records.set(normalized, { term: normalized, normalized, source, score });
    }
  };

  for (const term of EDITORIAL_SEEDS) add(term, 70, 'editorial');
  const areas = staticAreas().slice(0, areaLimit);
  for (const area of areas) {
    if (!area || !area.name) continue;
    const name = normalizeTerm(area.name);
    add(`news in ${name}`, 62, 'area');
    add(`${name} news`, 68, 'area');
    add(`realssa news ${name}`, 86, 'area');
    add(`realssa ${name}`, 80, 'area');
  }

  let titles = [];
  try {
    const result = await pool.query(
      `SELECT title FROM rss_articles
       WHERE published_at > NOW() - INTERVAL '7 days'
       ORDER BY published_at DESC
       LIMIT $1`,
      [titleLimit]
    );
    titles = result.rows.map(row => row.title);
  } catch {
    titles = [];
  }
  for (const phrase of recentHeadlinePhrases(titles, titleLimit)) add(phrase.term, phrase.score, phrase.source);

  if (includeRising) {
    try {
      const rising = await pool.query(
        `SELECT query FROM rising_queries WHERE score >= 1 ORDER BY score DESC LIMIT 60`
      );
      for (const row of rising.rows) {
        add(row.query, 72, 'rising');
        add(`realssa ${row.query}`, 78, 'rising');
      }
    } catch {
      // rising_queries is optional (keywordRadar may not have run yet).
    }
  }

  const rows = [...records.values()].slice(0, 1500);
  if (!rows.length) return { status: 'ok', seeded: 0, areas: areas.length, titles: titles.length };

  try {
    const result = await pool.query(
      `INSERT INTO search_suggestions(term, normalized, source, score)
       SELECT x.term, x.normalized, x.source, x.score
       FROM jsonb_to_recordset($1::jsonb) AS x(term text, normalized text, source text, score numeric)
       ON CONFLICT (normalized) DO UPDATE SET
         score = GREATEST(search_suggestions.score, EXCLUDED.score),
         last_seen_at = NOW()`,
      [JSON.stringify(rows)]
    );
    return {
      status: 'ok',
      seeded: rows.length,
      upserted: result.rowCount || 0,
      areas: areas.length,
      titles: titles.length
    };
  } catch (err) {
    return { status: 'error', error: err.message, seeded: 0 };
  }
}

/** Record a real click so the suggestion scores learn from reader behaviour. */
async function recordSuggestionClick(pool, term, { source = 'user' } = {}) {
  const normalized = normalizeTerm(term);
  if (!pool || !normalized) return false;
  try {
    await pool.query(
      `INSERT INTO search_suggestions(term, normalized, source, score, clicks)
       VALUES ($1, $2, $3, 4, 1)
       ON CONFLICT (normalized) DO UPDATE SET
         clicks = search_suggestions.clicks + 1,
         score = search_suggestions.score + 2,
         last_seen_at = NOW()`,
      [normalized, normalized, source]
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Bot stage 2: check whether Google/Bing/DDG suggest our brand for target
 * queries and persist `brand_hits`. Measurable, not a guarantee.
 */
async function probeBrandSuggestions(pool, {
  fetcher = globalThis.fetch,
  limit = 15,
  timeoutMs = ENGINE_TIMEOUT_MS
} = {}) {
  if (!pool) return { status: 'no_database', checked: 0, brandHits: 0 };
  let terms = [];
  try {
    const result = await pool.query(
      `SELECT term FROM search_suggestions
       WHERE normalized LIKE '%news%' OR normalized LIKE $1
       ORDER BY score DESC
       LIMIT $2`,
      [`%${BRAND}%`, limit]
    );
    terms = result.rows.map(row => row.term);
  } catch {
    terms = [];
  }
  const targetTerms = [...new Set([...terms, 'realssa news', 'realssa', 'realssanews.com.ng'])].slice(0, limit);

  let checked = 0;
  let brandHits = 0;
  for (const term of targetTerms) {
    const engineTerms = await fetchEngineTerms(term, { fetcher, timeoutMs });
    checked++;
    const hit = engineTerms.some(engineTerm => normalizeTerm(engineTerm).includes(BRAND));
    if (hit) brandHits++;
    try {
      await pool.query(
        `UPDATE search_suggestions
         SET brand_hits = brand_hits + $2, last_brand_check = NOW()
         WHERE normalized = $1`,
        [normalizeTerm(term), hit ? 1 : 0]
      );
    } catch {
      // Suggestion may not exist yet; probe still counts.
    }
  }
  return { status: 'ok', checked, brandHits };
}

module.exports = {
  DEFAULT_SITE,
  BRAND,
  EDITORIAL_SEEDS,
  CATEGORY_AREAS,
  normalizeTerm,
  titleCase,
  brandVariants,
  trendVariants,
  parseOsjsonPayload,
  parseDuckDuckGoPayload,
  rankSuggestions,
  fetchEngineTerms,
  recentHeadlinePhrases,
  loadLearnedSuggestions,
  loadArticleMatches,
  suggest,
  seedAutocomplete,
  recordSuggestionClick,
  probeBrandSuggestions,
  staticAreas
};
