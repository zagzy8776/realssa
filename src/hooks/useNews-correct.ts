// hooks/useNews.ts
// React hooks for NEWS API (C++ RSS Backend)

import { useState, useEffect, useCallback } from 'react';
import { newsAPI, APIError } from '@/lib/api-correct';

/**
 * Generic hook for API calls with automatic loading and error handling
 */
function useAPICall<T>(
  apiCall: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      setData(result);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
      console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for fetching ALL news from RSS feeds
 */
export function useNewsFeed() {
  return useAPICall(() => newsAPI.getNewsFeed());
}

/**
 * Hook for fetching breaking news notifications
 */
export function useNewsNotifications() {
  return useAPICall(() => newsAPI.getNotifications());
}

/**
 * Hook for backend health check
 */
export function useNewsHealth() {
  return useAPICall(() => newsAPI.getHealth());
}

/**
 * Hooks for news by COUNTRY
 */
export function useGhanaNews() {
  return useAPICall(() => newsAPI.getGhanaNews());
}

export function useNigeriaNews() {
  return useAPICall(() => newsAPI.getNigeriaNews());
}

export function useKenyaNews() {
  return useAPICall(() => newsAPI.getKenyaNews());
}

export function useSouthAfricaNews() {
  return useAPICall(() => newsAPI.getSouthAfricaNews());
}

export function useEgyptNews() {
  return useAPICall(() => newsAPI.getEgyptNews());
}

export function useMoroccoNews() {
  return useAPICall(() => newsAPI.getMoroccoNews());
}

export function useEthiopiaNews() {
  return useAPICall(() => newsAPI.getEthiopiaNews());
}

/**
 * Hooks for news by REGION
 */
export function useAfricanNews() {
  return useAPICall(() => newsAPI.getAfricanNews());
}

export function useUSANews() {
  return useAPICall(() => newsAPI.getUSANews());
}

export function useUKNews() {
  return useAPICall(() => newsAPI.getUKNews());
}

export function useCanadaNews() {
  return useAPICall(() => newsAPI.getCanadaNews());
}

export function useAsiaNews() {
  return useAPICall(() => newsAPI.getAsiaNews());
}

export function useWorldNews() {
  return useAPICall(() => newsAPI.getWorldNews());
}

/**
 * Hooks for news by CATEGORY
 */
export function useTechnologyNews() {
  return useAPICall(() => newsAPI.getTechnologyNews());
}

export function useBusinessNews() {
  return useAPICall(() => newsAPI.getBusinessNews());
}

export function useSportsNews() {
  return useAPICall(() => newsAPI.getSportsNews());
}

export function useScienceNews() {
  return useAPICall(() => newsAPI.getScienceNews());
}

export function useEntertainmentNews() {
  return useAPICall(() => newsAPI.getEntertainmentNews());
}

export function usePoliticsNews() {
  return useAPICall(() => newsAPI.getPoliticsNews());
}

/**
 * Hook for news by custom country
 */
export function useNewsByCountry(country: string) {
  return useAPICall(() => newsAPI.getNewsByCountry(country), [country]);
}

/**
 * Hook for news by custom category
 */
export function useNewsByCategory(category: string) {
  return useAPICall(() => newsAPI.getNewsByCategory(category), [category]);
}

/**
 * Hook for searching news
 */
export function useNewsSearch(query: string) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await newsAPI.searchNews(query);
      setResults(data);
    } catch (err) {
      setError(err instanceof APIError ? err.message : 'Search failed');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  return { results, loading, error };
}

/**
 * Hook for manual API calls (doesn't auto-fetch)
 */
export function useNewsManual() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async (apiCall: () => Promise<any>) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof APIError ? err.message : 'Error occurred';
      setError(errorMessage);
      console.error('API Error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchNews };
}