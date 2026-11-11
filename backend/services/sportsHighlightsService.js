/**
 * Sports Highlights Service
 * =========================
 * Finished matches deserve watch-time too. Given a fixture (home/away,
 * kickoff, optional TheSportsDB event id), collect official highlight
 * clips from two free providers — no API keys, no HTML scraping:
 *
 *   1. TheSportsDB v1 — eventsday.php?d=YYYY-MM-DD lists every event of a
 *      day with `strVideo` (official highlight, usually YouTube) and
 *      `strThumb`. Verified live 2026-10-18: strStatus "FT", strVideo set.
 *   2. ESPN site API  — scoreboard?dates=YYYYMMDD locates the event, then
 *      summary?event={id} → `videos[]` where `links.source.href` is a
 *      DIRECT MP4 (Akamai CDN) plus `thumbnail` + `duration` seconds.
 *      Verified live 2026-10-18 (eng.1, event 401878771).
 *
 * Every response also carries a YouTube deep-search link so the UI tab is
 * never a dead end. Results are cached in Redis (30 min) + per-instance
 * memory (5 min) — highlights are immutable once published, and at 1M users
 * we never want to re-walk two upstream chains per page view.
 */

let redisService = null;
try { redisService = require('./redisService'); } catch (_) { /* optional */ }

const THE_SPORTS_DB_KEY = '123'; // same free public key api/sports.js already uses

const MEM_TTL_MS = 5 * 60 * 1000;
const REDIS_TTL_S = 1800; // 30 min

const memCache = new Map(); // key → { at, value }

function fetchJson(url, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    signal: controller.signal,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  })
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null)
    .finally(() => clearTimeout(timer));
}

// ── Fuzzy team matching (the same trick the stream ladder uses) ───────────

const STOP_WORDS = new Set(['fc', 'cf', 'sc', 'afc', 'club', 'the', 'cd', 'ac']);

function teamKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !STOP_WORDS.has(w))
    .join(' ');
}

function teamMatches(a, b) {
  const ka = teamKey(a);
  const kb = teamKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.includes(kb) || kb.includes(ka)) return true;
  // Token overlap with prefix tolerance: "Man City" ↔ "Manchester City",
  // "Inter" ↔ "Inter Milan" — while "Arsenal" ≠ "Chelsea" stays false.
  const ta = ka.split(' ');
  const tb = kb.split(' ');
  let overlap = 0;
  for (const x of ta) {
    for (const y of tb) {
      if (x.length >= 3 && y.length >= 3 && (x === y || x.startsWith(y) || y.startsWith(x))) {
        overlap++;
        break;
      }
    }
  }
  return overlap >= 2;
}

