/**
 * RealSSA Own Sports Stream Service
 * ==================================
 * Powers OUR OWN native video player for live sports.
 * Instead of sending users into heavy-ad embed sites, we resolve DIRECT
 * HLS (.m3u8) streams and play them in our own in-app player (hls.js).
 *
 * Fixtures come from:
 *   1. Streamed API mirrors (all sports, with stream-site match IDs)
 *   2. `matches` DB table (football-data.org via sportsBot — crests, scores)
 *   3. ESPN scoreboards (NBA/NFL/F1/Tennis/etc.)
 *
 * Direct playback sources come from IPTV sports channel playlists
 * (legit free broadcast feeds) matched to fixtures with team-name and
 * crest/logo matching.
 *
 * Everything is Redis-cached (stale-on-error) so we can face 600k users.
 */

const axios = require('axios');
const redisService = require('./redisService');

const MATCHES_CACHE_KEY = 'sports:feed:v2';
const IPTV_CACHE_KEY = 'sports:iptv:v1';
const SOURCES_CACHE_PREFIX = 'sports:sources:v2:';

const MATCHES_TTL = 120;        // fixtures refresh every 2 min
const MATCHES_STALE = 1800;     // serve stale up to 30 min on upstream failure
const IPTV_TTL = 3600 * 6;      // channel library refresh every 6 hours
const SOURCES_TTL = 300;        // per-match direct sources cache 5 min

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

// ── Streamed API mirrors (the sites behind our iframe servers) ──
const STREAMED_HOSTS = [
  'https://streamed.st',
  'https://api.streamed.st',
  'https://streamed.su',
];

// ── IPTV playlists → our own direct HLS library (no iframes, no ads) ──
const IPTV_PLAYLISTS = [
  'https://iptv-org.github.io/iptv/categories/sports.m3u',
  'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ng.m3u',
  'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/uk.m3u',
  'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us.m3u',
  'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/za.m3u',
];

// Keep only likely live-sports broadcast channels
const IPTV_CHANNEL_FILTER = /(sport|espn|fox sport|scc|supersport|bein|arena|sporttv|sport tv|star sports|willow|ten sports|gps|gtv sport|nta|elevensport|viaplay|setanta|premiere|dazn|tnt sports|sky sport|bt sport|viasport|match\b|union paya|supersport)/i;
const IPTV_MAX_PER_PLAYLIST = 40;

// ══════════════════════════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════════════════════════

