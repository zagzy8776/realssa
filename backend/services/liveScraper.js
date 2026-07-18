/**
 * Live Scores Scraper Service
 * Runs on Railway (persistent Node process) — NOT on Vercel.
 * 
 * Architecture:
 *   - node-cron polls active competitions every 60s
 *   - Cheerio parses Soccerway HTML tables (plain HTML, no Puppeteer needed)
 *   - Change-detector compares scraped score against DB
 *   - On score change → UPDATE live_matches + fire OneSignal push
 *   - Vercel API reads live_matches table — never touches this scraper
 */

'use strict';

const cron    = require('node-cron');
const cheerio = require('cheerio');
const crypto  = require('crypto');
const { Pool } = require('pg');
const axios   = require('axios');

// ── Config ────────────────────────────────────────────────────────────────
const DATABASE_URL      = process.env.DATABASE_URL;
const ONESIGNAL_APP_ID  = process.env.ONESIGNAL_APP_ID  || '055b6596-a96c-48e2-8cda-ff4bb6d61009';
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const SITE_URL          = 'https://realssanews.com.ng';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Cache-Control': 'no-cache',
};

// ── DB Pool ───────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

pool.query('SELECT NOW()').then(r => {
  console.log('✅ Scraper DB connected:', r.rows[0].now);
}).catch(e => {
  console.error('❌ Scraper DB connection failed:', e.message);
});

// ── Helpers ───────────────────────────────────────────────────────────────

function hashId(str) {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 32);
}

function scoreString(home, away) {
  return `${home}-${away}`;
}

function scoreIncreased(oldScore, newScore) {
  if (!oldScore) return false;
  const [oh, oa] = oldScore.split('-').map(Number);
  const [nh, na] = newScore.split('-').map(Number);
  return (nh + na) > (oh + oa);
}

// ── Fetch HTML ────────────────────────────────────────────────────────────

async function fetchHtml(url) {
  try {
    const res = await axios.get(url, {
      headers: HEADERS,
      timeout: 8000,
      // Only download text — skip images/CSS/JS
      responseType: 'text',
    });
    return res.data;
  } catch (e) {
    console.warn(`Fetch failed (${url}): ${e.message}`);
    return null;
  }
}

// ── Flashscore Mobi Standings Parser ─────────────────────────────────────
// Parses the standings table from a Flashscore mobi standings page.
function parseFlashscoreStandings(html) {
  const $ = cheerio.load(html);
  const rows = [];

  $('table.table tbody tr, table.standings tbody tr, table tr').each((_, row) => {
    const $row = $(row);
    // Skip headers
    if ($row.find('th').length > 0 || $row.hasClass('heading')) return;

    const cells = $row.find('td').map((_, td) => $(td).text().trim()).get();
    // Typical standings columns: Pos, Team, P, W, D, L, F:A, +/- (GD), Pts
    if (cells.length < 8) return;

    // Pos is usually in cells[0], e.g. "1." or "1"
    const pos = parseInt(cells[0].replace('.', '')) || rows.length + 1;
    const teamName = cells[1];
    if (!teamName) return;

    const played = parseInt(cells[2]) || 0;
    const won = parseInt(cells[3]) || 0;
    const drawn = parseInt(cells[4]) || 0;
    const lost = parseInt(cells[5]) || 0;
    
    // Goals are often represented as "F:A" or "F-A" in cells[6]
    const goalPart = cells[6] || '';
    const goalMatch = goalPart.match(/(\d+):(\d+)/) || goalPart.match(/(\d+)-(\d+)/);
    const gf = goalMatch ? parseInt(goalMatch[1]) : 0;
    const ga = goalMatch ? parseInt(goalMatch[2]) : 0;
    const gd = parseInt(cells[7]) || (gf - ga);
    const points = parseInt(cells[cells.length - 1]) || 0;

    rows.push({
      position: pos,
      team:     teamName,
      played,
      won,
      drawn,
      lost,
      gf,
      ga,
      gd,
      points
    });
  });

  return rows;
}

