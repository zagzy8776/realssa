const { Pool } = require('pg');

let pool;
function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) return null;
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000,
  });
  return pool;
}

const json = (res, status, body, cache = 'public, s-maxage=15, stale-while-revalidate=60') => {
  res.status(status).setHeader('Cache-Control', cache);
  return res.json(body);
};

function normalizeMatch(row) {
  const statusRaw = String(row.status || '').toLowerCase();
  let status = statusRaw;
  if (['in_progress', 'inplay', 'in-play', 'playing'].includes(statusRaw)) status = 'live';
  if (['postponed', 'postponed_match'].includes(statusRaw)) status = 'scheduled';
  if (!['scheduled', 'live', 'finished', 'cancelled'].includes(status)) status = 'scheduled';

  return {
    provider_match_id: String(row.provider_match_id || row.match_id || row.id || ''),
    competition_name: row.competition_name || row.competition || 'Other',
    home_team_name: row.home_team_name || row.home_team || 'Home',
    home_team_crest: row.home_team_crest || row.home_crest || '',
    away_team_name: row.away_team_name || row.away_team || 'Away',
    away_team_crest: row.away_team_crest || row.away_crest || '',
    status,
    minute: row.minute || row.match_minute || '',
    home_score: Number(row.home_score ?? 0),
    away_score: Number(row.away_score ?? 0),
    kickoff_at: row.kickoff_at || row.start_time || row.match_time || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
    match_url: row.match_url || row.url || '',
    source: row.source || 'RealSSA Sports',
    home_hype_count: Number(row.home_hype_count || 0),
    away_hype_count: Number(row.away_hype_count || 0),
  };
}

async function queryDbMatches(mode) {
  const db = getPool();
  if (!db) return [];

  const conditions = [];
  if (mode === 'live') conditions.push("LOWER(status) IN ('live','in_progress','inplay','in-play','playing')");
  if (mode === 'upcoming') conditions.push("LOWER(status) = 'scheduled'");
  if (mode === 'results') conditions.push("LOWER(status) = 'finished'");

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query(`
    SELECT *
    FROM live_matches
    ${where}
    ORDER BY
      CASE
        WHEN LOWER(status) IN ('live','in_progress','inplay','in-play','playing') THEN 0
        WHEN LOWER(status) = 'scheduled' THEN 1
        ELSE 2
      END,
      kickoff_at ASC NULLS LAST,
      updated_at DESC NULLS LAST,
      match_id ASC
    LIMIT 500
  `);
  return result.rows.map(normalizeMatch).filter(m => m.provider_match_id);
}

const ESPN_LEAGUES = [
  ['eng.1', 'Premier League'],
  ['esp.1', 'LaLiga'],
  ['ger.1', 'Bundesliga'],
  ['ita.1', 'Serie A'],
  ['fra.1', 'Ligue 1'],
  ['ned.1', 'Eredivisie'],
  ['por.1', 'Primeira Liga'],
  ['bel.1', 'Belgian Pro League'],
  ['tur.1', 'Turkish Super Lig'],
  ['usa.1', 'MLS'],
  ['mex.1', 'Liga MX'],
  ['bra.1', 'Brazil Serie A'],
  ['arg.1', 'Argentina Liga Profesional'],
  ['col.1', 'Colombia Primera A'],
  ['sco.1', 'Scottish Premiership'],
  ['swe.1', 'Allsvenskan'],
  ['nor.1', 'Eliteserien'],
  ['den.1', 'Danish Superliga'],
  ['sau.1', 'Saudi Pro League'],
  ['uefa.champions', 'UEFA Champions League'],
  ['uefa.europa', 'UEFA Europa League'],
  ['uefa.europa.conf', 'UEFA Conference League'],
  ['caf.champions', 'CAF Champions League'],
  ['ng.1', 'NPFL'],
];

