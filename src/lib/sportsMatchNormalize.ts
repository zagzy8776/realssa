/**
 * Normalisation for the sports match feed.
 *
 * `/api/sports/matches` serves a rich camelCase payload
 *   { id, event, home, away, homeCrest, awayCrest, kickoff, league,
 *     isLive, status, score, venue, directSources, liveConfidence }
 * while the Sports UI (and the /videos handoff) render a legacy snake_case
 * model. Reading the camelCase payload directly left every card with no team
 * names, no crests, an "Invalid Date" kickoff and a single "Other" group.
 *
 * `isLive` is authoritative: the feeder marks genuinely live fixtures as
 * status 'scheduled' (kickoff passed, result not finalised), which made the
 * Live tab report 1 match while 5 were in play.
 */

export interface Match {
  provider_match_id: string;
  competition_name: string;
  home_team_name: string;
  home_team_crest: string;
  away_team_name: string;
  away_team_crest: string;
  status: 'scheduled' | 'live' | 'finished' | 'cancelled';
  minute: string;
  home_score: number;
  away_score: number;
  kickoff_at: string;
  updated_at: string;
  match_url?: string;
  highlight_url?: string;
  highlight_thumb?: string;
  venue?: string | null;
  source?: string;
  home_hype_count?: number;
  away_hype_count?: number;
}

export type RawMatch = Record<string, any>;

const firstValue = (...values: unknown[]): unknown =>
  values.find(v => v !== undefined && v !== null && v !== '');

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function scorePair(raw: RawMatch): { home: number; away: number } {
  if (raw.home_score !== undefined && raw.away_score !== undefined) {
    return { home: toNumber(raw.home_score), away: toNumber(raw.away_score) };
  }
  // Rich feed sends one compact string, e.g. "0-0".
  const compact = String(firstValue(raw.score, raw.result, '') ?? '');
  const pair = compact.match(/(\d+)\s*[-:–]\s*(\d+)/);
  return pair ? { home: Number(pair[1]), away: Number(pair[2]) } : { home: 0, away: 0 };
}

function normalizeMatchStatus(raw: RawMatch): Match['status'] {
  if (raw.isLive === true) return 'live';
  const s = String(firstValue(raw.status, raw.state, '') ?? '').toLowerCase();
  if (['live', 'inplay', 'in_play', 'in-play', '1h', '2h', 'ht', 'et', 'p', 'playing'].includes(s)) return 'live';
  if (['finished', 'ft', 'full_time', 'full-time', 'ended', 'final', 'aet', 'pen'].includes(s)) return 'finished';
  if (['cancelled', 'canceled', 'postponed', 'abandoned', 'suspended'].includes(s)) return 'cancelled';
  return 'scheduled';
}

export function normalizeMatch(raw: RawMatch): Match {
  const home = firstValue(raw.home_team_name, raw.home, raw.homeTeam?.name, raw.homeTeam, raw.home_team);
  const away = firstValue(raw.away_team_name, raw.away, raw.awayTeam?.name, raw.awayTeam, raw.away_team);
  const { home: homeScore, away: awayScore } = scorePair(raw);

  return {
    provider_match_id: String(firstValue(raw.provider_match_id, raw.id, raw.match_id, raw.matchId, '') ?? ''),
    competition_name: String(firstValue(raw.competition_name, raw.league, raw.competition, raw.tournament, raw.category, 'Other') ?? 'Other'),
    home_team_name: home == null ? '' : String(home),
    home_team_crest: String(firstValue(raw.home_team_crest, raw.homeCrest, raw.homeTeam?.crest, '') ?? ''),
    away_team_name: away == null ? '' : String(away),
    away_team_crest: String(firstValue(raw.away_team_crest, raw.awayCrest, raw.awayTeam?.crest, '') ?? ''),
    status: normalizeMatchStatus(raw),
    minute: String(firstValue(raw.minute, raw.liveDetail, raw.elapsed, '') ?? ''),
    home_score: homeScore,
    away_score: awayScore,
    kickoff_at: String(firstValue(
      raw.kickoff_at, raw.kickoff, raw.start_time, raw.startTime, raw.time, raw.date, raw.utcDate, '',
    ) ?? ''),
    updated_at: String(firstValue(raw.updated_at, raw.updatedAt, raw.generatedAt, '') ?? ''),
    match_url: (firstValue(raw.match_url, raw.matchUrl, raw.streamUrl) as string | undefined) ?? undefined,
    highlight_url: (firstValue(raw.highlight_url, raw.highlightUrl) as string | undefined) ?? undefined,
    highlight_thumb: (firstValue(raw.highlight_thumb, raw.highlightThumb, raw.thumbnail) as string | undefined) ?? undefined,
    venue: (firstValue(raw.venue, raw.stadium) as string | undefined) ?? null,
    source: (firstValue(raw.source, raw.provider) as string | undefined) ?? undefined,
    home_hype_count: raw.home_hype_count != null ? toNumber(raw.home_hype_count) : undefined,
    away_hype_count: raw.away_hype_count != null ? toNumber(raw.away_hype_count) : undefined,
  };
}

