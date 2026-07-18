const fetch = require('node-fetch');

const API_BASE = 'https://api.football-data.org/v4';

// Poll matches every 45 seconds during live matches, 2 minutes otherwise
const POLL_INTERVAL_LIVE = 45 * 1000;
const POLL_INTERVAL_IDLE = 2 * 60 * 1000;

// All competitions available on the football-data.org free tier
// ID => { slug, code, name, flag }
const COMPETITIONS = [
  { id: 2021, slug: 'epl',           code: 'PL',  name: 'Premier League',            flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 2016, slug: 'championship',  code: 'ELC', name: 'Championship',               flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 2014, slug: 'laliga',        code: 'PD',  name: 'La Liga',                    flag: '🇪🇸' },
  { id: 2002, slug: 'bundesliga',    code: 'BL1', name: 'Bundesliga',                 flag: '🇩🇪' },
  { id: 2019, slug: 'seriea',        code: 'SA',  name: 'Serie A',                    flag: '🇮🇹' },
  { id: 2015, slug: 'ligue1',        code: 'FL1', name: 'Ligue 1',                    flag: '🇫🇷' },
  { id: 2017, slug: 'primeiraliga',  code: 'PPL', name: 'Primeira Liga',              flag: '🇵🇹' },
  { id: 2003, slug: 'eredivisie',    code: 'DED', name: 'Eredivisie',                 flag: '🇳🇱' },
  { id: 2013, slug: 'brasileirao',   code: 'BSA', name: 'Campeonato Brasileiro',      flag: '🇧🇷' },
  { id: 2001, slug: 'ucl',           code: 'CL',  name: 'UEFA Champions League',      flag: '🌍' },
  { id: 2018, slug: 'euro',          code: 'EC',  name: 'European Championship',      flag: '🌍' },
  { id: 2000, slug: 'worldcup',      code: 'WC',  name: 'FIFA World Cup',             flag: '🌍' },
  { id: 2152, slug: 'libertadores',  code: 'CLI', name: 'Copa Libertadores',          flag: '🌎' },
];

// Legacy mapping for backwards compat (used in standings slug lookups)
const LEAGUE_MAPPING = Object.fromEntries(COMPETITIONS.map(c => [c.slug, c.code]));

let isPolling = false;

async function fetchWithToken(endpoint) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    console.warn('[sportsBot] FOOTBALL_DATA_API_KEY is not set. Skipping fetch.');
    return null;
  }
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'X-Auth-Token': apiKey
      }
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[sportsBot] API error: ${res.status} for ${endpoint}. Details: ${errText}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`[sportsBot] Fetch failed for ${endpoint}:`, e.message);
    return null;
  }
}

/**
 * Normalizes the match status to simple terms
 */
function normalizeStatus(status) {
  if (['SCHEDULED', 'TIMED'].includes(status)) return 'scheduled';
  if (['IN_PLAY', 'PAUSED'].includes(status)) return 'live';
  if (['FINISHED', 'AWARDED'].includes(status)) return 'finished';
  if (['POSTPONED', 'CANCELLED', 'SUSPENDED'].includes(status)) return 'cancelled';
  return 'scheduled';
}

/**
 * Fetches today's matches and actively playing matches, saves to DB,
 * and fires notifications for goal changes on followed matches.
 */