// ── Match Mapping Helper ──────────────────────────────────────────────────
// Maps a parsed league string to one of our database competitions
function matchCompetition(leagueName, competitions) {
  const normalizedLeague = leagueName.toUpperCase();
  for (const comp of competitions) {
    const slug = comp.slug.toUpperCase();
    const name = comp.name.toUpperCase();
    
    if (normalizedLeague.includes(slug)) return comp;
    
    // Explicit mappings for common African and international leagues
    if (slug === 'npfl' && normalizedLeague.includes('NIGERIA')) return comp;
    if (slug === 'egypt-premier' && normalizedLeague.includes('EGYPT')) return comp;
    if (slug === 'south-africa-psl' && (normalizedLeague.includes('SOUTH AFRICA') || normalizedLeague.includes('PSL'))) return comp;
    if (slug === 'ghana-premier' && normalizedLeague.includes('GHANA')) return comp;
    if (slug === 'kenya-premier' && normalizedLeague.includes('KENYA')) return comp;
    if (slug === 'tanzania-premier' && normalizedLeague.includes('TANZANIA')) return comp;
    if (slug === 'senegal-premier' && normalizedLeague.includes('SENEGAL')) return comp;
    if (slug === 'cameroon-premier' && (normalizedLeague.includes('CAMEROON') || normalizedLeague.includes('ELITE ONE'))) return comp;
    if (slug === 'cote-divoire-premier' && (normalizedLeague.includes('IVORY COAST') || normalizedLeague.includes('CÔTE D\'IVOIRE') || normalizedLeague.includes('MTN LIGUE 1'))) return comp;
    if (slug === 'morocco-premier' && (normalizedLeague.includes('MOROCCO') || normalizedLeague.includes('BOTOLA'))) return comp;
    if (slug === 'algeria-ligue1' && normalizedLeague.includes('ALGERIA')) return comp;
    if (slug === 'tunisia-ligue1' && normalizedLeague.includes('TUNISIA')) return comp;
    if (slug === 'uganda-premier' && normalizedLeague.includes('UGANDA')) return comp;
    if (slug === 'zambia-super' && normalizedLeague.includes('ZAMBIA')) return comp;
    
    if (slug === 'mls' && normalizedLeague.includes('USA: MLS')) return comp;
    if (slug === 'liga-mx' && normalizedLeague.includes('MEXICO: LIGA MX')) return comp;
    if (slug === 'saudi-pro' && normalizedLeague.includes('SAUDI ARABIA')) return comp;
    if (slug === 'j-league' && normalizedLeague.includes('JAPAN: J1 LEAGUE')) return comp;
    if (slug === 'k-league' && normalizedLeague.includes('SOUTH KOREA: K LEAGUE 1')) return comp;
    
    if (slug === 'efl-championship' && normalizedLeague.includes('ENGLAND: CHAMPIONSHIP')) return comp;
    if (slug === 'fa-cup' && normalizedLeague.includes('ENGLAND: FA CUP')) return comp;
    if (slug === 'europa-league' && normalizedLeague.includes('EUROPE: EUROPA LEAGUE')) return comp;
    if (slug === 'conference-league' && normalizedLeague.includes('EUROPE: UEFA CONFERENCE LEAGUE')) return comp;
    if (slug === 'scottish-premier' && normalizedLeague.includes('SCOTLAND: PREMIERSHIP')) return comp;
    if (slug === 'turkish-super' && normalizedLeague.includes('TURKEY: SUPER LIG')) return comp;
    
    if (slug === 'caf-champions-league' && normalizedLeague.includes('AFRICA: CAF CHAMPIONS LEAGUE')) return comp;
    if (slug === 'caf-confederation-cup' && normalizedLeague.includes('AFRICA: CAF CONFEDERATION CUP')) return comp;
    if (slug === 'afcon' && (normalizedLeague.includes('AFRICA: AFCON') || normalizedLeague.includes('AFRICA: AFRICA CUP OF NATIONS'))) return comp;
    
    // Fallback: clean the name and see if it matches
    const cleanCompName = name.replace(/[^\w\s]/g, '').trim();
    if (cleanCompName && normalizedLeague.includes(cleanCompName.toUpperCase())) return comp;
  }
  return null;
}

// ── OneSignal Push ────────────────────────────────────────────────────────

