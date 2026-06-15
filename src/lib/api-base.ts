export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  'https://realssa.onrender.com'
).replace(/\/$/, '');

export const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
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