function normalizeTeam(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(fc|cf|sc|afc|ac|club|de|da|do|del|the|team|if|fk|bk|sk|cd|ud|sd|cp|ca|rc|rcd|athletic|atletico|sporting|boavista|estrela|od|boldklub|fodbold|allianca|alliansi|liga)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Alias map so abbreviations match long forms: "PSG"↔"Paris Saint-Germain",
// "Man City"↔"Manchester City", "Inter"↔"Inter Milan", etc.
// KEY = compact (space-free) normalized name; VALUE = canonical token set for that club.
const CLUB_ALIASES = {
  psg: ['paris', 'saint', 'germain'],
  paris: ['paris', 'saint', 'germain'],
  parissaintgermain: ['paris', 'saint', 'germain'],
  psgparis: ['paris', 'saint', 'germain'],
  parissg: ['paris', 'saint', 'germain'],
  mancity: ['manchester', 'city'],
  manchester: ['manchester'],
  manchestercity: ['manchester', 'city'],
  city: ['manchester', 'city'],
  manutd: ['manchester', 'united'],
  manunited: ['manchester', 'united'],
  manchesterunited: ['manchester', 'united'],
  united: ['manchester', 'united'],
  realmadrid: ['real', 'madrid'],
  madrid: ['real', 'madrid'],
  real: ['real', 'madrid'],
  barcelona: ['barcelona', 'barca'],
  barca: ['barcelona', 'barca'],
  bayern: ['bayern', 'munich'],
  bayernmunich: ['bayern', 'munich'],
  bayernmunchen: ['bayern', 'munich'],
  dortmund: ['bvb', 'borussia', 'dortmund'],
  bvb: ['bvb', 'borussia', 'dortmund'],
  juventus: ['juventus', 'juve'],
  juve: ['juventus', 'juve'],
  inter: ['inter', 'milan'],
  intermilan: ['inter', 'milan'],
  internazionale: ['inter', 'milan'],
  napoli: ['napoli'],
  chelsea: ['chelsea'],
  arsenal: ['arsenal'],
  liverpool: ['liverpool'],
};

// Canonical token set for a team name: alias-aware so "PSG" and
// "Paris Saint-Germain" collapse to the same tokens.
function teamTokens(name) {
  const norm = normalizeTeam(name);
  const compact = norm.replace(/\s+/g, '');
  if (CLUB_ALIASES[compact]) {
    // canonical set: all alias tokens + compact alias itself
    const set = new Set(CLUB_ALIASES[compact]);
    set.add(compact);
    return set;
  }
  const tokens = new Set(norm.split(' ').filter(t => t.length >= 2));
  tokens.add(compact);
  return tokens;
}

// Stable canonical key: if the name maps to an alias group, key on the group's
// sorted tokens only (so every spelling of a club yields the SAME key).
function clubKey(name) {
  const norm = normalizeTeam(name);
  const compact = norm.replace(/\s+/g, '');
  if (CLUB_ALIASES[compact]) return 'CLUB:' + [...CLUB_ALIASES[compact]].sort().join('|');
  return norm;
}

function tokenSet(name) {
  return new Set(normalizeTeam(name).split(' ').filter(t => t.length >= 3));
}

function teamScore(a, b) {
  const na = normalizeTeam(a), nb = normalizeTeam(b);
  if (!na || !nb) return 0;
  if (na === nb || na.includes(nb) || nb.includes(na)) return 10;
  // Same club under different spellings/aliases (PSG ≡ Paris Saint-Germain)
  if (clubKey(a) === clubKey(b)) return 10;
  const ta = teamTokens(a), tb = teamTokens(b);
  const shared = sharedCount(ta, tb);
  if (shared >= 2) return 7;
  if (shared === 1) return 4;
  return 0;
}

function sharedCount(ta, tb) {
  let shared = 0;
  for (const t of ta) if (tb.has(t) && t.length >= 3) shared++;
  return shared;
}

function parseTeams(event) {
  const delimiters = [' vs ', ' VS ', ' - ', ' @ '];
  for (const d of delimiters) {
    if (event.includes(d)) {
      const parts = event.split(d);
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        return { home: parts[0].trim(), away: parts[1].trim().replace(/\s*\(.*?\)\s*$/, '').trim() };
      }
    }
  }
  return { home: null, away: null };
}

function fmtTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (_) { return ''; }
}

function inferSportFromTitle(title = '', category = '') {
  const t = `${category} ${title}`.toLowerCase();
  if (/nba|basketball|knicks|lakers|celtics/.test(t)) return 'NBA Basketball';
  if (/\bnfl\b|patriots|cowboys/.test(t)) return 'NFL American Football';
  if (/\bmlb\b|baseball|yankees|dodgers/.test(t)) return 'MLB Baseball';
  if (/ufc|mma|boxing|bare knuckle|fight night|wwe|wrestling/.test(t)) return 'Combat Sports';
  if (/formula 1|\bf1\b|motogp|motorsport|grand prix/.test(t)) return 'Formula 1';
  if (/tennis|\batp\b|\bwta\b|wimbledon/.test(t)) return 'Tennis';
  if (/rugby|six nations/.test(t)) return 'Rugby';
  if (/cricket|ipl|t20|ashes/.test(t)) return 'Cricket';
  if (/hockey|\bnhl\b/.test(t)) return 'Ice Hockey';
  if (/golf|pga|masters/.test(t)) return 'Golf';
  if (/cycling|tour de|giro/.test(t)) return 'Cycling';
  if (/volleyball|handball|netball/.test(t)) return 'Other Sports';
  return 'Football';
}

// Parse an IPTV m3u playlist → [{ name, url, logo, group }]
async function parseIptvPlaylist(playlistUrl) {
  try {
    const resp = await axios.get(playlistUrl, { timeout: 15000, responseType: 'text', maxRedirects: 5 });
    const text = typeof resp.data === 'string' ? resp.data : String(resp.data);
    const lines = text.split(/\r?\n/);
    const channels = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith('#EXTINF')) continue;
      const url = (lines[i + 1] || '').trim();
      if (!url || !url.startsWith('https://') || !url.includes('.m3u8')) continue;
      const name = (line.split(',').slice(1).join(',') || '').trim();
      if (!name) continue;
      if (IPTV_CHANNEL_FILTER.test(name)) {
        const logo = (line.match(/tvg-logo="([^"]*)"/) || [])[1] || '';
        const group = (line.match(/group-title="([^"]*)"/) || [])[1] || '';
        channels.push({ name, url, logo, group });
      }
    }
    return channels;
  } catch (err) {
    console.warn(`[sportsStreams] IPTV playlist failed ${playlistUrl}: ${err.message}`);
    return [];
  }
}