function dedupeClips(clips) {
  const seen = new Set();
  return (clips || []).filter(c => {
    if (!c?.url) return false;
    const k = c.url.replace(/^https?:\/\/(www\.)?/, '');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function youtubeSearchUrl(home, away) {
  const q = `${home || ''} vs ${away || ''} highlights`.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

// ── Provider 1: TheSportsDB (official per-event highlight video) ──────────

function sportsDbDate(kickoff) {
  if (kickoff == null || kickoff === '') return null;
  const d = new Date(typeof kickoff === 'number' ? (kickoff > 1e12 ? kickoff : kickoff * 1000) : kickoff);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function sportsDbClips(kickoff, id, home, away) {
  const date = sportsDbDate(kickoff);
  if (!date) return [];
  const data = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${THE_SPORTS_DB_KEY}/eventsday.php?d=${date}`);
  const events = data?.events || [];
  const ev =
    (id && events.find(e => String(e.idEvent) === String(id))) ||
    events.find(e => teamMatches(e.strHomeTeam, home) && teamMatches(e.strAwayTeam, away)) ||
    null;
  if (!ev || !ev.strVideo) return [];
  return [{
    id: `tsdb-${ev.idEvent}`,
    title: `${ev.strEvent || `${home} vs ${away}`} — Official Highlights`,
    thumb: ev.strThumb || '',
    url: ev.strVideo,
    kind: 'youtube',
    duration: null,
    provider: 'TheSportsDB',
  }];
}

// ── Provider 2: ESPN (direct MP4 clips per event) ─────────────────────────

const ESPN_SLUGS = [
  ['champions league', 'uefa.champions'],
  ['europa conference', 'uefa.europa.conf'],
  ['europa league', 'uefa.europa'],
  ['premier league', 'eng.1'], ['epl', 'eng.1'],
  ['championship', 'eng.2'],
  ['la liga', 'esp.1'], ['laliga', 'esp.1'],
  ['serie a', 'ita.1'],
  ['bundesliga', 'ger.1'],
  ['ligue 1', 'fra.1'],
  ['mls', 'usa.1'],
  ['eredivisie', 'ned.1'],
  ['primeira liga', 'por.1'],
  ['brasileir', 'bra.1'],
  ['liga mx', 'mex.1'],
  ['scottish prem', 'sco.1'],
  ['saudi', 'ksa.1'],
  ['j1 league', 'jpn.1'], ['j-league', 'jpn.1'],
  ['k league', 'kor.1'],
  ['a-league', 'aus.1'],
  ['super lig', 'tur.1'],
];

function espnSlugFor(competition) {
  const c = String(competition || '').toLowerCase();
  if (!c) return null;
  for (const [needle, slug] of ESPN_SLUGS) {
    if (c.includes(needle)) return slug;
  }
  return null;
}

function espnDate(kickoff) {
  const d = sportsDbDate(kickoff);
  return d ? d.replace(/-/g, '') : null;
}

function pickEspnVideoUrl(video) {
  return (
    video?.links?.source?.href ||
    video?.links?.mobile?.source?.href ||
    video?.links?.web?.href ||
    ''
  );
}

async function espnClips(leagueSlug, yyyymmdd, home, away) {
  if (!leagueSlug || !yyyymmdd) return [];
  const sb = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/scoreboard?dates=${yyyymmdd}`);
  const events = sb?.events || [];
  const ev = events.find(e => {
    const names = (e?.competitions?.[0]?.competitors || []).map(c => c?.team?.displayName || c?.team?.name || '');
    return names.some(n => teamMatches(n, home)) && names.some(n => teamMatches(n, away));
  });
  if (!ev) return [];
  const sum = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/summary?event=${ev.id}`);
  const videos = sum?.videos || [];
  return videos.slice(0, 8).map(v => {
    const url = pickEspnVideoUrl(v);
    return {
      id: `espn-${v.id}`,
      title: v.headline || v.description || 'Highlight',
      thumb: v.thumbnail || '',
      url,
      kind: /\.mp4($|\?)/i.test(url) ? 'mp4' : 'page',
      duration: v.duration || null,
      provider: 'ESPN',
    };
  }).filter(c => c.url);
}

const settled = r => (r.status === 'fulfilled' ? r.value : []);

// ── Public API ────────────────────────────────────────────────────────────

async function getHighlights(params = {}) {
  const home = String(params.home || '').trim();
  const away = String(params.away || '').trim();
  const kickoff = params.kickoff || null;
  const competition = params.competition || '';
  const matchUrl = params.matchUrl || '';
  // Accept an explicit id, or pull the TheSportsDB event id out of match_url
  // (normalizeMatch builds https://www.thesportsdb.com/event/{idEvent}).
  const id = params.id ? String(params.id) : ((String(matchUrl).match(/event\/(\d+)/) || [])[1] || '');
  const youtubeSearch = youtubeSearchUrl(home, away);

  if (!home || !away) {
    return { home, away, competition, clips: [], youtubeSearch, count: 0, providers: [], cached: false };
  }

  const key = `${id || 'x'}|${teamKey(home)}|${teamKey(away)}|${sportsDbDate(kickoff) || 'nodate'}`;

  const mem = memCache.get(key);
  if (mem && Date.now() - mem.at < MEM_TTL_MS) return { ...mem.value, cached: true };
  try {
    const cached = await redisService?.getCached?.(`sports:hl:${key}`);
    if (cached && Array.isArray(cached.clips)) return { ...cached, cached: true };
  } catch (_) { /* Redis down — fall through to providers */ }

  const slug = espnSlugFor(competition);
  const [dbRes, espnRes] = await Promise.allSettled([
    sportsDbClips(kickoff, id, home, away),
    slug ? espnClips(slug, espnDate(kickoff), home, away) : Promise.resolve([]),
  ]);

  const clips = dedupeClips([...settled(dbRes), ...settled(espnRes)]).slice(0, 12);
  const providers = [
    ...(settled(dbRes).length ? ['TheSportsDB'] : []),
    ...(settled(espnRes).length ? ['ESPN'] : []),
  ];

  const value = {
    home,
    away,
    competition,
    clips,
    youtubeSearch,
    count: clips.length,
    providers,
    cached: false,
    generatedAt: new Date().toISOString(),
  };

  memCache.set(key, { at: Date.now(), value });
  if (memCache.size > 300) memCache.clear();
  try { await redisService?.setCached?.(`sports:hl:${key}`, value, REDIS_TTL_S); } catch (_) {}

  return value;
}

module.exports = {
  getHighlights,
  youtubeSearchUrl,
  _test: { espnSlugFor, pickEspnVideoUrl, dedupeClips, sportsDbDate, teamKey, teamMatches },
};
