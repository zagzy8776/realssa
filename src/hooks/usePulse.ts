import { useEffect, useState, useCallback } from 'react';
import { apiUrl } from '@/lib/api-base';

export interface PulseRate {
  currency: string;
  buy: number | null;
  sell: number | null;
  mid: number | null;
  changePct: number;
}

export interface PulseCrypto {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
}

export interface PulseWeather {
  city: string;
  tempC: number;
  feelsLikeC: number;
  desc: string;
  icon: string;
  humidity: number;
  windKmph: number;
}

export interface PulseBreaking {
  id: number;
  title: string;
  excerpt: string;
  image: string;
  category: string;
  source: string;
  externalLink: string;
  publishedAt: string;
}

export interface PulseSentiment {
  score: number;
  label: string;
  drivers: string[];
}

export interface Pulse {
  ts: string;
  rates: PulseRate[];
  crypto: PulseCrypto[];
  weather: PulseWeather | null;
  breaking: PulseBreaking | null;
  sentiment: PulseSentiment | null;
  source: string;
}

/**
 * usePulse — single live feed for the Pulse Bar, Markets and Crypto surfaces.
 * One request to our own /api/pulse (which serves OUR scraped rates + cached
 * crypto + weather), refreshed every minute while the tab is visible.
 */
export function usePulse(refreshMs = 60000) {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/pulse'), { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as Pulse;
        if (data && Array.isArray(data.crypto)) setPulse(data);
      }
    } catch {
      // Pulse never blocks the UI — keep last known values
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = window.setInterval(() => {
      if (!document.hidden) load();
    }, refreshMs);
    return () => window.clearInterval(iv);
  }, [load, refreshMs]);

  return { pulse, loading, refresh: load };
}