// Fetch + cache the IPTV channel library (our own direct-HLS catalogue)
async function getIptvChannels() {
  try {
    const cached = await redisService.getCached(IPTV_CACHE_KEY);
    if (Array.isArray(cached) && cached.length) return cached;
  } catch (_) {}

  const results = await Promise.allSettled(IPTV_PLAYLISTS.map(p => parseIptvPlaylist(p)));
  const seenUrls = new Set();
  const channels = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    let added = 0;
    for (const ch of r.value) {
      if (added >= IPTV_MAX_PER_PLAYLIST) break;
      if (seenUrls.has(ch.url)) continue;
      seenUrls.add(ch.url);
      channels.push(ch);
      added++;
    }
  }
  if (channels.length) {
    redisService.setCached(IPTV_CACHE_KEY, channels, IPTV_TTL).catch(() => {});
    console.log(`[sportsStreams] IPTV library refreshed: ${channels.length} channels`);
  }
  return channels;
}

// Find direct HLS sources for a fixture using the IPTV library
function findIptvSources(home, away, homeCrest, awayCrest, channels) {
  const sources = [];
  const seen = new Set();
  const hTokens = [...teamTokens(home)].filter(t => t.length >= 4);
  const aTokens = [...teamTokens(away)].filter(t => t.length >= 4);

  for (const ch of channels) {
    const cn = ch.name.toLowerCase();
    let score = 0;
    // 1) Crest/logo match — strongest signal: this channel IS one of the teams
    const logoHay = `${ch.logo || ''}`.toLowerCase();
    if (homeCrest && logoHay) {
      const hKey = (String(homeCrest).split('/').pop() || '').toLowerCase();
      if (hKey.length > 4 && logoHay.includes(hKey)) score = Math.max(score, 12);
    }
    if (awayCrest && logoHay) {
      const aKey = (String(awayCrest).split('/').pop() || '').toLowerCase();
      if (aKey.length > 4 && logoHay.includes(aKey)) score = Math.max(score, 12);
    }
    // 2) Team (or alias) token inside channel name (e.g. "PSG TV", "Liverpool FC TV")
    if (score < 12 && hTokens.some(t => cn.includes(t))) score = Math.max(score, 9);
    if (score < 12 && aTokens.some(t => cn.includes(t))) score = Math.max(score, 9);
    if (score > 0 && !seen.has(ch.url)) {
      seen.add(ch.url);
      sources.push({ url: ch.url, quality: 'Auto', label: ch.name, matchScore: score });
    }
  }
  return sources.sort((x, y) => y.matchScore - x.matchScore).slice(0, 12);
}

// Full source ladder for a fixture:
//   tier 1 (9-12) exact team/crest channel
//   tier 2 (2-6)  broadcaster the league actually airs on
//   tier 3 (1)    generic sports channels — guarantees something plays
// Never returns an empty list (as long as we have any channels).
function buildSourceLadder(match, channels) {
  const out = [];
  const seen = new Set();
  const push = (arr) => {
    for (const s of arr) {
      if (!s?.url || seen.has(s.url)) continue;
      seen.add(s.url);
      out.push(s);
    }
  };
  // ── tier 1: exact team / crest channel ──
  push(findIptvSources(match?.home, match?.away, match?.homeCrest, match?.awayCrest, channels || [])
    .map(s => ({ ...s, sourceTier: 'team' })));
  // ── tier 2: broadcaster this league actually airs on ──
  push(pickBroadcasterSources(match || {}, channels || [])
    .map(s => ({ ...s, sourceTier: 'broadcaster' })));
  // ── tier 3: generic sports channels — never a dead end ──
  push(genericChannelSources(channels || [])
    .map(s => ({ ...s, sourceTier: 'generic' })));
  return out.slice(0, 14);
}

// Always-available generic live-sports channels (watch *a* live match now)
async function getGenericSportsChannels() {
  const channels = await getIptvChannels();
  return genericChannelSources(channels, 10);
}

