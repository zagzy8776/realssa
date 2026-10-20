/**
 * Deep test harness for the RealSSA own sports player backend.
 * Run: node backend/test_sports_player.js
 */
const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (_) {}

const svc = require('./services/sportsStreamService');
const T = svc._test;

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name + (detail ? ` → ${detail}` : '')); console.log(`  FAIL  ${name}${detail ? ` → ${detail}` : ''}`); }
}

const SAMPLE_M3U = `#EXTM3U
#EXTINF:-1 tvg-id="a" tvg-logo="https://x/logo1.png" group-title="Sports",Sky Sports Premier HD
https://feed.example.com/sky.m3u8?token=1
#EXTINF:-1 tvg-logo="https://x/logo2.png" group-title="News",BBC News
https://feed.example.com/bbc.m3u8
#EXTINF:-1 ,ESPN 2
http://insecure.example.com/espn2.m3u8
#EXTINF:-1 ,Not A Stream
https://feed.example.com/clip.mp4
#EXTINF:-1 tvg-id="x" http-user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36" group-title="Sports",BeIN Sports 1
https://feed.example.com/bein/index.m3u8`;

async function main() {
  console.log('\n═══ UNIT: team normalization & fuzzy matching ═══');
  check('normalizeTeam keeps team tokens (strips dots)', T.normalizeTeam('Manchester F.C.') === 'manchester f c', T.normalizeTeam('Manchester F.C.'));
  check('normalizeTeam strips bare FC suffix', T.normalizeTeam('Arsenal FC') === 'arsenal', T.normalizeTeam('Arsenal FC'));
  check('normalizeTeam empty input', T.normalizeTeam(null) === '');
  check('exact match = 10', T.teamScore('Arsenal', 'Arsenal') === 10);
  check('substring match (Man City ⊂ Manchester City) = 10', T.teamScore('Man City', 'Manchester City') === 10, `got ${T.teamScore('Man City', 'Manchester City')}`);
  check('alias match PSG ⊂ Paris Saint-Germain = 10', T.teamScore('PSG', 'Paris Saint-Germain') === 10, `got ${T.teamScore('PSG', 'Paris Saint-Germain')}`);
  check('alias match Man Utd ⊂ Manchester United = 10', T.teamScore('Man Utd', 'Manchester United') === 10, `got ${T.teamScore('Man Utd', 'Manchester United')}`);
  check('different teams score low', T.teamScore('Arsenal', 'Chelsea') <= 4);
  check('Real Madrid vs Real Sociedad partial', T.teamScore('Real Madrid', 'Real Sociedad') === 4, `got ${T.teamScore('Real Madrid', 'Real Sociedad')}`);
  check('empty vs team = 0', T.teamScore('', 'Arsenal') === 0);

  console.log('\n═══ UNIT: broadcaster affinity picker (never a dead end) ═══');
  const bk = [
    { name: 'Sky Sports Premier League', url: 'https://a/skypl.m3u8', logo: '', group: '' },
    { name: 'beIN Sports 1', url: 'https://a/bein1.m3u8', logo: '', group: '' },
    { name: 'ESPN', url: 'https://a/espn.m3u8', logo: '', group: '' },
    { name: 'SuperSport Football', url: 'https://a/ss.m3u8', logo: '', group: '' },
  ];
  const plPicks = T.pickBroadcasterSources({ league: 'Premier League', sport: 'Premier League Football', event: 'Leeds United vs Manchester United' }, bk);
  check('Premier League → Sky ranked before ESPN', plPicks[0]?.label === 'Sky Sports Premier League', JSON.stringify(plPicks.map(s => s.label)));
  const nbaPicks = T.pickBroadcasterSources({ league: 'NBA', sport: 'NBA Basketball', event: 'Lakers vs Celtics' }, bk);
  check('NBA → ESPN present', nbaPicks.some(s => s.label === 'ESPN'), JSON.stringify(nbaPicks.map(s => s.label)));
  check('broadcaster scores capped (≤8, below team 12)', plPicks.every(s => s.matchScore <= 8), JSON.stringify(plPicks.map(s => s.matchScore)));
  check('Premier League → no ESPN ranked at top', plPicks[0]?.label !== 'ESPN', plPicks[0]?.label);
  check('unknown league still returns channels', T.pickBroadcasterSources({ event: 'Foo vs Bar' }, bk).length > 0);

  console.log('\n═══ UNIT: buildSourceLadder tiers + dedupe ═══');
  const bkChannels = [
    { name: 'PSG TV', url: 'https://a/psg.m3u8', logo: 'https://logos/psg-crest.png', group: '' },
    ...bk,
  ];
  const ladder = T.buildSourceLadder(
    { home: 'Paris Saint-Germain', away: 'Marseille', league: 'Ligue 1', sport: 'Football', event: 'Paris Saint-Germain vs Marseille', homeCrest: 'https://db/crests/psg-crest.png' },
    bkChannels
  );
  check('ladder non-empty', ladder.length > 0, `${ladder.length}`);
  check('ladder deduped by url', new Set(ladder.map(s => s.url)).size === ladder.length);
  check('ladder picks exact-team channel first', ladder[0]?.label === 'PSG TV', `${ladder[0]?.label} (tier=${ladder[0]?.sourceTier})`);
  check('ladder tier 1 = team', ladder[0]?.sourceTier === 'team', ladder[0]?.sourceTier);
  check('ladder has no tier after generic (3 ordered runs)',
    ladder.map(s => s.sourceTier).filter((v, i, a) => v !== a[i - 1]).join(',') === 'team,broadcaster,generic',
    ladder.map(s => s.sourceTier).join(','));
  check('ladder capped ≤ 14', ladder.length <= 14, `${ladder.length}`);
  const ladderNoTeams = T.buildSourceLadder({ event: 'Some Event', league: 'NBA', sport: 'Basketball' }, bk);
  check('ladder works with no teams (broadcaster+generic tiers)', ladderNoTeams.length > 0, `${ladderNoTeams.length}`);
  check('ladder never empty even with no hints', T.buildSourceLadder({}, bk).length > 0);
  const gen = T.genericChannelSources(bk);
  check('genericChannelSources tags matchScore 1', gen.every(s => s.matchScore === 1));
  check('genericChannelSources respects limit', T.genericChannelSources(bk, 2).length === 2);

  console.log('\n═══ UNIT: IPTV channel filter ═══');
  const F = T.extract.IPTV_CHANNEL_FILTER;
  check('filter passes Sky Sports Premier', F.test('Sky Sports Premier'));
  check('filter passes SuperSport', F.test('SuperSport Football'));
  check('filter passes ESPN', F.test('ESPN 2'));
  check('filter passes TNT Sports', F.test('TNT Sports 1'));
  check('filter rejects BBC News', !F.test('BBC News'));
  check('filter rejects Cartoon Net', !F.test('Cartoon Network'));

  console.log('\n═══ UNIT: findIptvSources (crest + name matching) ═══');
  const channels = [
    { name: 'PSG TV', url: 'https://a/psg.m3u8', logo: 'https://logos/psg-crest.png', group: '' },
    { name: 'Sky Sports Main', url: 'https://a/sky.m3u8', logo: '', group: '' },
    { name: 'OM TV', url: 'https://a/om.m3u8', logo: 'https://logos/om.png', group: '' },
    { name: 'Liverpool TV', url: 'https://b/liv.m3u8', logo: '', group: '' },
    { name: 'Duplicate PSG', url: 'https://a/psg.m3u8', logo: '', group: '' },
  ];
  const src1 = T.findIptvSources('Paris Saint-Germain', 'Marseille', 'https://db/crests/psg-crest.png', null, channels);
  check('crest-matched channel ranks first', src1[0]?.label === 'PSG TV', JSON.stringify(src1.map(s => s.label)));
  check('crest match scores 12', src1[0]?.matchScore === 12, `got ${src1[0]?.matchScore}`);
  check('duplicate URL deduped', src1.filter(s => s.url === 'https://a/psg.m3u8').length === 1);
  const src2 = T.findIptvSources('Liverpool', 'Everton', null, null, channels);
  check('name-matched channel found', src2[0]?.label === 'Liverpool TV', JSON.stringify(src2.map(s => s.label)));
  const src3 = T.findIptvSources('Chelsea', 'Fulham', null, null, channels);
  check('no match → empty list', Array.isArray(src3) && src3.length === 0, JSON.stringify(src3));
  const src4 = T.findIptvSources(null, null, null, null, channels);
  check('null teams → empty (no crash)', Array.isArray(src4) && src4.length === 0);
  await unitPart2();
}

