const { test } = require('node:test');
const assert = require('node:assert/strict');

const auto = require('../services/seoAutocomplete');
const areaBot = require('../services/areaExpansionBot');
const traffic = require('../services/trafficBot');
const runner = require('../services/seoBotsRunner');

function jsonFetcher(payloadFor) {
  return async url => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify(payloadFor(url))
  });
}

test('normalizeTerm lowercases, strips markup and clamps length', () => {
  assert.equal(auto.normalizeTerm('  <b>Lagos</b>  NEWS | Today  '), 'lagos news today');
  assert.equal(auto.normalizeTerm('“RealSSA”').includes('"'), false);
  assert.ok(auto.normalizeTerm('x'.repeat(200)).length <= 90);
  assert.equal(auto.titleCase('realssa news lagos'), 'Realssa News Lagos');
});

test('branded variants always contain the site brand and are unique', () => {
  const variants = auto.brandVariants('Lagos');
  assert.ok(variants.length >= 3);
  assert.ok(variants.every(item => item.term.includes('realssa')));
  const terms = variants.map(item => item.term);
  assert.equal(new Set(terms).size, terms.length);
  assert.equal(auto.brandVariants('')[0], undefined);
});

test('engine suggestion payloads from Google/Bing and DuckDuckGo are parsed', () => {
  assert.deepEqual(
    auto.parseOsjsonPayload('["lagos",["lagos news","lagos state news"]]'),
    ['lagos news', 'lagos state news']
  );
  assert.deepEqual(
    auto.parseDuckDuckGoPayload('[{"phrase":"lagos traffic"},{"phrase":"lagos market"}]'),
    ['lagos traffic', 'lagos market']
  );
  assert.deepEqual(auto.parseOsjsonPayload('not-json'), []);
});

test('ranked suggestions always surface RealSSA and de-duplicate terms', () => {
  const ranked = auto.rankSuggestions('lagos', [
    { term: 'lagos news', score: 200, source: 'engine' },
    { term: 'LAGOS NEWS', score: 50, source: 'engine' },
    { term: 'realssa lagos', score: 10, source: 'learned' }
  ], 6);
  assert.ok(ranked[0].term.includes('realssa'));
  assert.equal(ranked.filter(item => item.term === 'lagos news').length, 1);
  assert.ok(ranked.some(item => item.term === 'realssa lagos'));
});

test('suggest() works without a database and merges live engine terms', async () => {
  const result = await auto.suggest(null, 'Kumasi', {
    limit: 6,
    fetcher: jsonFetcher(() => ['kumasi', ['kumasi news', 'kumasi weather']]),
    timeoutMs: 50
  });
  assert.equal(result.query, 'kumasi');
  assert.ok(result.site.length > 0);
  assert.ok(result.site[0].term.includes('realssa'));
  assert.ok(result.terms.includes('kumasi news'));
  assert.ok(result.site.every(item => item.url.startsWith('https://')));
  assert.deepEqual(result.articles, []);
});

test('headline harvesting produces suggestible phrases without stopwords', () => {
  const phrases = auto.recentHeadlinePhrases([
    'Lagos opens new rail line - Punch',
    'Super Eagles beat Ghana in AFCON qualifier'
  ]);
  const terms = phrases.map(item => item.term);
  assert.ok(terms.includes('lagos opens new rail line'));
  assert.ok(terms.includes('lagos news'));
  assert.equal(terms.includes('news'), false);
});

