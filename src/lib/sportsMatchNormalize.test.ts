import { describe, it, expect } from 'vitest';
import {
  normalizeMatches,
  normalizeFeedMatch,
  normalizeFeedMatches,
  type FeedMatch,
} from './sportsMatchNormalize';

/**
 * Fixtures are trimmed copies of real production payloads (captured from
 * /api/sports/matches). Keeping them verbatim matters: the whole bug was a
 * shape mismatch between these two representations.
 */

// Rich native feed (backend/services/sportsStreamService.js → getMatches)
const richLiveMatch = {
  id: 'db:558578',
  event: 'Parma Calcio 1913 vs Torino FC',
  sport: 'Football',
  league: '🇮🇹 Serie A',
  home: 'Parma Calcio 1913',
  away: 'Torino FC',
  homeCrest: 'https://crests.football-data.org/112.png',
  awayCrest: 'https://crests.football-data.org/586.png',
  kickoff: '2026-10-19T18:45:00.000Z',
  isLive: true,
  status: 'scheduled',
  score: '0-0',
  source: 'db',
  streamId: 'parma-vs-torino-2482206',
  liveDetail: "72'",
  venue: 'Ennio Tardini',
  liveConfidence: { level: 'match', exact: true, tier: 'team', label: 'Sportitalia Solocalcio (1080p)', score: 7 },
  exactEmbedUrl: 'https://streamed.st/embed/parma-vs-torino-2482206',
  directSources: [
    {
      url: 'https://distribution.sportitalialive.it/sportitalia/sisolocalcio_abr/playlist.m3u8',
      quality: 'Auto',
      label: 'Sportitalia Solocalcio (1080p)',
      matchScore: 7,
      sourceTier: 'team',
    },
    {
      url: 'http://primetv.cc.cd/beinfhd11/tracks-v1a1/mono.tbin.m3u8',
      quality: 'Auto',
      label: 'beIN Sports 1 (1080p)',
      matchScore: 6,
      wrongDiscipline: false,
      sourceTier: 'broadcaster',
    },
  ],
};

// Legacy DB / Vercel fallback (api/sports.js → normalizeMatch)
const legacyRow = {
  provider_match_id: '1494822',
  competition_name: 'English Premier League',
  home_team_name: 'Arsenal',
  home_team_crest: 'https://crests.football-data.org/57.png',
  away_team_name: 'Chelsea',
  away_team_crest: 'https://crests.football-data.org/61.png',
  status: 'live',
  minute: '67',
  home_score: 2,
  away_score: 1,
  kickoff_at: '2026-10-19T16:30:00.000Z',
  updated_at: '2026-10-19T17:37:00.000Z',
  match_url: 'https://www.thesportsdb.com/event/1494822',
  venue: 'Emirates Stadium',
  source: 'TheSportsDB',
};

describe('normalizeFeedMatches — rich native feed', () => {
  const matches = normalizeFeedMatches({ generatedAt: '2026-10-19T17:40:00Z', count: 1, liveCount: 1, matches: [richLiveMatch] });

  it('keeps the real fixture identity the cards render', () => {
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      id: 'db:558578',
      event: 'Parma Calcio 1913 vs Torino FC',
      sport: 'Football',
      league: '🇮🇹 Serie A',
      home: 'Parma Calcio 1913',
      away: 'Torino FC',
      homeCrest: 'https://crests.football-data.org/112.png',
      awayCrest: 'https://crests.football-data.org/586.png',
      kickoff: '2026-10-19T18:45:00.000Z',
      venue: 'Ennio Tardini',
      streamId: 'parma-vs-torino-2482206',
      liveDetail: "72'",
      score: '0-0',
    });
  });

  it('trusts isLive over a stale "scheduled" status', () => {
    expect(matches[0].isLive).toBe(true);
    expect(matches[0].status).toBe('live');
  });

  it('preserves every direct HLS source so playback can start natively', () => {
    expect(matches[0].directSources).toHaveLength(2);
    expect(matches[0].directSources[0]).toMatchObject({
      url: 'https://distribution.sportitalialive.it/sportitalia/sisolocalcio_abr/playlist.m3u8',
      label: 'Sportitalia Solocalcio (1080p)',
      quality: 'Auto',
    });
    expect(matches[0].liveConfidence).toMatchObject({ level: 'match', exact: true });
  });
});


