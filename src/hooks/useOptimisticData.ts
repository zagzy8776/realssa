/**
 * Optimistic Data Hook
 * Provides instant feedback with background revalidation
 */

import { useState, useCallback, useEffect } from "react";

/**
 * State management for optimistic UI with background revalidation
 */
export function useOptimisticData<T>(
  fetchFn: () => Promise<T>,
  initialData: T,
  options: {
    staleWhileRevalidate?: boolean;
    refreshInterval?: number;
    onError?: (error: Error) => void;
  } = {}
): {
  data: T;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
} {
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      if (!isLoading) {
        setIsRefreshing(true);
      }

      const newData = await fetchFn();
      setData(newData);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch");
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchFn, isLoading, options]);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (options.refreshInterval) {
      const interval = setInterval(refresh, options.refreshInterval);
      return () => clearInterval(interval);
    }
  }, [options.refreshInterval, refresh]);

  return { data, isLoading, isRefreshing, error, refresh, lastUpdated };
}

/**
 * Parallel data fetching hook - fetch multiple APIs simultaneously
 */
export function useParallelFetch<K extends string, T extends Record<K, unknown>>(
  fetchers: Record<K, () => Promise<unknown>>,
  initialData: Partial<T> = {}
): {
  data: Partial<T>;
  isLoading: boolean;
  isLoaded: Record<K, boolean>;
  errors: Record<K, Error | null>;
  refresh: () => Promise<void>;
  refreshKey: (key: K) => Promise<void>;
} {
  const [data, setData] = useState<Partial<T>>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState<Record<K, boolean>>({} as Record<K, boolean>);
  const [errors, setErrors] = useState<Record<K, Error | null>>({} as Record<K, Error | null>);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    const keys = Object.keys(fetchers) as K[];
    const results = await Promise.allSettled(
      keys.map((key) => fetchers[key]())
    );

    const newData: Partial<T> = {};
    const newIsLoaded: Record<K, boolean> = {} as Record<K, boolean>;
    const newErrors: Record<K, Error | null> = {} as Record<K, Error | null>;

    keys.forEach((key, index) => {
      const result = results[index];
      if (result.status === "fulfilled") {
        newData[key] = result.value;
        newIsLoaded[key] = true;
        newErrors[key] = null;
      } else {
        newData[key] = initialData[key] ?? null;
        newIsLoaded[key] = false;
        newErrors[key] = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
      }
    });

    setData((prev) => ({ ...prev, ...newData }));
    setIsLoaded(newIsLoaded);
    setErrors(newErrors);
    setIsLoading(false);
  }, [fetchers, initialData]);

  const refreshKey = useCallback(
    async (key: K) => {
      try {
        const result = await fetchers[key]();
        setData((prev) => ({ ...prev, [key]: result }));
        setIsLoaded((prev) => ({ ...prev, [key]: true }));
        setErrors((prev) => ({ ...prev, [key]: null }));
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          [key]: err instanceof Error ? err : new Error("Error"),
        }));
      }
    },
    [fetchers]
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { data, isLoading, isLoaded, errors, refresh: fetchAll, refreshKey };
}

/**
 * Cache-first hook with optional background revalidation
 */
export function useCachedData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: {
    ttl?: number;
    staleWhileRevalidate?: boolean;
  } = {}
): {
  data: T | null;
  isLoading: boolean;
  isStale: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cacheKey = `cache_${key}`;
  const ttl = options.ttl ?? 60000;
  const swrWindow = options.staleWhileRevalidate ? ttl * 3 : ttl;

  const loadFromCache = useCallback((): T | null => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const age = Date.now() - parsed.timestamp;
        if (age < swrWindow) {
          if (age >= ttl) {
            setIsStale(true);
          }
          return parsed.data;
        }
      }
    } catch {
      // Cache read failed
    }
    return null;
  }, [cacheKey, ttl, swrWindow]);

  const saveToCache = useCallback(
    (dataToSave: T) => {
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ data: dataToSave, timestamp: Date.now() })
        );
      } catch {
        // Cache write failed
      }
    },
    [cacheKey]
  );

  const refresh = useCallback(async () => {
    try {
      const result = await fetchFn();
      setData(result);
      setIsStale(false);
      setError(null);
      saveToCache(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch"));
    }
  }, [fetchFn, saveToCache]);

  useEffect(() => {
    const cached = loadFromCache();
    if (cached) {
      setData(cached);
      setIsLoading(false);
    }
    refresh();
  }, [key]);

  return { data, isLoading, isStale, error, refresh };
}