async function sendGoalNotification({ homeTeam, awayTeam, homeScore, awayScore, minute, competition }) {
  if (!ONESIGNAL_API_KEY) {
    console.warn('ONESIGNAL_API_KEY not set — skipping goal push');
    return;
  }
  const score   = scoreString(homeScore, awayScore);
  const minText = minute ? ` ${minute}'` : '';
  const body    = `⚽${minText} ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`;
  const title   = `GOAL! — ${competition}`;

  try {
    const res = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      {
        app_id:            ONESIGNAL_APP_ID,
        included_segments: ['All'],
        headings:          { en: title },
        contents:          { en: body },
        web_url:           `${SITE_URL}/sports`,
        collapse_id:       `goal-${homeTeam}-${awayTeam}`,
        priority:          10,
      },
      { headers: { Authorization: `Key ${ONESIGNAL_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    console.log(`🔔 Goal push sent [${score}]: ${body} | ID: ${res.data.id}`);
  } catch (e) {
    console.error('Goal push error:', e.response?.data || e.message);
  }
}

// ── DB Upsert ─────────────────────────────────────────────────────────────

async function upsertMatch(match, competition) {
  const { matchId, homeTeam, awayTeam, homeScore, awayScore, status, minute, matchUrl } = match;
  const newScore = scoreString(homeScore, awayScore);

  // Get current DB state
  const existing = await pool.query(
    'SELECT home_score, away_score, status, last_notified_score FROM live_matches WHERE match_id = $1',
    [matchId]
  );

  const dbRow      = existing.rows[0];
  const dbScore    = dbRow ? scoreString(dbRow.home_score, dbRow.away_score) : null;
  const isNewGoal  = dbRow && scoreIncreased(dbRow.last_notified_score || dbScore, newScore);
  const isKickoff  = (!dbRow || dbRow.status !== 'live') && status === 'live';

  // Upsert
  await pool.query(
    `INSERT INTO live_matches
       (match_id, competition, home_team, away_team, home_score, away_score,
        status, match_minute, match_url, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (match_id) DO UPDATE SET
       home_score   = EXCLUDED.home_score,
       away_score   = EXCLUDED.away_score,
       status       = EXCLUDED.status,
       match_minute = EXCLUDED.match_minute,
       updated_at   = NOW()`,
    [matchId, competition.name, homeTeam, awayTeam, homeScore, awayScore, status, minute, matchUrl]
  );

  // Fire kickoff notification to all subscribed users
  if (isKickoff) {
    if (ONESIGNAL_API_KEY) {
      try {
        await axios.post(
          'https://onesignal.com/api/v1/notifications',
          {
            app_id:            ONESIGNAL_APP_ID,
            included_segments: ['All'],
            headings:          { en: `KICKOFF! — ${competition.name}` },
            contents:          { en: `⚽ Match Started: ${homeTeam} vs ${awayTeam} is now live!` },
            web_url:           `${SITE_URL}/sports`,
            collapse_id:       `kickoff-${homeTeam}-${awayTeam}`,
            priority:          10,
          },
          { headers: { Authorization: `Key ${ONESIGNAL_API_KEY}`, 'Content-Type': 'application/json' } }
        );
        console.log(`🔔 Kickoff push sent from scraper: ${homeTeam} vs ${awayTeam}`);
      } catch (err) {
        console.error('Kickoff push error:', err.response?.data || err.message);
      }
    }
  }

  // Fire goal notification + stamp last_notified_score to prevent duplicates
  if (isNewGoal) {
    await sendGoalNotification({ homeTeam, awayTeam, homeScore, awayScore, minute, competition: competition.name });
    await pool.query(
      'UPDATE live_matches SET last_notified_score = $1 WHERE match_id = $2',
      [newScore, matchId]
    );
  }
}

// ── Mark stale live matches as finished ───────────────────────────────────
// If a match hasn't been updated in 3 hours, assume it's over

async function cleanStaleLiveMatches() {
  try {
    const res = await pool.query(
      `UPDATE live_matches SET status = 'finished'
       WHERE status = 'live'
         AND updated_at < NOW() - INTERVAL '3 hours'
       RETURNING match_id`
    );
    if (res.rowCount > 0) {
      console.log(`🧹 Marked ${res.rowCount} stale live matches as finished`);
    }
  } catch (e) {
    console.warn('Stale match cleanup error:', e.message);
  }
}

// ── Main Scrape Cycle ─────────────────────────────────────────────────────

async function scrapeAllActive() {
  let competitions = [];
  try {
    const res = await pool.query(
      'SELECT * FROM competitions WHERE is_active = true ORDER BY tier ASC'
    );
    competitions = res.rows;
  } catch (e) {
    console.error('Failed to load competitions:', e.message);
    return;
  }

  if (competitions.length === 0) {
    console.log('No active competitions to scrape');
    return;
  }

  console.log(`🔄 Scraping live scores from Flashscore Mobi for ${competitions.length} active competitions...`);

  // Try primary Flashscore Mobi scrape
  let parsedMatches = [];
  let scrapedOk = false;

  try {
    const html = await fetchHtml('https://www.flashscore.mobi/');
    if (html) {
      const $ = cheerio.load(html);
      const scoreDataDiv = $('#score-data');

      if (scoreDataDiv.length > 0) {
        let currentLeague = '';
        const leagueStandingsUrls = {};

        scoreDataDiv.contents().each((_, el) => {
          if (el.name === 'h4') {
            currentLeague = $(el).text().replace(/Standings/gi, '').replace(/\s+/g, ' ').trim();
            const standingsLink = $(el).find('a').attr('href');
            if (standingsLink) leagueStandingsUrls[currentLeague] = `https://www.flashscore.mobi${standingsLink}`;
          } else if (el.name === 'span') {
            const timeOrStatus = $(el).text().trim();
            let nextNode = el.nextSibling;
            let teamsText = '';
            while (nextNode) {
              if (nextNode.type === 'text') {
                teamsText = nextNode.data.trim();
                if (teamsText.includes(' - ')) break;
              }
              nextNode = nextNode.nextSibling;
            }
            if (teamsText) {
              const parts = teamsText.split(' - ');
              const homeTeam = parts[0].trim();
              const awayTeam = parts[1].trim();
              let linkNode = nextNode ? nextNode.nextSibling : null;
              while (linkNode) {
                if (linkNode.name === 'a') break;
                linkNode = linkNode.nextSibling;
              }
              if (linkNode) {
                const href = $(linkNode).attr('href') || '';
                const matchIdMatch = href.match(/\/match\/([a-zA-Z0-9]+)\//);
                const matchId = matchIdMatch ? matchIdMatch[1] : hashId(`flash-${currentLeague}-${homeTeam}-${awayTeam}`);
                const scoreText = $(linkNode).text().trim();
                const cls = $(linkNode).attr('class') || '';
                const matchUrl = `https://www.flashscore.mobi${href}`;
                let status = 'scheduled';
                let minute = null;
                if (cls.includes('live')) {
                  status = 'live';
                  const minMatch = timeOrStatus.match(/(\d+)'/);
                  if (minMatch) minute = parseInt(minMatch[1]);
                } else if (cls.includes('fin')) {
                  status = 'finished';
                }
                let homeScore = 0, awayScore = 0;
                const scoreMatch = scoreText.match(/(\d+)-(\d+)/);
                if (scoreMatch) { homeScore = parseInt(scoreMatch[1]); awayScore = parseInt(scoreMatch[2]); }
                parsedMatches.push({ matchId, league: currentLeague, timeOrStatus, homeTeam, awayTeam, homeScore, awayScore, status, minute, matchUrl });
              }
            }
          }
        });
        scrapedOk = parsedMatches.length > 0;
        console.log(`[liveScraper] Parsed ${parsedMatches.length} matches from Flashscore Mobi.`);
      } else {
        console.warn('[liveScraper] #score-data div not found — Flashscore may have changed structure');
      }
    }
  } catch (err) {
    console.error('[liveScraper] Flashscore scrape error:', err.message);
  }

  // Fallback: try livescore.com mobi if Flashscore returned nothing
  if (!scrapedOk) {
    console.warn('[liveScraper] Flashscore returned 0 matches, trying livescore.in fallback...');
    try {
      const html2 = await fetchHtml('https://www.livescore.in/');
      if (html2) {
        const $ = cheerio.load(html2);
        $('div.match, div.event__match, .soccer-match').each((_, el) => {
          const homeTeam = $(el).find('.event__participant--home, .home-team, .team-home').first().text().trim();
          const awayTeam = $(el).find('.event__participant--away, .away-team, .team-away').first().text().trim();
          const scoreEl = $(el).find('.event__score, .score, .match-score').first().text().trim();
          const statusEl = $(el).find('.event__stage, .match-status').first().text().trim().toLowerCase();
          if (!homeTeam || !awayTeam) return;
          const scoreMatch = scoreEl.match(/(\d+)[^\d]+(\d+)/);
          const homeScore = scoreMatch ? parseInt(scoreMatch[1]) : 0;
          const awayScore = scoreMatch ? parseInt(scoreMatch[2]) : 0;
          const isLive = statusEl.includes("'") || statusEl === 'live' || statusEl.includes('ht');
          const isFin = statusEl === 'ft' || statusEl === 'finished' || statusEl === 'aet';
          const status = isLive ? 'live' : isFin ? 'finished' : 'scheduled';
          const matchId = hashId(`ls-${homeTeam}-${awayTeam}`);
          parsedMatches.push({ matchId, league: 'Unknown', timeOrStatus: statusEl, homeTeam, awayTeam, homeScore, awayScore, status, minute: null, matchUrl: '' });
        });
        console.log(`[liveScraper] Fallback parsed ${parsedMatches.length} matches from livescore.in`);
      }
    } catch (e2) {
      console.error('[liveScraper] Fallback scrape also failed:', e2.message);
    }
  }

  // Upsert all parsed matches
  let matchedCount = 0;
  for (const match of parsedMatches) {
    const comp = matchCompetition(match.league, competitions);
    if (comp) {
      matchedCount++;
      await upsertMatch(match, comp);
    }
  }
  console.log(`[liveScraper] Upserted ${matchedCount} matched scores to DB.`);

  await cleanStaleLiveMatches();
}

