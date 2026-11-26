/**
 * Country Intelligence Service
 * ------------------------------------------------------------------
 * Gives every programmatic country page a genuinely unique payload:
 *   - local time (UTC offset)
 *   - currency code + name
 *   - top-3 rising queries
 *   - flag emoji (derived from ISO-3166 alpha-2)
 *   - 60-word regional summary built from live headlines
 *
 * Backed by backend/data/world_feeds.json (203 markets).
 * Consumed by GET /api/location-feed in backend/server.js.
 */

const WORLD_FEEDS = require('../data/world_feeds.json');

// ISO-3166 alpha-2 codes -> flag emoji via regional indicators
const ISO2 = {
  algeria: 'DZ', angola: 'AO', benin: 'BJ', botswana: 'BW', 'burkina-faso': 'BF',
  burundi: 'BI', 'cabo-verde': 'CV', cameroon: 'CM', 'central-african-republic': 'CF',
  chad: 'TD', comoros: 'KM', 'democratic-republic-of-the-congo': 'CD',
  'republic-of-the-congo': 'CG', 'cote-d-ivoire': 'CI', 'cote-divoire': 'CI',
  'ivory-coast': 'CI', 'cape-verde': 'CV', djibouti: 'DJ', egypt: 'EG', 'equatorial-guinea': 'GQ',
  eritrea: 'ER', eswatini: 'SZ', ethiopia: 'ET', gabon: 'GA', gambia: 'GM',
  'the-gambia': 'GM', ghana: 'GH', guinea: 'GN', 'guinea-bissau': 'GW', kenya: 'KE',
  lesotho: 'LS', liberia: 'LR', libya: 'LY', madagascar: 'MG', malawi: 'MW',
  mali: 'ML', mauritania: 'MR', mauritius: 'MU', morocco: 'MA', mozambique: 'MZ',
  namibia: 'NA', niger: 'NE', nigeria: 'NG', rwanda: 'RW',
  'sao-tome-and-principe': 'ST', senegal: 'SN', seychelles: 'SC',
  'sierra-leone': 'SL', somalia: 'SO', 'south-africa': 'ZA', 'south-sudan': 'SS',
  sudan: 'SD', tanzania: 'TZ', togo: 'TG', tunisia: 'TN', uganda: 'UG',
  zambia: 'ZM', zimbabwe: 'ZW',
  'united-kingdom': 'GB', 'united-states': 'US', uk: 'GB', usa: 'US', uae: 'AE',
  canada: 'CA', mexico: 'MX',
  brazil: 'BR', argentina: 'AR', india: 'IN', china: 'CN', japan: 'JP',
  indonesia: 'ID', philippines: 'PH', germany: 'DE', france: 'FR', italy: 'IT',
  spain: 'ES', netherlands: 'NL', belgium: 'BE', ireland: 'IE', portugal: 'PT',
  australia: 'AU', 'new-zealand': 'NZ'
};

// Hours offset from UTC (DST ignored — news pages only need "roughly now")
const TZ_OFFSET = {
  algeria: 1, angola: 1, benin: 1, botswana: 2, 'burkina-faso': 0, burundi: 2,
  'cabo-verde': -1, cameroon: 1, 'central-african-republic': 1, chad: 1,
  comoros: 3, 'democratic-republic-of-the-congo': 1, 'republic-of-the-congo': 1,
  'cote-d-ivoire': 0, 'cote-divoire': 0, 'ivory-coast': 0, djibouti: 3, egypt: 2,
  'equatorial-guinea': 1, eritrea: 3, eswatini: 2, ethiopia: 3, gabon: 1,
  gambia: 0, 'the-gambia': 0, ghana: 0, guinea: 0, 'guinea-bissau': 0, kenya: 3,
  lesotho: 2, liberia: 0, libya: 2, madagascar: 3, malawi: 2, mali: 0,
  mauritania: 0, mauritius: 4, morocco: 1, mozambique: 2, namibia: 2, niger: 1,
  nigeria: 1, rwanda: 2, 'sao-tome-and-principe': 0, senegal: 0, seychelles: 4,
  'sierra-leone': 0, somalia: 3, 'south-africa': 2, 'south-sudan': 2, sudan: 2,
  tanzania: 3, togo: 0, tunisia: 1, uganda: 3, zambia: 2, zimbabwe: 2,
  'united-kingdom': 0, 'united-states': -5, uk: 0, usa: -5, uae: 4, 'cape-verde': -1,
  canada: -5, mexico: -6, brazil: -3,
  argentina: -3, india: 5.5, china: 8, japan: 9, indonesia: 7, philippines: 8,
  germany: 1, france: 1, italy: 1, spain: 1, netherlands: 1, belgium: 1,
  ireland: 0, portugal: 0, australia: 10, 'new-zealand': 12
};

