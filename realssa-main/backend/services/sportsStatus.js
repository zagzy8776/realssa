/**
 * Shared match-status normalizer
 * ==============================
 * ONE source of truth for turning messy upstream status strings
 * (TheSportsDB "Match Finished"/"FT"/"NS", flashscore scraper codes,
 * football-data "SCHEDULED"/"FINISHED", ESPN states, or empty junk)
 * into the four canonical statuses the whole app speaks:
 *
 *     'live' | 'finished' | 'cancelled' | 'scheduled'
 *
 * WHY THIS EXISTS: our feeds used to disagree with each other. TheSportsDB
 * sends "Match Finished" which the old per-file status sets did not know,
 * so yesterday's final results were published as "Upcoming". A stale
 * scraper left genuinely-finished games flagged "scheduled" forever, and
 * the merged player feed OR'd a kickoff-clock check over an explicit
 * 'finished', resurrecting dead games as LIVE. This module closes all
 * three holes:
 *   1. exhaustive alias sets (TheSportsDB v1 + flashscore + football-data codes)
 *   2. a kickoff-clock fallback — unknown/empty status is derived from time
 *   3. the clock also overrides a STALE 'scheduled' whose kickoff is hours past
 *      (a "scheduled" match from 4 hours ago is finished, not upcoming)
 */

const LIVE_STATUSES = new Set([
  '1h', '2h', 'ht', 'et', 'bt', 'p',              // flashscore / TheSportsDB in-play
  'live', 'in play', 'in-play', 'inplay', 'playing',
  'in progress', 'in-progress', 'in_progress',
  'first half', 'second half', 'extra time', 'penalties',
  '1st half', '2nd half', 'q1', 'q2', 'q3', 'q4',  // basketball quarters
  'in',                                            // ESPN state
]);

const FINISHED_STATUSES = new Set([
  'ft', 'aet', 'pen', 'ap',                       // full time / after ET / after pens
  'finished', 'match finished', 'complete', 'completed',
  'after et', 'after penalties', 'full time', 'full-time',
  'final', 'ended', 'post',                        // 'post' = ESPN finished state
]);

const CANCELLED_STATUSES = new Set([
  'pst', 'post.', 'post', 'postponed',
  'canc', 'cancel', 'cancelled', 'canceled',
  'abd', 'abandoned', 'susp', 'suspended',
  'awd', 'awarded', 'walkover', 'wo', 'interrupted', 'stopped',
]);

const SCHEDULED_STATUSES = new Set([
  'scheduled', 'ns', 'not started', 'upcoming', 'tbd', 'fixture',
  'timed', 'pre-match', 'pre',                     // 'pre' = ESPN scheduled state
]);

const LIVE_WINDOW_BEFORE_MS = 15 * 60 * 1000;       // show as live 15 min before kickoff
const LIVE_WINDOW_AFTER_MS = 3 * 60 * 60 * 1000;    // generous: stoppage + ET + penalties
const FINISHED_AFTER_MS = 3.5 * 60 * 60 * 1000;     // past any realistic match length

// Kickoff arrives as an ISO string (DB / ESPN / TheSportsDB strTimestamp —
// always UTC) or an epoch-ms number (Streamed mirrors).
function parseKickoffTs(kickoff) {
  if (kickoff == null || kickoff === '') return NaN;
  if (typeof kickoff === 'number') return kickoff > 1e12 ? kickoff : kickoff * 1000;
  const t = Date.parse(String(kickoff));
  return Number.isNaN(t) ? NaN : t;
}

// Clock-derived status for rows whose upstream status is missing or stale.
function deriveFromClock(kickoff, now = Date.now()) {
  const t = parseKickoffTs(kickoff);
  if (Number.isNaN(t)) return null;
  if (now < t - LIVE_WINDOW_BEFORE_MS) return 'scheduled';
  if (now - t > FINISHED_AFTER_MS) return 'finished';
  return 'live'; // inside the live window (pre-roll through +3h)
}

function normalizeStatus(rawStatus, kickoff) {
  const raw = String(rawStatus || '').trim().toLowerCase();

  if (LIVE_STATUSES.has(raw)) return 'live';
  if (FINISHED_STATUSES.has(raw)) return 'finished';
  if (CANCELLED_STATUSES.has(raw)) return 'cancelled';

  if (SCHEDULED_STATUSES.has(raw)) {
    // A stale scraper can leave FT games marked "scheduled" forever.
    // The clock is the tiebreaker: a "scheduled" match that kicked off
    // hours ago is finished — never show it under Upcoming again. And a
    // "scheduled" match whose kickoff just passed is live (scraper lag),
    // matching the merged player feed's isFixtureLive behavior.
    const clock = deriveFromClock(kickoff);
    if (clock === 'finished') return 'finished';
    if (clock === 'live') return 'live';
    return 'scheduled';
  }

  // Unknown / empty → trust the clock, never guess "upcoming" for the past.
  return deriveFromClock(kickoff) || 'scheduled';
}

module.exports = {
  normalizeStatus,
  deriveFromClock,
  parseKickoffTs,
  LIVE_WINDOW_BEFORE_MS,
  LIVE_WINDOW_AFTER_MS,
  FINISHED_AFTER_MS,
  _sets: { LIVE_STATUSES, FINISHED_STATUSES, CANCELLED_STATUSES, SCHEDULED_STATUSES },
};