// ── Standings refresh (every 30 min) ─────────────────────────────────────

async function refreshAllStandings() {
  let competitions = [];
  try {
    const res = await pool.query('SELECT * FROM competitions WHERE is_active = true ORDER BY tier ASC');
    competitions = res.rows;
  } catch (e) { return; }

  console.log(`[liveScraper] Refreshing standings for ${competitions.length} active competitions...`);

  for (const comp of competitions) {
    // Only scrape if we have a valid flashscore.mobi standings URL (which has /standings/ in it)
    if (!comp.scrape_url || !comp.scrape_url.includes('/standings/')) {
      console.log(`[liveScraper] Skipping standings fetch for ${comp.name} (not a flashscore standings URL: ${comp.scrape_url})`);
      continue;
    }

    try {
      console.log(`[liveScraper] Fetching standings for ${comp.name} from ${comp.scrape_url}...`);
      const html = await fetchHtml(comp.scrape_url);
      if (!html) continue;

      const standings = parseFlashscoreStandings(html);
      if (standings.length === 0) {
        console.log(`[liveScraper] No standings parsed for ${comp.name}`);
        continue;
      }

      await pool.query(
        `INSERT INTO league_tables (league_slug, standings, scraped_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (league_slug, season) DO UPDATE
           SET standings = EXCLUDED.standings, scraped_at = NOW()`,
        [comp.slug, JSON.stringify(standings)]
      );
      console.log(`[liveScraper] ✅ Standings cached: ${comp.name} (${standings.length} teams)`);

    } catch (e) {
      console.error(`[liveScraper] Standings scrape error (${comp.name}):`, e.message);
    }
    // Throttle requests (3s gap)
    await new Promise(r => setTimeout(r, 3000));
  }
}

// ── Cron Schedule ─────────────────────────────────────────────────────────

console.log('🚀 Live scores scraper starting...');

scrapeAllActive().catch(console.error);
refreshAllStandings().catch(console.error);

cron.schedule('* * * * *', () => scrapeAllActive().catch(console.error));
cron.schedule('*/30 * * * *', () => refreshAllStandings().catch(console.error));

// Daily cleanup
cron.schedule('0 3 * * *', async () => {
  try {
    const res = await pool.query(
      `DELETE FROM live_matches WHERE status = 'finished' AND updated_at < NOW() - INTERVAL '24 hours'`
    );
    console.log(`🧹 Daily cleanup: removed ${res.rowCount} old finished matches`);
  } catch (e) {
    console.error('Daily cleanup error:', e.message);
  }
});

module.exports = { scrapeAllActive, refreshAllStandings };