// ══════════════════════════════════════════════════════════════
//  Smart channel picker — league/sport → broadcaster affinity
//  How the big aggregators do it: they know Newcastle is on Sky/beIN,
//  NBA is on ESPN, NFL on Sky/Fox. We do the same so a match always has
//  a *sensible* channel even when the exact team channel isn't in our
//  playlist — instead of a random channel list.
// ══════════════════════════════════════════════════════════════

const BROADCASTER_HINTS = [
  // Football — by league
  { test: /premier league|efl|championship|fa cup|carabao/i, names: ['sky sport', 'tnt sport', 'supersport', 'premier sports', 'beIN'] },
  { test: /la liga|laliga|copa del rey/i,                     names: ['laliga', 'la liga', 'beIN', 'movistar', 'espn'] },
  { test: /serie a|coppa italia/i,                            names: ['serie a', 'dazn', 'sky sport', 'bein'] },
  { test: /bundesliga|dfb/i,                                  names: ['bundesliga', 'sky sport', 'dazn'] },
  { test: /ligue 1|french/i,                                  names: ['ligue 1', 'beIN', 'dazn'] },
  { test: /champions league|europa league|uefa|conference league/i, names: ['tnt sport', 'cbs sport', 'beIN', 'supersport', 'sky sport'] },
  { test: /afcon|africa|nigeria|npfl/i,                       names: ['supersport', 'super sport', 'nff', 'nta', 'sport tv', 'gtv sport'] },
  { test: /\bmls\b|usa\.1/i,                                  names: ['espn', 'fox sport', 'mls'] },
  { test: /eredivisie|belgian|portugal|primeira|scottish|super ?lig/i, names: ['espn', 'sky sport', 'sport tv'] },
  // US sports
  { test: /\bnba\b|basketball|euroleague|\bncaa\b/i,           names: ['espn', 'tnt sport', 'sky sport', 'arena sport', 'sport tv'] },
  { test: /\bnfl\b|american football/i,                        names: ['sky sport', 'fox sport', 'espn', 'nfl network'] },
  { test: /\bmlb\b|baseball/i,                                 names: ['espn', 'fox sport', 'mlb'] },
  { test: /\bnhl\b|ice hockey/i,                               names: ['espn', 'sky sport'] },
  { test: /\bmls\b|\bnrl\b|rugby|six nations|super rugby/i,    names: ['sky sport', 'supersport', 'premier sports', 'fox sport'] },
  { test: /cricket|\bipl\b|\bt20\b|ashes|\bbbl\b|\bpsl\b/i,    names: ['star sports', 'sky sport', 'supersport', 'willow', 'ten sports', 'sport tv'] },
  { test: /formula 1|\bf1\b|motogp|nascar|motorsport|grand prix|superbike|wsbk/i, names: ['sky sport', 'espn', 'fox sport', 'tnt sport'] },
  { test: /ufc|mma|boxing|fight|wwe|wrestling|combat/i,        names: ['espn', 'tnt sport', 'sky sport', 'dazn', 'arena sport'] },
  { test: /tennis|\batp\b|\bwta\b|wimbledon|us open|roland/i,  names: ['sky sport', 'espn', 'tnt sport', 'eurosport', 'sport tv'] },
  { test: /golf|pga|masters|ryder/i,                           names: ['sky sport', 'golf', 'espn'] },
  { test: /cycling|tour de|giro|vuelta/i,                      names: ['eurosport', 'sky sport', 'tnt sport'] },
  { test: /darts|snooker|athletics|volleyball|handball|netball|badminton|table tennis/i, names: ['sky sport', 'eurosport', 'sport tv', 'supersport'] },
];

// Fallback broadcaster list when we can't infer the league at all.
const GENERIC_SPORTS_CHANNEL_RE = /superSport|Sky Sport|ESPN|Fox Sport|beIN|Star Sports|Arena Sport|SportTV|Sport TV|TNT Sports|Premier Sports|Setanta|Eleven Sport|Viaplay|Viasport|NTA Sports|GTV Sport|SCC|DAZN|Eurosport|Match ?!|Sport ?1|Movistar/i;