/** Accepts the `{ matches: [...] }` envelope or a bare array (legacy endpoint). */
function payloadList(payload: unknown): RawMatch[] {
  const list = Array.isArray(payload)
    ? payload
    : (Array.isArray((payload as { matches?: unknown } | null)?.matches)
      ? (payload as { matches: unknown[] }).matches
      : []);
  return list.filter((m): m is RawMatch => !!m && typeof m === 'object');
}

export function normalizeMatches(payload: unknown): Match[] {
  return payloadList(payload)
    .map(normalizeMatch)
    .filter(m => m.provider_match_id || m.home_team_name || m.away_team_name);
}

/* ─────────────────────── CinemaHub feed view model ────────────────────── */
/**
 * `/api/sports/matches` is served by two different implementations:
 *
 *   • rich native feed  → camelCase `{ id, event, home, away, homeCrest,
 *                         kickoff, isLive, status, score, streamId,
 *                         directSources }` (what the cards were written for)
 *   • Vercel/DB fallback → snake_case `{ provider_match_id, home_team_name,
 *                         kickoff_at, … }` with no stream URLs at all
 *
 * CinemaHub rendered the raw payload, so whenever the fallback answered the
 * cards showed "Sports Match" with no teams and the Watch button fell through
 * to the third-party iframes. Normalising both shapes into the camelCase view
 * keeps the real fixture names, crests and direct HLS sources visible.
 */
export interface FeedDirectSource {
  url: string;
  quality?: string;
  label?: string;
}

export type FeedConfidence = {
  level: 'match' | 'channel' | 'generic' | 'none';
  exact?: boolean;
  label?: string | null;
};

export interface FeedMatch {
  id: string;
  event: string;
  sport: string;
  league: string;
  home: string;
  away: string;
  homeCrest: string;
  awayCrest: string;
  kickoff: string;
  /** Pre-formatted kickoff clock from legacy feeds (e.g. "20:00"). */
  time: string;
  isLive: boolean;
  status: Match['status'];
  score: string;
  source?: string;
  streamId: string | null;
  liveDetail: string;
  venue: string | null;
  directSources: FeedDirectSource[];
  liveConfidence: FeedConfidence | null;
  /**
   * Fixture-locked embed URL for THIS match (embed.st/embed/<source>/<id>/1).
   * Built from the authoritative `streamSources` source/id pair — the match id
   * is NOT a stream id and `embed.st/embed/admin/<matchId>` 404s.
   */
  exactEmbedUrl: string | null;
}

// The DB fallback uses 'Home'/'Home Team'/'Away Team' placeholders when the
// upstream row had no name. Showing those as real clubs is worse than hiding.
const PLACEHOLDER_TEAM = /^(home|away)(\s*team)?$/i;
const cleanTeam = (value: unknown): string => {
  const s = value == null ? '' : String(value).trim();
  return PLACEHOLDER_TEAM.test(s) ? '' : s;
};