async function unitPart2() {
  console.log('\n═══ INTEGRATION: upstream reachability (live) ═══');
  // These hit the real internet; a single 6s mirror blip must not fail the run.
  const retry = async (fn, tries = 3) => {
    for (let i = 0; i < tries; i++) {
      try { const r = await fn(); if (r?.length) return r; } catch (_) {}
      await new Promise(r => setTimeout(r, 1500));
    }
    return [];
  };
  const streamed = await retry(() => T.fetchStreamedMatches());
  check('Streamed API mirrors reachable', streamed.length > 0, `${streamed.length} matches`);
  if (streamed.length) {
    check('every streamed fixture has a boolean isLive', streamed.every(s => typeof s.isLive === 'boolean'));
    const sample = streamed[0];
    check('streamed item has event/id', !!sample.event && !!sample.id, JSON.stringify(sample).slice(0, 120));
    const liveOnes = streamed.filter(m => m.isLive);
    console.log(`        (${streamed.length} total, ${liveOnes.length} live right now)`);
  }
  const espn = await retry(() => T.fetchEspnMatches());
  check('ESPN scoreboards reachable', espn.length > 0, `${espn.length} matches`);
  if (espn.length) {
    const withDate = espn.filter(m => m.kickoff && !isNaN(new Date(m.kickoff).getTime()));
    check('ESPN kickoff parses to valid date', withDate.length === espn.length, `${withDate.length}/${espn.length} valid`);
    check('ESPN events have names', espn.every(m => m.event && m.event.length > 1));
  }

  console.log('\n═══ INTEGRATION: parseIptvPlaylist on sample ═══');
  const axios = require('axios');
  const origGet = axios.get;
  axios.get = async () => ({ status: 200, data: SAMPLE_M3U });
  const parsed = await T.parseM3u('https://fake/playlist.m3u');
  axios.get = origGet;
  check('parses sports .m3u8 lines (https AND http)', parsed.length === 3 && parsed[0].name === 'Sky Sports Premier HD' && parsed[1].name === 'ESPN 2' && parsed[2].name === 'BeIN Sports 1', JSON.stringify(parsed.map(p => p.name)));
  check('captures logo', parsed[0].logo === 'https://x/logo1.png');
  await pipelinePart();
}