const CURRENCY = {
  nigeria: { code: 'NGN', name: 'Nigerian Naira' },
  ghana: { code: 'GHS', name: 'Ghanaian Cedi' },
  kenya: { code: 'KES', name: 'Kenyan Shilling' },
  'south-africa': { code: 'ZAR', name: 'South African Rand' },
  egypt: { code: 'EGP', name: 'Egyptian Pound' },
  ethiopia: { code: 'ETB', name: 'Ethiopian Birr' },
  algeria: { code: 'DZD', name: 'Algerian Dinar' },
  morocco: { code: 'MAD', name: 'Moroccan Dirham' },
  tunisia: { code: 'TND', name: 'Tunisian Dinar' },
  angola: { code: 'AOA', name: 'Angolan Kwanza' },
  tanzania: { code: 'TZS', name: 'Tanzanian Shilling' },
  uganda: { code: 'UGX', name: 'Ugandan Shilling' },
  zambia: { code: 'ZMW', name: 'Zambian Kwacha' },
  zimbabwe: { code: 'ZWL', name: 'Zimbabwean Dollar' },
  mozambique: { code: 'MZN', name: 'Mozambican Metical' },
  namibia: { code: 'NAD', name: 'Namibian Dollar' },
  botswana: { code: 'BWP', name: 'Botswana Pula' },
  rwanda: { code: 'RWF', name: 'Rwandan Franc' },
  senegal: { code: 'XOF', name: 'West African CFA Franc' },
  cameroon: { code: 'XAF', name: 'Central African CFA Franc' },
  'cote-d-ivoire': { code: 'XOF', name: 'West African CFA Franc' },
  'cote-divoire': { code: 'XOF', name: 'West African CFA Franc' },
  'ivory-coast': { code: 'XOF', name: 'West African CFA Franc' },
  mali: { code: 'XOF', name: 'West African CFA Franc' },
  'burkina-faso': { code: 'XOF', name: 'West African CFA Franc' },
  'united-kingdom': { code: 'GBP', name: 'British Pound' },
  'united-states': { code: 'USD', name: 'US Dollar' },
  uk: { code: 'GBP', name: 'British Pound' },
  usa: { code: 'USD', name: 'US Dollar' },
  uae: { code: 'AED', name: 'UAE Dirham' },
  'cape-verde': { code: 'CVE', name: 'Cape Verdean Escudo' },
  'ivory-coast': { code: 'XOF', name: 'West African CFA Franc' },
  netherlands: { code: 'EUR', name: 'Euro' },
  france: { code: 'EUR', name: 'Euro' },
  germany: { code: 'EUR', name: 'Euro' },
  italy: { code: 'EUR', name: 'Euro' },
  spain: { code: 'EUR', name: 'Euro' }
};

const RISING = {
  nigeria: ['fuel subsidy', 'naira rate', 'election tribunal'],
  ghana: ['cocoa price', 'cedi dollar', '2026 budget'],
  kenya: ['housing levy', 'shilling rate', 'tea exports'],
  'south-africa': ['load shedding', 'rand dollar', 'coalition talks'],
  egypt: ['imf tranche', 'pound devaluation', 'suez revenue'],
  ethiopia: ['birr float', 'amhara ceasefire', 'coffee exports'],
  algeria: ['gas exports', 'dinar rate', 'presidential poll'],
  morocco: ['dirham rate', 'phosphates', 'world cup 2030'],
  tanzania: ['shilling rate', 'gas pipeline', 'port expansion'],
  uganda: ['shilling rate', 'oil pipeline', 'election 2026'],
  zambia: ['copper price', 'kwacha rate', 'debt deal'],
  zimbabwe: ['zimbabwe dollar', 'gold mafia', 'by-election'],
  mozambique: ['gas project', 'metical rate', 'insurgency'],
  senegal: ['oil revenue', 'cfa franc', '2026 budget'],
  cameroon: ['cfa franc', 'cocoa price', 'anglophone crisis']
};

