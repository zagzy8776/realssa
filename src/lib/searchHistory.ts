const STORAGE_KEY = 'realssa-search-history';
const MAX_ITEMS = 8;

type SearchHistoryEntry = {
  url: string;
  title: string;
  isSearch?: boolean;
};

const readHistory = (): SearchHistoryEntry[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is SearchHistoryEntry =>
        item && typeof item === 'object' &&
        typeof item.title === 'string' &&
        typeof item.url === 'string'
      )
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
};

export const getSearchHistory = (): SearchHistoryEntry[] => readHistory();

export const saveSearchHistory = (entry: SearchHistoryEntry | string): void => {
  if (typeof window === 'undefined') return;

  const normalized: SearchHistoryEntry = typeof entry === 'string'
    ? { title: entry.trim(), url: `realssa://search?q=${encodeURIComponent(entry.trim())}`, isSearch: true }
    : entry;

  if (!normalized.title.trim()) return;

  try {
    const existing = readHistory();
    const next = [normalized, ...existing.filter(item => item.title.toLowerCase() !== normalized.title.toLowerCase())]
      .slice(0, MAX_ITEMS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Search history is an enhancement; storage failures should never break navigation.
  }
};

export const clearSearchHistory = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};

export const getHistoryMatches = (query: string): SearchHistoryEntry[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return readHistory().filter(item => item.title.toLowerCase().includes(normalized));
};