async function fetchJson(url, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'RealSSA-Sports/1.0' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function espnEventToMatch(event, leagueName) {
  const competition = event.competitions?.[0];
  if (!competition) return null;
  const competitors = competition.competitors || [];
  const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
  const away = competitors.find(c => c.homeAway === 'away') || competitors[1];
  if (!home || !away) return null;

  const state = String(event.status?.type?.state || '').toLowerCase();
  const completed = Boolean(event.status?.type?.completed);
  const status = completed ? 'finished' : state === 'in' ? 'live' : 'scheduled';
  const minute = event.status?.displayClock || event.status?.type?.shortDetail || '';

  return normalizeMatch({
    provider_match_id: `espn-${event.id}`,
    competition_name: competition.league?.name || leagueName,
    home_team_name: home.team?.displayName || home.team?.name,
    home_team_crest: home.team?.logo || '',
    away_team_name: away.team?.displayName || away.team?.name,
    away_team_crest: away.team?.logo || '',
    status,
    minute,
    home_score: home.score || 0,
    away_score: away.score || 0,
    kickoff_at: event.date,
    updated_at: new Date().toISOString(),
    match_url: event.links?.find(l => l.rel?.includes('summary'))?.href || '',
    source: 'ESPN',
  });
}

async function fetchExternalMatches(mode) {
  const now = new Date();
  const dates = [];
  const addDate = offset => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + offset);
    dates.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
  };

  if (mode === 'results') [-2, -1, 0].forEach(addDate);
  else if (mode === 'live') [0].forEach(addDate);
  else [0, 1, 2].forEach(addDate);

  // Keep the serverless fallback bounded: a handful of leagues gives broad
  // coverage without turning one page request into dozens of upstream calls.
  const leagues = ESPN_LEAGUES.slice(0, 16);
  const requests = [];
  for (const [slug, name] of leagues) {
    for (const date of dates) {
      requests.push({ slug, name, date });
    }
  }

  const results = await Promise.all(requests.map(async ({ slug, name, date }) => {
    const data = await fetchJson(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${date}&limit=100`
    );
    return (data?.events || []).map(event => espnEventToMatch(event, name)).filter(Boolean);
  }));

  const seen = new Set();
  return results.flat().filter(match => {
    if (seen.has(match.provider_match_id)) return false;
    seen.add(match.provider_match_id);
    if (mode === 'live') return match.status === 'live';
    if (mode === 'upcoming') return match.status === 'scheduled';
    if (mode === 'results') return match.status === 'finished';
    return true;
  }).sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at));
}

async function queryMatches(mode) {
  let matches = [];
  try { matches = await queryDbMatches(mode); } catch (error) {
    console.warn('[Sports API] Database read failed:', error.message);
  }

  // Database is the primary source. If it has no usable fixtures, use the
  // external read-only fallback so the Sports page never renders empty just
  // because the scraper/cron is temporarily behind.
  if (matches.length > 0) return matches;
  return fetchExternalMatches(mode);
}

async function ensureFollowingTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS sports_following (
      device_id VARCHAR(255) NOT NULL,
      provider_match_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (device_id, provider_match_id)
    )
  `);
}

async function handleFollowing(req, res, path) {
  const db = getPool();
  if (!db) return json(res, 200, { following: [] });
  await ensureFollowingTable(db);

  if (req.method === 'GET' && path.startsWith('following/')) {
    const deviceId = decodeURIComponent(path.slice('following/'.length));
    const result = await db.query(
      'SELECT provider_match_id FROM sports_following WHERE device_id = $1 ORDER BY created_at DESC',
      [deviceId]
    );
    return json(res, 200, { following: result.rows.map(r => String(r.provider_match_id)) });
  }

  if (req.method === 'POST' && path === 'follow') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const deviceId = String(body.device_id || '').trim();
    const matchId = String(body.provider_match_id || '').trim();
    const action = String(body.action || '').toLowerCase();
    if (!deviceId || !matchId) return json(res, 400, { error: 'Missing device_id or provider_match_id' });

    if (action === 'follow') {
      await db.query(
        `INSERT INTO sports_following (device_id, provider_match_id)
         VALUES ($1, $2) ON CONFLICT (device_id, provider_match_id) DO NOTHING`,
        [deviceId, matchId]
      );
    } else {
      await db.query('DELETE FROM sports_following WHERE device_id = $1 AND provider_match_id = $2', [deviceId, matchId]);
    }
    return json(res, 200, { ok: true });
  }

  return null;
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Method not allowed' });

  const path = String(req.url || '').split('?')[0]
    .replace(/^\/api\/sports\/?/, '')
    .replace(/\/$/, '');
  const mode = String(req.query?.mode || '').toLowerCase();

  try {
    const followingResponse = await handleFollowing(req, res, path);
    if (followingResponse) return followingResponse;

    if (path === 'stream-schedule') {
      const matches = await queryMatches('upcoming');
      return json(res, 200, matches.map(m => ({
        id: m.provider_match_id,
        event: `${m.home_team_name} vs ${m.away_team_name}`,
        sport: 'Football',
        competition: m.competition_name,
        time: m.kickoff_at,
        status: m.status,
        homeTeam: m.home_team_name,
        awayTeam: m.away_team_name,
        channels: [],
        match_url: m.match_url,
      })));
    }

    if (path === 'matches/live' || mode === 'live') return json(res, 200, { matches: await queryMatches('live') });
    if (path === 'matches/upcoming' || mode === 'upcoming') return json(res, 200, { matches: await queryMatches('upcoming') });
    if (path === 'matches/results' || mode === 'results') return json(res, 200, { matches: await queryMatches('results') });
    if (path === 'matches' || !path) return json(res, 200, { matches: await queryMatches('all') });

    if (path === 'leagues') {
      const db = getPool();
      if (!db) return json(res, 200, { leagues: [] });
      const result = await db.query(`
        SELECT COALESCE(competition_name, competition) AS name, COUNT(*)::int AS match_count
        FROM live_matches
        WHERE COALESCE(competition_name, competition) IS NOT NULL
          AND COALESCE(competition_name, competition) <> ''
        GROUP BY COALESCE(competition_name, competition)
        ORDER BY match_count DESC, name ASC
        LIMIT 100
      `);
      return json(res, 200, { leagues: result.rows });
    }

    if (path.startsWith('standings/')) {
      // Standings are optional and can be supplied by the existing scraper.
      const slug = path.slice('standings/'.length).trim();
      const db = getPool();
      if (db) {
        try {
          const result = await db.query(
            `SELECT standings FROM league_tables
             WHERE league_slug = $1
             ORDER BY scraped_at DESC NULLS LAST LIMIT 1`,
            [slug]
          );
          if (result.rows[0]?.standings) return json(res, 200, { standings: result.rows[0].standings });
        } catch { /* table may not exist */ }
      }
      return json(res, 200, { standings: [] });
    }

    if (path.startsWith('matches/') && path.endsWith('/details')) {
      const matchId = decodeURIComponent(path.slice('matches/'.length, -'/details'.length));
      const matches = await queryMatches('all');
      const match = matches.find(m => m.provider_match_id === matchId) || null;
      return json(res, 200, { match, h2h: null, stats: null, incidents: null });
    }

    return json(res, 404, { error: 'Sports endpoint not found' });
  } catch (error) {
    console.error('[Sports API]', error.message);
    if (path.startsWith('matches')) return json(res, 200, { matches: [] });
    return json(res, 200, { following: [] });
  }
};