const DEFAULT_RISING = ['breaking news', 'politics', 'economy'];

/** Normalise a URL slug or display name into a world_feeds key. */
function toSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics: Côte -> Cote
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Alternate spellings that do not match a world_feeds key or display name.
 * Maps a normalised slug to the canonical world_feeds key.
 */
const ALIASES = {
  'cote-divoire': 'ivory-coast',
  'cote-d-ivoire': 'ivory-coast',
  'ivory-coast': 'ivory-coast',
  'the-gambia': 'gambia',
  'gambia': 'gambia',
  'congo-brazzaville': 'republic-of-the-congo',
  'congo-kinshasa': 'democratic-republic-of-the-congo',
  'drc': 'democratic-republic-of-the-congo',
  'swaziland': 'eswatini',
  'cabo-verde': 'cape-verde',
  'east-africa': 'kenya'
};

/** Resolve a country record from world_feeds.json by slug or display name. */
function getCountry(value) {
  const slug = toSlug(value);
  if (!slug) return null;

  const direct = WORLD_FEEDS[slug];
  if (direct) return { slug, ...direct };

  // Alternate spellings / historical names (Côte d'Ivoire -> ivory-coast).
  const alias = ALIASES[slug];
  if (alias && WORLD_FEEDS[alias]) return { slug: alias, ...WORLD_FEEDS[alias] };

  // Fall back to matching on display name (diacritics normalised).
  for (const key of Object.keys(WORLD_FEEDS)) {
    const entry = WORLD_FEEDS[key];
    if (toSlug(entry.name) === slug) return { slug: key, ...entry };
  }
  return null;
}

