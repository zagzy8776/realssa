// lib/api.ts
// API Integration for RealSSA
// Connects to the same-origin Vercel API on web and the configured API on native.

import { Capacitor } from '@capacitor/core';

const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';

// Browser requests stay same-origin so production does not depend on the
// separate Fly scraper service or its CORS configuration. Capacitor builds
// still use the configured absolute API URL.
const NEWS_API_URL = isNative
  ? (import.meta.env.VITE_NEWS_API_URL || 'https://www.realssanews.com.ng')
  : (browserOrigin || import.meta.env.VITE_NEWS_API_URL || 'https://www.realssanews.com.ng');

const SPORTS_API_URL = import.meta.env.VITE_SPORTS_API || 'http://localhost:3001';
const DB_API_URL = import.meta.env.VITE_DB_API || 'http://localhost:3002';

// Simple in-memory cache for API responses
const apiCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

function getCachedData(key: string): any | null {
  const cached = apiCache[key];
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > CACHE_DURATION) {
    delete apiCache[key];
    return null;
  }
  
  return cached.data;
}

function setCachedData(key: string, data: any): void {
  apiCache[key] = {
    data,
    timestamp: Date.now()
  };
}

class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchAPI<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        errorData.message || `HTTP Error: ${response.status}`,
        response.status,
        errorData
      );
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      undefined,
      error
    );
  }
}

export const newsAPI = {
  baseURL: NEWS_API_URL,

  async getNewsFeed() {
    const cacheKey = 'news-feed';
    const cached = getCachedData(cacheKey);
    if (cached) {
      console.log('Using cached news feed');
      return cached;
    }
    
    const data = await fetchAPI(`${NEWS_API_URL}/news-feed`);
    setCachedData(cacheKey, data);
    return data;
  },

  async getHealth() {
    return fetchAPI(`${NEWS_API_URL}/health`);
  },

  async getNotifications() {
    return fetchAPI(`${NEWS_API_URL}/notifications`);
  },

  async getNewsByCountry(country: string) {
    const allNews = await this.getNewsFeed();
    return Array.isArray(allNews) 
      ? allNews.filter((item: any) => 
          item.country?.toLowerCase() === country.toLowerCase()
        )
      : [];
  },

  async getNewsByCategory(category: string) {
    const allNews = await this.getNewsFeed();
    return Array.isArray(allNews)
      ? allNews.filter((item: any) => 
          item.category?.toLowerCase() === category.toLowerCase()
        )
      : [];
  },

  async getGhanaNews() { return this.getNewsByCountry('Ghana'); },
  async getNigeriaNews() { return this.getNewsByCountry('Nigeria'); },
  async getKenyaNews() { return this.getNewsByCountry('Kenya'); },
  async getSouthAfricaNews() { return this.getNewsByCountry('South Africa'); },
  async getEgyptNews() { return this.getNewsByCountry('Egypt'); },
  async getMoroccoNews() { return this.getNewsByCountry('Morocco'); },
  async getEthiopiaNews() { return this.getNewsByCountry('Ethiopia'); },

  async getAfricanNews() {
    const allNews = await this.getNewsFeed();
    const africanCountries = ['Ghana', 'Nigeria', 'Kenya', 'South Africa', 'Egypt', 'Morocco', 'Ethiopia', 'Africa'];
    return Array.isArray(allNews)
      ? allNews.filter((item: any) => africanCountries.includes(item.country))
      : [];
  },

  async getUSANews() { return this.getNewsByCountry('USA'); },
  async getUKNews() { return this.getNewsByCountry('UK'); },
  async getCanadaNews() { return this.getNewsByCountry('Canada'); },

  async getAsiaNews() {
    const allNews = await this.getNewsFeed();
    const asianCountries = ['China', 'Japan', 'Singapore', 'India'];
    return Array.isArray(allNews)
      ? allNews.filter((item: any) => asianCountries.includes(item.country))
      : [];
  },

  async getWorldNews() { return this.getNewsByCountry('Global'); },
  async getTechnologyNews() { return this.getNewsByCategory('Technology'); },
  async getBusinessNews() { return this.getNewsByCategory('Business'); },
  async getSportsNews() { return this.getNewsByCategory('Sports'); },
  async getScienceNews() { return this.getNewsByCategory('Science'); },
  async getEntertainmentNews() { return this.getNewsByCategory('Entertainment'); },
  async getPoliticsNews() { return this.getNewsByCategory('Politics'); },

  async searchNews(query: string) {
    const allNews = await this.getNewsFeed();
    const lowercaseQuery = query.toLowerCase();
    return Array.isArray(allNews)
      ? allNews.filter((item: any) => 
          item.title?.toLowerCase().includes(lowercaseQuery) ||
          item.description?.toLowerCase().includes(lowercaseQuery)
        )
      : [];
  },
};

export const sportsAPI = {
  baseURL: SPORTS_API_URL,
  async getLiveMatches() { return fetchAPI(`${SPORTS_API_URL}/api/matches/live`); },
  async getAllMatches() { return fetchAPI(`${SPORTS_API_URL}/api/matches`); },
  async getLeagues() { return fetchAPI(`${SPORTS_API_URL}/api/leagues`); },
};

export const dbAPI = {
  baseURL: DB_API_URL,
  async getUsers() { return fetchAPI(`${DB_API_URL}/api/users`); },
  async getUserProfile(userId: string) { return fetchAPI(`${DB_API_URL}/api/users/${userId}`); },
};

export const api = newsAPI;

export default {
  news: newsAPI,
  sports: sportsAPI,
  db: dbAPI,
};

export { APIError };
