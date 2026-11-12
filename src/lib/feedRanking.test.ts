import { describe, it, expect, beforeEach } from 'vitest';
import { rankFeed, articleKey, getReaderProfile, rememberStory, ReaderProfile } from './feedRanking';
import { decodeHTMLEntities } from './utils';
const now = Date.parse('2026-11-12T12:00:00Z');
const pool = Array.from({length: 60}, (_, i) => ({ id: `story-${i}`, title: `Confirmed story ${i}`,
 category: ['sports','tech','culture','business'][i % 4], date: new Date(now - 3600000).toISOString(),
 externalLink: `https://publisher-${i%5}.test/story/${i}`, image: 'https://example.test/photo.jpg' }));
const profile = (seed = 'reader-one'): ReaderProfile => ({seed, interests: {}, selectedTopics: [], read: {}, impressions: {}});
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
describe('reader-specific news ranking', () => {
 it('uses interests and selected topics to produce different top stories', () => {
  const sports = rankFeed(pool, {...profile(), interests:{sports:30}, selectedTopics:['sports']}, now);
  const tech = rankFeed(pool, {...profile('reader-two'), interests:{tech:30}, selectedTopics:['tech']}, now);
  expect(sports[0].category).toBe('sports'); expect(tech[0].category).toBe('tech');
  expect(sports[0].id).not.toBe(tech[0].id);
 });
 it('new readers receive distinct but stable exploration', () => {
  const selections = Array.from({length:12}, (_, i) => rankFeed(pool, profile(`new-reader-${i}`), now)[0].id);
  expect(new Set(selections).size).toBeGreaterThan(3);
  expect(rankFeed(pool, profile(), now)).toEqual(rankFeed(pool, profile(), now));
 });
 it('demotes read and recently viewed stories without reordering a mounted feed', () => {
  const initial = rankFeed(pool, profile(), now);
  const key = articleKey(initial[0]);
  const updated = rankFeed(pool, {...profile(), read:{[key]:now}}, now);
  expect(updated[0].id).not.toBe(initial[0].id);
  expect(initial[0].id).toBe(rankFeed(pool, profile(), now)[0].id);
 });
 it('includes multiple categories and publishers despite a strong preference', () => {
  const ranked = rankFeed(pool, {...profile(), interests:{sports:100}}, now).slice(0,12);
  expect(new Set(ranked.map(a => a.category)).size).toBeGreaterThan(1);
  expect(new Set(ranked.map(a => new URL(a.externalLink).hostname)).size).toBeGreaterThan(2);
 });
 it('deduplicates tracking URLs and encoded headline variants', () => {
  const story={...pool[0],title:'&#8216;A story&#8217;'};
  const ranked=rankFeed([story,{...story,id:'duplicate',externalLink:story.externalLink+'?utm_source=share#part'},
   {...pool[1],title:'‘A story’'}],profile(),now);
  expect(ranked).toHaveLength(1);
 });
 it('expires old read penalties', () => {
  const expected = rankFeed(pool,profile(),now);
  const key=articleKey(expected[0]);
  expect(rankFeed(pool,{...profile(),read:{[key]:now-8*86400000}},now)[0]).toEqual(expected[0]);
 });
 it('persists each browser profile and bounds stored viewing history', () => {
  const first=getReaderProfile(),second=getReaderProfile();expect(first.seed).toBe(second.seed);
  for(let i=0;i<420;i++)rememberStory({...pool[0],externalLink:`https://example.test/${i}`},'read',now+i);
  expect(Object.keys(JSON.parse(localStorage.getItem('realssa_read_stories')!))).toHaveLength(400);
 });
});
it('renders decimal, hex, named and double-encoded punctuation as text', () => {
 expect(decodeHTMLEntities('&amp;#8216;The story&#x2019; &amp; more &mdash; today')).toBe('‘The story’ & more — today');
 expect(decodeHTMLEntities('&lt;script&gt;')).toBe('<script>'); // plain React text; never HTML insertion
});
