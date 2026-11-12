import { decodeHTMLEntities } from './utils';

export interface FeedArticle {
  id?: string; title: string; category?: string; date?: string; published_at?: string;
  externalLink?: string; external_link?: string; image?: string; author?: string;
  source_name?: string; story_hash?: string; storyHash?: string;
}
export interface ReaderProfile {
  seed: string; interests: Record<string, number>; selectedTopics: string[];
  read: Record<string, number>; impressions: Record<string, number>;
}
export function categoryKey(value = '') {
  value = String(value).toLowerCase().trim();
  if (value === 'nigeria' || value === 'nigerian-news') return 'nigeria';
  return value.replace(/^nigerian-/, '');
}
export function articleKey(article: FeedArticle): string {
  try {
    const url = new URL(article.externalLink || article.external_link || '');
    url.hash = '';
    for (const name of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(name)) url.searchParams.delete(name);
    return url.toString();
  } catch { return article.id || decodeHTMLEntities(article.title).toLowerCase().trim(); }
}
function storyKey(article: FeedArticle) {
  return article.story_hash || article.storyHash || decodeHTMLEntities(article.title).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}
function randomUnit(seed: string) {
  let value = 2166136261;
  for (let i = 0; i < seed.length; i++) value = Math.imul(value ^ seed.charCodeAt(i), 16777619);
  return (value >>> 0) / 4294967296;
}
function sourceKey(article: FeedArticle) {
  try { return new URL(article.externalLink || article.external_link || '').hostname.replace(/^www\./, ''); }
  catch { return article.source_name || article.author || ''; }
}
export function rankFeed<T extends FeedArticle>(articles: T[], profile: ReaderProfile, now = Date.now()): T[] {
  const seenUrls = new Set<string>(), seenStories = new Set<string>();
  const interests: Record<string, number> = {};
  for (const [category, weight] of Object.entries(profile.interests)) {
    if (Number.isFinite(weight) && weight > 0) interests[categoryKey(category)] = (interests[categoryKey(category)] || 0) + weight;
  }
  const maxInterest = Math.max(1, ...Object.values(interests));
  const topics = new Set((Array.isArray(profile.selectedTopics) ? profile.selectedTopics : []).map(categoryKey));
  const pool = articles.filter(article => {
    const key = articleKey(article), story = storyKey(article);
    if (!article.title || seenUrls.has(key) || seenStories.has(story)) return false;
    seenUrls.add(key); seenStories.add(story); return true;
  }).map(article => {
    const key = articleKey(article), category = categoryKey(article.category);
    const published = Date.parse(article.date || article.published_at || '');
    const hours = Number.isFinite(published) ? Math.max(0, (now - published) / 3600000) : 72;
    const freshness = 6 * Math.exp(-hours / 36);
    const affinity = 6 * (interests[category] || 0) / maxInterest + (topics.has(category) ? 3 : 0);
    const readAge = now - (profile.read[key] || 0);
    const impressionAge = now - (profile.impressions[key] || 0);
    const repetition = (readAge < 7 * 86400000 ? 12 : 0) + (impressionAge < 12 * 3600000 ? 4 : 0);
    // Seeded exploration gives new readers distinct, stable starting choices.
    const exploration = randomUnit(`${profile.seed}:${key}`) * 4;
    return { article, category, source: sourceKey(article), score: freshness + affinity + exploration - repetition - Math.min(12, Math.max(0, hours - 72) / 24) };
  });
  const result: T[] = [], categoryCounts = new Map<string, number>(), sourceCounts = new Map<string, number>();
  while (pool.length) {
    let best = 0, bestScore = -Infinity;
    const previous = result.slice(-2).map(a => categoryKey(a.category));
    pool.forEach((entry, index) => {
      const { category, source } = entry;
      const score = entry.score - (categoryCounts.get(category) || 0) * 0.7 - (sourceCounts.get(source) || 0) * 0.8
        - (previous.length === 2 && previous.every(value => value === category) ? 5 : 0);
      if (score > bestScore) { best = index; bestScore = score; }
    });
    const { article } = pool.splice(best, 1)[0]; result.push(article);
    const category = categoryKey(article.category), source = sourceKey(article);
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
  }
  return result;
}
const fallbackSeed = Math.random().toString(36).slice(2);
export function getReaderProfile(): ReaderProfile {
  const empty: ReaderProfile = { seed: fallbackSeed, interests: {}, selectedTopics: [], read: {}, impressions: {} };
  try {
    let device = localStorage.getItem('realssa_device_uuid');
    if (!device) { device = crypto.randomUUID(); localStorage.setItem('realssa_device_uuid', device); }
    let session = sessionStorage.getItem('realssa_feed_session');
    if (!session) { session = crypto.randomUUID(); sessionStorage.setItem('realssa_feed_session', session); }
    return { seed: `${device}:${session}`, interests: JSON.parse(localStorage.getItem('realssa_preferences') || '{}').counts || {},
      selectedTopics: JSON.parse(localStorage.getItem('realssa_user_selected_topics') || '[]'),
      read: JSON.parse(localStorage.getItem('realssa_read_stories') || '{}') || {},
      impressions: JSON.parse(localStorage.getItem('realssa_feed_impressions') || '{}') || {} };
  } catch { return empty; }
}
export function rememberStory(article: FeedArticle, kind: 'read' | 'impression', now = Date.now()) {
  const storageKey = kind === 'read' ? 'realssa_read_stories' : 'realssa_feed_impressions';
  try {
    const previous = JSON.parse(localStorage.getItem(storageKey) || '{}');
    previous[articleKey(article)] = now;
    const recent = Object.entries(previous).filter(([, at]) => typeof at === 'number' && now - at < 7 * 86400000)
      .sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 400);
    localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(recent)));
  } catch { /* Feed still works when storage is unavailable. */ }
}