// Rank our IPTV channels by broadcaster affinity for this fixture.
// Returns sources tagged matchScore 3-6 (below an exact team match of 9/12).
function pickBroadcasterSources(match, channels) {
  const hay = `${match.league || ''} ${match.sport || ''} ${match.event || ''}`;
  const hints = [];
  for (const h of BROADCASTER_HINTS) {
    if (h.test.test(hay)) hints.push(...h.names.map(n => n.toLowerCase()));
  }
  if (!hints.length) hints.push('espn', 'sky sport', 'supersport', 'bein', 'tnt sport');

  const scored = [];
  for (let hi = 0; hi < hints.length; hi++) {
    const hint = hints[hi];
    // Earlier (more specific) hints win; long broadcaster names beat short/generic ones.
    const base = Math.max(2, 6 - Math.floor(hi / 2)) + (hint.length >= 6 ? 1 : 0);
    for (const ch of channels) {
      const name = ch.name.toLowerCase();
      if (!name.includes(hint)) continue;
      // Prefer channels whose *leading* word is the broadcaster (e.g. "beIN Sports 1"
      // over "Adjarasport 1" which merely contains it) — avoids junk ranked at tier 6.
      const starts = name.trimStart().startsWith(hint) ? 1 : 0;
      scored.push({ ch, score: base + starts, starts, hi });
    }
  }
  // Highest score first; tie-break on specificity then original channel order.
  scored.sort((a, b) => b.score - a.score || a.starts - b.starts || a.hi - b.hi);

  const out = [];
  const seen = new Set();
  for (const s of scored) {
    if (seen.has(s.ch.url)) continue;
    seen.add(s.ch.url);
    out.push({ url: s.ch.url, quality: 'Auto', label: s.ch.name, matchScore: s.score });
    if (out.length >= 10) break;
  }
  return out;
}

// Generic sports channels — used as the guaranteed last-resort tier so a
// fixture ALWAYS has something native to open (never a dead end).
function genericChannelSources(channels, limit = 6) {
  return channels
    .filter(ch => GENERIC_SPORTS_CHANNEL_RE.test(ch.name))
    .slice(0, limit)
    .map(ch => ({ url: ch.url, quality: 'Live', label: ch.name, matchScore: 1 }));
}

// ── Source 1: Streamed API mirrors (all sports + embed match IDs) ──
async function fetchStreamedMatches() {
  for (const host of STREAMED_HOSTS) {
    for (const path of ['/api/matches/live', '/api/matches/all']) {
      try {
        const resp = await axios.get(`${host}${path}`, { headers: BROWSER_HEADERS, timeout: 6000 });
        if (resp.status === 200 && Array.isArray(resp.data) && resp.data.length) {
          console.log(`[sportsStreams] Streamed mirror OK: ${host}${path} (${resp.data.length} matches)`);
          return resp.data.map(item => {
            const title = item.title || item.name || '';
            const rawSport = item.category || item.sport || inferSportFromTitle(title);
            const sport = rawSport ? rawSport.charAt(0).toUpperCase() + rawSport.slice(1) : 'Sports';
            const { home, away } = parseTeams(title);
            const isLive = !!(item.live || item.isLive);
            return {
              id: String(item.id || ''),
              event: title,
              sport,
              home,
              away,
              kickoff: item.date || item.time || null,
              isLive,
              source: 'streamed',
            };
          }).filter(m => m.event);
        }
      } catch (e) {
        console.warn(`[sportsStreams] Streamed mirror ${host}${path}: ${e.message}`);
      }
    }
  }
  return [];
}

// ── Source 2: our own DB (football-data via sportsBot — crests, scores, status) ──
async function fetchDbMatches(pool) {
  if (!pool) return [];
  try {
    const r = await pool.query(`
      SELECT provider_match_id, competition_name, home_team_name, home_team_crest,
             away_team_name, away_team_crest, status, minute, home_score, away_score, kickoff_at
      FROM matches
      WHERE status IN ('live', 'scheduled')
         OR kickoff_at > NOW() - INTERVAL '3 hours'
      ORDER BY (status = 'live') DESC, kickoff_at ASC
      LIMIT 120
    `);
    return r.rows.map(m => ({
      id: `db:${m.provider_match_id}`,
      event: `${m.home_team_name} vs ${m.away_team_name}`,
      sport: 'Football',
      league: m.competition_name || '',
      home: m.home_team_name || null,
      away: m.away_team_name || null,
      homeCrest: m.home_team_crest || null,
      awayCrest: m.away_team_crest || null,
      kickoff: m.kickoff_at || null,
      isLive: m.status === 'live',
      status: m.status,
      score: (m.home_score != null || m.away_score != null)
        ? `${m.home_score ?? 0}-${m.away_score ?? 0}`
        : null,
      source: 'db',
    }));
  } catch (e) {
    console.warn('[sportsStreams] DB fixture fetch failed:', e.message);
    return [];
  }
}

