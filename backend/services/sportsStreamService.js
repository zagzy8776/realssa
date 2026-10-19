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
//
// MEASURED, not guessed. The union of ALL iptv-org playlists yields only 375
// sports channels — and 4 files carry 374 of them:
//     categories/sports.m3u  → 278   (contains almost every world broadcaster)
//     regions/asia.m3u       → +49   (beIN Box Office, Al Jazeera, Asharq)
//     languages/spa.m3u      → +40   (LatAm feeds)
//     languages/por.m3u      → +7
// Everything else (apac/ara/tam/hin/us/it/fr/tr/br/uk) adds ≤1 channel each
// and, because the old code fetched all 20 AT ONCE, most of them were silently
// killed by a 15s timeout. Fewer files = fewer failure modes + more channels.
//
// Note on "Korea/Japan": MEASURED — streams/kr.m3u (73 channels) and
// streams/jp.m3u (7 channels) contain ZERO sports channels, and de.m3u has no
// ARD/ZDF/Sky either. Fetching them costs a download and adds nothing, so they
// are deliberately absent. Korean/Japanese *fixtures* reach the feed through
// ESPN (see ESPN_LEAGUES); their broadcasters are paywalled and not in any
// free playlist, so those ladders honestly fall back to the broadcaster tier.
// The country files that DO carry sports channels (cn, in, au, th, id) are
// listed below.
const IPTV_PLAYLISTS = [
  ['sports', 'https://iptv-org.github.io/iptv/categories/sports.m3u'],
  ['asia', 'https://iptv-org.github.io/iptv/regions/asia.m3u'],
  ['cn', 'https://iptv-org.github.io/iptv/countries/cn.m3u'],
  ['in', 'https://iptv-org.github.io/iptv/countries/in.m3u'],
  ['au', 'https://iptv-org.github.io/iptv/countries/au.m3u'],
  ['th', 'https://iptv-org.github.io/iptv/countries/th.m3u'],
  ['id', 'https://iptv-org.github.io/iptv/countries/id.m3u'],
  ['spa', 'https://iptv-org.github.io/iptv/languages/spa.m3u'],
  ['por', 'https://iptv-org.github.io/iptv/languages/por.m3u'],
];

// Keep only likely live-sports broadcasters.
// Wider than before so Asian/MENA/LatAm sports broadcasters qualify
// (Star Sports, SSC, Alkass, Sportitalia, Max Sport, Digi Sport, Ziggo,
// DD Sports, CCTV-Golf, T Sports…).
const IPTV_CHANNEL_FILTER = /(sport|espn|fox sport|scc|supersport|bein|arena|sporttv|sport ?tv|sportitalia|star sports|willow|ten sports|gps|gtv sport|nta|elevensport|viaplay|setanta|premiere|dazn|tnt sports|sky sport|bt sport|viasport|match\b|match ?tv|union paya|supersport|kbsn|jtbc|mbc sport|sbs sport|spoticar|olympic|golf|dd sport|sony|eurosport|abema|movistar|nova sport|max sport|digi sport|prim[a-z]* ?sport|tivibu|ssc|alkass|dubai sport|abu dhabi sport|canal\+ ?sport|ziggo|fox ?sports|fox ?sport|t sports|band sports|dsports|directv sport|cctv-?5|cctv-?golf|sport ?television|sportv|j ?sports|sportklub|true ?sport|indosiar|tvri|sports18|jio ?sport|astro ?sport)/i;

// Per-playlist cap and global ceiling. Kept generous: the whole 375-channel
// space is tiny in memory, and resolution work is a cheap in-memory scan.
// MUST stay above 278 or the sports category gets truncated (it was 40!).
const IPTV_MAX_PER_PLAYLIST = 400;
const IPTV_LIBRARY_MAX = 1200;

// ── Dead-channel memory ──
// Some upstreams in the library are permanently gone (e.g. the Portuguese
// "Sport TV1/2/5" block on znty.dyndns.org, a dynamic-DNS host that now answers
// every request with a connection error). Because they are ordinary IPTV
// channels they still won the broadcaster tier for Portuguese/Swedish fixtures,
// so the FIRST source in the ladder was a guaranteed 502 and the player showed
// "connecting…" until the user manually picked source 2.
// Whenever the proxy reports an upstream failure we remember the URL, and the
// ladder builder sorts those channels last for the next ten minutes.
const DEAD_CHANNEL_TTL = 10 * 60 * 1000;
const _deadChannels = new Map();   // url → expiry ts

function markChannelDead(url) {
  if (!url) return;
  _deadChannels.set(String(url), Date.now() + DEAD_CHANNEL_TTL);
  if (_deadChannels.size > 500) {
    const now = Date.now();
    for (const [u, exp] of _deadChannels) if (exp < now) _deadChannels.delete(u);
  }
}

function isChannelDead(url) {
  const key = String(url || '');
  const exp = _deadChannels.get(key);
  if (!exp) return false;
  if (exp < Date.now()) { _deadChannels.delete(key); return false; }
  return true;
}


// ══════════════════════════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════════════════════════

