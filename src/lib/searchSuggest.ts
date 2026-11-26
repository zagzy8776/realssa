import { apiUrl } from '@/lib/api-base';

/** A site-first suggestion returned by /api/search/suggest/v2. */
export type SiteSuggestion = {
  term: string;
  title: string;
  url: string;
  score?: number;
  sources?: string[];
  type: 'suggestion';
};

/** A matching article returned alongside the suggestions. */
export type ArticleMatch = {
  id: string;
  title: string;
  category?: string;
  image?: string;
  type: 'article';
};

export type SearchSuggestion = SiteSuggestion | ArticleMatch;

export type SuggestPayload = {
  query: string;
  terms: string[];
  site: SiteSuggestion[];
  articles: ArticleMatch[];
};

const EMPTY: SuggestPayload = { query: '', terms: [], site: [], articles: [] };

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

export const normalizeSuggestPayload = (data: unknown): SuggestPayload => {
  if (!data || typeof data !== 'object') return EMPTY;
  const record = data as Record<string, unknown>;
  const site = Array.isArray(record.site)
    ? record.site
        .map(item => (item && typeof item === 'object' ? item as Record<string, unknown> : null))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map(item => ({
          term: asString(item.term),
          title: asString(item.title) || asString(item.term),
          url: asString(item.url),
          score: typeof item.score === 'number' ? item.score : undefined,
          sources: Array.isArray(item.sources) ? item.sources.filter((src): src is string => typeof src === 'string') : [],
          type: 'suggestion' as const
        }))
        .filter(item => item.term)
    : [];
  const articles = Array.isArray(record.articles)
    ? record.articles
        .map(item => (item && typeof item === 'object' ? item as Record<string, unknown> : null))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map(item => ({
          id: asString(item.id),
          title: asString(item.title),
          category: asString(item.category) || undefined,
          image: asString(item.image) || undefined,
          type: 'article' as const
        }))
        .filter(item => item.id && item.title)
    : [];
  return {
    query: asString(record.query),
    terms: Array.isArray(record.terms) ? record.terms.filter((term): term is string => typeof term === 'string') : [],
    site,
    articles
  };
};

export const fetchSiteSuggestions = async (query: string, signal?: AbortSignal): Promise<SuggestPayload> => {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { ...EMPTY, query: trimmed };
  try {
    const response = await fetch(apiUrl(`/api/search/suggest/v2?q=${encodeURIComponent(trimmed)}`), { signal });
    if (!response.ok) return { ...EMPTY, query: trimmed };
    return normalizeSuggestPayload(await response.json());
  } catch {
    return { ...EMPTY, query: trimmed };
  }
};

/** Fire-and-forget click tracking; never blocks navigation. */
export const trackSuggestionClick = (term: string): void => {
  const trimmed = term.trim();
  if (!trimmed) return;
  try {
    fetch(apiUrl('/api/search/suggest/click'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term: trimmed }),
      keepalive: true
    }).catch(() => {});
  } catch {
    // Tracking is an enhancement; storage/network failures must never break search.
  }
};