describe('normalizeFeedMatches — legacy snake_case fallback', () => {
  it('builds the same view model from DB rows', () => {
    const [m] = normalizeFeedMatches([legacyRow]);
    expect(m).toMatchObject({
      id: '1494822',
      event: 'Arsenal vs Chelsea',
      home: 'Arsenal',
      away: 'Chelsea',
      homeCrest: 'https://crests.football-data.org/57.png',
      awayCrest: 'https://crests.football-data.org/61.png',
      league: 'English Premier League',
      kickoff: '2026-10-19T16:30:00.000Z',
      status: 'live',
      isLive: true,
      liveDetail: '67',
      score: '2-1',
      venue: 'Emirates Stadium',
      sport: 'Sports',
      streamId: null,
    });
    expect(m.directSources).toEqual([]);
  });

  it('drops placeholder team names instead of showing "Home Team"', () => {
    const [m] = normalizeFeedMatches([{
      provider_match_id: 'x1',
      home_team_name: 'Home Team',
      away_team_name: 'Away Team',
      status: 'scheduled',
      kickoff_at: '2026-10-20T18:00:00.000Z',
    }]);
    expect(m.home).toBe('');
    expect(m.away).toBe('');
    expect(m.event).toBe('Sports Match');
  });

  it('accepts the { matches: [...] } envelope for both shapes', () => {
    expect(normalizeFeedMatches({ matches: [legacyRow] })[0].home).toBe('Arsenal');
    expect(normalizeFeedMatches({ matches: [] })).toEqual([]);
    expect(normalizeFeedMatches(null)).toEqual([]);
  });
});

describe('normalizeFeedMatch — edge cases', () => {
  it('keeps camelCase crests when team names arrive snake_case', () => {
    const m = normalizeFeedMatch({
      id: 'db:1',
      home_team_name: 'Roma',
      away_team_name: 'Lazio',
      homeCrest: 'https://crests.football-data.org/100.png',
      awayCrest: 'https://crests.football-data.org/110.png',
      status: 'finished',
      home_score: 1,
      away_score: 1,
    });
    expect(m.home).toBe('Roma');
    expect(m.away).toBe('Lazio');
    expect(m.homeCrest).toBe('https://crests.football-data.org/100.png');
    expect(m.score).toBe('1-1');
    expect(m.status).toBe('finished');
    expect(m.isLive).toBe(false);
    expect(m.event).toBe('Roma vs Lazio');
  });

  it('filters non-http / malformed direct sources', () => {
    const m: FeedMatch = normalizeFeedMatch({
      event: 'A vs B',
      directSources: [
        { url: 'https://cdn.example/live.m3u8', label: 'Good' },
        { url: 'javascript:alert(1)' },
        { label: 'Missing url' },
        'https://cdn.example/second.m3u8',
        null,
      ],
    });
    expect(m.directSources.map(s => s.url)).toEqual([
      'https://cdn.example/live.m3u8',
      'https://cdn.example/second.m3u8',
    ]);
  });

  it('does not invent a stream id from a DB match page', () => {
    const m = normalizeFeedMatch({
      provider_match_id: '42',
      home_team_name: 'A',
      away_team_name: 'B',
      match_url: 'https://www.thesportsdb.com/event/42',
    });
    expect(m.streamId).toBeNull();
  });
});

describe('normalizeMatches — Sports page view', () => {
  it('still returns real team names from the rich feed', () => {
    const [m] = normalizeMatches({ matches: [richLiveMatch] });
    expect(m.home_team_name).toBe('Parma Calcio 1913');
    expect(m.away_team_name).toBe('Torino FC');
    expect(m.status).toBe('live');
    expect(m.kickoff_at).toBe('2026-10-19T18:45:00.000Z');
    expect(m.home_score).toBe(0);
    expect(m.away_score).toBe(0);
  });
});