async function pollMatches(pool, notificationService) {
  if (isPolling) return;
  isPolling = true;

  try {
    // Calculate date bounds (today through +14 days for better fixture coverage)
    const today = new Date();
    const dateFrom = today.toISOString().split('T')[0];
    const future = new Date();
    future.setDate(today.getDate() + 14);
    const dateTo = future.toISOString().split('T')[0];

    // Fetch matches for today through +7 days
    console.log(`[sportsBot] Polling matches from ${dateFrom} to ${dateTo}...`);
    const data = await fetchWithToken(`/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);

    let matches = [];
    if (data && data.matches) {
      matches = [...data.matches];
    }

    // World Cup dedicated call check
    const now = new Date();
    const isWorldCupWindow = now >= new Date('2026-06-11') && now <= new Date('2026-07-25');
    if (isWorldCupWindow) {
      console.log('[sportsBot] Inside World Cup window. Scheduling dedicated WC match fetch with a 15s stagger...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      const wcData = await fetchWithToken(`/competitions/WC/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      if (wcData && wcData.matches) {
        console.log(`[sportsBot] Fetched ${wcData.matches.length} dedicated World Cup matches.`);
        const seenIds = new Set(matches.map(m => m.id));
        for (const match of wcData.matches) {
          if (!seenIds.has(match.id)) {
            matches.push(match);
          }
        }
      }
    }

    if (matches.length === 0) {
      console.log('[sportsBot] No matches found for the current window.');
      isPolling = false;
      return;
    }

    console.log(`[sportsBot] Processing ${matches.length} matches total.`);

    for (const match of matches) {
      const matchId = match.id.toString();
      const compName = match.competition.name;
      // Find competition metadata from our list
      const compMeta = COMPETITIONS.find(c => c.id === match.competition.id);
      const compEmblem = match.competition.emblem || null;
      const compFlag = compMeta?.flag || '';
      const displayCompName = compFlag ? `${compFlag} ${compName}` : compName;
      const homeTeam = match.homeTeam.name;
      const homeCrest = match.homeTeam.crest;
      const awayTeam = match.awayTeam.name;
      const awayCrest = match.awayTeam.crest;
      const status = normalizeStatus(match.status);
      // Use in-play score first (live), then fullTime (finished), then halfTime, then 0
      const homeScore = match.score.fullTime.home 
        ?? (status === 'live' ? (match.score.regularTime?.home ?? match.score.halfTime?.home ?? 0) : 0);
      const awayScore = match.score.fullTime.away 
        ?? (status === 'live' ? (match.score.regularTime?.away ?? match.score.halfTime?.away ?? 0) : 0);
      const kickoffAt = match.utcDate;

      const minute = status === 'live' ? 'Live' : (status === 'finished' ? 'FT' : '');

      // Get existing match state to detect goals
      const existingRes = await pool.query(`SELECT home_score, away_score, status FROM matches WHERE provider_match_id = $1`, [matchId]);

      let goalOccurred = false;
      let isKickoff = false;
      let notificationMessage = '';

      if (existingRes.rows.length > 0) {
        const existing = existingRes.rows[0];
        if (existing.status !== 'live' && status === 'live') {
          isKickoff = true;
        }
        if (status === 'live') {
          if (Number(existing.home_score) !== homeScore || Number(existing.away_score) !== awayScore) {
            goalOccurred = true;
            notificationMessage = `⚽ GOAL! ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`;
          }
        }
      } else if (status === 'live') {
        isKickoff = true;
      }

      // Upsert into `matches` (primary sports hub table)
      await pool.query(`
        INSERT INTO matches (
          provider_match_id, competition_name, home_team_name, home_team_crest, 
          away_team_name, away_team_crest, status, minute, home_score, away_score, kickoff_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (provider_match_id) DO UPDATE SET
          competition_name = EXCLUDED.competition_name,
          status = EXCLUDED.status,
          minute = EXCLUDED.minute,
          home_score = EXCLUDED.home_score,
          away_score = EXCLUDED.away_score,
          home_team_crest = EXCLUDED.home_team_crest,
          away_team_crest = EXCLUDED.away_team_crest,
          updated_at = NOW()
      `, [matchId, displayCompName, homeTeam, homeCrest, awayTeam, awayCrest, status, minute, homeScore, awayScore, kickoffAt]);

      // Mirror into `live_matches` — but NEVER overwrite match_minute if scraper already has it
      try {
        await pool.query(`
          INSERT INTO live_matches (
            match_id, competition, home_team, away_team,
            home_score, away_score, status, match_minute, kickoff_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, NOW())
          ON CONFLICT (match_id) DO UPDATE SET
            competition  = EXCLUDED.competition,
            home_team    = EXCLUDED.home_team,
            away_team    = EXCLUDED.away_team,
            home_score   = EXCLUDED.home_score,
            away_score   = EXCLUDED.away_score,
            status       = EXCLUDED.status,
            kickoff_at   = EXCLUDED.kickoff_at,
            updated_at   = NOW()
            -- match_minute intentionally NOT updated: scraper owns it
        `, [matchId, compName, homeTeam, awayTeam, homeScore, awayScore, status, kickoffAt]);
      } catch (lmErr) {
        console.error('[sportsBot] live_matches mirror failed:', lmErr.message);
      }

      // Send Notifications if kickoff occurred
      if (isKickoff && notificationService) {
        console.log(`[sportsBot] Kickoff detected: ${homeTeam} vs ${awayTeam}`);
        const SITE_URL = 'https://realssanews.com.ng';
        await notificationService.sendToTopic('sports', {
          title: `KICKOFF! — ${displayCompName}`,
          body: `⚽ Match Started: ${homeTeam} vs ${awayTeam} is now live!`,
          url: `${SITE_URL}/sports`,
          category: 'sports'
        });
      }

      // Send goal notification to ALL subscribers
      if (goalOccurred && notificationService) {
        const goalMsg = `${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`;
        console.log(`[sportsBot] Goal detected: ${goalMsg}`);
        await notificationService.sendToTopic('sports', {
          title: `⚽ GOAL! — ${displayCompName}`,
          body: goalMsg,
          url: 'https://realssanews.com.ng/sports',
          category: 'sports',
          priority: 10
        });
      }

      // Also send FT notification to all subscribers
      if (existingRes.rows.length > 0 && existingRes.rows[0].status === 'live' && status === 'finished' && notificationService) {
        await notificationService.sendToTopic('sports', {
          title: `🏁 FULL TIME — ${displayCompName}`,
          body: `${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`,
          url: 'https://realssanews.com.ng/sports',
          category: 'sports'
        });
      }
    }

    // Housekeeping: Clean up followed matches database older than 2 days
    await pool.query(`
      DELETE FROM followed_matches 
      WHERE provider_match_id IN (
        SELECT provider_match_id FROM matches 
        WHERE kickoff_at < NOW() - INTERVAL '2 days'
      )
    `);
  } catch (err) {
    console.error('[sportsBot] Error during polling:', err.message);
  } finally {
    isPolling = false;
  }
}

