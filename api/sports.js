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

const json = (res, status, body) => {
  res.status(status).setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
  return res.json(body);
};

function normalizeMatch(row) {
  return {
    provider_match_id: String(row.provider_match_id || row.id || ''),
    competition_name: row.competition_name || row.competition || 'Other',
    home_team_name: row.home_team_name || row.home_team || 'Home',
    home_team_crest: row.home_team_crest || row.home_crest || '',
    away_team_name: row.away_team_name || row.away_team || 'Away',
    away_team_crest: row.away_team_crest || row.away_crest || '',
    status: row.status || 'scheduled',
    minute: row.minute || '',
    home_score: Number(row.home_score || 0),
    away_score: Number(row.away_score || 0),
    kickoff_at: row.kickoff_at || row.start_time || row.match_time || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
    match_url: row.match_url || row.url || '',
    source: row.source || 'RealSSA Sports',
    home_hype_count: Number(row.home_hype_count || 0),
    away_hype_count: Number(row.away_hype_count || 0),
  };
}

async function queryMatches(mode) {
  const db = getPool();
  if (!db) return [];

  const conditions = [];
  const params = [];
  if (mode === 'live') conditions.push("status = 'live'");
  if (mode === 'upcoming') {
    conditions.push("status = 'scheduled'");
    conditions.push('kickoff_at >= NOW()');
  }
  if (mode === 'results') conditions.push("status = 'finished'");

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query(`
    SELECT *
    FROM live_matches
    ${where}
    ORDER BY
      CASE WHEN status = 'live' THEN 0 WHEN status = 'scheduled' THEN 1 ELSE 2 END,
      kickoff_at ASC NULLS LAST,
      updated_at DESC NULLS LAST
    LIMIT 300
  `);
  return result.rows.map(normalizeMatch);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const path = String(req.url || '').split('?')[0].replace(/^\/api\/sports\/?/, '').replace(/\/$/, '');
  const mode = String(req.query?.mode || '').toLowerCase();

  try {
    if (path === 'stream-schedule') {
      const matches = await queryMatches('all');
      return json(res, 200, matches.map((m) => ({
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

    if (path === 'matches/live' || mode === 'live') return json(res, 200, await queryMatches('live'));
    if (path === 'matches/upcoming' || mode === 'upcoming') return json(res, 200, await queryMatches('upcoming'));
    if (path === 'matches/results' || mode === 'results') return json(res, 200, await queryMatches('results'));
    if (path === 'matches' || !path) return json(res, 200, await queryMatches('all'));

    if (path === 'leagues') {
      const db = getPool();
      if (!db) return json(res, 200, []);
      const result = await db.query(`
        SELECT competition_name AS name, COUNT(*)::int AS match_count
        FROM live_matches
        WHERE competition_name IS NOT NULL AND competition_name <> ''
        GROUP BY competition_name
        ORDER BY match_count DESC, competition_name ASC
        LIMIT 100
      `);
      return json(res, 200, result.rows);
    }

    return json(res, 404, { error: 'Sports endpoint not found' });
  } catch (error) {
    console.error('[Sports API]', error.message);
    return json(res, 200, []);
  }
};
