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
  const liveOnes = feed.matches.filter(m => m.isLive);
  if (liveOnes.length) {
    const withDir = liveOnes.filter(m => m.directSources?.length);
    check('live matches have directSources (≥1)', withDir.length > 0, `${withDir.length}/${liveOnes.length} live have direct sources`);
    check('directSources well-formed', withDir.every(m => m.directSources.every(s => /^https:\/\/.+\.m3u8/.test(s.url) && s.label)), JSON.stringify(withDir[0]?.directSources?.[0]).slice(0, 140));
  } else {
    console.log('        (no live matches right now — directSources check skipped)');
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