// ── Source 3: ESPN scoreboards (NBA/NFL/F1/Tennis/etc.) ──
const ESPN_LEAGUES = [
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard', sport: 'Premier League Football' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard', sport: 'Champions League' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard', sport: 'La Liga Football' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard', sport: 'Serie A Football' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard', sport: 'Bundesliga Football' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard', sport: 'MLS Football' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', sport: 'NBA Basketball' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', sport: 'NFL American Football' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard', sport: 'MLB Baseball' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard', sport: 'Formula 1' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/scoreboard', sport: 'Tennis' },
];

async function fetchEspnMatches() {
  const events = [];
  await Promise.allSettled(
    ESPN_LEAGUES.map(async ({ url, sport }) => {
      try {
        const resp = await axios.get(url, { timeout: 6000 });
        (resp.data?.events || []).forEach(ev => {
          const comps = ev.competitions?.[0]?.competitors || ev.competitors || [];
          const findSide = (side, idx) => {
            const c = comps.find(x => x.homeAway === side) || comps[idx];
            return {
              name: c?.team?.displayName || c?.team?.shortDisplayName || c?.athlete?.shortDisplayName || '',
              logo: c?.team?.logo || c?.athlete?.headshot?.href || null,
              score: c?.score ?? null,
            };
          };
          const h = findSide('home', 0), a = findSide('away', 1);
          const name = h.name && a.name ? `${h.name} vs ${a.name}` : (ev.name || ev.shortName || '');
          if (!name) return;
          const statusCode = ev.competitions?.[0]?.status?.type?.state
            || ev.status?.type?.state || '';
          const isLive = statusCode === 'in';
          const detailClock = ev.competitions?.[0]?.status?.type?.shortDetail || '';
          events.push({
            id: `espn:${ev.id}`,
            event: name,
            sport,
            home: h.name || null,
            away: a.name || null,
            homeCrest: h.logo,
            awayCrest: a.logo,
            kickoff: ev.date || null,
            isLive,
            status: statusCode === 'post' ? 'finished' : (isLive ? 'live' : 'scheduled'),
            score: (h.score != null && a.score != null && statusCode !== 'pre') ? `${h.score}-${a.score}` : null,
            liveDetail: isLive ? detailClock : null,
            source: 'espn',
          });
        });
      } catch (_) { /* skip league */ }
    })
  );
  return events;
}

// ══════════════════════════════════════════════════════════════
//  Aggregator — merged fixture feed with direct-source enrichment
// ══════════════════════════════════════════════════════════════

function mergeMatches(streamed, dbList, espnList) {
  const merged = [];
  const used = new Set();

  // DB first (rich: crests, scores) — primary football source
  for (const m of dbList) {
    merged.push({ ...m, streamId: null });
    used.add(m.event.toLowerCase());
  }

  // Streamed: attach embed IDs to DB matches; add extra sports
  for (const s of streamed) {
    const key = s.event.toLowerCase();
    const existing = merged.find(m =>
      (m.home && s.home && teamScore(m.home, s.home) >= 7 && teamScore(m.away, s.away) >= 7)
    );
    if (existing) {
      existing.streamId = s.id;          // enables iframe fallback servers
      existing.sport = existing.sport || s.sport;
      continue;
    }
    if (used.has(key)) continue;
    merged.push({ ...s, streamId: s.id });
    used.add(key);
  }

  // ESPN: fill gaps (US sports) + attach logos to matches missing them
  for (const e of espnList) {
    const existing = merged.find(m =>
      (m.home && e.home && teamScore(m.home, e.home) >= 8 && teamScore(m.away, e.away) >= 8)
    );
    if (existing) {
      if (!existing.homeCrest) existing.homeCrest = e.homeCrest;
      if (!existing.awayCrest) existing.awayCrest = e.awayCrest;
      if (!existing.liveDetail) existing.liveDetail = e.liveDetail;
      continue;
    }
    const key = e.event.toLowerCase();
    if (used.has(key)) continue;
    merged.push({ ...e, streamId: null });
    used.add(key);
  }

  // Live first, then upcoming
  merged.sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0));
  return merged;
}

