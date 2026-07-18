'use strict';

/**
 * Live Scores Scraper
 * Priority: 1) Soccerway per-competition  2) Flashscore Mobi sweep  3) football-data.org API fallback
 */

const cron    = require('node-cron');
const cheerio = require('cheerio');
const crypto  = require('crypto');
const { Pool } = require('pg');
const axios   = require('axios');

const DATABASE_URL      = process.env.DATABASE_URL;
const ONESIGNAL_APP_ID  = process.env.ONESIGNAL_APP_ID || '055b6596-a96c-48e2-8cda-ff4bb6d61009';
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const FD_API_KEY        = process.env.FOOTBALL_DATA_API_KEY;
const SITE_URL          = 'https://realssanews.com.ng';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Cache-Control': 'no-cache',
};

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

function scoreString(home, away) { return `${home}-${away}`; }

function scoreIncreased(oldScore, newScore) {
  if (!oldScore) return false;
  const [oh, oa] = oldScore.split('-').map(Number);
  const [nh, na] = newScore.split('-').map(Number);
  return (nh + na) > (oh + oa);
}

async function fetchHtml(url) {
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 10000, responseType: 'text' });
    return res.data;
  } catch (e) {
    console.warn(`Fetch failed (${url}): ${e.message}`);
    return null;
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── SOURCE 1: Soccerway per-competition page ──────────────────────────────
// Soccerway renders plain HTML tables — reliable, no JS needed.
// Each competition's scrape_url points to its Soccerway page.

function parseSoccerwayMatches(html, comp) {
  const $ = cheerio.load(html);
  const matches = [];
  const today = new Date().toISOString().split('T')[0];

  // Soccerway match rows are in table.matches tbody tr
  $('table.matches tbody tr, table#tournament-stage-table tbody tr').each((_, row) => {
    const $row = $(row);
    // Skip header/group rows
    if ($row.hasClass('group') || $row.hasClass('heading') || $row.find('th').length > 0) return;

    const cells = $row.find('td');
    if (cells.length < 4) return;

    // Date cell — skip rows not for today or tomorrow
    const dateText = $(cells[0]).text().trim();
    const timeText = $(cells[1]).text().trim();

    // Team names
    const homeTeam = $(cells[2]).find('a, span').first().text().trim() || $(cells[2]).text().trim();
    const awayTeam = $(cells[4]).find('a, span').first().text().trim() || $(cells[4]).text().trim();
    if (!homeTeam || !awayTeam) return;

    // Score cell (index 3) — e.g. "2 - 1" or "-" or "HT" or "45'"
    const scoreCell = $(cells[3]).text().trim();
    const scoreMatch = scoreCell.match(/(\d+)\s*[-:]\s*(\d+)/);
    const homeScore = scoreMatch ? parseInt(scoreMatch[1]) : 0;
    const awayScore = scoreMatch ? parseInt(scoreMatch[2]) : 0;

    // Status
    const statusClass = $row.attr('class') || '';
    const minuteMatch = scoreCell.match(/(\d+)'/);
    let status = 'scheduled';
    let minute = null;

    if (statusClass.includes('live') || minuteMatch || scoreCell.includes("'") || scoreCell.toUpperCase().includes('HT')) {
      status = 'live';
      minute = minuteMatch ? parseInt(minuteMatch[1]) : (scoreCell.toUpperCase().includes('HT') ? 45 : null);
    } else if (scoreMatch) {
      // Has a score and no live indicator — finished
      status = 'finished';
    }

    // Kickoff time
    let kickoffAt = null;
    if (timeText && timeText.match(/\d{2}:\d{2}/)) {
      try {
        const [h, m] = timeText.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        kickoffAt = d.toISOString();
      } catch (_) {}
    }

    const matchId = hashId(`sw-${comp.slug}-${homeTeam}-${awayTeam}`);
    matches.push({ matchId, homeTeam, awayTeam, homeScore, awayScore, status, minute, kickoffAt });
  });

  return matches;
}

// ── SOURCE 2: Flashscore Mobi homepage sweep ──────────────────────────────
// Catches any live matches across all leagues not covered by Soccerway scrape.

function parseFlashscoreHomepage(html, competitions) {
  const $ = cheerio.load(html);
  const matches = [];
  const scoreDataDiv = $('#score-data');
  if (!scoreDataDiv.length) return matches;

  let currentLeague = '';

  scoreDataDiv.contents().each((_, el) => {
    if (el.name === 'h4') {
      currentLeague = $(el).text().replace(/Standings/gi, '').replace(/\s+/g, ' ').trim();
    } else if (el.name === 'span') {
      const timeOrStatus = $(el).text().trim();
      let nextNode = el.nextSibling;
      let teamsText = '';
      while (nextNode) {
        if (nextNode.type === 'text') { teamsText = nextNode.data.trim(); if (teamsText.includes(' - ')) break; }
        nextNode = nextNode.nextSibling;
      }
      if (!teamsText) return;
      const parts = teamsText.split(' - ');
      const homeTeam = parts[0].trim();
      const awayTeam = parts[1]?.trim();
      if (!homeTeam || !awayTeam) return;

      let linkNode = nextNode ? nextNode.nextSibling : null;
      while (linkNode) { if (linkNode.name === 'a') break; linkNode = linkNode.nextSibling; }
      if (!linkNode) return;

      const href = $(linkNode).attr('href') || '';
      const matchIdMatch = href.match(/\/match\/([a-zA-Z0-9]+)\//);
      const matchId = matchIdMatch ? matchIdMatch[1] : hashId(`flash-${currentLeague}-${homeTeam}-${awayTeam}`);
      const scoreText = $(linkNode).text().trim();
      const cls = $(linkNode).attr('class') || '';

      let status = 'scheduled';
      let minute = null;
      if (cls.includes('live')) {
        status = 'live';
        const minMatch = timeOrStatus.match(/(\d+)'/);
        if (minMatch) minute = parseInt(minMatch[1]);
      } else if (cls.includes('fin')) {
        status = 'finished';
      }

      const scoreMatch = scoreText.match(/(\d+)-(\d+)/);
      const homeScore = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      const awayScore = scoreMatch ? parseInt(scoreMatch[2]) : 0;

      // Find which competition this belongs to
      const comp = matchCompetition(currentLeague, competitions);
      if (comp) {
        matches.push({ matchId, comp, homeTeam, awayTeam, homeScore, awayScore, status, minute, kickoffAt: null });
      }
    }
  });

  return matches;
}

// ── SOURCE 3: football-data.org API fallback ──────────────────────────────
// Used for scheduled fixtures (has kickoff times, crests) when scraper has no data.

async function fetchApiMatches() {
  if (!FD_API_KEY) return [];
  try {
    const today = new Date().toISOString().split('T')[0];
    const future = new Date(); future.setDate(future.getDate() + 3);
    const dateTo = future.toISOString().split('T')[0];
    const res = await axios.get(`https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${dateTo}`, {
      headers: { 'X-Auth-Token': FD_API_KEY }, timeout: 10000,
    });
    return res.data?.matches || [];
  } catch (e) {
    console.warn('[liveScraper] API fallback failed:', e.message);
    return [];
  }
}

// ── Competition matcher ───────────────────────────────────────────────────

function matchCompetition(leagueName, competitions) {
  const n = leagueName.toUpperCase();
  for (const comp of competitions) {
    const name = comp.name.replace(/[^\w\s]/g, '').toUpperCase();
    const slug = comp.slug.toUpperCase();
    if (n.includes(slug) || n.includes(name)) return comp;
    // Explicit mappings
    if (slug === 'NPFL' && n.includes('NIGERIA')) return comp;
    if (slug === 'EPL' && (n.includes('PREMIER LEAGUE') && n.includes('ENGLAND'))) return comp;
    if (slug === 'LALIGA' && n.includes('LA LIGA')) return comp;
    if (slug === 'BUNDESLIGA' && n.includes('BUNDESLIGA')) return comp;
    if (slug === 'SERIEA' && n.includes('SERIE A')) return comp;
    if (slug === 'LIGUE1' && n.includes('LIGUE 1')) return comp;
    if (slug === 'UCL' && n.includes('CHAMPIONS LEAGUE')) return comp;
    if (slug === 'EUROPA-LEAGUE' && n.includes('EUROPA LEAGUE')) return comp;
    if (slug === 'CAF-CHAMPIONS-LEAGUE' && n.includes('CAF CHAMPIONS')) return comp;
    if (slug === 'AFCON' && (n.includes('AFCON') || n.includes('AFRICA CUP'))) return comp;
    if (slug === 'EGYPT-PREMIER' && n.includes('EGYPT')) return comp;
    if (slug === 'SOUTH-AFRICA-PSL' && (n.includes('SOUTH AFRICA') || n.includes('PSL'))) return comp;
    if (slug === 'GHANA-PREMIER' && n.includes('GHANA')) return comp;
    if (slug === 'KENYA-PREMIER' && n.includes('KENYA')) return comp;
    if (slug === 'SAUDI-PRO' && n.includes('SAUDI')) return comp;
    if (slug === 'MLS' && n.includes('MLS')) return comp;
    if (slug === 'LIGA-MX' && n.includes('LIGA MX')) return comp;
  }
  return null;
}

// ── Soccerway standings parser ────────────────────────────────────────────

function parseSoccerwayStandings(html) {
  const $ = cheerio.load(html);
  const rows = [];
  $('table.leaguetable tbody tr, table#tournament-stage-table tbody tr').each((_, row) => {
    const $row = $(row);
    if ($row.hasClass('group') || $row.find('th').length > 0) return;
    const cells = $row.find('td').map((_, td) => $(td).text().trim()).get();
    if (cells.length < 8) return;
    const pos = parseInt(cells[0]) || rows.length + 1;
    const teamName = $row.find('td.team a, td.name a').first().text().trim() || cells[1];
    if (!teamName) return;
    const played = parseInt(cells[2]) || 0;
    const won    = parseInt(cells[3]) || 0;
    const drawn  = parseInt(cells[4]) || 0;
    const lost   = parseInt(cells[5]) || 0;
    const goalPart = cells[6] || '';
    const gm = goalPart.match(/(\d+):(\d+)/) || goalPart.match(/(\d+)-(\d+)/);
    const gf = gm ? parseInt(gm[1]) : 0;
    const ga = gm ? parseInt(gm[2]) : 0;
    const points = parseInt(cells[cells.length - 1]) || 0;
    rows.push({ position: pos, team: teamName, played, won, drawn, lost, gf, ga, gd: gf - ga, points });
  });
  return rows;
}

// ── OneSignal Push ────────────────────────────────────────────────────────

async function sendPush(title, body, collapseId) {
  if (!ONESIGNAL_API_KEY) return;
  try {
    await axios.post('https://onesignal.com/api/v1/notifications', {
      app_id: ONESIGNAL_APP_ID, included_segments: ['All'],
      headings: { en: title }, contents: { en: body },
      web_url: `${SITE_URL}/sports`, collapse_id: collapseId, priority: 10,
    }, { headers: { Authorization: `Key ${ONESIGNAL_API_KEY}`, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Push error:', e.response?.data || e.message);
  }
}

// ── DB Upsert ─────────────────────────────────────────────────────────────

async function upsertMatch({ matchId, homeTeam, awayTeam, homeScore, awayScore, status, minute, kickoffAt }, comp) {
  const newScore = scoreString(homeScore, awayScore);
  const existing = await pool.query(
    'SELECT home_score, away_score, status, last_notified_score FROM live_matches WHERE match_id = $1',
    [matchId]
  );
  const dbRow     = existing.rows[0];
  const dbScore   = dbRow ? scoreString(dbRow.home_score, dbRow.away_score) : null;
  const isNewGoal = dbRow && scoreIncreased(dbRow.last_notified_score || dbScore, newScore);
  const isKickoff = (!dbRow || dbRow.status !== 'live') && status === 'live';

  await pool.query(
    `INSERT INTO live_matches (match_id, competition, home_team, away_team, home_score, away_score, status, match_minute, kickoff_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (match_id) DO UPDATE SET
       home_score   = EXCLUDED.home_score,
       away_score   = EXCLUDED.away_score,
       status       = EXCLUDED.status,
       match_minute = EXCLUDED.match_minute,
       kickoff_at   = COALESCE(EXCLUDED.kickoff_at, live_matches.kickoff_at),
       updated_at   = NOW()`,
    [matchId, comp.name, homeTeam, awayTeam, homeScore, awayScore, status, minute, kickoffAt]
  );

  if (isKickoff) await sendPush(`KICKOFF! — ${comp.name}`, `⚽ ${homeTeam} vs ${awayTeam} is now live!`, `kickoff-${matchId}`);
  if (isNewGoal) {
    const minText = minute ? ` ${minute}'` : '';
    await sendPush(`GOAL! — ${comp.name}`, `⚽${minText} ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`, `goal-${matchId}`);
    await pool.query('UPDATE live_matches SET last_notified_score = $1 WHERE match_id = $2', [newScore, matchId]);
  }
  if (dbRow?.status === 'live' && status === 'finished') {
    await sendPush(`🏁 FULL TIME — ${comp.name}`, `${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`, `ft-${matchId}`);
  }
}

async function cleanStaleLiveMatches() {
  try {
    const res = await pool.query(
      `UPDATE live_matches SET status = 'finished' WHERE status = 'live' AND updated_at < NOW() - INTERVAL '3 hours' RETURNING match_id`
    );
    if (res.rowCount > 0) console.log(`🧹 Marked ${res.rowCount} stale live matches as finished`);
  } catch (e) { console.warn('Stale cleanup error:', e.message); }
}

// ── Main Scrape Cycle ─────────────────────────────────────────────────────

async function scrapeAllActive() {
  let competitions = [];
  try {
    const res = await pool.query('SELECT * FROM competitions WHERE is_active = true ORDER BY tier ASC');
    competitions = res.rows;
  } catch (e) { console.error('Failed to load competitions:', e.message); return; }

  if (!competitions.length) { console.log('No active competitions'); return; }

  const seenMatchIds = new Set();
  let totalUpserted = 0;

  // ── PASS 1: Soccerway — scrape each competition's page directly ──────────
  console.log(`[liveScraper] Pass 1: Soccerway — scraping ${competitions.length} competitions...`);
  for (const comp of competitions) {
    if (!comp.scrape_url) continue;
    try {
      const html = await fetchHtml(comp.scrape_url);
      if (!html) continue;
      const matches = parseSoccerwayMatches(html, comp);
      for (const m of matches) {
        seenMatchIds.add(m.matchId);
        await upsertMatch(m, comp);
        totalUpserted++;
      }
      if (matches.length) console.log(`[liveScraper] ✅ Soccerway ${comp.name}: ${matches.length} matches`);
    } catch (e) {
      console.error(`[liveScraper] Soccerway error (${comp.name}):`, e.message);
    }
    await delay(1500); // polite throttle between competition pages
  }

  // ── PASS 2: Flashscore Mobi — sweep for anything missed ─────────────────
  console.log('[liveScraper] Pass 2: Flashscore Mobi homepage sweep...');
  try {
    const html = await fetchHtml('https://www.flashscore.mobi/');
    if (html) {
      const flashMatches = parseFlashscoreHomepage(html, competitions);
      for (const m of flashMatches) {
        if (seenMatchIds.has(m.matchId)) continue; // already got it from Soccerway
        const { comp, ...matchData } = m;
        seenMatchIds.add(m.matchId);
        await upsertMatch(matchData, comp);
        totalUpserted++;
      }
      console.log(`[liveScraper] ✅ Flashscore sweep: ${flashMatches.length} matches found`);
    }
  } catch (e) {
    console.error('[liveScraper] Flashscore sweep error:', e.message);
  }

  // ── PASS 3: football-data.org API — scheduled fixtures fallback ──────────
  // Only fills in matches not already seen from scraper (scheduled only, no overwrite of live)
  console.log('[liveScraper] Pass 3: API fallback for scheduled fixtures...');
  try {
    const apiMatches = await fetchApiMatches();
    for (const m of apiMatches) {
      if (m.status !== 'SCHEDULED' && m.status !== 'TIMED') continue;
      const comp = competitions.find(c =>
        c.name.replace(/[^\w]/g, '').toUpperCase().includes(m.competition.name.replace(/[^\w]/g, '').toUpperCase().slice(0, 8))
      );
      if (!comp) continue;
      const matchId = m.id.toString();
      if (seenMatchIds.has(matchId)) continue;
      // Only insert if not already in live_matches (don't overwrite scraper data)
      const exists = await pool.query('SELECT 1 FROM live_matches WHERE match_id = $1', [matchId]);
      if (exists.rows.length) continue;
      await upsertMatch({
        matchId,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        homeScore: 0, awayScore: 0,
        status: 'scheduled',
        minute: null,
        kickoffAt: m.utcDate,
      }, comp);
      totalUpserted++;
    }
    console.log(`[liveScraper] ✅ API fallback done`);
  } catch (e) {
    console.error('[liveScraper] API fallback error:', e.message);
  }

  console.log(`[liveScraper] Cycle complete — ${totalUpserted} total upserts`);
  await cleanStaleLiveMatches();
}

// ── Standings refresh (every 30 min) ─────────────────────────────────────

async function refreshAllStandings() {
  let competitions = [];
  try {
    const res = await pool.query('SELECT * FROM competitions WHERE is_active = true ORDER BY tier ASC');
    competitions = res.rows;
  } catch (e) { return; }

  console.log(`[liveScraper] Refreshing standings for ${competitions.length} competitions...`);
  for (const comp of competitions) {
    if (!comp.scrape_url) continue;
    try {
      const html = await fetchHtml(comp.scrape_url);
      if (!html) continue;
      const standings = parseSoccerwayStandings(html);
      if (!standings.length) continue;
      await pool.query(
        `INSERT INTO league_tables (league_slug, standings, scraped_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (league_slug, season) DO UPDATE SET standings = EXCLUDED.standings, scraped_at = NOW()`,
        [comp.slug, JSON.stringify(standings)]
      );
      console.log(`[liveScraper] ✅ Standings: ${comp.name} (${standings.length} teams)`);
    } catch (e) {
      console.error(`[liveScraper] Standings error (${comp.name}):`, e.message);
    }
    await delay(3000);
  }
}

// ── Cron Schedule ─────────────────────────────────────────────────────────

console.log('🚀 Live scores scraper starting...');

scrapeAllActive().catch(console.error);
refreshAllStandings().catch(console.error);

cron.schedule('* * * * *', () => scrapeAllActive().catch(console.error));
cron.schedule('*/30 * * * *', () => refreshAllStandings().catch(console.error));

cron.schedule('0 3 * * *', async () => {
  try {
    const res = await pool.query(`DELETE FROM live_matches WHERE status = 'finished' AND updated_at < NOW() - INTERVAL '24 hours'`);
    console.log(`🧹 Daily cleanup: removed ${res.rowCount} old finished matches`);
  } catch (e) { console.error('Daily cleanup error:', e.message); }
});

module.exports = { scrapeAllActive, refreshAllStandings };