/**
 * Fetches standings for active competitions with a staggered delay to respect API rate limits
 */
async function fetchAndCacheStandings(pool) {
  console.log('[sportsBot] Starting staggered standings update for all competitions...');

  // Competitions that support standings (knockout-only comps like WC/EURO/UCL have group stages)
  const standingsComps = COMPETITIONS;

  for (const comp of standingsComps) {
    try {
      const data = await fetchWithToken(`/competitions/${comp.code}/standings`);
      if (!data || !data.standings) {
        console.log(`[sportsBot] No standings data available for ${comp.name} (may be off-season).`);
        // Delay before next request
        await new Promise(resolve => setTimeout(resolve, 12000));
        continue;
      }

      let normalized = [];
      const isGroupStage = ['WC', 'EC', 'CL', 'CLI'].includes(comp.code);

      if (isGroupStage) {
        // Flatten group standings for tournament competitions
        data.standings.forEach(groupStanding => {
          if (groupStanding.table) {
            const groupLabel = groupStanding.group
              ? groupStanding.group.replace(/_/g, ' ')
              : (groupStanding.stage || 'Group');
            groupStanding.table.forEach(row => {
              normalized.push({
                position: row.position,
                team: row.team.name,
                teamCrest: row.team.crest,
                group: groupLabel,
                played: row.playedGames,
                won: row.won,
                drawn: row.draw,
                lost: row.lost,
                gf: row.goalsFor,
                ga: row.goalsAgainst,
                gd: row.goalDifference,
                points: row.points
              });
            });
          }
        });
      } else if (data.standings[0] && data.standings[0].table) {
        // Standard league table
        const table = data.standings[0].table;
        normalized = table.map(row => ({
          position: row.position,
          team: row.team.name,
          teamCrest: row.team.crest,
          played: row.playedGames,
          won: row.won,
          drawn: row.draw,
          lost: row.lost,
          gf: row.goalsFor,
          ga: row.goalsAgainst,
          gd: row.goalDifference,
          points: row.points
        }));
      }

      if (normalized.length > 0) {
        await pool.query(`
          INSERT INTO league_tables (league_slug, standings, scraped_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (league_slug, season) DO UPDATE
            SET standings = EXCLUDED.standings, scraped_at = NOW()
        `, [comp.slug, JSON.stringify(normalized)]);
        console.log(`[sportsBot] ✅ Standings cached for: ${comp.flag || ''} ${comp.name}`);
      }
    } catch (e) {
      console.error(`[sportsBot] Error updating standings for ${comp.name}:`, e.message);
    }
    // 12s delay between requests (5 req/min free tier = max 12s apart)
    await new Promise(resolve => setTimeout(resolve, 12000));
  }
  console.log('[sportsBot] ✅ All standings updates complete.');
}

/**
 * Initializes the bot
 */
function initSportsBot(pool, notificationService) {
  console.log('[sportsBot] Initializing Sports Livescore Bot...');

  // Initial match polling run
  pollMatches(pool, notificationService);

  // Adaptive polling: fast during live matches, slower when idle
  const schedulePoll = async () => {
    await pollMatches(pool, notificationService);
    // Check if any matches are currently live
    try {
      const liveCheck = await pool.query(`SELECT COUNT(*) AS c FROM matches WHERE status = 'live'`);
      const hasLive = parseInt(liveCheck.rows[0].c) > 0;
      setTimeout(schedulePoll, hasLive ? POLL_INTERVAL_LIVE : POLL_INTERVAL_IDLE);
    } catch (e) {
      setTimeout(schedulePoll, POLL_INTERVAL_IDLE);
    }
  };
  setTimeout(schedulePoll, POLL_INTERVAL_LIVE);

  // Fetch standings immediately on startup, and refresh every 12 hours
  fetchAndCacheStandings(pool);
  setInterval(() => {
    fetchAndCacheStandings(pool);
  }, 12 * 60 * 60 * 1000);
}

module.exports = { initSportsBot, pollMatches, fetchAndCacheStandings };
