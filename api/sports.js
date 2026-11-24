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
    connectionTimeoutMillis: 5000,
  });
  return pool;
}

const json = (res, status, body) => {
  res.status(status).setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
  return res.json(body);
};

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label || 'operation'} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

let normalizeStatus;
try {
  normalizeStatus = require('../backend/services/sportsStatus').normalizeStatus;
} catch (e) {
  console.warn('[Sports API] sportsStatus unavailable, using local normalizer:', e.message);
  normalizeStatus = (status, kickoffAt) => {
    const s = String(status || '').toLowerCase().trim();
    if (['live', 'in play', 'in-play', 'inplay', '1h', '2h', 'ht', 'et', 'pen', 'playing'].includes(s)) return 'live';
    if (['ft', 'finished', 'match finished', 'aet', 'final', 'ended', 'complete', 'completed'].includes(s)) return 'finished';
    if (['pst', 'postponed', 'canc', 'cancelled', 'canceled', 'abandoned'].includes(s)) return 'cancelled';
    if (kickoffAt) {
      const t = new Date(kickoffAt).getTime();
      if (!Number.isNaN(t)) {
        const now = Date.now();
        if (now - t > 3 * 60 * 60 * 1000) return 'finished';
        if (now >= t - 15 * 60 * 1000 && now <= t + 3 * 60 * 60 * 1000) return 'live';
      }
    }
    return 'scheduled';
  };
}

function normalizeMatch(row) {
  const kickoffAt =
    row.kickoff_at ||
    row.start_time ||
    row.match_time ||
    row.strTimestamp ||
    (row.dateEvent && row.strTime ? `${row.dateEvent}T${row.strTime}` : '') ||
    '';
  const status = normalizeStatus(row.status || row.strStatus, kickoffAt || undefined);

  return {
    provider_match_id: String(row.provider_match_id || row.match_id || row.idEvent || row.id || ''),
    competition_name: row.competition_name || row.competition || row.strLeague || 'Other',
    home_team_name: row.home_team_name || row.home_team || row.strHomeTeam || 'Home',
    home_team_crest: row.home_team_crest || row.home_crest || row.strHomeTeamBadge || '',
    away_team_name: row.away_team_name || row.away_team || row.strAwayTeam || 'Away',
    away_team_crest: row.away_team_crest || row.away_crest || row.strAwayTeamBadge || '',
    status,
    minute: row.minute || row.match_minute || row.strProgress || (status === 'finished' ? 'FT' : ''),
    home_score: Number(row.home_score ?? row.intHomeScore ?? 0),
    away_score: Number(row.away_score ?? row.intAwayScore ?? 0),
    kickoff_at: kickoffAt || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
    match_url:
      row.match_url ||
      row.url ||
      (row.idEvent ? `https://www.thesportsdb.com/event/${row.idEvent}` : ''),
    highlight_url: row.highlight_url || row.strVideo || '',
    highlight_thumb: row.highlight_thumb || row.strThumb || '',
    venue: row.venue || row.strVenue || '',
    source: row.source || (row.idEvent ? 'TheSportsDB' : 'RealSSA Sports'),
    home_hype_count: Number(row.home_hype_count || 0),
    away_hype_count: Number(row.away_hype_count || 0),
  };
}

async function queryDbMatches(mode) {
  const db = getPool();
  if (!db) return [];
  const conditions = [];
  if (mode === 'live')
    conditions.push(
      "LOWER(status) IN ('live','in_progress','inplay','in-play','playing','1h','2h','ht','et','bt','p','pen')"
    );
  if (mode === 'upcoming') conditions.push("LOWER(status) = 'scheduled'");
  if (mode === 'results')
    conditions.push("LOWER(status) IN ('finished','ft','complete','completed','aet','final')");
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderSql = `ORDER BY CASE WHEN LOWER(status) IN ('live','in_progress','inplay','in-play','playing','1h','2h','ht','et','bt','p','pen') THEN 0 WHEN LOWER(status) = 'scheduled' THEN 1 ELSE 2 END,
      kickoff_at ASC NULLS LAST, updated_at DESC NULLS LAST LIMIT 500`;

  try {
    const result = await withTimeout(
      db.query(`SELECT * FROM live_matches ${where} ${orderSql}`),
      4000,
      'live_matches'
    );
    const primary = result.rows.map(normalizeMatch).filter((m) => m.provider_match_id);
    if (primary.length) return primary;
  } catch (error) {
    console.warn('[Sports API] live_matches read failed:', error.message);
  }

  try {
    const result = await withTimeout(
      db.query(`SELECT * FROM matches ${where} ${orderSql}`),
      4000,
      'matches'
    );
    return result.rows.map(normalizeMatch).filter((m) => m.provider_match_id);
  } catch (error) {
    console.warn('[Sports API] matches read failed:', error.message);
    return [];
  }
}

