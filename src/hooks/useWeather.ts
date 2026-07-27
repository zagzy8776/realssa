import { useState, useEffect } from "react";

export interface WeatherData {
  temp: string;
  condition: string;
  location: string;
  humidity: string;
  windSpeed: string;
}

const CACHE_KEY = "realssa_weather_cache_v1";
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

type CachePayload = {
  data: WeatherData;
  fetchedAt: number;
};

let memoryCache: CachePayload | null = null;
let inFlight: Promise<WeatherData | null> | null = null;

function readCache(): CachePayload | null {
  if (memoryCache) return memoryCache;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed?.data?.temp || !parsed.fetchedAt) return null;
    memoryCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: WeatherData) {
  const payload: CachePayload = { data, fetchedAt: Date.now() };
  memoryCache = payload;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

function isFresh(cache: CachePayload | null): boolean {
  return !!cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

async function fetchFromWttr(lat?: number, lon?: number): Promise<WeatherData> {
  const query = lat !== undefined && lon !== undefined ? `${lat},${lon}` : "";
  const res = await fetch(`https://wttr.in/${query}?format=j1`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Weather API ${res.status}`);

  const data = await res.json();
  const current = data.current_condition?.[0];
  const nearestArea = data.nearest_area?.[0];
  const city = nearestArea?.areaName?.[0]?.value || "";
  const country = nearestArea?.country?.[0]?.value || "";

  if (!current?.temp_C || !city) {
    throw new Error("Incomplete weather payload");
  }

  return {
    temp: `${current.temp_C}°C`,
    condition: current.weatherDesc?.[0]?.value || "Clear",
    location: country ? `${city}, ${country}` : city,
    humidity: `${current.humidity ?? "--"}%`,
    windSpeed: `${current.windspeedKmph ?? "--"} km/h`,
  };
}

function getPosition(): Promise<GeolocationPosition | null> {
  if (!navigator.geolocation) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { timeout: 3500, enableHighAccuracy: false, maximumAge: 10 * 60 * 1000 }
    );
  });
}

async function loadWeather(): Promise<WeatherData | null> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const position = await getPosition();
      const data = position
        ? await fetchFromWttr(position.coords.latitude, position.coords.longitude)
        : await fetchFromWttr();
      writeCache(data);
      return data;
    } catch (err) {
      console.warn("Weather fetch failed:", err);
      return readCache()?.data ?? null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * Shared weather hook — caches results so header + drawer both show instantly
 * and never flash empty when the network/geo is slow.
 */
export function useWeather() {
  const cached = readCache();
  const [weather, setWeather] = useState<WeatherData | null>(cached?.data ?? null);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const existing = readCache();
      if (isFresh(existing)) {
        if (!cancelled) {
          setWeather(existing!.data);
          setLoading(false);
        }
        return;
      }

      // Stale cache still shown while we refresh
      if (existing && !cancelled) {
        setWeather(existing.data);
        setLoading(false);
      }

      const data = await loadWeather();
      if (cancelled) return;

      if (data) {
        setWeather(data);
      } else if (!existing) {
        setWeather(null);
      }
      setLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { weather, loading };
}
