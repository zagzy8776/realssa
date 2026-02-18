// lib/api.ts
// API Integration for RealSSA
// Connects to multiple Railway backends

// Vite environment variables (use import.meta.env in Vite)
// For production, API requests are proxied through Vercel to Railway backend
const NEWS_API_URL = import.meta.env.VITE_NEWS_API_URL || '';

const SPORTS_API_URL = import.meta.env.VITE_SPORTS_API || 'http://localhost:3001';
const DB_API_URL = import.meta.env.VITE_DB_API || 'http://localhost:3002';

// Simple in-memory cache for API responses
const apiCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Get cached data or null if expired/not found
 */
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

/**
 * Set data in cache
 */
function setCachedData(key: string, data: any): void {
  apiCache[key] = {
    data,
    timestamp: Date.now()
  };
}


/**
 * API Error class for better error handling
 */
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

/**
 * Generic fetch wrapper with error handling
 */
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

/**
 * NEWS API - C++ RSS News Backend
 * Your C++ backend running on Railway
 */
export const newsAPI = {
  baseURL: NEWS_API_URL,

  /**
   * Get all news from RSS feeds
   * Endpoint: /news-feed
   * Returns all aggregated news from 100+ RSS sources
   */
  async getNewsFeed() {
    const cacheKey = 'news-feed';
    const cached = getCachedData(cacheKey);
    if (cached) {
      console.log('Using cached news feed');
      return cached;
    }
    
    // Use relative path to go through Vercel proxy
    const data = await fetchAPI('/news-feed');
    setCachedData(cacheKey, data);
    return data;
  },



  /**
   * Get health status of news backend
   * Endpoint: /health
   */
  async getHealth() {
    return fetchAPI(`${NEWS_API_URL}/health`);
  },

  /**
   * Get latest breaking news notifications (last 2 hours)
   * Endpoint: /notifications
   */
  async getNotifications() {
    return fetchAPI(`${NEWS_API_URL}/notifications`);
  },

  /**
   * Filter news by country
   * Client-side filtering since C++ backend returns all news
   */
  async getNewsByCountry(country: string) {
    const allNews = await this.getNewsFeed();
    return Array.isArray(allNews) 
      ? allNews.filter((item: any) => 
          item.country?.toLowerCase() === country.toLowerCase()
        )
      : [];
  },

  /**
   * Filter news by category
   * Client-side filtering since C++ backend returns all news
   */
  async getNewsByCategory(category: string) {
    const allNews = await this.getNewsFeed();
    return Array.isArray(allNews)
      ? allNews.filter((item: any) => 
          item.category?.toLowerCase() === category.toLowerCase()
        )
      : [];
  },

  /**
   * Get news for specific African countries
   */
  async getGhanaNews() {
    return this.getNewsByCountry('Ghana');
  },

  async getNigeriaNews() {
    return this.getNewsByCountry('Nigeria');
  },

  async getKenyaNews() {
    return this.getNewsByCountry('Kenya');
  },

  async getSouthAfricaNews() {
    return this.getNewsByCountry('South Africa');
  },

  async getEgyptNews() {
    return this.getNewsByCountry('Egypt');
  },

  async getMoroccoNews() {
    return this.getNewsByCountry('Morocco');
  },

  async getEthiopiaNews() {
    return this.getNewsByCountry('Ethiopia');
  },

  /**
   * Get news by region
   */
  async getAfricanNews() {
    const allNews = await this.getNewsFeed();
    const africanCountries = ['Ghana', 'Nigeria', 'Kenya', 'South Africa', 'Egypt', 'Morocco', 'Ethiopia', 'Africa'];
    return Array.isArray(allNews)
      ? allNews.filter((item: any) => 
          africanCountries.includes(item.country)
        )
      : [];
  },

  async getUSANews() {
    return this.getNewsByCountry('USA');
  },

  async getUKNews() {
    return this.getNewsByCountry('UK');
  },

  async getCanadaNews() {
    return this.getNewsByCountry('Canada');
  },

  async getAsiaNews() {
    const allNews = await this.getNewsFeed();
    const asianCountries = ['China', 'Japan', 'Singapore', 'India'];
    return Array.isArray(allNews)
      ? allNews.filter((item: any) => 
          asianCountries.includes(item.country)
        )
      : [];
  },

  async getWorldNews() {
    return this.getNewsByCountry('Global');
  },

  /**
   * Get news by category
   */
  async getTechnologyNews() {
    return this.getNewsByCategory('Technology');
  },

  async getBusinessNews() {
    return this.getNewsByCategory('Business');
  },

  async getSportsNews() {
    return this.getNewsByCategory('Sports');
  },

  async getScienceNews() {
    return this.getNewsByCategory('Science');
  },

  async getEntertainmentNews() {
    return this.getNewsByCategory('Entertainment');
  },

  async getPoliticsNews() {
    return this.getNewsByCategory('Politics');
  },

  /**
   * Search news by keyword
   * Client-side search
   */
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

/**
 * SPORTS API - If you have a separate sports backend on Railway
 * (Only include this if you actually have a sports API backend)
 */
export const sportsAPI = {
  baseURL: SPORTS_API_URL,

  // Add your sports endpoints here when you create the sports backend
  // For now, this is a placeholder
  
  async getLiveMatches() {
    return fetchAPI(`${SPORTS_API_URL}/api/matches/live`);
  },

  async getAllMatches() {
    return fetchAPI(`${SPORTS_API_URL}/api/matches`);
  },

  async getLeagues() {
    return fetchAPI(`${SPORTS_API_URL}/api/leagues`);
  },
};

/**
 * DATABASE API - If you have a separate PostgreSQL backend on Railway
 */
export const dbAPI = {
  baseURL: DB_API_URL,

  // Add your database endpoints here
  async getUsers() {
    return fetchAPI(`${DB_API_URL}/api/users`);
  },

  async getUserProfile(userId: string) {
    return fetchAPI(`${DB_API_URL}/api/users/${userId}`);
  },
};

/**
 * Main API export - primarily for NEWS (your C++ backend)
 */
export const api = newsAPI;

/**
 * Export all APIs
 */
export default {
  news: newsAPI,
  sports: sportsAPI,
  db: dbAPI,
};

/**
 * Export types
 */
export { APIError };