async function fetchJson(url, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'RealSSA-Sports/1.0' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn('[Sports API] Upstream failed:', error.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSportsDbMatches(mode) {
  const today = new Date();
  const offsets =
    mode === 'results'
      ? [-2, -1, 0]
      : mode === 'live'
        ? [0]
        : mode === 'upcoming'
          ? [0, 1, 2]
          : [-2, -1, 0, 1, 2];
  const dates = offsets.map((offset) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  });

  const results = await Promise.all(
    dates.map(async (date) => {
      const data = await fetchJson(
        `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${date}&s=Soccer`
      );
      return (data?.events || []).map((event) =>
        normalizeMatch({ ...event, source: 'TheSportsDB' })
      );
    })
  );

  const seen = new Set();
  return results
    .flat()
    .filter((match) => {
      if (!match.provider_match_id || seen.has(match.provider_match_id)) return false;
      seen.add(match.provider_match_id);
      if (mode === 'live') return match.status === 'live';
      if (mode === 'upcoming') return match.status === 'scheduled';
      if (mode === 'results') return match.status === 'finished';
      return true;
    })
    .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at));
}

async function queryMatches(mode) {
  try {
    const dbMatches = await queryDbMatches(mode);

    if (mode === 'all') {
      const externalMatches = await fetchSportsDbMatches('all');
      const byId = new Map();
      for (const match of externalMatches) byId.set(match.provider_match_id, match);
      for (const match of dbMatches) byId.set(match.provider_match_id, match);
      return Array.from(byId.values()).sort(
        (a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at)
      );
    }

    if (dbMatches.length) return dbMatches;
  } catch (error) {
    console.warn('[Sports API] Database read failed:', error.message);
  }
  return fetchSportsDbMatches(mode);
}