async function buildFeed(pool) {
  const [streamed, dbList, espnList] = await Promise.all([
    fetchStreamedMatches(),
    fetchDbMatches(pool),
    fetchEspnMatches(),
  ]);

  let matches = mergeMatches(streamed, dbList, espnList);

  // ── Enrich EVERY fixture with our own direct HLS sources ──
  // Upcoming matches included: the ladder is cheap in-memory work over the
  // cached channel library, and it means a card is never a dead end.
  const now = Date.now();
  const withSources = matches.filter(m => {
    if (m.isLive) return true;
    if (!m.kickoff) return false;
    const t = new Date(m.kickoff).getTime();
    return !isNaN(t) && t > now - 3 * 60 * 60 * 1000;   // live + all upcoming
  }).slice(0, 60);

  const channels = await getIptvChannels();

  if (withSources.length && channels.length) {
    for (const m of withSources) {
      const ladder = buildSourceLadder(m, channels);
      if (ladder.length) m.directSources = ladder;
    }
  }

  // Guarantee: anything still without a native source gets generic channels,
  // so nobody is ever pushed off-site just to find a stream.
  const generic = channels.length ? genericChannelSources(channels, 8) : [];
  if (generic.length) {
    for (const m of matches) {
      if (m.isLive || m.directSources?.length) continue;
      m.directSources = generic;
      m.sourceTier = 'generic';
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    count: matches.length,
    liveCount: matches.filter(m => m.isLive).length,
    matches,
  };
}

async function getMatches(pool, opts = {}) {
  const staleOk = opts.staleOk !== false;
  try {
    const cached = await redisService.getCached(MATCHES_CACHE_KEY);
    // Full TTL window: fresh
    if (cached?.matches?.length && cached?._freshUntil && Date.now() < cached._freshUntil) {
      return cached;
    }
    // Between fresh window and stale window: serve stale, refresh in background
    if (cached?.matches?.length && staleOk && Date.now() < cached._staleUntil) {
      buildFeed(pool)
        .then(fresh => redisService.setCached(MATCHES_CACHE_KEY,
          { ...fresh, _freshUntil: Date.now() + MATCHES_TTL * 1000, _staleUntil: Date.now() + MATCHES_STALE * 1000 },
          MATCHES_STALE + 60))
        .catch(() => {});
      return cached;
    }
  } catch (_) {}

  const feed = await buildFeed(pool);
  const withMeta = {
    ...feed,
    _freshUntil: Date.now() + MATCHES_TTL * 1000,
    _staleUntil: Date.now() + MATCHES_STALE * 1000,
  };
  if (feed.matches?.length) {
    redisService.setCached(MATCHES_CACHE_KEY, withMeta, MATCHES_STALE + 60).catch(() => {});
  }
  return withMeta;
}

// On-demand direct sources for a single fixture (category browsing / ESPN matches)
function sourcesCacheKey(home, away) {
  const pair = `${normalizeTeam(home)}__${normalizeTeam(away)}`;
  return SOURCES_CACHE_PREFIX + pair.replace(/\s+/g, '_');
}


async function getMatchSources({ home, away, homeCrest, awayCrest, sport, league, event }) {
  const channels = await getIptvChannels();
  if (!home || !away) {
    return { directSources: genericChannelSources(channels, 10) };
  }
  const key = sourcesCacheKey(home, away);
  try {
    const cached = await redisService.getCached(key);
    if (cached?.directSources?.length) return cached;
  } catch (_) {}

  const ladder = buildSourceLadder({ home, away, homeCrest, awayCrest, sport, league, event }, channels);
  const directSources = ladder.length ? ladder : genericChannelSources(channels, 10);

  const result = { directSources };
  redisService.setCached(key, result, SOURCES_TTL).catch(() => {});
  return result;
}

module.exports = { getMatches, getMatchSources, _test: {
  normalizeTeam, tokenSet, teamScore, teamTokens, parseM3u: parseIptvPlaylist, dedupeChannels: null,
  fetchStreamedMatches, fetchEspnMatches, mergeMatches, buildFeed,
  getIptvChannels, getGenericSportsChannels, findIptvSources, sourcesCacheKey,
  buildSourceLadder, pickBroadcasterSources, genericChannelSources,
  extract: { IPTV_CHANNEL_FILTER, IPTV_MAX_PER_PLAYLIST, BROADCASTER_HINTS },
} };