test('area registry covers countries, cities, states and category hubs', () => {
  const areas = areaBot.buildAreas();
  const slugs = areas.map(area => area.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.ok(areas.length > 250);
  for (const slug of ['country:nigeria', 'city:lagos', 'city:kumasi', 'state:lagos', 'category:sports']) {
    assert.ok(slugs.includes(slug), slug);
  }
  const lagos = areas.find(area => area.slug === 'city:lagos');
  assert.equal(areaBot.areaUrl(lagos), 'https://www.realssanews.com.ng/city/lagos');
  assert.ok(areaBot.keywordVariants('Kumasi').includes('news in kumasi'));
});

test('traffic session plan stays on the site and includes area + article pages', () => {
  const plan = traffic.sessionPlan(
    { slug: 'city:lagos', name: 'Lagos', path: '/city/lagos' },
    [{ id: 41, title: 'Lagos story' }],
    { size: 4, baseUrl: 'https://example.test' }
  );
  assert.ok(plan.length <= 4);
  assert.ok(plan.every(step => step.url.startsWith('https://example.test/')));
  assert.ok(plan.some(step => step.path === '/city/lagos'));
  assert.ok(plan.some(step => step.path === '/article/rss-41'));
});

test('internal links are restricted to the session origin', () => {
  const html = `
    <a href="/article/rss-1">internal</a>
    <a href="https://publisher.test/story">external</a>
    <a href="/assets/app.js">asset</a>
    <a href="/country/ghana#top">fragment</a>`;
  const links = traffic.extractInternalLinks(html, 'https://www.realssanews.com.ng/', 'https://www.realssanews.com.ng', 5);
  assert.deepEqual(links, [
    'https://www.realssanews.com.ng/article/rss-1',
    'https://www.realssanews.com.ng/country/ghana'
  ]);
});

test('runSession dwells, follows one internal link and respects the request budget', async () => {
  const seen = [];
  const fetcher = async (url, options) => {
    seen.push({ url, referer: options.headers.Referer, ua: options.headers['User-Agent'] });
    return {
      status: 200,
      headers: { get: () => 'text/html' },
      text: async () => '<a href="/country/ghana">Ghana</a>'
    };
  };
  const sleeps = [];
  const session = await traffic.runSession([
    { url: 'https://www.realssanews.com.ng/', path: '/', kind: 'home', dwellMs: 100 },
    { url: 'https://www.realssanews.com.ng/city/lagos', path: '/city/lagos', kind: 'area', dwellMs: 200 }
  ], {
    baseUrl: 'https://www.realssanews.com.ng',
    fetcher,
    sleep: async ms => { sleeps.push(ms); },
    maxRequests: 3,
    sessionIndex: 0
  });

  assert.equal(session.requests, 3);
  assert.equal(session.ok, 3);
  assert.equal(session.failed, 0);
  assert.ok(session.dwellMs >= 300);
  assert.ok(seen.every(item => item.referer && item.ua));
  assert.ok(session.events.some(event => event.path === '/country/ghana'));
  assert.ok(sleeps.length >= session.events.length - 1);
});

test('traffic cycle rotates areas and reports dwell without a database', async () => {
  const fetcher = async () => ({ status: 200, headers: { get: () => 'text/html' }, text: async () => '' });
  const report = await traffic.runTrafficCycle(null, {
    maxSessions: 2,
    fetcher,
    sleep: async () => {}
  });
  assert.equal(report.sessions, 2);
  assert.equal(report.areasVisited.length, 2);
  assert.ok(report.requests > 0);
  assert.ok(report.dwellMs > 0);
  assert.equal(report.failed, 0);
});

test('runner skips a run when another worker holds the advisory lock', async () => {
  let released = false;
  const pool = {
    query: async () => ({ rows: [] }),
    connect: async () => ({
      query: async sql => {
        if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: false }] };
        return { rows: [] };
      },
      release: () => { released = true; }
    })
  };
  assert.equal((await runner.runSeoBots(pool)).status, 'already_running');
  assert.equal(released, true);
});

test('runner executes area + traffic stages in database-less mode', async () => {
  const fetcher = async () => ({ status: 200, headers: { get: () => 'text/html' }, text: async () => '' });
  const result = await runner.runSeoBots(null, {
    stages: ['areas', 'traffic', 'suggestions'],
    fetcher,
    sleep: async () => {},
    trafficSessions: 2
  });
  assert.equal(result.status, 'no_database');
  assert.equal(result.report.areas.status, 'no_database');
  assert.ok(result.report.areas.areas > 0);
  assert.equal(result.report.traffic.sessions, 2);
  assert.equal(result.report.suggestions.status, 'no_database');
});