/** Flag emoji from ISO-3166 alpha-2, falling back to a globe. */
function getFlag(slug) {
  const code = ISO2[toSlug(slug)];
  if (!code) return '🌍';
  return String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Local clock time for a country, e.g. "14:32". */
function getLocalTime(slug) {
  const offset = TZ_OFFSET[toSlug(slug)];
  const hours = typeof offset === 'number' ? offset : 0;
  const now = new Date(Date.now() + hours * 60 * 60 * 1000);
  return now.toISOString().slice(11, 16);
}

/** Local date + time label for display, e.g. "Mon 24 Nov, 14:32". */
function getLocalDateTime(slug) {
  const offset = TZ_OFFSET[toSlug(slug)];
  const hours = typeof offset === 'number' ? offset : 0;
  const now = new Date(Date.now() + hours * 60 * 60 * 1000);
  const day = now.toUTCString().slice(0, 3);
  const date = now.toUTCString().slice(5, 16);
  return `${day} ${date}, ${now.toISOString().slice(11, 16)}`;
}

/** Title-case a slug/name fallback, e.g. "south-africa" -> "South Africa". */
function titleCase(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Currency descriptor for a country. */
function getCurrency(slug) {
  return CURRENCY[toSlug(slug)] || { code: 'USD', name: 'US Dollar' };
}

/** Top-3 rising queries for a country. */
function getRisingQueries(slug) {
  const key = toSlug(slug);

  // Prefer live Google Trends data from the 40-minute keyword radar.
  try {
    const { getRisingKeywords } = require('./keywordRadar');
    const live = getRisingKeywords(key, 3);
    if (live.length >= 3) return live;
  } catch (_) { /* radar is optional */ }

  const queries = RISING[key];
  if (Array.isArray(queries) && queries.length >= 3) return queries.slice(0, 3);
  const name = getCountry(key)?.name || key.replace(/-/g, ' ');
  return [`${name} news`, ...DEFAULT_RISING.slice(0, 2)];
}

/**
 * Build a ~60-word regional summary from live headlines.
 * Deterministic (no AI call) so it is cheap and cache-friendly, while still
 * unique per country because it is derived from that country's own stories.
 */
function buildRegionalSummary(headlines = [], countryName = 'this region') {
  const titles = (headlines || [])
    .map(h => String(h.title || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 5);

  if (titles.length === 0) {
    return `RealSSA News is tracking developing stories across ${countryName}. Fresh reporting from local newsrooms is being verified and will publish here as the newsroom confirms details.`;
  }

  const opening = `Latest from ${countryName}:`;
  const body = titles
    .map((title, i) => {
      const trimmed = title.length > 110 ? `${title.slice(0, 107)}...` : title;
      return `${i === 0 ? '' : 'Also,'} ${trimmed.replace(/[.]+$/, '')}.`;
    })
    .join(' ');

  const words = `${opening} ${body}`.split(/\s+/).filter(Boolean);
  if (words.length <= 60) return words.join(' ');

  const clipped = words.slice(0, 60).join(' ').replace(/[,;:]$/, '');
  return `${clipped}.`;
}

/**
 * Full payload for a country page.
 * @param {string} slugOrName Country slug or display name
 * @param {Array} articles Live articles for that country
 */
function buildCountryPayload(slugOrName, articles = []) {
  const country = getCountry(slugOrName);
  const slug = country?.slug || toSlug(slugOrName);
  const name = country?.name || titleCase(String(slugOrName || '').replace(/-/g, ' '));
  const headlines = (articles || []).slice(0, 5);

  return {
    country: {
      slug,
      name,
      flag: getFlag(slug),
      continent: country?.continent || 'Africa'
    },
    localTime: getLocalTime(slug),
    localDateTime: getLocalDateTime(slug),
    currency: getCurrency(slug),
    risingQueries: getRisingQueries(slug),
    regionalSummary: buildRegionalSummary(headlines, name),
    headlines: headlines.map(a => ({
      id: a.id,
      title: a.title,
      excerpt: a.excerpt || a.summary || '',
      image: a.image || null,
      date: a.date || a.published_at || null,
      source: a.source || a.author || 'RealSSA News'
    })),
    hasCoverage: headlines.length > 0
  };
}

// Capital-city coordinates (lat, lon) for weather lookups. Countries without an
// entry simply omit the weather block — the payload stays valid.
const COORDS = {
  nigeria: [9.06, 7.49], ghana: [5.60, -0.19], kenya: [-1.29, 36.82],
  'south-africa': [-25.75, 28.19], egypt: [30.04, 31.24], ethiopia: [9.03, 38.74],
  tanzania: [-6.79, 39.21], uganda: [0.35, 32.58], algeria: [36.75, 3.06],
  angola: [-8.84, 13.23], benin: [6.37, 2.42], botswana: [-24.63, 25.92],
  'burkina-faso': [12.37, -1.52], burundi: [-3.38, 29.36], 'cabo-verde': [14.93, -23.51],
  'cape-verde': [14.93, -23.51], cameroon: [3.85, 11.50],
  'central-african-republic': [4.39, 18.56], chad: [12.13, 15.06],
  comoros: [-11.70, 43.26], 'democratic-republic-of-the-congo': [-4.44, 15.27],
  'republic-of-the-congo': [-4.26, 15.24], 'cote-d-ivoire': [6.83, -5.30],
  'cote-divoire': [6.83, -5.30], 'ivory-coast': [6.83, -5.30], djibouti: [11.59, 43.15],
  'equatorial-guinea': [3.75, 8.78], eritrea: [15.34, 38.93], eswatini: [-26.31, 31.14],
  gabon: [0.42, 9.47], gambia: [13.45, -16.58], 'the-gambia': [13.45, -16.58],
  guinea: [9.95, -9.47], 'guinea-bissau': [11.86, -15.60], lesotho: [-29.31, 27.48],
  liberia: [6.30, -10.80], libya: [32.89, 13.19], madagascar: [-18.91, 47.54],
  malawi: [-13.96, 33.79], mali: [12.64, -8.00], mauritania: [18.08, -15.98],
  mauritius: [-20.16, 57.50], morocco: [34.02, -6.84], mozambique: [-25.97, 32.57],
  namibia: [-22.56, 17.08], niger: [13.51, 2.11], rwanda: [-1.94, 30.06],
  'sao-tome-and-principe': [0.34, 6.73], senegal: [14.72, -17.47],
  seychelles: [-4.62, 55.45], 'sierra-leone': [8.48, -13.23], somalia: [2.05, 45.32],
  'south-sudan': [4.85, 31.58], sudan: [15.50, 32.56], togo: [6.13, 1.22],
  tunisia: [36.81, 10.18], zambia: [-15.42, 28.28], zimbabwe: [-17.83, 31.05],
  'united-kingdom': [51.51, -0.13], uk: [51.51, -0.13], 'united-states': [38.90, -77.04],
  usa: [38.90, -77.04], uae: [24.47, 54.37], canada: [45.42, -75.70],
  mexico: [19.43, -99.13], brazil: [-15.79, -47.88], argentina: [-34.60, -58.38],
  india: [28.61, 77.21], japan: [35.68, 139.69], china: [39.90, 116.41],
  germany: [52.52, 13.40], france: [48.86, 2.35], netherlands: [52.37, 4.90],
  portugal: [38.72, -9.14], ireland: [53.35, -6.26], australia: [-35.28, 149.13],
  'new-zealand': [-41.29, 174.78], philippines: [14.60, 120.98], indonesia: [-6.21, 106.85]
};

// WMO weather interpretation codes -> short human labels
const WMO = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers',
  85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm',
  96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail'
};

const weatherCache = new Map(); // slug -> { data, at }
const WEATHER_TTL_MS = 30 * 60 * 1000;
const WEATHER_TIMEOUT_MS = 2500;

/**
 * Current conditions for a country's capital, cached for 30 minutes.
 * Returns null when the country has no coordinate entry or the API fails.
 * @returns {Promise<null|{tempC:number, condition:string, code:number, asOf:string}>}
 */
async function getWeather(slug) {
  const key = toSlug(slug);
  const coords = COORDS[key];
  if (!coords) return null;

  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.at < WEATHER_TTL_MS) return cached.data;

  try {
    const [lat, lon] = coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
    const res = await fetch(url, { signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS) });
    if (!res.ok) return null;
    const json = await res.json();
    const current = json?.current;
    if (!current || typeof current.temperature_2m !== 'number') return null;

    const code = Number(current.weather_code);
    const data = {
      tempC: Math.round(current.temperature_2m),
      condition: WMO[code] || 'Current conditions',
      code,
      asOf: new Date().toISOString()
    };
    weatherCache.set(key, { data, at: Date.now() });
    return data;
  } catch (_) {
    return null;
  }
}