function normalizeDirectSources(raw: RawMatch): FeedDirectSource[] {
  const list = Array.isArray(raw.directSources)
    ? raw.directSources
    : Array.isArray(raw.direct_sources) ? raw.direct_sources : [];
  return list
    .map((entry: unknown): FeedDirectSource => {
      if (typeof entry === 'string') return { url: entry };
      const o = (entry || {}) as RawMatch;
      return {
        url: String(firstValue(o.url, o.src, o.link, '') ?? ''),
        quality: o.quality ? String(o.quality) : undefined,
        label: o.label ? String(o.label) : undefined,
      };
    })
    .filter(s => /^https?:\/\//i.test(s.url));
}

function normalizeFeedConfidence(raw: RawMatch): FeedConfidence | null {
  const c = raw.liveConfidence ?? raw.live_confidence;
  if (!c || typeof c !== 'object') return null;
  const level = String((c as RawMatch).level || '').toLowerCase();
  if (!['match', 'channel', 'generic', 'none'].includes(level)) return null;
  return {
    level: level as FeedConfidence['level'],
    exact: !!(c as RawMatch).exact,
    label: (c as RawMatch).label ? String((c as RawMatch).label) : null,
  };
}

export function normalizeFeedMatch(raw: RawMatch): FeedMatch {
  const base = normalizeMatch(raw);
  const home = cleanTeam(base.home_team_name);
  const away = cleanTeam(base.away_team_name);
  const isLive = base.status === 'live';
  const explicitScore = firstValue(raw.score, raw.result);
  const hasScore = base.home_score !== 0 || base.away_score !== 0;
  const streamId = firstValue(raw.streamId, raw.stream_id, raw.exactStreamId, raw.exact_stream_id);

  // Exact-match embed: streamed.st per-match embed URL. Prefer the derived URL
  // from the first source/id pair, but fall back to the admin/<matchId> format
  // when the exact sources are unavailable (the admin URL 404s, which is why
  // this fix was needed in the first place).
  const firstSource = Array.isArray(raw.streamSources) && raw.streamSources.length
    ? raw.streamSources[0]
    : null;
  const exactEmbedUrl = firstSource
    ? `https://embed.st/embed/${String(firstSource.source)}/${String(firstSource.id)}/1`
    : (raw.streamId ? `https://embed.st/embed/admin/${raw.streamId}/1` : null);

  return {
    id: base.provider_match_id,
    event: String(firstValue(raw.event, raw.title, '') ?? '') ||
      (home && away ? `${home} vs ${away}` : home || away || 'Sports Match'),
    sport: String(firstValue(raw.sport, raw.sport_name, raw.discipline, 'Sports') ?? 'Sports'),
    league: base.competition_name,
    home,
    away,
    homeCrest: base.home_team_crest,
    awayCrest: base.away_team_crest,
    kickoff: base.kickoff_at,
    time: String(firstValue(raw.time, raw.startTime, '') ?? ''),
    isLive,
    status: base.status,
    score: explicitScore != null && explicitScore !== ''
      ? String(explicitScore)
      : (hasScore ? `${base.home_score}-${base.away_score}` : ''),
    source: base.source,
    streamId: streamId == null || streamId === '' ? null : String(streamId),
    liveDetail: base.minute,
    venue: base.venue ?? null,
    directSources: normalizeDirectSources(raw),
    liveConfidence: normalizeFeedConfidence(raw),
    // Exact-match embed URL (fixture-locked player source). Derived from the
    // authoritative streamSources pair; falls back to the legacy admin/<matchId>
    // format which 404s, but is kept for backward compatibility.
    exactEmbedUrl,
  };
}

export function normalizeFeedMatches(payload: unknown): FeedMatch[] {
  return payloadList(payload)
    .map(normalizeFeedMatch)
    .filter(m => m.id || m.home || m.away || m.event);
}