function resolvePath(req) {
  // Vercel rewrites may leave req.url as /api/sports.js — prefer original URL headers.
  const raw =
    req.headers?.['x-forwarded-uri'] ||
    req.headers?.['x-invoke-path'] ||
    req.url ||
    '';
  let path = String(raw).split('?')[0];
  path = path
    .replace(/^\/api\/sports\.js\/?/, '')
    .replace(/^\/api\/sports\/?/, '')
    .replace(/\/$/, '');
  // If still looks like a filename, treat as root
  if (path === 'sports.js' || path === 'js') path = '';
  return path;
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
  if (!(path === 'follow' || path.startsWith('following/'))) return null;
  const db = getPool();
  if (!db) return json(res, 200, { following: [] });
  try {
    await ensureFollowingTable(db);
  } catch (e) {
    console.warn('[Sports API] following table:', e.message);
    return json(res, 200, { following: [] });
  }
  if (req.method === 'GET' && path.startsWith('following/')) {
    const deviceId = decodeURIComponent(path.slice('following/'.length));
    const result = await db.query(
      'SELECT provider_match_id FROM sports_following WHERE device_id = $1 ORDER BY created_at DESC',
      [deviceId]
    );
    return json(res, 200, { following: result.rows.map((r) => String(r.provider_match_id)) });
  }
  if (req.method === 'POST' && path === 'follow') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const deviceId = String(body.device_id || '').trim();
    const matchId = String(body.provider_match_id || '').trim();
    if (!deviceId || !matchId)
      return json(res, 400, { error: 'Missing device_id or provider_match_id' });
    if (String(body.action).toLowerCase() === 'follow') {
      await db.query(
        'INSERT INTO sports_following (device_id, provider_match_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [deviceId, matchId]
      );
    } else {
      await db.query(
        'DELETE FROM sports_following WHERE device_id = $1 AND provider_match_id = $2',
        [deviceId, matchId]
      );
    }
    return json(res, 200, { ok: true });
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Method not allowed' });
  const path = resolvePath(req);
  const mode = String(req.query?.mode || '').toLowerCase();

  try {
    const following = await handleFollowing(req, res, path);
    if (following) return following;

    if (path === 'stream-schedule') {
      const matches = await queryMatches('upcoming');
      return json(
        res,
        200,
        matches.map((m) => ({
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
        }))
      );
    }
    if (path === 'matches/live' || mode === 'live')
      return json(res, 200, { matches: await queryMatches('live') });
    if (path === 'matches/upcoming' || mode === 'upcoming')
      return json(res, 200, { matches: await queryMatches('upcoming') });
    if (path === 'matches/results' || mode === 'results')
      return json(res, 200, { matches: await queryMatches('results') });

    if (path === 'match-sources') {
      try {
        const q = req.query || {};
        const { getMatchSources } = require('../backend/services/sportsStreamService');
        const result = await withTimeout(
          getMatchSources({
            home: q.home,
            away: q.away,
            homeCrest: q.homeCrest,
            awayCrest: q.awayCrest,
            sport: q.sport,
            league: q.league,
            event: q.event,
            kickoff: q.kickoff,
            pool: getPool(),
          }),
          8000,
          'match-sources'
        );
        return json(res, 200, result);
      } catch (error) {
        console.warn('[Sports API] match-sources failed:', error.message);
        return json(res, 200, { sources: [] });
      }
    }

    if (path === 'highlights') {
      try {
        const { getHighlights } = require('../backend/services/sportsHighlightsService');
        const q = req.query || {};
        const result = await withTimeout(
          getHighlights({
            id: q.id,
            home: q.home,
            away: q.away,
            kickoff: q.kickoff,
            competition: q.competition,
            matchUrl: q.matchUrl,
          }),
          8000,
          'highlights'
        );
        return json(res, 200, result);
      } catch (error) {
        console.warn('[Sports API] highlights failed:', error.message);
        return json(res, 200, { highlights: [] });
      }
    }

    if (path === 'matches' || !path) {
      // Fast path first: DB + TheSportsDB so the page always has fixtures.
      // Native stream enrichment is best-effort with a hard timeout so a slow
      // scraper can never blank the entire sports page.
      const baselinePromise = queryMatches('all');

      let nativeFeed = null;
      try {
        const { getMatches } = require('../backend/services/sportsStreamService');
        nativeFeed = await withTimeout(getMatches(getPool()), 4500, 'native-feed');
      } catch (error) {
        console.warn('[Sports API] Native feed skipped:', error.message);
      }

      if (nativeFeed?.matches?.length) {
        return json(res, 200, nativeFeed);
      }

      const matches = await baselinePromise;
      return json(res, 200, { matches });
    }

    if (path === 'leagues') {
      const db = getPool();
      if (!db) return json(res, 200, { leagues: [] });
      try {
        const result = await db.query(
          `SELECT COALESCE(competition_name, competition) AS name, COUNT(*)::int AS match_count
           FROM live_matches
           WHERE COALESCE(competition_name, competition) IS NOT NULL
             AND COALESCE(competition_name, competition) <> ''
           GROUP BY COALESCE(competition_name, competition)
           ORDER BY match_count DESC, name ASC LIMIT 100`
        );
        return json(res, 200, { leagues: result.rows });
      } catch (e) {
        console.warn('[Sports API] leagues failed:', e.message);
        return json(res, 200, { leagues: [] });
      }
    }

    if (path.startsWith('standings/')) {
      const slug = path.slice('standings/'.length).trim();
      const db = getPool();
      if (db) {
        try {
          const result = await db.query(
            'SELECT standings FROM league_tables WHERE league_slug = $1 ORDER BY scraped_at DESC NULLS LAST LIMIT 1',
            [slug]
          );
          if (result.rows[0]?.standings)
            return json(res, 200, { standings: result.rows[0].standings });
        } catch {
          /* optional table */
        }
      }
      return json(res, 200, { standings: [] });
    }

    if (path.startsWith('matches/') && path.endsWith('/details')) {
      const matchId = decodeURIComponent(path.slice('matches/'.length, -'/details'.length));
      const matches = await queryMatches('all');
      const match = matches.find((m) => m.provider_match_id === matchId) || null;
      return json(res, 200, { match, h2h: null, stats: null, incidents: null });
    }

    return json(res, 404, { error: 'Sports endpoint not found', path });
  } catch (error) {
    console.error('[Sports API]', error.message);
    // Last-resort: still try TheSportsDB so the UI is not a blank page
    try {
      if (path.startsWith('matches') || !path || path === 'stream-schedule') {
        const matches = await fetchSportsDbMatches(
          mode === 'live' || path.includes('live')
            ? 'live'
            : mode === 'upcoming' || path.includes('upcoming')
              ? 'upcoming'
              : mode === 'results' || path.includes('results')
                ? 'results'
                : 'all'
        );
        return json(res, 200, { matches });
      }
    } catch (e2) {
      console.error('[Sports API] fallback also failed:', e2.message);
    }
    if (path.startsWith('matches') || !path) return json(res, 200, { matches: [] });
    if (path.startsWith('following') || path === 'follow') return json(res, 200, { following: [] });
    return json(res, 200, { error: error.message });
  }
};
