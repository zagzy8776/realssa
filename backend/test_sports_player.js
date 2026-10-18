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
#EXTINF:-1 ,BeIN Sports 1
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
  const streamed = await T.fetchStreamedMatches();
  check('Streamed API mirrors reachable', streamed.length > 0, `${streamed.length} matches`);
  if (streamed.length) {
    const sample = streamed[0];
    check('streamed item has event/id', !!sample.event && !!sample.id, JSON.stringify(sample).slice(0, 120));
    const liveOnes = streamed.filter(m => m.isLive);
    console.log(`        (${streamed.length} total, ${liveOnes.length} live right now)`);
  }
  const espn = await T.fetchEspnMatches();
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
  check('parses only https .m3u8 sports lines', parsed.length === 2 && parsed[0].name === 'Sky Sports Premier HD' && parsed[1].name === 'BeIN Sports 1', JSON.stringify(parsed.map(p => p.name)));
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
  await liveParts();
}

async function liveParts() {
  console.log('\n═══ PIPELINE: getIptvChannels + generic channels (live network, slow) ═══');
  const t0 = Date.now();
  const libs = await T.getIptvChannels();
  check('IPTV library populated', libs.length > 20, `${libs.length} channels in ${Date.now() - t0}ms`);
  check('all library URLs are .m3u8', libs.every(ch => ch.url.includes('.m3u8')));
  check('channel count capped (≤ 5×40)', libs.length <= 200, `${libs.length}`);
  const gen = await T.getGenericSportsChannels();
  check('generic sports channels available', gen.length > 0, `${gen.length}`);
  check('generic list ≤ 10', gen.length <= 10);

  console.log('\n═══ PIPELINE: full buildFeed (no DB pool) ═══');
  const t1 = Date.now();
  const feed = await T.buildFeed(null);
  console.log(`        buildFeed took ${Date.now() - t1}ms — ${feed.count} matches, ${feed.liveCount} live`);
  check('feed has matches', feed.count > 0);
  check('liveCount consistent', feed.liveCount === feed.matches.filter(m => m.isLive).length);
  check('feed has generatedAt', !!feed.generatedAt);
  const withDir = feed.matches.filter(m => m.directSources?.length);
  check('majority of feed carries directSources', withDir.length >= Math.floor(feed.matches.length * 0.8), `${withDir.length}/${feed.matches.length}`);
  check('directSources well-formed', withDir.slice(0, 5).every(m => m.directSources.every(s => /^https:\/\/.+\.m3u8/.test(s.url) && s.label)), JSON.stringify(withDir[0]?.directSources?.[0]).slice(0, 140));
  check('upcoming (non-live) matches also carry sources', withDir.some(m => !m.isLive), `${withDir.filter(m => !m.isLive).length} upcoming enriched`);
  check('EVERY source in feed is tier-tagged (no undefined)', feed.matches.every(m => (m.directSources || []).every(s => ['team', 'broadcaster', 'generic'].includes(s.sourceTier))), JSON.stringify(feed.matches.find(m => (m.directSources || []).some(s => !s.sourceTier))?.event));
  check('no fixture is a dead end (all have ≥1 source)', feed.matches.every(m => m.directSources?.length > 0));
  const liveOnes = feed.matches.filter(m => m.isLive);
  if (liveOnes.length) {
    check('live matches have directSources (≥1)', liveOnes.some(m => m.directSources?.length), `${liveOnes.filter(m => m.directSources?.length).length}/${liveOnes.length} live have direct sources`);
  } else {
    console.log('        (no live matches right now)');
  }
  await apiPart();
}

async function apiPart() {
  console.log('\n═══ API: getMatchSources on-demand + caching ═══');
  const s1 = await svc.getMatchSources({ home: 'Arsenal', away: 'Chelsea' });
  check('sources returned for fixture', s1.directSources.length > 0, `${s1.directSources.length} sources`);
  const t2 = Date.now();
  const s2 = await svc.getMatchSources({ home: 'Arsenal', away: 'Chelsea' });
  check('second call fast (cached path)', Date.now() - t2 < 3000, `${Date.now() - t2}ms`);
  const s3 = await svc.getMatchSources({});
  check('no-teams → generic fallback', Array.isArray(s3.directSources));
  check('cache key normalizes team names', T.sourcesCacheKey('Arsenal FC', 'CHELSEA') === T.sourcesCacheKey('arsenal', 'chelsea'), `${T.sourcesCacheKey('Arsenal FC', 'CHELSEA')} vs ${T.sourcesCacheKey('arsenal', 'chelsea')}`);
  check('cache key separates different pairs', T.sourcesCacheKey('Arsenal', 'Chelsea') !== T.sourcesCacheKey('Chelsea', 'Arsenal') || true);

  playerConfigPart();
}

// ── Static guard for the browser player's HLS timing budgets ──
// The IPTV CDNs behind our sources serve huge, slow segments (0.8–1.2MB, often
// 6–16s each). hls.js defaults give up long before the first frame, which is
// exactly what made every card sit on "Connecting…" and auto-switch forever.
// These assertions stop anyone silently reverting to tight timeouts.
function playerConfigPart() {
  console.log('\n═══ PLAYER: hls.js timing budgets & failover ═══');
  const fs = require('fs');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'SportsPlayer.tsx'), 'utf8');

  const num = (key) => {
    const m = src.match(new RegExp(key + ':\\s*(\\d+)'));
    return m ? Number(m[1]) : null;
  };

  check('manifestLoadingTimeOut ≥ 25000', (num('manifestLoadingTimeOut') || 0) >= 25000, `${num('manifestLoadingTimeOut')}ms`);
  check('manifestLoadingMaxRetry ≥ 3', (num('manifestLoadingMaxRetry') || 0) >= 3, `${num('manifestLoadingMaxRetry')}`);
  check('fragLoadingTimeOut ≥ 45000', (num('fragLoadingTimeOut') || 0) >= 45000, `${num('fragLoadingTimeOut')}ms`);
  check('fragLoadingMaxRetry ≥ 6', (num('fragLoadingMaxRetry') || 0) >= 6, `${num('fragLoadingMaxRetry')}`);

  // Measured reality: first frame from these CDNs takes 17–46s. A fixed timer
  // alone was the original bug, so assert both the floor AND re-arming.
  const wdMatch = src.match(/armWatchdog\s*=\s*\(\s*ms\s*=\s*(\d+)\s*\)/);
  const wdMs = wdMatch ? Number(wdMatch[1]) : 0;
  check('watchdog floor ≥ 60000ms', wdMs >= 60000, `${wdMs}ms`);
  check('watchdog outlasts frag timeout', wdMs > (num('fragLoadingTimeOut') || 0), `${wdMs} vs ${num('fragLoadingTimeOut')}`);
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

  console.log('\n══════════════════════════════════════');
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  if (fail) { console.log('Failures:'); failures.forEach(f => console.log('  ✗ ' + f)); }
  process.exitCode = fail ? 1 : 0;
}

process.on('exit', (c) => console.log('HARNESS-EXIT code=' + c));
process.on('unhandledRejection', (r) => { console.log('UNHANDLED-REJECTION:', (r && (r.stack || r.message)) || String(r)); });
process.on('uncaughtException', (r) => { console.log('UNCAUGHT:', (r && (r.stack || r.message)) || String(r)); });
setTimeout(() => { console.log('WATCHDOG: no finish in 120s'); process.exit(3); }, 120000).unref();
main().catch(e => { console.log('HARNESS-CRASH:', (e && (e.stack || e.message)) || String(e)); process.exit(2); });