function normalizeTeam(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .normalize('NFD')                       // split accents from base letters
    .replace(/[\u0300-\u036f]/g, '')        // drop the accent marks
    .replace(/[ø]/g, 'o').replace(/[đ]/g, 'd').replace(/[ł]/g, 'l')
    .replace(/[æ]/g, 'ae').replace(/[þ]/g, 'th').replace(/[ß]/g, 'ss')
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

// How *confident* are we that this source is showing THIS fixture?
//
// Being honest about this matters: an exact "Liverpool FC TV" channel is the
// real thing; "beIN Sports 1" is the right broadcaster for the league but is
// showing whatever it happens to be airing; a generic ESPN feed is simply
// live sport. The UI surfaces this so nobody is told a random channel is
// "the match" when it is not.
//   match   → sources[0] is an actual team/crest channel for this fixture
//   channel → right broadcaster for the league, but not team-specific
//   generic → any live sports channel (never a dead end)
function liveConfidence(match, sources) {
  const top = (sources || []).find(s => s?.url);
  if (!top) {
    // No sources at all — still allow an embed/iframe fallback.
    return { level: 'none', exact: false, tier: null, label: top?.label || null };
  }
  const tier = top.sourceTier || null;
  const level = tier === 'team' ? 'match' : (tier === 'broadcaster' ? 'channel' : 'generic');
  return {
    level,
    exact: level === 'match',
    tier,
    label: top.label || null,
    score: top.matchScore ?? null,
  };
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

const LIVE_WINDOW_BEFORE_MS = 15 * 60 * 1000;    // show as live 15 min before kickoff
const LIVE_WINDOW_AFTER_MS = 3 * 60 * 60 * 1000; // assume in play for up to 3h after

// `kickoff` arrives as an ISO string (DB / ESPN) OR an epoch-ms number
// (the Streamed API sends `date` as ms since epoch).
function parseKickoffTs(kickoff) {
  if (kickoff == null) return NaN;
  if (typeof kickoff === 'number') return kickoff > 1e12 ? kickoff : kickoff * 1000;
  const t = Date.parse(String(kickoff));
  return isNaN(t) ? NaN : t;
}

// Is this fixture inside its live window?
//
// CRITICAL: the upstream Streamed API DOES NOT SEND a `live`/`isLive` field at
// all — items are only { id, title, category, date, poster, popular, sources }.
// The old code did `!!(item.live || item.isLive)`, which evaluated to `false`
// for literally every Streamed fixture. That is why "● Live Now" was always
// empty and every in-play match rendered as upcoming. Honour an explicit
// upstream flag when present; otherwise derive liveness from the kickoff clock.
function isFixtureLive(kickoff, explicitFlag) {
  if (explicitFlag === true) return true;
  const t = parseKickoffTs(kickoff);
  if (isNaN(t)) return false;
  const now = Date.now();
  if (now < t - LIVE_WINDOW_BEFORE_MS) return false;
  return now - t <= LIVE_WINDOW_AFTER_MS;
}


// Broadcaster matching reads league/sport/event. Streamed only gives a coarse
// `category` ("football"), which made every Premier League game look generic.
// Infer a real competition from the club names so Sky/TNT outrank a random feed.
const LEAGUE_BY_CLUB = [
  { league: 'Premier League', clubs: ['arsenal', 'chelsea', 'liverpool', 'everton', 'newcastle', 'aston villa', 'west ham', 'brighton', 'crystal palace', 'bournemouth', 'sunderland', 'wolves', 'fulham', 'brentford', 'nottingham', 'burnley', 'leeds', 'tottenham', 'manchester'] },
  { league: 'La Liga', clubs: ['barcelona', 'real madrid', 'atletico', 'sevilla', 'valencia', 'betis', 'villarreal', 'osasuna', 'girona', 'celta', 'mallorca', 'getafe', 'alaves', 'elche', 'levante', 'espanyol'] },
  { league: 'Serie A', clubs: ['juventus', 'napoli', 'roma', 'lazio', 'fiorentina', 'atalanta', 'bologna', 'torino', 'udinese', 'lecce', 'genoa', 'cagliari', 'verona', 'como', 'parma', 'sassuolo'] },
  { league: 'Bundesliga', clubs: ['bayern', 'dortmund', 'leipzig', 'leverkusen', 'frankfurt', 'stuttgart', 'wolfsburg', 'bremen', 'freiburg', 'mainz', 'augsburg', 'hoffenheim', 'union berlin', 'monchengladbach'] },
  { league: 'Ligue 1', clubs: ['psg', 'paris saint', 'marseille', 'lyon', 'monaco', 'lille', 'rennes', 'nice', 'lens', 'nantes', 'reims', 'strasbourg', 'toulouse', 'auxerre'] },
  { league: 'Eredivisie', clubs: ['ajax', 'psv', 'feyenoord', 'az alkmaar', 'twente', 'utrecht', 'zwolle', 'heerenveen', 'cambuur', 'go ahead', 'nec', 'sparta rotterdam', 'willem ii', 'groningen'] },
  { league: 'Allsvenskan', clubs: ['sirius', 'elfsborg', 'mjallby', 'vasteras', 'hammarby', 'malmo', 'aik', 'djurgarden', 'goteborg', 'halmstad', 'degerfors', 'brommapojkarna', 'mjallby aik', 'norrkoping', 'varberg', 'sundsvall'] },
  { league: 'Ekstraklasa', clubs: ['legia', 'lech', 'wisla', 'cracovia', 'jagiellonia', 'rakow', 'pogon'] },
  { league: 'Super Lig', clubs: ['galatasaray', 'fenerbahce', 'besiktas', 'trabzonspor', 'basaksehir'] },
  { league: 'Primeira Liga', clubs: ['benfica', 'porto', 'sporting lisbon', 'braga', 'vitoria', 'boavista'] },
  { league: 'Champions League', clubs: ['champions league'] },
];

// A league name that can only belong to football (association football).
// Used to strip a football league that a feed wrongly attached to another sport.
const FOOTBALL_LEAGUE_RE = /premier league|la liga|serie a|bundesliga|ligue 1|eredivisie|allsvenskan|ekstraklasa|super ?lig|primeira liga|champions league|europa league|conference league|copa|afc champions|j1 league|chinese super league|indian super league|thai league|liga 1|super league/i;

// "American Football" and "Football" both contain the word football, so a plain
// `/football/` test is not enough — check the codes/names that name another
// sport FIRST and treat "association football"/"soccer"/bare "football" as the
// only soccer values.
// This is what stops "Indianapolis Colts vs Tennessee Titans" from being
// labelled Serie A (the club list contains "napoli", a substring of
// "Indianapolis") and then routed to DAZN Darts.
function isNonFootballSport(sport) {
  const s = String(sport || '');
  if (!s) return false;
  if (/\b(nfl|nba|mlb|nhl|ufc|ncaa|atp|wta|f1)\b/i.test(s)) return true;
  if (/american ?football|basketball|baseball|ice ?hockey|hockey|tennis|golf|cricket|rugby|darts|snooker|boxing|\bmma\b|motorsport|motor-?sports|formula|racing|cycling|volleyball|handball|netball|badminton/i.test(s)) return true;
  return false;
}

// Whole-word match on the folded haystack. Plain `includes()` matched inside
// other words ("napoli" ⊂ "indianapolis", "nice" ⊂ "venice", "roma" ⊂ "romania"),
// and React/ESPN feed us full legal names, so both sides are word-bounded.
function containsWord(hay, needle) {
  const n = String(needle || '').trim();
  if (!n) return false;
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|\\s)${esc}($|\\s)`).test(hay);
}

function inferLeagueFromTeams(home, away, sport) {
  if (sport && isNonFootballSport(sport)) return '';
  // Fold accents too: "Mjällby" must match the 'mjallby' club list.
  const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const hay = fold(`${home || ''} ${away || ''}`);
  if (!hay.trim()) return '';
  for (const { league, clubs } of LEAGUE_BY_CLUB) {
    if (clubs.some(c => containsWord(hay, fold(c)))) return league;
  }
  return '';
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
//
// The display name is the text AFTER THE LAST comma of the #EXTINF line.
// Splitting on the first comma is wrong because several playlists embed a
// User-Agent/Referrer attribute that itself contains commas, e.g.
//   #EXTINF:-1 tvg-id="x" http-user-agent="Mozilla/5.0 (Windows NT 10.0;
//   Win64; x64) ... Chrome/149.0.0.0 Safari/537.36" group-title="Sports",Arena Sport 1
// Using the first comma produced a 90-char garbage "name" starting with
// ` like Gecko)...`, which then failed the sports filter — that is why the
// sports category parsed 109 of 277 and uk/kr/jp/za returned literally zero.
function parseExtinfName(line) {
  const idx = line.lastIndexOf(',');
  if (idx === -1) return '';
  return line.slice(idx + 1).trim();
}

// Playlists are large (up to ~3.3k entries). Fetching 16 of them at once
// starved a 15s timeout so MOST were silently dropped — the library ended up
// at 87 channels and the majors (Sky, Star Sports, SuperSport) were missing.
// Longer timeout + a concurrency gate fixes it.
const IPTV_FETCH_TIMEOUT = 45000;
const IPTV_FETCH_CONCURRENCY = 6;
const IPTV_MAX_BYTES = 12 * 1024 * 1024; // bail out on runaway files

async function parseIptvPlaylist(playlistUrl) {
  try {
    const resp = await axios.get(playlistUrl, {
      timeout: IPTV_FETCH_TIMEOUT,
      responseType: 'text',
      maxRedirects: 5,
      maxContentLength: IPTV_MAX_BYTES,
      transformResponse: [(d) => d],
      headers: { 'Accept-Encoding': 'identity', 'User-Agent': BROWSER_HEADERS['User-Agent'] },
    });
    const text = typeof resp.data === 'string' ? resp.data : String(resp.data);
    if (!text.includes('#EXTINF')) return [];
    const lines = text.split(/\r?\n/);
    const channels = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith('#EXTINF')) continue;
      // Find the first non-comment, non-blank line after the #EXTINF.
      let url = '';
      for (let j = i + 1; j < lines.length; j++) {
        const cand = (lines[j] || '').trim();
        if (!cand || cand.startsWith('#')) continue;
        url = cand;
        break;
      }
      if (!/^https?:\/\//i.test(url) || !url.includes('.m3u8')) continue;
      const name = parseExtinfName(line);
      if (!name) continue;
      if (IPTV_CHANNEL_FILTER.test(name)) {
        const logo = (line.match(/tvg-logo="([^"]*)"/) || [])[1] || '';
        const group = (line.match(/group-title="([^"]*)"/) || [])[1] || '';
        const clean = name.replace(/\s+/g, ' ').slice(0, 80);
        channels.push({ name: clean, url, logo, group });
      }
    }
    return channels;
  } catch (err) {
    console.warn(`[sportsStreams] IPTV playlist failed ${playlistUrl}: ${err.message}`);
    return [];
  }
}

// Run the playlist fetches in small batches so the network is not saturated.
async function fetchAllPlaylists() {
  const out = [];
  for (let i = 0; i < IPTV_PLAYLISTS.length; i += IPTV_FETCH_CONCURRENCY) {
    const batch = IPTV_PLAYLISTS.slice(i, i + IPTV_FETCH_CONCURRENCY);
    const settled = await Promise.allSettled(batch.map(([, url]) => parseIptvPlaylist(url)));
    settled.forEach((r, k) => {
      const tag = batch[k][0];
      const val = r.status === 'fulfilled' ? r.value : [];
      out.push({ tag, channels: val });
      if (r.status === 'rejected') console.warn(`[sportsStreams] ${tag} rejected: ${r.reason?.message}`);
    });
  }
  return out;
}

// Fetch + cache the IPTV channel library (our own direct-HLS catalogue).
//
// ROUND-ROBIN, not playlist-by-playlist: the old code drained playlist #1 to
// its cap before touching playlist #2, so the 481-entry sports category filled
// the whole library with Europe/MENA channels and the Asia/language playlists
// contributed nothing. Interleaving guarantees every region is represented.
// In-process memo so repeated calls inside one request / one test run do not
// re-download 4 playlists each time (Redis is the cross-process layer; this is
// the intra-process one, and it is what stops buildFeed + getGenericSports-
// Channels + getMatchSources from each triggering a full refetch).
let _iptvMemo = null;
let _iptvMemoAt = 0;
const IPTV_MEMO_TTL = 5 * 60 * 1000;

async function getIptvChannels() {
  if (_iptvMemo && Date.now() - _iptvMemoAt < IPTV_MEMO_TTL) return _iptvMemo;
  try {
    const cached = await redisService.getCached(IPTV_CACHE_KEY);
    if (Array.isArray(cached) && cached.length) { _iptvMemo = cached; _iptvMemoAt = Date.now(); return cached; }
  } catch (_) {}

  const perPlaylist = await fetchAllPlaylists();
  const seenUrls = new Set();
  const channels = [];
  const taken = perPlaylist.map(() => 0);

  // Priority-weighted fill. Pure round-robin starved the big list: the sports
  // category has 278 channels while por has 8, yet each got ONE slot per round
  // — so sports surrendered 3 of every 4 slots and the library fell to 197
  // with only 67 from the richest playlist. Here each playlist is drained by
  // its own priority, but we reserve room so later playlists still contribute.
  const order = [...perPlaylist.keys()];
  for (const p of order) {
    const list = perPlaylist[p].channels;
    for (const ch of list) {
      if (taken[p] >= IPTV_MAX_PER_PLAYLIST) break;
      if (channels.length >= IPTV_LIBRARY_MAX) break;
      if (!ch?.url || seenUrls.has(ch.url)) continue;
      seenUrls.add(ch.url);
      channels.push(ch);
      taken[p]++;
    }
    if (channels.length >= IPTV_LIBRARY_MAX) break;
  }

  if (channels.length) {
    _iptvMemo = channels;
    _iptvMemoAt = Date.now();
    redisService.setCached(IPTV_CACHE_KEY, channels, IPTV_TTL).catch(() => {});
    const perTag = perPlaylist
      .map((p, i) => `${p.tag}:${taken[i]}`)
      .filter(s => !s.endsWith(':0'))
      .join(' ');
    console.log(`[sportsStreams] IPTV library refreshed: ${channels.length} channels (${perTag})`);
    const dead = perPlaylist.filter(p => !p.channels.length).map(p => p.tag);
    if (dead.length) console.warn(`[sportsStreams] playlists with 0 channels: ${dead.join(', ')}`);
  }
  return channels;
}

// Find direct HLS sources for a fixture using the IPTV library
// A channel only counts as a direct team feed if it actually looks like a
// sports channel. Without this, a team token matched ANY channel: "Racing de
// Santander" happily matched "CNC Santander de Quilichao" — a Colombian RADIO
// station — and topped the ladder over beIN.
const IPTV_LOOKS_LIKE_SPORT = /(sport|tv|hd|deportes|futbol|football|calcio|gol|arena|plus|channel|network|\d)/i;

// Club-name boilerplate that identifies nothing on its own. A channel called
// "ESPN 2 (United States)" must not be read as "NorthEast United"'s own feed.
// Deliberately SHORT: real channel names are built from the distinctive part
// ("Leeds United" → "Leeds TV"), so only legal-form / geographic filler is here.
// Nicknames (United, City, Jets...) stay matchable because plenty of channels
// are named exactly that ("Jets TV").
// Legal-form filler plus nicknames that are ALSO country/region words — an
// "ESPN (United States)" channel must not read as "NorthEast United"'s feed.
// Distinctive club nouns (Leeds, Liverpool, Northeast, Newcastle) stay valid.
const GENERIC_CLUB_TOKEN = new Set([
  'club', 'national', 'olympique', 'atletico', 'deportivo', 'sports', 'sport',
  'academy', 'reserves', 'first', 'team', 'women', 'ladies', 'u21', 'u23',
  'united', 'city', 'states', 'kingdom', 'emirates', 'republic', 'west', 'east',
]);

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
    // 2) Team (or alias) token inside channel name (e.g. "PSG TV", "Liverpool FC TV").
    // Score by how much of the team name the channel actually contains, so a
    // channel named after the FULL club ("Racing Santander TV") beats one that
    // merely shares a token ("CNC Santander de Quilichao" — a radio station).
    if (score < 12 && IPTV_LOOKS_LIKE_SPORT.test(ch.name)) {
      const cover = (name) => {
        const norm = normalizeTeam(name);
        if (!norm) return 0;
        // Whole club name present in the channel name → strongest team signal.
        // "psg" is only 3 chars but is an exact club alias, so short names are
        // matched whole-word instead of by substring.
        if (cn.includes(norm) && (norm.length >= 6 || cn.split(/[^a-z0-9]+/).includes(norm))) return 9;
        const tokens = [...teamTokens(name)].filter(t => t.length >= 4);
        // `teamTokens` also emits the squashed form ("northeastunited"); it can
        // never appear in a channel name, so it must not count as evidence.
        const joined = norm.replace(/\s+/g, '');
        const words = tokens.filter(t => t !== joined);
        // Generic suffixes are not identifying. "NorthEast United FC" reduced to
        // the token "united" matched "ESPN 2 (United States)" (and "ESPN United
        // States"), which then masqueraded as an exact team channel and took
        // tier 1 of the ladder. Such a channel may only count when a MORE
        // specific partner token is present too, or when the whole club name is.
        const DISTINCTIVE = words.filter(t => !GENERIC_CLUB_TOKEN.has(t));
        if (!words.length) return 0;
        const hits = words.filter(t => cn.includes(t));
        if (!hits.length) return 0;
        // Two words from the club name (or the whole name, above) → confident.
        if (hits.length >= 2) return 8;
        // One word only. It must be distinctive — "united"/"city" alone is not a
        // club, it is far more likely a country label or a competitor's brand
        // ("ESPN 2 (United States)", "Sky Sports (United Kingdom)").
        const hit = hits[0];
        return DISTINCTIVE.includes(hit) ? 7 : 0;
      };
      score = Math.max(score, cover(home), cover(away));
    }
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
    .map(s => ({ ...s, sourceTier: 'broadcaster', wrongDiscipline: s.wrongDiscipline === true })));
  // ── tier 3: generic sports channels — never a dead end ──
  push(genericChannelSources(channels || [])
    .map(s => ({ ...s, sourceTier: 'generic' })));
  // Channels the proxy has just failed on go to the end, so the player opens a
  // source that is likely to play instead of burning its first attempt on a
  // known-dead host. Stable: ties keep their tier order.
  // Same idea for wrong-discipline sources: a DAZN Combat channel that won the
  // broadcaster tier must sit behind EVERY generic sports channel, otherwise a
  // J-League card opens a combat feed. buildSourceLadder pushes tier-by-tier,
  // so this has to be sorted here, not inside pickBroadcasterSources.
  const bad = (s) => isChannelDead(s.url) || s.wrongDiscipline;
  const liveFirst = out.filter(s => !bad(s));
  const deadLast = out.filter(bad).map(s => ({ ...s, dead: isChannelDead(s.url) || s.dead }));
  return [...liveFirst, ...deadLast].slice(0, 14);
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

// Broadcaster hints are matched against league/sport/event. A hint may also
// carry `exclude` — a channel that matches the brand but is the WRONG sport.
// Real case: "Sky Sports F1" and "Sky Sports NFL" are in the library and both
// contain "sky sport", so they topped every Premier League ladder even though
// neither shows football.
const BROADCASTER_HINTS = [
  // Football — by league
  { test: /premier league|efl|championship|fa cup|carabao/i, names: ['sky sport', 'tnt sport', 'supersport', 'premier sports', 'beIN'], exclude: /sky sports? (f1|nfl|racing|golf|cricket)/i },
  { test: /la liga|laliga|copa del rey/i,                     names: ['laliga', 'la liga', 'beIN', 'movistar', 'espn'] },
  { test: /serie a|coppa italia/i,                            names: ['serie a', 'dazn', 'sky sport', 'bein'], exclude: /sky sports? (f1|nfl|racing|golf|cricket)/i },
  { test: /bundesliga|dfb/i,                                  names: ['bundesliga', 'sky sport', 'dazn', 'sport'], exclude: /sky sports? (f1|nfl|racing|golf|cricket)/i },
  { test: /ligue 1|french/i,                                  names: ['ligue 1', 'beIN', 'dazn'] },
  { test: /champions league|europa league|uefa|conference league/i, names: ['tnt sport', 'cbs sport', 'beIN', 'supersport', 'sky sport'], exclude: /sky sports? (f1|nfl|racing|golf|cricket)/i },
  { test: /afcon|africa|nigeria|npfl/i,                       names: ['supersport', 'super sport', 'nff', 'nta', 'sport tv', 'gtv sport'] },
  { test: /\bmls\b|usa\.1/i,                                  names: ['espn', 'fox sport', 'mls'] },
  { test: /eredivisie|belgian|portugal|primeira|scottish|super ?lig/i, names: ['espn', 'sky sport', 'sport tv'] },
  { test: /eredivisie/i,                                 names: ['espn', 'ziggo', 'sport tv'] },
  // ── Asia / Oceania ──
  // Without these, J-League / CSL / ISL fixtures fell through to the generic
  // fallback list and were handed European feeds (Sky/ESPN US) instead of the
  // regional Asian broadcasters the IPTV library actually carries.
  { test: /j1 league|j-?league|japanese/i,                    names: ['j sports', 'abema', 'nhk', 'fuji tv', 'wowow', 'sky sport', 'dazn'], exclude: /sky sports? (f1|nfl|racing|golf|cricket)/i },
  { test: /chinese super league|\bcsl\b|chinese/i,            names: ['cctv-?5', 'cctv-?5\\+', 'migu', 'star sports', 'iqiyi', 'sport'] },
  { test: /indian super league|\bisl\b|indian/i,              names: ['star sports', 'sports18', 'sony', 'dd sport', 'jio', 'ten sports'] },
  { test: /thai league|thai/i,                                names: ['true sport', 'bugaboo', 'thairath', 't sport', 'sport'] },
  { test: /liga 1 indonesia|liga 1|indonesian/i,              names: ['indosiar', 'tvri sport', 'tvri', 'sport'] },
  { test: /malaysia super|malaysian/i,                        names: ['astro', 'rtm', 'sport'] },
  { test: /singapore premier/i,                               names: ['singtel', 'starhub', 'sport'] },
  { test: /a-?league|australian/i,                            names: ['fox sport', 'paramount', 'optus', 'ten sport', 'sbs', 'beIN'] },
  { test: /afc champions|afc|asian/i,                         names: ['star sports', 'beIN', 'sport', 'sony'] },
  { test: /allsvenskan|swedish|norwegian|eliteserien|danish|superligaen/i, names: ['viaplay', 'tv2 sport', 'sport tv', 'eurosport'] },
  { test: /ekstraklasa|polish/i,                         names: ['canal+ sport', 'polsat sport', 'eurosport'] },
  { test: /super ?lig|turkish/i,                         names: ['s sport', 'tivibu', 'beIN'] },
  { test: /primeira liga|portuguese|liga portugal/i,     names: ['sport tv', 'sporttv', 'benfica'] },
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
// Anchored brands only: an unanchored /sport/ pattern let "ACI Sport TV" (an
// Italian sports channel with no relation to any Asian league) top the generic
// tier for every J-League / CSL / ISL fixture. Each alternative now has to BE
// the brand, not merely contain the word "sport" somewhere.
const GENERIC_SPORTS_CHANNEL_RE = /^(supersport|sky ?sport|espn|fox ?sport|bein|star ?sport|arena ?sport|sport ?tv|sportv|tnt ?sport|premier ?sport|setanta|eleven ?sport|viaplay|viasport|nta ?sport|gtv ?sport|ssc|dazn|eurosport|match ?!|sport ?1|movistar|cctv-?5|sony (sports|ten)|sports18|dd ?sport|j ?sport|true ?sport|indosiar|tvri ?sport|sportklub|dsport|sport ?television)/i;

// Rank our IPTV channels by broadcaster affinity for this fixture.
// Returns sources tagged matchScore 3-6 (below an exact team match of 9/12).
//
// ORDERING INVARIANT: the hint list order is authoritative — hint #1 must
// always beat hint #2. The old code added a `hint.length >= 6` bonus, which
// silently inverted that: for Serie A, 'dazn' (4th in the list, 4 chars) got
// +1 and leapfrogged 'bein', so a DAZN darts channel topped every Serie A
// ladder. Position is now the dominant term and name length only breaks ties.
function pickBroadcasterSources(match, channels) {
  const hay = `${match.league || ''} ${match.sport || ''} ${match.event || ''}`;
  // Is this fixture itself Asian/Oceania? If so, a channel marked "Asia" or
  // "India" is the RIGHT regional feed, not a second-rate variant, so the
  // regional demotion below must not apply to it.
  const fixtureRegion = /j-?league|j1 league|japanese|chinese|csl|\bisl\b|indian|thai|indonesia|malaysia|singapore|a-?league|australia|afc|asian|\bkor|korea/i.test(
    `${match.league || ''} ${match.sport || ''} ${match.country || ''}`) ? 'asia' : 'eu';
  const hints = [];
  for (const h of BROADCASTER_HINTS) {
    if (!h.test.test(hay)) continue;
    for (const n of h.names) {
      hints.push({ name: n.toLowerCase(), exclude: h.exclude ? new RegExp(h.exclude.source, 'i') : null });
    }
  }
  if (!hints.length) hints.push({ name: 'espn' }, { name: 'sky sport' }, { name: 'supersport' }, { name: 'bein' }, { name: 'tnt sport' });

  // Wrong-sport brands: a channel name that declares a DIFFERENT discipline must
  // never top a fixture of another one. "DAZN Combat" and "DAZN Darts x Pluto
  // TV" both contain "dazn", so they outranked beIN/Movistar for Bundesliga AND
  // Serie A AND the J-League — the player then opened a combat-sports loop for
  // a football match. Only the per-league `exclude` used to do this, and it
  // only ever covered Sky Sports.
  const fixtureSport = `${match.sport || ''} ${match.league || ''} ${match.event || ''}`;
  // Multi-brand hints ("sony", "sport") sweep in entertainment / regional
  // channels ("Sony Max", "TVRI Central Java"). Those are only admitted when
  // the FAMILY brand is present — "Sony Sports Ten 1" and "TVRI Sport" pass,
  // "Sony Entertainment Television" and "TVRI Bali" do not.
  const FAMILY_OK = {
    sony: /sony .*sport|sports(18| ?ten)/i,
    // A bare "sport" hint is the last resort for leagues with no known
    // broadcaster. Without a brand anchor it swept in "ACI Sport TV" (an
    // Italian sports channel) for every CSL / J-League fixture, so restrict it
    // to names that actually lead with a sports brand.
    sport: /^(sports?\d?|eurosport|sky sport|fox sport|bein|star sport|arena sport|sport ?tv|sportv|dsport|match|sportklub)/i,
    sports: /^(sports?\d?|eurosport|sky sport|fox sport|bein|star sport|arena sport|sport ?tv|sportv|dsport|match|sportklub)/i,
    // TVRI is a public broadcaster with ~40 regional channels ("TVRI Bali",
    // "TVRI Central Java"); only its sports channel belongs in a sports ladder.
    tvri: /tvri sport/i,
  };
  // Brand hints that are only a PREFIX of a family: "sky sport" must not match
  // "Sky Sports F1"/"Sky Sports NFL" for a football fixture. Combined with the
  // per-hint `exclude` below, those are dropped entirely rather than ranked.
  const SKY_WRONG_SPORT = /sky sports? (f1|nfl|racing|golf|cricket)/i;

  const scored = [];
  for (let hi = 0; hi < hints.length; hi++) {
    const hint = hints[hi].name;
    const exclude = hints[hi].exclude;
    // Hint names are plain substrings, EXCEPT patterns that visibly carry regex
    // intent ("cctv-?5\\+", "cctv-?5") — those are compiled so they match the
    // real channel names ("CCTV-5+") instead of failing as literals.
    const hintRe = /[\\()?+*|[\]]|\\$/.test(hint) ? new RegExp(hint, 'i') : null;
    // Strictly decreasing by hint position — the single source of truth.
    const base = Math.max(3, 6 - Math.floor(hi / 2));
    for (const ch of channels) {
      const name = ch.name.toLowerCase();
      const hit = hintRe ? hintRe.test(name) : name.includes(hint);
      if (!hit) continue;
      // Family filter for broad brands: reject "Sony Max", "TVRI Bali", etc.
      const family = FAMILY_OK[hint];
      if (family && !family.test(ch.name)) continue;
      // Sky Sports F1/NFL are a different discipline than "sky sport" implies
      // for football. When the league declares an exclude, honour it here so
      // they never occupy ladder slots at all.
      if (exclude && exclude.test(ch.name) && SKY_WRONG_SPORT.test(ch.name)) continue;
      // Prefer channels whose *leading* word is the broadcaster (e.g. "beIN Sports 1"
      // over "Adjarasport 1" which merely contains it) — avoids junk ranked at tier 6.
      const starts = hintRe ? (hintRe.test(ch.name.trimStart()) ? 1 : 0) : (name.trimStart().startsWith(hint) ? 1 : 0);
      // A regional variant ("ESPN 2 Latin America", "beIN Sports 1 Turk") is a
      // worse fit for a European fixture than the plain brand, and there are
      // dozens of them — they used to fill the whole ladder. Demote them, but
      // ONLY when the tag is for a different region than the fixture: for a
      // J-League or ISL game, "Asia"/"India" is the correct feed.
      const regionTag = / (latin america|latam|brasil|brazil|mexico|mexic|argentina|chile|colombia|peru|caribbean|sur|andina|deportes|en espanol|europa|asia|africa|turkey|turk|arabia|arabic|india|hindi|tamil|telugu|netherlands|nederland)\b/i.exec(ch.name);
      const ASIAN_TAG = /asia|india|hindi|tamil|telugu|arabia|arabic|turkey|turk|indonesia|thai/i;
      const regional = regionTag && !(fixtureRegion === 'asia' && ASIAN_TAG.test(regionTag[0])) ? 1 : 0;
      // Wrong-sport brand (Sky Sports F1 for a football match) drops a full rung
      // AND a bit more, so any correct-sport alternative at the next hint
      // position outranks it. Without the extra it merely tied with the next
      // rung and the wrong-sport channel still surfaced first.
      const wrongSport = exclude && exclude.test(ch.name) ? 1 : 0;
      // Declared-discipline mismatch is a hard penalty: a football fixture must
      // not open "DAZN Combat" just because "DAZN" is its league's broadcaster.
      const wrongDiscipline =
        (/ (f1|nfl|nba|mlb|nhl)\b/i.test(ch.name) && !/\b(f1|nfl|nba|mlb|nhl)\b/i.test(fixtureSport)) ||
        (/combat|\bdarts\b|snooker|boxing|\bmma\b|\bufc\b|wrestling/i.test(ch.name) && !/combat|darts|snooker|boxing|\bmma\b|\bufc\b|wrestling/i.test(fixtureSport)) ||
        (/netball|badminton|table tennis/i.test(ch.name) && !/netball|badminton|table tennis/i.test(fixtureSport)) ||
        (/\btennis\b|\bgolf\b/i.test(ch.name) && !/\btennis\b|\bgolf\b/i.test(fixtureSport)) ||
        // "DAZN Heldinnen" is DAZN's German WOMEN'S FOOTBALL channel — it is a
        // football channel, but not THE match. Keep it off the top rung.
        (/heldinnen|frauen|damen|women/i.test(ch.name) && !/women|frauen|damen/i.test(fixtureSport));
      // Short generic broadcasters ("AZ", "SSC") should not beat a specific
      // multi-word brand; only used as a last tie-break within a hint.
      const specific = hint.length >= 6 ? 1 : 0;
      scored.push({ ch, score: base + starts - regional * 0.5 - wrongSport * 2.5 - (wrongDiscipline ? 4 : 0), starts, specific, regional, wrongSport, wrongDiscipline, hi });
    }
  }
  // Discipline correctness outranks everything: a combat channel with a great
  // broadcaster score must never precede a plain sports channel for a football
  // fixture. Only then does raw score / hint position decide.
  scored.sort((a, b) =>
    a.wrongDiscipline - b.wrongDiscipline ||
    b.score - a.score || a.hi - b.hi || a.wrongSport - b.wrongSport ||
    a.regional - b.regional || b.specific - a.specific || b.starts - a.starts);

  const out = [];
  const seen = new Set();
  // Prefer wrong-discipline channels last: only fall back to them when the
  // ladder would otherwise be empty (better a combat feed than nothing).
  const usable = scored.filter(s => !s.wrongDiscipline);
  const fallback = scored.filter(s => s.wrongDiscipline);
  for (const s of [...usable, ...fallback]) {
    if (seen.has(s.ch.url)) continue;
    seen.add(s.ch.url);
    out.push({ url: s.ch.url, quality: 'Auto', label: s.ch.name, matchScore: s.score, wrongDiscipline: s.wrongDiscipline });
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
            // Prefer the structured `teams` field when the mirror sends one;
            // fall back to parsing the title.
            const parsed = parseTeams(title);
            const home = (item.teams?.home?.name || parsed.home) || null;
            const away = (item.teams?.away?.name || parsed.away) || null;
            const kickoff = item.date || item.time || null;
            // Upstream has no `live` flag — derive from the clock.
            const isLive = isFixtureLive(kickoff, item.live ?? item.isLive);
            // /api/matches/all also lists YESTERDAY's games with no `finished`
            // flag — without the clock check they re-entered the feed as
            // "scheduled" and showed under Upcoming after the final whistle.
            const kickoffTs = parseKickoffTs(kickoff);
            const wellPast = !isNaN(kickoffTs) && Date.now() - kickoffTs > LIVE_WINDOW_AFTER_MS;
            const status = isLive ? 'live' : (item.finished || wellPast ? 'finished' : 'scheduled');
            return {
              id: String(item.id || ''),
              event: title,
              sport,
              league: item.category ? String(item.category) : '',
              home,
              away,
              kickoff,
              isLive,
              status,
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
      // The scraper can lag, leaving a genuinely in-play game as 'scheduled'.
      // Trust `live`, but also derive liveness from the kickoff clock — ONLY
      // for still-scheduled games. The clock check must NOT override an
      // explicit 'finished': a final whistle 30 min ago was being resurrected
      // as LIVE (kickoff inside the 3h window) and shown with a Watch button.
      isLive: m.status === 'live' || (m.status === 'scheduled' && isFixtureLive(m.kickoff_at, false)),
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
//
// `league` is REQUIRED, not cosmetic: mergeMatches only infers a competition
// when this field is missing/generic, and inferLeagueFromTeams() does not know
// any Asian club — so without it every J-League / CSL / ISL fixture fell through
// to league '' and its broadcaster ladder collapsed to generic ESPN channels.
//
// The Asian block is the answer to "why do I never see Korean or Japanese
// games": ESPN does publish them (verified live), we simply never asked for
// them. K-League (kor.1) is genuinely absent from ESPN — the only Asia feed
// that carries it is not reachable from here — so Korean *club* football is
// limited to what the Streamed mirrors list.
const ESPN_LEAGUES = [
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard', sport: 'Premier League Football', league: 'Premier League' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard', sport: 'Champions League', league: 'Champions League' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard', sport: 'La Liga Football', league: 'La Liga' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard', sport: 'Serie A Football', league: 'Serie A' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard', sport: 'Bundesliga Football', league: 'Bundesliga' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard', sport: 'MLS Football', league: 'MLS' },
  // ── Asia / Oceania ──
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/jpn.1/scoreboard', sport: 'J-League Football', league: 'J1 League', country: 'Japan' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/chn.1/scoreboard', sport: 'Chinese Super League Football', league: 'Chinese Super League', country: 'China' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ind.1/scoreboard', sport: 'Indian Super League Football', league: 'Indian Super League', country: 'India' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/tha.1/scoreboard', sport: 'Thai League Football', league: 'Thai League 1', country: 'Thailand' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/idn.1/scoreboard', sport: 'Liga 1 Football', league: 'Liga 1 Indonesia', country: 'Indonesia' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/mys.1/scoreboard', sport: 'Super League Football', league: 'Malaysia Super League', country: 'Malaysia' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/sgp.1/scoreboard', sport: 'Premier League Football', league: 'Singapore Premier League', country: 'Singapore' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/aus.1/scoreboard', sport: 'A-League Football', league: 'A-League', country: 'Australia' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/afc.champions/scoreboard', sport: 'AFC Champions League', league: 'AFC Champions League', country: 'Asia' },
  // ── US / global ──
  { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', sport: 'NBA Basketball' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', sport: 'NFL American Football' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard', sport: 'MLB Baseball' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard', sport: 'Formula 1' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/scoreboard', sport: 'Tennis' },
];

async function fetchEspnMatches() {
  const events = [];
  await Promise.allSettled(
    ESPN_LEAGUES.map(async ({ url, sport, league, country }) => {
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
            // Fixture-site style metadata: the stadium/arena this game is
            // played at (ESPN competitions carry `venue.fullName`), shown on
            // cards and in the player's "kicks off at …" banner.
            venue: ev.competitions?.[0]?.venue?.fullName || null,
            sport,
            league: league || ev.competitions?.[0]?.league?.name || '',
            country: country || ev.competitions?.[0]?.league?.abbreviation || '',
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
      if (!existing.venue) existing.venue = e.venue;
      continue;
    }
    const key = e.event.toLowerCase();
    if (used.has(key)) continue;
    merged.push({ ...e, streamId: null });
    used.add(key);
  }

  // Broadcaster matching reads league/sport/event. Streamed only supplies a
  // coarse `category` ("football"/"darts"), so a real competition has to be
  // inferred from the club names or Sky/TNT/beIN never rank.
  const GENERIC_CATEGORIES = /^(football|soccer|basketball|basket|american ?football|baseball|ice ?hockey|hockey|tennis|golf|cricket|rugby|darts|snooker|boxing|mma|ufc|motorsport|motor-?sports|racing|f1|formula ?1|cycling|volleyball|handball|other|sports?)$/i;
  for (const m of merged) {
    // Sport first: a non-football fixture must not inherit a football league.
    if (!m.sport) m.sport = inferSportFromTitle(m.event, m.league);
    const leagueStr = String(m.league || '').trim();
    // PRECEDENCE: an upstream competition name always wins. "AS Roma vs Slovan
    // Bratislava" is a Champions League tie and ESPN says so; the club list
    // guessing "Serie A" from "roma" is strictly worse information.
    // EXCEPTION: a football league on a non-football fixture is always wrong,
    // whichever feed supplied it — an NFL game tagged "Serie A" must be dropped
    // or its broadcaster ladder opens a European football channel.
    const footballLeagueOnOtherSport = leagueStr
      && isNonFootballSport(m.sport)
      && FOOTBALL_LEAGUE_RE.test(leagueStr);
    if (!leagueStr || footballLeagueOnOtherSport) {
      m.league = footballLeagueOnOtherSport ? '' : (inferLeagueFromTeams(m.home, m.away, m.sport) || '');
    } else if (GENERIC_CATEGORIES.test(leagueStr)) {
      // Only a coarse category ("football") may be upgraded.
      const guess = inferLeagueFromTeams(m.home, m.away, m.sport);
      m.league = guess || '';
    }
    if (m.isLive && !m.status) m.status = 'live';
  }

  // Live first, then upcoming, then finished (newest final whistle first)
  const rank = m => (m.isLive ? 0 : m.status === 'finished' ? 2 : 1);
  merged.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r) return r;
    const ta = new Date(a.kickoff || 0).getTime() || 0;
    const tb = new Date(b.kickoff || 0).getTime() || 0;
    return rank(a) === 2 ? tb - ta : ta - tb;
  });
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
    // Finished games must NOT walk the live ladder — a "stream" for a match
    // that ended 2h ago is a dead channel and a broken promise. They get the
    // Highlights feature instead.
    if (m.status === 'finished') return false;
    if (!m.kickoff) return false;
    const t = new Date(m.kickoff).getTime();
    return !isNaN(t) && t > now - 3 * 60 * 60 * 1000;   // live + all upcoming
  }).slice(0, 60);

  const channels = await getIptvChannels();

  if (withSources.length && channels.length) {
    for (const m of withSources) {
      const ladder = buildSourceLadder(m, channels);
      if (ladder.length) {
        m.directSources = ladder;
        m.liveConfidence = liveConfidence(m, ladder);
      }
      // Exact per-match embed (Streamed). An IPTV ladder entry is CHANNEL
      // level — even a perfect Sky hit airs whatever Sky chose today. The
      // per-match embed is the ONE source guaranteed to be this fixture, so
      // the player surfaces it as the "★ Exact Match" tab.
      if (m.streamId) m.exactEmbedUrl = `https://streamed.st/embed/${m.streamId}`;
    }
  }

  // Guarantee: anything still without a native source gets generic channels,
  // so nobody is ever pushed off-site just to find a stream.
  const generic = channels.length
    ? genericChannelSources(channels, 8).map(s => ({ ...s, sourceTier: 'generic' }))
    : [];
  if (generic.length) {
    for (const m of matches) {
      // Finished games never get the generic live-channel ladder — that is
      // what made finished cards claim "● Direct stream available".
      if (m.isLive || m.directSources?.length || m.status === 'finished') continue;
      m.directSources = generic;
      m.sourceTier = 'generic';
      m.liveConfidence = { level: 'generic', exact: false, tier: 'generic', label: generic[0]?.label || null, score: null };
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


// ── Liveness probe ───────────────────────────────────────────────────────────
//
// Why this exists: the ladder is a guess. Roughly a third of the community IPTV
// hosts in it are dead at any given moment (measured: primetv.cc.cd and the
// AMGI/Premier Sports host both fail DNS right now while Arena Sport and the
// Turkish beIN mirrors answer in ~450ms). The player used to discover this the
// slow way -- a watchdog per source -- so a user watched "Connecting…" churn
// through the whole list before reaching the iframe servers.
//
// Checking the manifest server-side costs ~450ms per source in PARALLEL and
// lets us hand the player only streams that are verifiably up, which is what
// the iframe-based competitors effectively do.
const PROBE_TIMEOUT_MS = 5000;
const PROBE_MAX_SOURCES = 12;

async function probeSource(source) {
  const url = source?.url;
  if (!url || !/^https?:\/\//i.test(url)) return { source, ok: false, ms: 0 };
  const t0 = Date.now();
  try {
    // GET, not HEAD: a number of these CDNs answer HEAD with 404/403 but serve
    // the manifest fine. We only need the first bytes to prove it is HLS.
    const res = await axios.get(url, {
      timeout: PROBE_TIMEOUT_MS,
      maxRedirects: 3,
      responseType: 'stream',
      headers: { Origin: 'https://realssanews.com.ng/', Referer: 'https://realssanews.com.ng/', 'User-Agent': 'Mozilla/5.0' },
    });
    const ct = String(res.headers['content-type'] || '').toLowerCase();
    const head = await new Promise(resolve => {
      let buf = '';
      res.data.on('data', chunk => {
        buf += chunk.toString('utf8').slice(0, 512);
        // Enough bytes to see the #EXTM3U magic -- stop reading immediately so
        // we do not pull a whole live playlist down the socket.
        if (buf.includes('#EXTM3U') || buf.length > 400) { try { res.data.destroy(); } catch (_) {} resolve(buf); }
      });
      res.data.on('end', () => resolve(buf));
      res.data.on('error', () => resolve(buf));
    });
    const ms = Date.now() - t0;
    const looksHls = head.includes('#EXTM3U') || /mpegurl/i.test(ct);
    const ok = res.status >= 200 && res.status < 300 && looksHls;
    if (!ok) markChannelDead(url);
    return { source, ok, ms };
  } catch (_) {
    markChannelDead(url);
    return { source, ok: false, ms: Date.now() - t0 };
  }
}

// Order a ladder by verified liveness, WITHOUT destroying relevance.
//
// Tier must outrank speed: if we sorted purely by response time, a live-but-
// useless channel (Arena Sport for an ISL fixture) would jump ahead of the
// broadcaster that actually shows the match, and the user would watch the wrong
// game. So we probe everything, then re-sort WITHIN each tier.
//
// Fail-open: if the probe cannot answer for ANY source (our own network is the
// problem), return the original ladder untouched rather than an empty list.
async function probeLadder(ladder) {
  if (!Array.isArray(ladder) || ladder.length === 0) return ladder;
  const head = ladder.slice(0, PROBE_MAX_SOURCES);
  const tail = ladder.slice(PROBE_MAX_SOURCES);
  const results = await Promise.all(head.map(probeSource));
  const alive = results.filter(r => r.ok);
  if (!alive.length) return ladder;                       // fail-open
  const dead = results.filter(r => !r.ok);

  // Rank so that (a) verified-alive beats unverified beats probed-dead, and
  // (b) inside each group the original ladder order is preserved, since that
  // order encodes relevance (team channel → league broadcaster → generic).
  const rank = new Map();
  alive.forEach(r => rank.set(r.source, 0));
  tail.forEach(s => { if (!rank.has(s)) rank.set(s, 1); });
  dead.forEach(r => rank.set(r.source, 2));

  const indexed = ladder.map((s, i) => ({ s, i }));
  indexed.sort((a, b) => {
    const ra = rank.has(a.s) ? rank.get(a.s) : 1;
    const rb = rank.has(b.s) ? rank.get(b.s) : 1;
    if (ra !== rb) return ra - rb;
    return a.i - b.i;                                     // stable: keep relevance order
  });
  return indexed.map(x => x.s);
}

// ── Exact-match context for one fixture ────────────────────────────────────
//
// "I clicked Man City vs Arsenal — why am I watching Brighton vs Everton?"
// Because the IPTV ladder is CHANNEL level: even a perfect broadcaster hit is
// showing whatever that broadcaster chose to air. resolveFeedContext closes
// the gap by finding, in the merged feed:
//   1. `exactStreamId`  → the Streamed per-match embed for THIS fixture (the
//      one source that is guaranteed to be this game, not channel roulette);
//   2. `venue`          → stadium/arena for the fixture card / player banner;
//   3. `matchLive`      → has this fixture actually kicked off;
//   4. `othersLive`     → fixtures live RIGHT NOW, so when the clicked match
//      has not started (or is not airing anywhere), the player can honestly
//      say "not live yet — here is what IS live" with one-tap switching,
//      instead of silently opening a random channel.
function resolveFeedContext(list, home, away, kickoff) {
  const out = { self: null, exactStreamId: null, venue: null, matchLive: null, othersLive: [] };
  try {
    if (!Array.isArray(list)) return out;
    const self = (home && away)
      ? list.find(m => m.home && m.away && teamScore(m.home, home) >= 7 && teamScore(m.away, away) >= 7)
      : null;
    if (self) {
      out.self = self;
      out.exactStreamId = self.streamId || null;
      out.venue = self.venue || null;
      out.matchLive = !!self.isLive;
      // A feed entry flagged live must still be inside its live window — the
      // Streamed mirror has no live flag of its own (see isFixtureLive).
      if (out.matchLive && !isFixtureLive(self.kickoff, true)) out.matchLive = false;
    }
    if (out.matchLive === null) {
      // No feed entry for this fixture — fall back to the kickoff clock.
      const t = parseKickoffTs(kickoff);
      out.matchLive = isNaN(t) ? null : isFixtureLive(t, false);
    }
    const selfKey = self ? `${normalizeTeam(self.home)}|${normalizeTeam(self.away)}` : null;
    out.othersLive = list
      .filter(m => m.isLive && m.status !== 'finished' && m.home && m.away)
      .filter(m => !selfKey || `${normalizeTeam(m.home)}|${normalizeTeam(m.away)}` !== selfKey)
      .slice(0, 8)
      .map(m => ({
        event: m.event || `${m.home} vs ${m.away}`,
        home: m.home,
        away: m.away,
        homeCrest: m.homeCrest || null,
        awayCrest: m.awayCrest || null,
        league: m.league || '',
        sport: m.sport || '',
        kickoff: m.kickoff ?? null,
        venue: m.venue || null,
        score: m.score || null,
        liveDetail: m.liveDetail || null,
        streamId: m.streamId || null,
        directSources: Array.isArray(m.directSources) ? m.directSources.slice(0, 4) : [],
        liveConfidence: m.liveConfidence || null,
      }));
    return out;
  } catch (_) {
    return out;
  }
}

async function getMatchSources({ home, away, homeCrest, awayCrest, sport, league, event, kickoff, pool }) {
  const channels = await getIptvChannels();
  const shaped = (list) => ({
    directSources: list,
    liveConfidence: liveConfidence({ home, away }, list),
  });
  const EMPTY_CTX = { exactStreamId: null, exactEmbedUrl: null, venue: null, matchLive: null, othersLive: [] };
  if (!home || !away) {
    return {
      ...shaped(genericChannelSources(channels, 10).map(s => ({ ...s, sourceTier: 'generic' }))),
      ...EMPTY_CTX,
    };
  }
  const key = sourcesCacheKey(home, away);
  try {
    const cached = await redisService.getCached(key);
    if (cached?.directSources?.length) return cached;
  } catch (_) {}

  const ladder = buildSourceLadder({ home, away, homeCrest, awayCrest, sport, league, event, kickoff }, channels);
  const fallback = ladder.length
    ? ladder
    : genericChannelSources(channels, 10).map(s => ({ ...s, sourceTier: 'generic' }));

  // Lead with what is actually up. Cached, so the next viewer of this fixture
  // gets the verified order for free.
  const directSources = await probeLadder(fallback);

  // Exact-match context (per-match embed + what else is live right now) from
  // the merged feed. Own try/catch: a feed failure must never cost the user
  // their sources. `pool` may be absent (Vercel routes without DB access) —
  // getMatches(null) still merges Streamed + ESPN.
  let ctx = { self: null, exactStreamId: null, venue: null, matchLive: null, othersLive: [] };
  try {
    const feed = await getMatches(pool || null, { staleOk: true });
    ctx = resolveFeedContext(feed?.matches || [], home, away, kickoff);
  } catch (_) {}

  const result = {
    ...shaped(directSources),
    exactStreamId: ctx.exactStreamId,
    exactEmbedUrl: ctx.exactStreamId ? `https://streamed.st/embed/${ctx.exactStreamId}` : null,
    venue: ctx.venue,
    matchLive: ctx.matchLive,
    othersLive: ctx.othersLive,
  };
  redisService.setCached(key, result, SOURCES_TTL).catch(() => {});
  return result;
}

module.exports = { getMatches, getMatchSources, markChannelDead, _test: {
  normalizeTeam, tokenSet, teamScore, teamTokens, parseM3u: parseIptvPlaylist, dedupeChannels: null,
  fetchStreamedMatches, fetchEspnMatches, mergeMatches, buildFeed,
  getIptvChannels, getGenericSportsChannels, findIptvSources, sourcesCacheKey,
  buildSourceLadder, pickBroadcasterSources, genericChannelSources, resolveFeedContext,
  extract: { IPTV_CHANNEL_FILTER, IPTV_MAX_PER_PLAYLIST, IPTV_LIBRARY_MAX, BROADCASTER_HINTS, IPTV_PLAYLIST_COUNT: IPTV_PLAYLISTS.length, IPTV_PLAYLISTS, ESPN_LEAGUES, LEAGUE_BY_CLUB },
  isFixtureLive, parseKickoffTs, liveConfidence, inferLeagueFromTeams,
  markChannelDead, isChannelDead,
  probeSource, probeLadder,
  resetIptvMemo: () => { _iptvMemo = null; _iptvMemoAt = 0; },
  resetDeadChannels: () => { _deadChannels.clear(); },
} };
