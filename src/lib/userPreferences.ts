// ============================================================
// RealSSA User Preferences Engine
// Tracks category clicks, followed topics, followed sources,
// reading history, and geo-location — all in localStorage.
// ============================================================

const PREFS_KEY = "realssa_prefs";

interface UserPrefs {
  categoryScores: Record<string, number>;
  followedTopics: string[];
  followedSources: string[];
  readingHistory: ReadingEntry[];
  geo: { country?: string; city?: string } | null;
  detectedAt?: number;
}

interface ReadingEntry {
  id: string;
  title: string;
  category: string;
  image?: string;
  externalLink?: string;
  readAt: number;
  readSeconds?: number;
}

function load(): UserPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { categoryScores: {}, followedTopics: [], followedSources: [], readingHistory: [], geo: null };
}

function save(prefs: UserPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (_) {}
}

// ----- Category Score Tracking -----
export function trackCategoryClick(category: string) {
  if (!category) return;
  const prefs = load();
  const key = category.toLowerCase();
  prefs.categoryScores[key] = (prefs.categoryScores[key] || 0) + 1;
  save(prefs);
}

export function getTopCategories(count = 3): string[] {
  const prefs = load();
  return Object.entries(prefs.categoryScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([cat]) => cat);
}

// ----- Topic Following -----
export function followTopic(topic: string) {
  const prefs = load();
  const t = topic.toLowerCase();
  if (!prefs.followedTopics.includes(t)) prefs.followedTopics.push(t);
  save(prefs);
}

export function unfollowTopic(topic: string) {
  const prefs = load();
  prefs.followedTopics = prefs.followedTopics.filter(t => t !== topic.toLowerCase());
  save(prefs);
}

export function isFollowingTopic(topic: string): boolean {
  return load().followedTopics.includes(topic.toLowerCase());
}

export function getFollowedTopics(): string[] {
  return load().followedTopics;
}

// ----- Source Following -----
export function followSource(source: string) {
  const prefs = load();
  if (!prefs.followedSources.includes(source)) prefs.followedSources.push(source);
  save(prefs);
}

export function unfollowSource(source: string) {
  const prefs = load();
  prefs.followedSources = prefs.followedSources.filter(s => s !== source);
  save(prefs);
}

export function isFollowingSource(source: string): boolean {
  return load().followedSources.includes(source);
}

export function getFollowedSources(): string[] {
  return load().followedSources;
}

// ----- Reading History -----
export function trackArticleRead(article: { id: string; title: string; category: string; image?: string; externalLink?: string }) {
  const prefs = load();
  // Prevent duplicates — bump to top if re-read
  prefs.readingHistory = prefs.readingHistory.filter(e => e.id !== article.id);
  prefs.readingHistory.unshift({ ...article, readAt: Date.now() });
  // Keep last 200 entries
  if (prefs.readingHistory.length > 200) prefs.readingHistory = prefs.readingHistory.slice(0, 200);
  save(prefs);
  // Also bump category score
  trackCategoryClick(article.category);
}

export function getReadingHistory(): ReadingEntry[] {
  return load().readingHistory;
}

export function clearReadingHistory() {
  const prefs = load();
  prefs.readingHistory = [];
  save(prefs);
}

// ----- IP Geo-Targeting -----
export async function detectAndSaveGeo(): Promise<{ country?: string; city?: string } | null> {
  const prefs = load();
  // Only refresh every 24 hours
  if (prefs.geo && prefs.detectedAt && Date.now() - prefs.detectedAt < 86400000) {
    return prefs.geo;
  }
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const geo = { country: data.country_name, city: data.city };
    prefs.geo = geo;
    prefs.detectedAt = Date.now();
    save(prefs);
    return geo;
  } catch (_) {
    return null;
  }
}

export function getSavedGeo(): { country?: string; city?: string } | null {
  return load().geo;
}