/**
 * Thin-content guard for country pages.
 * If a country yields fewer than 3 distinct headlines, mark the page noindex, follow
 * and list it in a thin_pages table instead of exposing it to crawl.
 */
let thinPagesTableReady = false;

async function ensureThinPagesTable(pool) {
  if (thinPagesTableReady || !pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS thin_pages (
        id SERIAL PRIMARY KEY,
        country_slug TEXT NOT NULL,
        country_name TEXT NOT NULL,
        headline_count INTEGER DEFAULT 0,
        last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        noindex_reason TEXT,
        UNIQUE(country_slug)
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_thin_pages_slug ON thin_pages(country_slug);
    `);
    console.log('[CountryIntel] Thin pages table ready');
    thinPagesTableReady = true;
  } catch (err) {
    console.warn('[CountryIntel] Thin pages table setup failed:', err.message);
  }
}

async function checkThinContent(pool, slug, name, headlineCount) {
  await ensureThinPagesTable(pool);
  const isThin = headlineCount < 3;

  if (pool) {
    try {
      if (isThin) {
        await pool.query(
          `INSERT INTO thin_pages (country_slug, country_name, headline_count, noindex_reason, last_checked_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (country_slug) DO UPDATE SET
             headline_count = EXCLUDED.headline_count,
             last_checked_at = NOW()`,
          [slug, name, headlineCount, `Only ${headlineCount} distinct headlines available`]
        );
      } else {
        await pool.query(
          `DELETE FROM thin_pages WHERE country_slug = $1`,
          [slug]
        );
      }
    } catch (err) {
      console.warn('[CountryIntel] Thin content check failed:', err.message);
    }
  }

  return isThin;
}

async function getThinPages(pool) {
  if (!pool) return [];
  try {
    const result = await pool.query(
      `SELECT * FROM thin_pages ORDER BY headline_count ASC, country_name ASC`
    );
    return result.rows;
  } catch (err) {
    console.warn('[CountryIntel] getThinPages failed:', err.message);
    return [];
  }
}

module.exports = {
  WORLD_FEEDS,
  toSlug,
  getCountry,
  getFlag,
  getLocalTime,
  getLocalDateTime,
  getCurrency,
  getRisingQueries,
  getWeather,
  buildRegionalSummary,
  buildCountryPayload,
  checkThinContent,
  getThinPages,
  ensureThinPagesTable
};