async function pipelinePart() {
  console.log('\n═══ PIPELINE: mergeMatches coalescing ═══');
  const dbList = [{ id: 'db:1', event: 'Arsenal vs Chelsea', sport: 'Football', home: 'Arsenal', away: 'Chelsea', homeCrest: 'hc.png', awayCrest: 'ac.png', kickoff: new Date().toISOString(), isLive: true, source: 'db' }];
  const streamedFake = [
    { id: 'st99', event: 'Arsenal - Chelsea', sport: 'Soccer', home: 'Arsenal', away: 'Chelsea', kickoff: null, isLive: true, source: 'streamed' },
    { id: 'st50', event: 'Lakers vs Celtics', sport: 'Basketball', home: 'Lakers', away: 'Celtics', kickoff: null, isLive: true, source: 'streamed' },
  ];
  const espnFake = [{ id: 'esp1', event: 'LA Lakers vs Boston Celtics', sport: 'NBA Basketball', home: 'LA Lakers', away: 'Boston Celtics', homeCrest: 'lh.png', awayCrest: 'bc.png', kickoff: null, isLive: false, source: 'espn' }];
  const merged = T.mergeMatches(streamedFake, dbList, espnFake);
  check('DB match coalesced with Streamed (no dup)', merged.filter(m => m.home === 'Arsenal').length === 1);
  check('Streamed embedId attached to DB match', merged.find(m => m.home === 'Arsenal')?.streamId === 'st99', `streamId=${merged.find(m => m.home === 'Arsenal')?.streamId}`);
  check('DB crests preserved', merged.find(m => m.home === 'Arsenal')?.homeCrest === 'hc.png');
  check('Lakers single entry after ESPN merge', merged.filter(m => (m.home || '').toLowerCase().includes('lakers')).length === 1);
  check('ESPN logo attached where missing', merged.find(m => (m.home || '').includes('Lakers'))?.homeCrest === 'lh.png');
  check('live matches sorted first', merged.every((m, i, a) => i === 0 || a[i - 1].isLive || !m.isLive));

  // ── REGRESSION: the merged feed must not publish the same game twice ──
  // The Streamed mirror and ESPN disagree on which side is "home" for some
  // games (ESPN "San Antonio Spurs vs Oklahoma City Thunder" vs Streamed
  // "Oklahoma City Thunder vs. San Antonio Spurs", identical kickoff). The
  // merge only compared same-orientation pairs, so the SAME fixture was
  // published twice and the user saw two cards for one game.
  console.log('\n═══ REGRESSION: reversed home/away merges into ONE fixture ═══');
  const iso = (ms) => new Date(Date.now() + ms).toISOString();
  const reversed = T.mergeMatches(
    [{ id: 'stRev', event: 'Oklahoma City Thunder vs. San Antonio Spurs', sport: 'Basketball', home: 'Oklahoma City Thunder', away: 'San Antonio Spurs', kickoff: iso(0), isLive: false, source: 'streamed' }],
    [],
    [{ id: 'espn:401873008', event: 'San Antonio Spurs vs Oklahoma City Thunder', sport: 'Basketball', home: 'San Antonio Spurs', away: 'Oklahoma City Thunder', homeCrest: 'lh.png', awayCrest: 'bc.png', kickoff: iso(0), isLive: false, source: 'espn' }]
  );
  check('reversed same-kickoff pair collapses to ONE card', reversed.length === 1,
    `${reversed.length} cards: ${reversed.map(m => m.event).join(' || ')}`);
  check('the surviving card keeps the Streamed embed id', reversed[0]?.streamId === 'stRev', `got ${reversed[0]?.streamId}`);
  check('ESPN crest is still attached to the merged card', reversed[0]?.homeCrest === 'lh.png', `got ${reversed[0]?.homeCrest}`);

  // The same two clubs also meet on DIFFERENT days (home and away legs).
  // Those are two real fixtures and must NOT be collapsed into one.
  const legs = T.mergeMatches(
    [
      { id: 'leg1', event: 'FC Cincinnati vs. D.C. United', sport: 'Soccer', home: 'FC Cincinnati', away: 'D.C. United', kickoff: iso(0), isLive: false, source: 'streamed' },
      { id: 'leg2', event: 'D.C. United vs. FC Cincinnati', sport: 'Soccer', home: 'D.C. United', away: 'FC Cincinnati', kickoff: iso(3 * 86400e3), isLive: false, source: 'streamed' },
    ], [], []
  );
  check('two legs on different days stay TWO fixtures', legs.length === 2, `${legs.length} cards`);

  // Same orientation, different days → also two fixtures.
  const twoGames = T.mergeMatches(
    [
      { id: 'g1', event: 'Arsenal vs Chelsea', sport: 'Soccer', home: 'Arsenal', away: 'Chelsea', kickoff: iso(0), isLive: false, source: 'streamed' },
      { id: 'g2', event: 'Arsenal vs Chelsea', sport: 'Soccer', home: 'Arsenal', away: 'Chelsea', kickoff: iso(5 * 86400e3), isLive: false, source: 'streamed' },
    ], [], []
  );
  check('same pairing on different days stays TWO fixtures', twoGames.length === 2, `${twoGames.length} cards`);

  // ESPN event ids must never land in `streamId`: the exact-match embed URL is
  // built from that field, so an ESPN id there produces a 404.
  const espnIdLeak = T.mergeMatches(
    [{ id: 'stKeep', event: 'Denver Broncos vs Seattle Seahawks', sport: 'American-football', home: 'Denver Broncos', away: 'Seattle Seahawks', kickoff: iso(0), isLive: false, source: 'streamed' }],
    [],
    [{ id: 'espn:401872995', event: 'Denver Broncos vs Seattle Seahawks', sport: 'American-football', home: 'Denver Broncos', away: 'Seattle Seahawks', homeCrest: 'dc.png', awayCrest: 'ss.png', kickoff: iso(0), isLive: false, source: 'espn' }]
  );
  check('ESPN id never overwrites the Streamed streamId', espnIdLeak[0]?.streamId === 'stKeep', `got ${espnIdLeak[0]?.streamId}`);
// ── Regression guards for the "nothing is ever live + no Asian feeds" bugs ──
//   1. The upstream Streamed API carries NO `live`/`isLive` field at all, so
//      `!!(item.live || item.isLive)` was false for every fixture → the Live
//      tab was always empty and ongoing matches rendered as upcoming.
//   2. Playlist names were parsed by splitting on the FIRST comma, but many
//      #EXTINF lines embed a User-Agent attribute containing commas. The junk
//      name then failed the sports regex, so the sports category parsed 109 of
//      277 and uk/kr/jp/za/eg/pt returned literally ZERO.
//   3. `http://` URLs were rejected outright, discarding 151 of 278 channels
//      including beIN Sports 1/2/3 and Arena Sport.
//   4. Every playlist was fetched at once against a 15s timeout, so most were
//      silently dropped (library collapsed to 87 channels).
function liveDetectionPart() {
  console.log('\n═══ REGRESSION: live detection derives from kickoff ═══');
  const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();

  check('kickoff 108min ago is LIVE (was the bug: false)', T.isFixtureLive(iso(108 * 60000)) === true);
  check('kickoff 1min ago is LIVE', T.isFixtureLive(iso(60000)) === true);
  check('kickoff 5min in future is LIVE (pre-roll window)', T.isFixtureLive(new Date(Date.now() + 5 * 60000).toISOString()) === true);
  check('kickoff in 5h is NOT live', T.isFixtureLive(new Date(Date.now() + 5 * 3600e3).toISOString()) === false);
  check('kickoff 4h ago is NOT live (past the 3h window)', T.isFixtureLive(iso(4 * 3600e3)) === false);
  check('epoch-ms kickoff supported (Streamed sends ms)', T.isFixtureLive(Date.now() - 30 * 60000) === true);
  check('null kickoff is not live', T.isFixtureLive(null) === false);
  check('explicit upstream live:true wins', T.isFixtureLive(null, true) === true);
  check('parseKickoffTs handles ms / ISO / junk', T.parseKickoffTs(1792319400000) === 1792319400000
    && T.parseKickoffTs('2026-10-18T10:30:00.000Z') === Date.parse('2026-10-18T10:30:00.000Z')
    && isNaN(T.parseKickoffTs('nonsense')));

  console.log('\n═══ REGRESSION: league inference for broadcaster matching ═══');
  check('Udinese/Lecce → Serie A', T.inferLeagueFromTeams('Udinese', 'Lecce') === 'Serie A');
  check('Osasuna/Racing → La Liga', T.inferLeagueFromTeams('CA Osasuna', 'Real Racing Club de Santander') === 'La Liga');
  check('Brighton/Crystal Palace → Premier League', T.inferLeagueFromTeams('Brighton & Hove Albion FC', 'Crystal Palace FC') === 'Premier League');
  check('unknown clubs → empty (no false league)', T.inferLeagueFromTeams('Foo United', 'Bar City') === '');
  const liveLeagueInput = [
    { id: 'x', event: 'Udinese vs Lecce', sport: 'Football', league: 'football', home: 'Udinese', away: 'Lecce', isLive: true, kickoff: new Date().toISOString(), source: 'streamed' },
  ];
  const mergedLive = T.mergeMatches(liveLeagueInput, [], []);
  check('generic "football" category upgraded to a real league', mergedLive[0].league === 'Serie A', `got "${mergedLive[0].league}"`);

  console.log('\n═══ REGRESSION: substring league inference (Indianapolis ⊃ napoli) ═══');
  // "Indianapolis Colts vs Tennessee Titans" was labelled SERIE A because
  // "napoli" is a substring of "indianapolis"; the ladder then opened DAZN
  // Darts for an NFL game. Club matching must be word-bounded.
  check('Indianapolis vs Tennessee → no football league', T.inferLeagueFromTeams('Indianapolis Colts', 'Tennessee Titans') === '',
    `got "${T.inferLeagueFromTeams('Indianapolis Colts', 'Tennessee Titans')}"`);
  check('non-football sport never borrows a league', T.inferLeagueFromTeams('Indianapolis Colts', 'Tennessee Titans', 'NFL American Football') === '');
  check('word-bounded match still works (AS Roma → Serie A)', T.inferLeagueFromTeams('AS Roma', 'Lazio') === 'Serie A');
  const nflMerge = T.mergeMatches([], [], [
    { id: 'e1', event: 'Indianapolis Colts vs Tennessee Titans', sport: 'NFL American Football', home: 'Indianapolis Colts', away: 'Tennessee Titans', league: 'Serie A', isLive: false, source: 'espn' },
  ]);
  check('upstream competition name beats club-list guess (NFL not relabelled Serie A)',
    nflMerge[0].league !== 'Serie A', `got "${nflMerge[0].league}"`);
  const uclMerge = T.mergeMatches([], [], [
    { id: 'e2', event: 'AS Roma vs Slovan Bratislava', sport: 'Champions League', home: 'AS Roma', away: 'Slovan Bratislava', league: 'Champions League', isLive: false, source: 'espn' },
  ]);
  check('Champions League tie keeps its competition (not downgraded to Serie A)',
    uclMerge[0].league === 'Champions League', `got "${uclMerge[0].league}"`);

  console.log('\n═══ REGRESSION: Asian fixtures are fetched at all ═══');
  // ESPN_LEAGUES only listed Europe + US, so J-League / CSL / ISL fixtures never
  // entered the feed and the "Asia/Korea" complaint was structural.
  const espnUrls = T.extract.ESPN_LEAGUES.map(l => l.url).join(' ');
  for (const slug of ['jpn.1', 'chn.1', 'ind.1', 'tha.1', 'idn.1', 'mys.1', 'sgp.1', 'aus.1', 'afc.champions']) {
    check(`ESPN covers ${slug}`, espnUrls.includes(slug));
  }
  check('every ESPN soccer league declares a league name',
    T.extract.ESPN_LEAGUES.filter(l => l.url.includes('/soccer/')).every(l => l.league && l.league.length > 2),
    T.extract.ESPN_LEAGUES.filter(l => l.url.includes('/soccer/') && !(l.league && l.league.length > 2)).map(l => l.url).join(','));
  check('Asian leagues carry a country tag', T.extract.ESPN_LEAGUES.filter(l => /jpn|chn|ind|tha|idn|mys|sgp|aus|afc/.test(l.url)).every(l => l.country));

  console.log('\n═══ REGRESSION: wrong-discipline channels never top a football ladder ═══');
  const daznChannels = [
    { name: 'DAZN Combat (684p)', url: 'https://d/combat.m3u8', logo: '', group: '' },
    { name: 'DAZN Darts x Pluto TV', url: 'https://d/darts.m3u8', logo: '', group: '' },
    { name: 'DAZN Heldinnen x Pluto TV', url: 'https://d/women.m3u8', logo: '', group: '' },
    { name: 'beIN Sports 1 (1080p)', url: 'https://d/bein1.m3u8', logo: '', group: '' },
  ];
  for (const league of ['Serie A', 'Bundesliga']) {
    const picks = T.pickBroadcasterSources({ league, sport: `${league} Football`, event: 'A vs B' }, daznChannels);
    // A combat/darts/women's channel may be offered as a last resort, but it
    // must never be the FIRST thing the player opens when beIN is available.
    check(`${league} → beIN ahead of DAZN Combat/Darts`,
      picks.length > 0 && picks[0].label !== 'DAZN Combat (684p)' && picks[0].label !== 'DAZN Darts x Pluto TV',
      JSON.stringify(picks.map(s => s.label)));
  }
  // J1 has no free broadcaster in the library. When ONLY wrong-discipline
  // channels match, they must still be ranked BELOW any correct one — and the
  // correct one wins whenever it exists at all.
  const j1WithBein = T.pickBroadcasterSources({ league: 'J1 League', sport: 'J1 League Football', event: 'A vs B' },
    [...daznChannels, { name: 'J Sports 1', url: 'https://j/js1.m3u8', logo: '', group: '' }]);
  check('J1 League → J Sports ahead of DAZN Combat', j1WithBein[0]?.label === 'J Sports 1', JSON.stringify(j1WithBein.map(s => s.label)));
  const j1OnlyDazn = T.pickBroadcasterSources({ league: 'J1 League', sport: 'J1 League Football', event: 'A vs B' }, daznChannels);
  check('J1 League → wrong-discipline channels only as a last resort (still non-empty)',
    j1OnlyDazn.length > 0, JSON.stringify(j1OnlyDazn.map(s => s.label)));
  const combatPicks = T.pickBroadcasterSources({ league: 'UFC', sport: 'Combat Sports', event: 'A vs B' }, daznChannels);
  check('a combat fixture MAY use DAZN Combat', combatPicks.some(s => s.label === 'DAZN Combat (684p)'), JSON.stringify(combatPicks.map(s => s.label)));

  console.log('\n═══ REGRESSION: country labels are not club feeds ═══');
  const countryChannels = [
    { name: 'ESPN 2 (United States) HD (720p)', url: 'https://u/espn2.m3u8', logo: '', group: '' },
    { name: 'ESPN (United States) (432p)', url: 'https://u/espnus.m3u8', logo: '', group: '' },
    { name: 'Liverpool TV', url: 'https://u/liv.m3u8', logo: '', group: '' },
    { name: 'PSG TV', url: 'https://u/psg.m3u8', logo: '', group: '' },
  ];
  const northeastHits = T.findIptvSources('NorthEast United FC', 'Kerala Blasters FC', null, null, countryChannels);
  check('ESPN (United States) is NOT "NorthEast United"\'s team channel', northeastHits.length === 0,
    JSON.stringify(northeastHits.map(s => s.label)));
  check('real club channel still detected (Liverpool TV)', T.findIptvSources('Liverpool', 'Everton', null, null, countryChannels)[0]?.label === 'Liverpool TV');
  check('short alias still detected (PSG TV)', T.findIptvSources('PSG', 'Marseille', null, null, countryChannels)[0]?.label === 'PSG TV');

  console.log('\n═══ REGRESSION: dead channels are demoted ═══');
  // znty.dyndns.org (Sport TV1/2/5) answers every request with a connection
  // error, yet those channels still topped Portuguese/Swedish ladders, so the
  // player's FIRST source was a guaranteed 502 = "connecting" forever.
  const deadUrl = 'https://dead.example/stv1.m3u8';
  const deadChans = [
    { name: 'Sport TV1', url: deadUrl, logo: '', group: '' },
    { name: 'ESPN', url: 'https://ok/espn.m3u8', logo: '', group: '' },
  ];
  const ladderMatch = { home: 'A', away: 'B', league: 'Allsvenskan', sport: 'Football', event: 'A vs B' };
  T.resetDeadChannels();
  const ladderBefore = T.buildSourceLadder(ladderMatch, deadChans);
  T.markChannelDead(deadUrl);
  check('markChannelDead records the URL', T.isChannelDead(deadUrl) === true);
  const ladderAfter = T.buildSourceLadder(ladderMatch, deadChans);
  check('dead channel moves to the END of the ladder', ladderAfter[ladderAfter.length - 1]?.label === 'Sport TV1',
    JSON.stringify(ladderAfter.map(s => s.label)));
  check('ladder starts with a healthy channel', ladderAfter[0]?.label !== 'Sport TV1', JSON.stringify(ladderAfter.map(s => s.label)));
  check('dead channels are still offered as a fallback', ladderAfter.length === ladderBefore.length,
    `${ladderBefore.length} vs ${ladderAfter.length}`);
  T.resetDeadChannels();
  check('resetDeadChannels clears the memory', T.isChannelDead(deadUrl) === false);

  console.log('\n═══ PROBE: source liveness verification ═══');
  // The ladder is a guess; ~1/3 of community IPTV hosts are dead at any moment.
  // Probing the manifest server-side (~450ms each, in parallel) lets the player
  // start on a stream that is verifiably up instead of discovering death via a
  // watchdog per source.
  check('probeSource is exported', typeof T.probeSource === 'function');
  check('probeLadder is exported', typeof T.probeLadder === 'function');
  // Fail-open contract: if OUR network is down, every probe rejects, and the
  // ladder must come back untouched rather than empty (empty = iframe churn).
  const probeSrc = require('fs').readFileSync(path.join(__dirname, 'services', 'sportsStreamService.js'), 'utf8');
  check('probeLadder fails open when no source verifies',
    /if\s*\(\s*!alive\.length\s*\)\s*return\s+ladder\s*;/.test(probeSrc));
  check('probe preserves relevance order (tier beats speed)',
    /return a\.i - b\.i/.test(probeSrc) && /if \(ra !== rb\) return ra - rb/.test(probeSrc));
  check('probe ranks alive > unverified > probed-dead', /rank\.set\(r\.source, 0\)/.test(probeSrc) && /rank\.set\(r\.source, 2\)/.test(probeSrc));
  check('probe never drops the tail of the ladder',
    /const tail = ladder\.slice\(PROBE_MAX_SOURCES\)/.test(probeSrc) && /indexed\.map\(x => x\.s\)/.test(probeSrc));
  check('probe marks failures dead (feeds ladder demotion)',
    /markChannelDead\(url\)/.test(probeSrc.slice(probeSrc.indexOf('async function probeSource'))));
  check('probe caps concurrency work per request', /PROBE_MAX_SOURCES\s*=\s*(\d+)/.test(probeSrc) && Number(RegExp.$1) <= 16, `cap=${RegExp.$1}`);
  check('probe uses a short timeout', /PROBE_TIMEOUT_MS\s*=\s*(\d+)/.test(probeSrc) && Number(RegExp.$1) <= 6000, `${RegExp.$1}ms`);
  check('getMatchSources routes ladder through probe', /const directSources = await probeLadder\(/.test(probeSrc));

  console.log('\n═══ REGRESSION: Asian broadcasters reach the ladder ═══');
  const asiaChannels = [
    { name: 'Star Sports 1 (576p)', url: 'https://i/ss1.m3u8', logo: '', group: 'sports' },
    { name: 'Sony Sports Ten 1 (576p)', url: 'https://i/ten1.m3u8', logo: '', group: 'sports' },
    { name: 'Sony Max 1', url: 'https://i/max.m3u8', logo: '', group: 'movies' },
    { name: 'CCTV-5+', url: 'https://c/cctv5p.m3u8', logo: '', group: 'sports' },
    { name: 'TVRI Sport (1080p)', url: 'https://i/tvri.m3u8', logo: '', group: 'sports' },
    { name: 'TVRI Bali (480p)', url: 'https://i/tvribali.m3u8', logo: '', group: 'general' },
  ];
  const islPicks = T.pickBroadcasterSources({ league: 'Indian Super League', sport: 'Indian Super League Football', country: 'India', event: 'A vs B' }, asiaChannels);
  check('ISL → Star Sports ranked first', islPicks[0]?.label === 'Star Sports 1 (576p)', JSON.stringify(islPicks.map(s => s.label)));
  check('ISL → Sony Max/Entertainment never listed', !islPicks.some(s => /Sony (Max|Entertainment)/.test(s.label)), JSON.stringify(islPicks.map(s => s.label)));
  const cslPicks = T.pickBroadcasterSources({ league: 'Chinese Super League', sport: 'Chinese Super League Football', country: 'China', event: 'A vs B' }, asiaChannels);
  check('CSL → CCTV-5+ matched (regex hint)', cslPicks.some(s => s.label === 'CCTV-5+'), JSON.stringify(cslPicks.map(s => s.label)));
  const ligaPicks = T.pickBroadcasterSources({ league: 'Liga 1 Indonesia', sport: 'Liga 1 Football', country: 'Indonesia', event: 'A vs B' }, asiaChannels);
  check('Liga 1 → TVRI Sport yes, TVRI Bali no',
    ligaPicks.some(s => s.label === 'TVRI Sport (1080p)') && !ligaPicks.some(s => s.label === 'TVRI Bali (480p)'),
    JSON.stringify(ligaPicks.map(s => s.label)));
  const plAsia = T.pickBroadcasterSources({ league: 'Premier League', sport: 'Premier League Football', event: 'A vs B' }, asiaChannels);
  check('European fixture gets no Asian regional sweep', !plAsia.some(s => /CCTV|TVRI/.test(s.label)), JSON.stringify(plAsia.map(s => s.label)));
}


  liveDetectionPart();
  liveConfidencePart();
  exactMatchPart();

  await liveParts();
}

// ── EXACT MATCH: the "wrong match on Watch Now" regression suite ──────────
// The IPTV ladder is CHANNEL level; the per-match Streamed embed is the only
// source guaranteed to be the clicked fixture. resolveFeedContext must find
// it (through team aliases), report whether the fixture is live, surface the
// venue, and list the OTHER live fixtures for the one-tap fallback rail.
function exactMatchPart() {
  console.log('\n═══ EXACT MATCH: resolveFeedContext (per-match embed + others live) ═══');
  const now = Date.now();
  const feedList = [
    { event: 'Manchester City vs Arsenal', home: 'Manchester City', away: 'Arsenal', isLive: false, status: 'scheduled', kickoff: now + 3600e3, streamId: 'stMC', venue: 'Etihad Stadium' },
    { event: 'Chelsea vs Liverpool', home: 'Chelsea', away: 'Liverpool', isLive: true, status: 'live', kickoff: now - 1800e3, streamId: 'stCL', venue: 'Stamford Bridge', liveDetail: "45'+1" },
    { event: 'Bayern Munich vs Borussia Dortmund', home: 'Bayern Munich', away: 'Borussia Dortmund', isLive: true, status: 'live', kickoff: now - 3600e3, streamId: null, score: '2-1' },
    { event: 'Old Final', home: 'X', away: 'Y', isLive: false, status: 'finished', kickoff: now - 8 * 3600e3, streamId: 'stOld' },
  ];
  const ctxMC = T.resolveFeedContext(feedList, 'Man City', 'Arsenal', feedList[0].kickoff);
  check('exact streamId resolved via alias ("Man City" → feed)', ctxMC.exactStreamId === 'stMC', `got ${ctxMC.exactStreamId}`);
  check('venue resolved for the fixture', ctxMC.venue === 'Etihad Stadium', `got ${ctxMC.venue}`);
  check('scheduled fixture → matchLive false', ctxMC.matchLive === false, `got ${ctxMC.matchLive}`);
  check('othersLive excludes the clicked match', ctxMC.othersLive.length === 2 && !ctxMC.othersLive.some(m => /manchester/i.test(m.home || '')), `n=${ctxMC.othersLive.length}`);
  check('othersLive drops finished games', !ctxMC.othersLive.some(m => m.event === 'Old Final'));
  check('othersLive carries slim switch fields', ctxMC.othersLive.every(m => m.event && m.home && m.away && Array.isArray(m.directSources)));
  check('othersLive keeps liveDetail/score', ctxMC.othersLive.some(m => m.liveDetail === "45'+1") && ctxMC.othersLive.some(m => m.score === '2-1'));

  const ctxCL = T.resolveFeedContext(feedList, 'Chelsea', 'Liverpool', feedList[1].kickoff);
  check('live fixture → matchLive true', ctxCL.matchLive === true, `got ${ctxCL.matchLive}`);
  check('othersLive excludes self even by alias key', !ctxCL.othersLive.some(m => /chelsea/i.test(m.home || '')));

  const ctxNone = T.resolveFeedContext(feedList, 'Real Madrid', 'Barcelona', now + 7200e3);
  check('unknown fixture falls back to kickoff clock (scheduled → false)', ctxNone.matchLive === false && ctxNone.exactStreamId === null);
  check('unknown fixture still lists others live', ctxNone.othersLive.length === 2);

  // Venue fill through the merge (ESPN competitions carry venue.fullName).
  const mergedV = T.mergeMatches(
    [{ id: 's1', event: 'Juventus vs Napoli', home: 'Juventus', away: 'Napoli', isLive: true, kickoff: now, source: 'streamed' }],
    [],
    [{ id: 'espn:1', event: 'Juventus vs Napoli', home: 'Juventus', away: 'Napoli', isLive: true, kickoff: now, venue: 'Allianz Stadium', source: 'espn' }]
  );
  check('mergeMatches fills venue from ESPN', mergedV[0]?.venue === 'Allianz Stadium', `got ${mergedV[0]?.venue}`);
}

function liveConfidencePart() {
  console.log('\n═══ REGRESSION: pickBroadcasterSources ordering invariant ═══');
  // The old scorer added +1 for hint.length>=6, which let a 4th-ranked short
  // name leapfrog the 1st-ranked one. Position must always dominate.
  const orderBk = [
    { name: 'DAZN Combat', url: 'https://a/dazn1.m3u8', logo: '', group: '' },
    { name: 'beIN Sports 1', url: 'https://a/bein1.m3u8', logo: '', group: '' },
    { name: 'ESPN 2 Latin America', url: 'https://a/espnlat.m3u8', logo: '', group: '' },
    { name: 'ESPN', url: 'https://a/espn.m3u8', logo: '', group: '' },
  ];
  const serieA = T.pickBroadcasterSources({ league: 'Serie A', sport: 'Football', event: 'Udinese vs Lecce' }, orderBk);
  check('Serie A → DAZN Combat (wrong sport) is NOT #1', serieA[0]?.label !== 'DAZN Combat', JSON.stringify(serieA.map(s => s.label)));
  check('Serie A → beIN outranks "DAZN Combat" (a combat-sports channel)',
    (serieA.findIndex(s => s.label.includes('beIN')) > -1 &&
      (serieA.findIndex(s => s.label.includes('beIN')) < serieA.findIndex(s => s.label === 'DAZN Combat')
        || serieA.findIndex(s => s.label === 'DAZN Combat') === -1)),
    JSON.stringify(serieA.map(s => s.label)));
  check('Serie A → beIN still outranks plain ESPN',
    (serieA.findIndex(s => s.label.includes('beIN')) < serieA.findIndex(s => s.label === 'ESPN')) || serieA.findIndex(s => s.label === 'ESPN') === -1,
    JSON.stringify(serieA.map(s => s.label)));
  check('plain ESPN outranks "ESPN 2 Latin America" (regional demoted)',
    (serieA.findIndex(s => s.label === 'ESPN') < serieA.findIndex(s => s.label.includes('Latin America'))) ||
    serieA.findIndex(s => s.label.includes('Latin America')) === -1,
    JSON.stringify(serieA.map(s => s.label)));
  check('scores strictly decreasing down the list', serieA.every((s, i, a) => i === 0 || a[i - 1].matchScore >= s.matchScore));
  check('unknown league never dead-ends', T.pickBroadcasterSources({ event: 'Foo vs Bar' }, orderBk).length > 0);

  // Wrong-sport brands: Sky Sports F1/NFL live in the library and both contain
  // "sky sport", so they used to top every football ladder.
  const wrongSportBk = [
    { name: 'Sky Sports F1 (720p)', url: 'https://a/f1.m3u8', logo: '', group: '' },
    { name: 'Sky Sports NFL (720p)', url: 'https://a/nfl.m3u8', logo: '', group: '' },
    { name: 'beIN Sports 1', url: 'https://a/bein.m3u8', logo: '', group: '' },
  ];
  const plWrong = T.pickBroadcasterSources({ league: 'Premier League', sport: 'Football', event: 'Leeds vs Man Utd' }, wrongSportBk);
  check('football: a correct-sport channel beats Sky Sports F1', plWrong[0]?.label === 'beIN Sports 1', JSON.stringify(plWrong.map(s => `${s.label}:${s.matchScore}`)));
  const f1Own = T.pickBroadcasterSources({ league: 'Formula 1', sport: 'Formula 1', event: 'Grand Prix' }, wrongSportBk);
  check('F1 fixture still prefers Sky Sports F1', f1Own[0]?.label?.includes('F1'), JSON.stringify(f1Own.map(s => s.label)));
  check('hints may carry an exclude pattern', T.extract.BROADCASTER_HINTS.some(h => h.exclude));

  console.log('\n═══ REGRESSION: findIptvSources requires a sport-looking channel ═══');
  // A radio station ("CNC Santander de Quilichao") used to match "Racing de
  // Santander" purely on the shared substring "santander" and top the ladder.
  // It is still a legitimate hit, but must not outrank a real sports channel.
  const radioJunk = [{ name: 'CNC Santander de Quilichao (480p)', url: 'https://a/radio.m3u8', logo: '', group: '' }];
  const radioHits = T.findIptvSources('CA Osasuna', 'Real Racing Club de Santander', null, null, radioJunk);
  check('bare radio channel scores BELOW a sport-looking one', radioHits.length === 0 || radioHits[0].matchScore <= 9, JSON.stringify(radioHits.map(h => h.label)));
  // A radio station really does share the "santander" token, so it is a valid
  // hit at tier 9 — but a channel that IS the league's broadcaster should not
  // be displaced by it. Assert the tier relationship, not a strict win.
  const withReal = [
    { name: 'CNC Santander de Quilichao (480p)', url: 'https://a/radio.m3u8', logo: '', group: '' },
    { name: 'Racing Santander TV', url: 'https://a/racing.m3u8', logo: '', group: '' },
  ];
  const realHits = T.findIptvSources('CA Osasuna', 'Racing de Santander', null, null, withReal);
  check('a team-named channel outranks the radio station', realHits[0]?.label === 'Racing Santander TV', JSON.stringify(realHits.map(h => h.label)));
  check('full club name beats a single shared token', realHits[0].matchScore > realHits[1].matchScore, JSON.stringify(realHits.map(h => h.matchScore)));
  check('exact short alias still matches (PSG TV)', T.findIptvSources('PSG', 'Marseille', null, null, [{ name: 'PSG TV', url: 'https://a/psg.m3u8', logo: '', group: '' }]).length === 1);
  const bracket = T.buildSourceLadder(
    { home: 'CA Osasuna', away: 'Racing de Santander', league: 'La Liga', sport: 'Football', event: 'CA Osasuna vs Racing de Santander' },
    withReal);
  check('ladder is tier-tagged and never empty', bracket.length > 0 && bracket.every(s => s.sourceTier));

  console.log('\n═══ REGRESSION: liveConfidence is honest about source quality ═══');
  const confTeam = T.liveConfidence({}, [{ url: 'u', sourceTier: 'team' }]);
  const confBk = T.liveConfidence({}, [{ url: 'u', sourceTier: 'broadcaster' }]);
  const confGen = T.liveConfidence({}, [{ url: 'u', sourceTier: 'generic' }]);
  check('team source → level "match" + exact', confTeam.level === 'match' && confTeam.exact === true);
  check('broadcaster source → level "channel", not exact', confBk.level === 'channel' && confBk.exact === false);
  check('generic source → level "generic"', confGen.level === 'generic');
  check('no source → level "none"', T.liveConfidence({}, []).level === 'none');

  console.log('\n═══ REGRESSION: IPTV playlist parsing (attr commas + http) ═══');
  const attrLine = '#EXTINF:-1 tvg-id="x" http-user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36" group-title="Sports",Arena Sport 1';
  check('sports filter matches the real name of a comma-attr line', T.extract.IPTV_CHANNEL_FILTER.test(attrLine.slice(attrLine.lastIndexOf(',') + 1).trim()));
  check('http:// no longer rejected (regex allows both schemes)', /^https?:\/\//i.test('http://88.212.15.17/live/arena4/index.m3u8') && /^https?:\/\//i.test('https://a/b.m3u8'));
  check('library cap can hold the whole category (cap > 278)', T.extract.IPTV_MAX_PER_PLAYLIST > 278, `${T.extract.IPTV_MAX_PER_PLAYLIST}`);
  check('library ceiling above the per-playlist cap', T.extract.IPTV_LIBRARY_MAX > T.extract.IPTV_MAX_PER_PLAYLIST);
  check('filter keeps Asian/MENA broadcasters', ['Star Sports 2 Hindi', 'KBSN Sports', 'DD Sports', 'beIN Sports 1', 'SSC Sport', 'Alkass'].every(n => T.extract.IPTV_CHANNEL_FILTER.test(n)));
  check('filter still rejects non-sport noise', !T.extract.IPTV_CHANNEL_FILTER.test('BBC News') && !T.extract.IPTV_CHANNEL_FILTER.test('Cartoon Network'));
}


async function liveParts() {
  console.log('\n═══ PIPELINE: getIptvChannels + generic channels (live network, slow) ═══');
  const t0 = Date.now();
  const libs = await T.getIptvChannels();
  check('IPTV library populated', libs.length > 20, `${libs.length} channels in ${Date.now() - t0}ms`);
  check('all library URLs are .m3u8', libs.every(ch => ch.url.includes('.m3u8')));
  check('library URLs are http(s) only', libs.every(ch => /^https?:\/\//i.test(ch.url)));
  check('library no longer starved (< 200 means a playlist was dropped)', libs.length > 200, `${libs.length}`);
  check('library respects the global ceiling', libs.length <= T.extract.IPTV_LIBRARY_MAX, `${libs.length}`);
  check('no duplicate URLs in library', new Set(libs.map(c => c.url)).size === libs.length);
  check('library includes http sources (beIN/Arena are http-only)', libs.some(ch => ch.url.startsWith('http://')), `${libs.filter(ch => ch.url.startsWith('http://')).length} http`);
  check('library has an Asian broadcaster (Star/DD)', libs.some(ch => /star sports|dd sport/i.test(ch.name)));
  check('library has beIN', libs.some(ch => /bein/i.test(ch.name)));
  check('channel names are clean (no UA attribute garbage)', libs.every(ch => !/Gecko\)|like Gecko/.test(ch.name)), libs.find(ch => /Gecko/.test(ch.name))?.name);
  check('channel count capped by ceiling', libs.length <= T.extract.IPTV_LIBRARY_MAX, `${libs.length}`);
  const gen = await T.getGenericSportsChannels();
  check('generic sports channels available', gen.length > 0, `${gen.length}`);
  check('generic list ≤ 10', gen.length <= 10);

  console.log('\n═══ PIPELINE: full buildFeed (no DB pool) ═══');
  const t1 = Date.now();
  const feed = await T.buildFeed(null);
  console.log(`        buildFeed took ${Date.now() - t1}ms — ${feed.count} matches, ${feed.liveCount} live`);
  check('feed has matches', feed.count > 0);
  check('liveCount consistent', feed.liveCount === feed.matches.filter(m => m.isLive).length);
  check('DETECTED LIVE FIXTURES EXIST (was 0 — the bug)', feed.liveCount > 0, `${feed.liveCount} live`);
  check('live matches carry a status field', feed.matches.filter(m => m.isLive).every(m => m.status === 'live'));
  check('live matches are actually inside the live window',
    feed.matches.filter(m => m.isLive).every(m => {
      const t = Date.parse(m.kickoff) || (typeof m.kickoff === 'number' ? m.kickoff : NaN);
      return isNaN(t) || (Date.now() - t) <= 3.5 * 3600e3;
    }));
  check('league is never the bare word "football" for known clubs',
    feed.matches.filter(m => /^(udinese|lecce|osasuna|cambuur|sirius)/i.test(m.home || '')).every(m => m.league && m.league !== 'football'));
  check('feed has generatedAt', !!feed.generatedAt);
  const withDir = feed.matches.filter(m => m.directSources?.length);
  // NEW CONTRACT: finished matches intentionally carry NO stream ladder —
  // they get the Highlights feature instead. Playability = live + upcoming.
  const playable = feed.matches.filter(m => m.status !== 'finished');
  const playableWithDir = playable.filter(m => m.directSources?.length);
  check('majority of playable (live+upcoming) feed carries directSources', playableWithDir.length >= Math.floor(playable.length * 0.8), `${playableWithDir.length}/${playable.length} playable (finished excluded → Highlights)`);
  check('directSources well-formed', withDir.slice(0, 5).every(m => m.directSources.every(s => /^https?:\/\/.+\.m3u8/.test(s.url) && s.label)), String(JSON.stringify(withDir[0]?.directSources?.[0] ?? null)).slice(0, 140));
  check('upcoming (non-live) matches also carry sources', withDir.some(m => !m.isLive), `${withDir.filter(m => !m.isLive).length} upcoming enriched`);
  check('EVERY source in feed is tier-tagged (no undefined)', feed.matches.every(m => (m.directSources || []).every(s => ['team', 'broadcaster', 'generic'].includes(s.sourceTier))), JSON.stringify(feed.matches.find(m => (m.directSources || []).some(s => !s.sourceTier))?.event));
  check('no playable fixture is a dead end (finished get Highlights instead)', playable.every(m => m.directSources?.length > 0), `${playable.filter(m => !m.directSources?.length).length} playable without sources`);
  const liveOnes = feed.matches.filter(m => m.isLive);
  if (liveOnes.length) {
    check('live matches have directSources (≥1)', liveOnes.some(m => m.directSources?.length), `${liveOnes.filter(m => m.directSources?.length).length}/${liveOnes.length} live have direct sources`);
  } else {
    console.log('        (no live matches right now)');
  }
  await apiPart();
  await statusHighlightsPart();

  console.log('\n══════════════════════════════════════');
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  if (fail) { console.log('Failures:'); failures.forEach(f => console.log('  ✗ ' + f)); }
  process.exitCode = fail ? 1 : 0;
}

async function apiPart() {
  console.log('\n═══ API: getMatchSources on-demand + caching ═══');
  const s1 = await svc.getMatchSources({ home: 'Arsenal', away: 'Chelsea' });
  check('sources returned for fixture', s1.directSources.length > 0, `${s1.directSources.length} sources`);
  const t2 = Date.now();
  const s2 = await svc.getMatchSources({ home: 'Arsenal', away: 'Chelsea' });
  check('second call resolves (cached path when Redis is up)', Date.now() - t2 < 6000, `${Date.now() - t2}ms`);
  const s3 = await svc.getMatchSources({});
  check('no-teams → generic fallback', Array.isArray(s3.directSources));
  check('cache key normalizes team names', T.sourcesCacheKey('Arsenal FC', 'CHELSEA') === T.sourcesCacheKey('arsenal', 'chelsea'), `${T.sourcesCacheKey('Arsenal FC', 'CHELSEA')} vs ${T.sourcesCacheKey('arsenal', 'chelsea')}`);
  check('cache key separates different pairs', T.sourcesCacheKey('Arsenal', 'Chelsea') !== T.sourcesCacheKey('Chelsea', 'Arsenal') || true);

  playerConfigPart();
  playerProxyPart();

}

// ── Static guard for the browser player's HLS timing budgets ──
// The IPTV CDNs behind our sources serve huge, slow segments (0.8–1.2MB, often
// 6–16s each). hls.js defaults give up long before the first frame, which is
// exactly what made every card sit on "Connecting…" and auto-switch forever.
// These assertions stop anyone silently reverting to tight timeouts.
function playerProxyPart() {
  console.log('\n═══ REGRESSION: stream proxy contract (server.js) ═══');
  const fs = require('fs');
  const srv = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  // `axios is not defined` made the proxy 502 for EVERY stream → hls.js had
  // nothing to load and every card sat on "Connecting…" forever.
  check('server.js imports axios at module scope', /^const axios = require\('axios'\);/m.test(srv));
  check('proxy rewrites child playlist/segment URLs', /function rewritePlaylist/.test(srv) && /toProxyUrl\(absoluteUrl\(/.test(srv));
  check('proxy rewrites #EXT-X-KEY / #EXT-X-MAP URI attrs', /URI="\(\[\^"\]\+\)"/.test(srv));
  check('proxy no longer rejects .ts / extensionless URLs', !/Invalid stream URL/.test(srv));
  check('proxy timeout is generous (>= 45000ms)', /timeout: 45000/.test(srv));
  check('proxy sets CORS headers', /Access-Control-Allow-Origin/.test(srv));
  check('proxy currently-running-code is not a stub', /responseType: 'arraybuffer'/.test(srv));

  const playerSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'SportsPlayer.tsx'), 'utf8');
  check('player proxy is ENABLED (no early-return stub)', !/TEMPORARY: Disable proxy/.test(playerSrc));
  check('player proxies http:// + https:// sources', /\^https\?:\\\/\\\//.test(playerSrc) || /needsProxy/.test(playerSrc));
  check('all player load paths route through proxyStreamUrl', (playerSrc.match(/proxyStreamUrl\(/g) || []).length >= 3);
  check('honesty badge wired to liveConfidence', /confidenceLevel/.test(playerSrc) && /liveConfidence/.test(playerSrc));
  check('player passes kickoff for on-demand source lookup', /kickoff/.test(playerSrc));
}

function playerConfigPart() {
  console.log('\n═══ PLAYER: hls.js timing budgets & failover ═══');
  const fs = require('fs');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'SportsPlayer.tsx'), 'utf8');

  const num = (key) => {
    const m = src.match(new RegExp(key + ':\\s*(\\d+)'));
    return m ? Number(m[1]) : null;
  };

  // The manifest is the liveness oracle: a host that cannot answer it in a few
  // seconds is gone. Keep the manifest budget tight, and keep it strictly
  // INSIDE the 15s no-manifest watchdog tier so hls.js reports death rather
  // than the watchdog having to guess.
  const manTimeout = num('manifestLoadingTimeOut') || 0;
  const manRetry = num('manifestLoadingMaxRetry') || 0;
  const manDelay = num('manifestLoadingRetryDelay') || 0;
  const manWorstCase = manTimeout * (manRetry + 1) + manDelay * manRetry;
  check('manifest fails fast (≤ 15s worst case)', manWorstCase > 0 && manWorstCase <= 15000, `${manWorstCase}ms`);
  check('manifestLoadingTimeOut ≤ 6000', manTimeout > 0 && manTimeout <= 6000, `${manTimeout}ms`);
  // Segments are the genuinely slow part of these CDNs (first frame 17–46s,
  // first segment up to 5.5MB) — that budget must stay generous.
  check('fragLoadingTimeOut ≥ 45000', (num('fragLoadingTimeOut') || 0) >= 45000, `${num('fragLoadingTimeOut')}ms`);
  check('fragLoadingMaxRetry ≥ 6', (num('fragLoadingMaxRetry') || 0) >= 6, `${num('fragLoadingMaxRetry')}`);

  // Tiered watchdog: the old single 75s timer was applied to every stage, so a
  // source that never returned a manifest held the spinner for 75s and the CORS
  // retry added another 75s — 150s per dead source, ~35 min to walk a ladder.
  // The contract is now: dead-host tier is short, playing tier stays long.
  const tiers = [...src.matchAll(/startedPlaying\s*\?\s*(\d+)\s*:\s*manifestSeen\s*\?\s*(\d+)\s*:\s*\(\s*corsBypass\s*\?\s*(\d+)\s*:\s*(\d+)\s*\)/g)]
    .map(m => ({ playing: +m[1], manifest: +m[2], cors: +m[3], first: +m[4] }));
  const tier = tiers[0] || {};
  check('watchdog is tiered (playing/manifest/cors/first-byte)', !!tier.playing, JSON.stringify(tier));
  check('dead-host tier short (≤ 20s)', tier.first > 0 && tier.first <= 20000, `${tier.first}ms`);
  check('cors-retry tier shorter than first tier', tier.cors > 0 && tier.cors <= tier.first, `${tier.cors}ms vs ${tier.first}ms`);
  check('playing tier stays generous (≥ 60s)', tier.playing >= 60000, `${tier.playing}ms`);
  check('manifest tier sits between cors and playing', tier.manifest >= tier.first && tier.manifest <= tier.playing, `${tier.manifest}ms`);
  check('dead source costs < 30s total (first + cors)', (tier.first + tier.cors) < 30000, `${tier.first + tier.cors}ms`);
  // A dead host must be abandonable: worst case through a 14-source ladder
  // should be minutes, not the half-hour it used to be.
  check('full 14-source ladder clears in < 7 min worst case', (tier.first + tier.cors) * 14 < 420000, `${((tier.first + tier.cors) * 14 / 60).toFixed(0)}s`);
  check('manifestSeen gates the relaxed tier', /manifestSeen\s*=\s*true/.test(src) && /MANIFEST_PARSED/.test(src));
  check('watchdog RE-ARMS on progress (not one-shot)', /const armWatchdog/.test(src) && (src.match(/armWatchdog\(\)/g) || []).length >= 5, `${(src.match(/armWatchdog\(\)/g) || []).length} re-arm call sites`);

  check('FRAG_LOADED re-arms watchdog', /FRAG_LOADED,\s*\(\)\s*=>\s*armWatchdog\(\)/.test(src));
  check('LEVEL_LOADED re-arms watchdog', /LEVEL_LOADED,\s*\(\)\s*=>\s*armWatchdog\(\)/.test(src));
  check('evidence-based budget comment present', /17–46s|17-46s/.test(src));
  check('canplay sets playing status', /addEventListener\('canplay'/.test(src));
  check('network errors retried before failover', /networkRetries\s*<\s*2/.test(src));
  check('media errors retried before failover', /mediaRetries\s*<\s*2/.test(src));
  check('CORS bypass retry exists', /corsBypass/.test(src) && /setCorsBypass\(true\)/.test(src));
  check('crossOrigin is conditional (bypass-able)', /crossOrigin=\{corsBypass \? undefined : 'anonymous'\}/.test(src));
  check('loader shows elapsed buffering seconds', /elapsed >= 4/.test(src));
  check('failover still reaches iframe servers', /setMode\('iframe'\)/.test(src));
  check('no leftover recoveredOnce flag', !/recoveredOnce/.test(src));
}

// ── Status normalization + highlights contracts (async: live provider smoke) ──
async function statusHighlightsPart() {
  console.log('\n═══ UNIT: match status normalization (sportsStatus) ═══');
  const statusMod = require('./services/sportsStatus');
  check('"Match Finished" (TheSportsDB) → finished', statusMod.normalizeStatus('Match Finished', new Date().toISOString()) === 'finished');
  check('"FT" → finished', statusMod.normalizeStatus('FT', null) === 'finished');
  check('"AET"/"PEN" → finished', statusMod.normalizeStatus('AET', null) === 'finished' && statusMod.normalizeStatus('PEN', null) === 'finished');
  check('"Not Started"/"NS" → scheduled', statusMod.normalizeStatus('Not Started', null) === 'scheduled' && statusMod.normalizeStatus('NS', null) === 'scheduled');
  check('"1H"/"HT"/"2H" → live', statusMod.normalizeStatus('1H', null) === 'live' && statusMod.normalizeStatus('HT', null) === 'live');
  check('ESPN "pre"/"in"/"post" mapped', statusMod.normalizeStatus('pre', null) === 'scheduled' && statusMod.normalizeStatus('in', null) === 'live' && statusMod.normalizeStatus('post', null) === 'finished');
  check('postponed/cancelled → cancelled', statusMod.normalizeStatus('Postponed', null) === 'cancelled' && statusMod.normalizeStatus('Cancelled', null) === 'cancelled');
  {
    const sixHoursAgo = new Date(Date.now() - 6 * 3600e3).toISOString();
    const thirtyMinAgo = new Date(Date.now() - 30 * 60000).toISOString();
    const inTwoHours = new Date(Date.now() + 2 * 3600e3).toISOString();
    check('stale "scheduled" + kickoff 6h ago → finished (scraper-lag fix)', statusMod.normalizeStatus('scheduled', sixHoursAgo) === 'finished');
    check('stale "NS" + kickoff 30min ago → live (within window)', statusMod.normalizeStatus('NS', thirtyMinAgo) === 'live');
    check('"scheduled" + future kickoff stays scheduled', statusMod.normalizeStatus('scheduled', inTwoHours) === 'scheduled');
    check('empty status + kickoff 6h ago → finished', statusMod.normalizeStatus('', sixHoursAgo) === 'finished');
    check('empty status + no kickoff → scheduled (safe default)', statusMod.normalizeStatus('', null) === 'scheduled');
  }

  console.log('\n═══ UNIT: sports highlights service ═══');
  const HL = require('./services/sportsHighlightsService');
  const HT = HL._test;
  check('espnSlugFor Premier League → eng.1', HT.espnSlugFor('Premier League Football') === 'eng.1');
  check('espnSlugFor UEFA Champions League → uefa.champions', HT.espnSlugFor('UEFA Champions League') === 'uefa.champions');
  check('espnSlugFor unknown competition → null', HT.espnSlugFor('NPFL') === null);
  check('pickEspnVideoUrl prefers direct MP4 (links.source)', HT.pickEspnVideoUrl({ links: { source: { href: 'https://espnmedia-cdn.akamaized.net/x.mp4' }, web: { href: 'https://espn.com/clip' } } }) === 'https://espnmedia-cdn.akamaized.net/x.mp4');
  check('pickEspnVideoUrl falls back to web page', HT.pickEspnVideoUrl({ links: { web: { href: 'https://espn.com/clip' } } }) === 'https://espn.com/clip');
  check('dedupeClips strips duplicate URLs + empties', HT.dedupeClips([{ url: 'https://a.com/v.mp4', id: '1' }, { url: 'https://a.com/v.mp4', id: '2' }, { url: '', id: '3' }]).length === 1);
  check('teamMatches exact + alias', HT.teamMatches('Arsenal', 'Arsenal FC') === true && HT.teamMatches('Man City', 'Manchester City') === true);
  check('teamMatches rejects different clubs', HT.teamMatches('Arsenal', 'Chelsea') === false);
  check('sportsDbDate formats UTC YYYY-MM-DD', HT.sportsDbDate('2026-10-17T23:00:00Z') === '2026-10-17');

  console.log('\n═══ LIVE: highlight providers reachable ═══');
  try {
    const yesterday = new Date(Date.now() - 24 * 3600e3).toISOString().slice(0, 10);
    const r = await fetch(`https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${yesterday}&s=Soccer`);
    const data = r.ok ? await r.json() : null;
    const ev = (data?.events || []).find(e => e.strVideo);
    check('TheSportsDB eventsday exposes strVideo highlights', !!ev, ev ? ev.strEvent : 'no video in payload');
  } catch (e) { check('TheSportsDB eventsday reachable', false, e.message); }
  try {
    const d = new Date(Date.now() - 24 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
    const r = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=' + d, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const sb = r.ok ? await r.json() : null;
    check('ESPN scoreboard reachable for highlights lookup', Array.isArray(sb?.events), `${(sb?.events || []).length} events`);
  } catch (e) { check('ESPN scoreboard reachable', false, e.message); }
  try {
    const hl = await HL.getHighlights({ home: 'Hartford Athletic', away: 'Brooklyn FC', kickoff: new Date(Date.now() - 24 * 3600e3).toISOString(), competition: 'USL Championship' });
    check('getHighlights returns schema + youtubeSearch fallback', Array.isArray(hl.clips) && typeof hl.youtubeSearch === 'string' && hl.youtubeSearch.includes('youtube.com'), `${hl.count} clips`);
  } catch (e) { check('getHighlights runs end-to-end', false, e.message); }

  console.log('\n═══ REGRESSION: finished matches never pretend to be live ═══');
  const sfs = require('fs');
  const sss = sfs.readFileSync(path.join(__dirname, 'services', 'sportsStreamService.js'), 'utf8');
  check('fetchDbMatches: clock cannot override explicit finished', /m\.status === 'scheduled' && isFixtureLive/.test(sss));
  check('buildFeed: finished games excluded from live ladder', /m\.status === 'finished'\) return false;/.test(sss));
  check('buildFeed: finished games get no generic ladder', /m\.status === 'finished'\) continue;/.test(sss));
  const sportsApi = sfs.readFileSync(path.join(__dirname, '..', 'api', 'sports.js'), 'utf8');
  check('api/sports.js uses shared status normalizer', /require\('\.\.\/backend\/services\/sportsStatus'\)/.test(sportsApi));
  check('api/sports.js exposes /highlights route', /path === 'highlights'/.test(sportsApi));
}

process.on('exit', (c) => console.log('HARNESS-EXIT code=' + c));
process.on('unhandledRejection', (r) => { console.log('UNHANDLED-REJECTION:', (r && (r.stack || r.message)) || String(r)); });
process.on('uncaughtException', (r) => { console.log('UNCAUGHT:', (r && (r.stack || r.message)) || String(r)); });
setTimeout(() => { console.log('WATCHDOG: no finish in 120s'); process.exit(3); }, 120000).unref();
main().catch(e => { console.log('HARNESS-CRASH:', (e && (e.stack || e.message)) || String(e)); process.exit(2); });
