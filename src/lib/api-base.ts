import { Capacitor } from '@capacitor/core';

// Web clients should call the same Vercel origin as the page. This avoids
// depending on the separate Fly scraper service for browser reads and removes
// a CORS failure point. Native Capacitor builds still use VITE_API_URL.
const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';

export const API_BASE_URL = isNative
  ? (import.meta.env?.VITE_API_URL || 'https://www.realssanews.com.ng')
  : (browserOrigin || import.meta.env?.VITE_API_URL || 'https://www.realssanews.com.ng');

export const RUST_ENGINE_URL = import.meta.env?.MODE === 'development'
  ? (import.meta.env?.VITE_RUST_ENGINE_URL || 'http://localhost:8080')
  : 'https://engine.realssanews.com.ng';

export const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let finalUrl = `${API_BASE_URL}${normalizedPath}`;
  
  // Auto-append deviceId for /api/ requests to enable batched user reactions
  if (normalizedPath.startsWith('/api/') && !normalizedPath.includes('deviceId=')) {
    const deviceId = typeof window !== 'undefined' ? window.localStorage.getItem('realssa_device_uuid') : null;
    if (deviceId) {
      const sep = finalUrl.includes('?') ? '&' : '?';
      finalUrl = `${finalUrl}${sep}deviceId=${deviceId}`;
    }
  }
  
  return finalUrl;
};

export const getArticleReadTime = (article: any, fallback = '5 min read') =>
  article?.readTime || article?.read_time || fallback;

export const getArticleExternalLink = (article: any, fallback = '#') =>
  article?.externalLink || article?.external_link || article?.url || article?.link || fallback;

export const getArticleContentType = (article: any, fallback = 'article') =>
  article?.contentType || article?.content_type || fallback;

export const normalizeArticle = <T extends Record<string, any>>(article: T) => ({
  ...article,
  readTime: getArticleReadTime(article),
  externalLink: getArticleExternalLink(article),
  contentType: getArticleContentType(article),
});

export const normalizeArticles = <T extends Record<string, any>>(articles: T[]) =>
  articles.map(normalizeArticle);