const { Pool } = require('pg');

let pool;
function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) return null;
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000 });
  return pool;
}

const json = (res, status, body) => {
  res.status(status).setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
  return res.json(body);
};

function normalizeMatch(row) {
  const raw = String(row.status || row.strStatus || '').toLowerCase();
  let status = raw;
  if (['in progress', 'in-progress', 'inplay', 'in-play', 'playing', 'live'].includes(raw)) status = 'live';
  else if (['ft', 'finished', 'complete', 'completed', 'after penalties'].includes(raw)) status = 'finished';
  else if (!['scheduled', 'live', 'finished', 'cancelled'].includes(status)) status = 'scheduled';

  return {
    provider_match_id: String(row.provider_match_id || row.match_id || row.idEvent || row.id || ''),
    competition_name: row.competition_name || row.competition || row.strLeague || 'Other',
    home_team_name: row.home_team_name || row.home_team || row.strHomeTeam || 'Home',
    home_team_crest: row.home_team_crest || row.home_crest || row.strHomeTeamBadge || '',
    away_team_name: row.away_team_name || row.away_team || row.strAwayTeam || 'Away',
    away_team_crest: row.away_team_crest || row.away_crest || row.strAwayTeamBadge || '',
    status,
    minute: row.minute || row.match_minute || row.strProgress || row.strStatus || '',
    home_score: Number(row.home_score ?? row.intHomeScore ?? 0),
    away_score: Number(row.away_score ?? row.intAwayScore ?? 0),
    kickoff_at: row.kickoff_at || row.start_time || row.match_time || row.strTimestamp || (row.dateEvent && row.strTime ? `${row.dateEvent}T${row.strTime}` : new Date().toISOString()),
    updated_at: row.updated_at || new Date().toISOString(),
    match_url: row.match_url || row.url || (row.idEvent ? `https://www.thesportsdb.com/event/${row.idEvent}` : ''),
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
    SELECT * FROM live_matches ${where}
    ORDER BY CASE WHEN LOWER(status) IN ('live','in_progress','inplay','in-play','playing') THEN 0 WHEN LOWER(status) = 'scheduled' THEN 1 ELSE 2 END,
      kickoff_at ASC NULLS LAST, updated_at DESC NULLS LAST, match_id ASC LIMIT 500
  `);
  return result.rows.map(normalizeMatch).filter(m => m.provider_match_id);
}

async function fetchJson(url, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'RealSSA-Sports/1.0' } });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn('[Sports API] Upstream failed:', error.message);
    return null;
  } finally { clearTimeout(timer); }
}

async function fetchSportsDbMatches(mode) {
  const today = new Date();
  const offsets = mode === 'results' ? [-2, -1, 0] : mode === 'live' ? [0] : [0, 1, 2];
  const dates = offsets.map(offset => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  });

  // TheSportsDB V1 exposes events by day using the free public key. Three
  // day requests stay within the documented free request limit and give us
  // broad football coverage instead of depending on one league/scraper.
  const results = await Promise.all(dates.map(async date => {
    const data = await fetchJson(`https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${date}&s=Soccer`);
    return (data?.events || []).map(event => normalizeMatch({ ...event, source: 'TheSportsDB' }));
  }));

  const seen = new Set();
  return results.flat().filter(match => {
    if (!match.provider_match_id || seen.has(match.provider_match_id)) return false;
    seen.add(match.provider_match_id);
    if (mode === 'live') return match.status === 'live';
    if (mode === 'upcoming') return match.status === 'scheduled';
    if (mode === 'results') return match.status === 'finished';
    return true;
  }).sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at));
}

async function queryMatches(mode) {
  try {
    const dbMatches = await queryDbMatches(mode);
    if (dbMatches.length) return dbMatches;
  } catch (error) {
    console.warn('[Sports API] Database read failed:', error.message);
  }
  return fetchSportsDbMatches(mode);
}

async function ensureFollowingTable(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS sports_following (
    device_id VARCHAR(255) NOT NULL,
    provider_match_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (device_id, provider_match_id)
  )`);
}

async function handleFollowing(req, res, path) {
  const db = getPool();
  if (!db) return json(res, 200, { following: [] });
  await ensureFollowingTable(db);
  if (req.method === 'GET' && path.startsWith('following/')) {
    const deviceId = decodeURIComponent(path.slice('following/'.length));
    const result = await db.query('SELECT provider_match_id FROM sports_following WHERE device_id = $1 ORDER BY created_at DESC', [deviceId]);
    return json(res, 200, { following: result.rows.map(r => String(r.provider_match_id)) });
  }
  if (req.method === 'POST' && path === 'follow') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const deviceId = String(body.device_id || '').trim();
    const matchId = String(body.provider_match_id || '').trim();
    if (!deviceId || !matchId) return json(res, 400, { error: 'Missing device_id or provider_match_id' });
    if (String(body.action).toLowerCase() === 'follow') {
      await db.query('INSERT INTO sports_following (device_id, provider_match_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [deviceId, matchId]);
    } else {
      await db.query('DELETE FROM sports_following WHERE device_id = $1 AND provider_match_id = $2', [deviceId, matchId]);
    }
    return json(res, 200, { ok: true });
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Method not allowed' });
  const path = String(req.url || '').split('?')[0].replace(/^\/api\/sports\/?/, '').replace(/\/$/, '');
  const mode = String(req.query?.mode || '').toLowerCase();
  try {
    const following = await handleFollowing(req, res, path);
    if (following) return following;

    if (path === 'stream-schedule') {
      const matches = await queryMatches('upcoming');
      return json(res, 200, matches.map(m => ({ id: m.provider_match_id, event: `${m.home_team_name} vs ${m.away_team_name}`, sport: 'Football', competition: m.competition_name, time: m.kickoff_at, status: m.status, homeTeam: m.home_team_name, awayTeam: m.away_team_name, channels: [], match_url: m.match_url })));
    }
    if (path === 'matches/live' || mode === 'live') return json(res, 200, { matches: await queryMatches('live') });
    if (path === 'matches/upcoming' || mode === 'upcoming') return json(res, 200, { matches: await queryMatches('upcoming') });
    if (path === 'matches/results' || mode === 'results') return json(res, 200, { matches: await queryMatches('results') });
    if (path === 'matches' || !path) return json(res, 200, { matches: await queryMatches('all') });

    if (path === 'leagues') {
      const db = getPool();
      if (!db) return json(res, 200, { leagues: [] });
      const result = await db.query(`SELECT COALESCE(competition_name, competition) AS name, COUNT(*)::int AS match_count FROM live_matches WHERE COALESCE(competition_name, competition) IS NOT NULL AND COALESCE(competition_name, competition) <> '' GROUP BY COALESCE(competition_name, competition) ORDER BY match_count DESC, name ASC LIMIT 100`);
      return json(res, 200, { leagues: result.rows });
    }

    if (path.startsWith('standings/')) {
      const slug = path.slice('standings/'.length).trim();
      const db = getPool();
      if (db) {
        try {
          const result = await db.query('SELECT standings FROM league_tables WHERE league_slug = $1 ORDER BY scraped_at DESC NULLS LAST LIMIT 1', [slug]);
          if (result.rows[0]?.standings) return json(res, 200, { standings: result.rows[0].standings });
        } catch { /* optional table */ }
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
