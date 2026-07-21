import { apiUrl } from '@/lib/api-base';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingUp, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import NewsCard from '@/components/NewsCard';

interface Article {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  image: string;
  readTime: string;
  date: string;
  author?: string;
  externalLink?: string;
  source?: string;
}

const FEEDS = [
  '/api/news/breaking?diverse=true',
  '/api/articles/trending?diverse=true',
  '/api/news/nigerian',
  '/api/news/sports',
  '/api/news/world',
  '/api/news/culture',
  '/api/news/entertainment',
  '/api/news/tech',
  '/api/news/business',
  '/api/news/ghana',
  '/api/news/kenya',
  '/api/news/south-africa',
  '/api/news/uk',
  '/api/news/usa',
  '/api/news/science',
  '/api/news/lifestyle',
  '/api/news/jobs',
  '/api/news/crypto',
  '/api/news/local',
];

const PAGE_SIZE = 20;

const ForYou: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const loaderRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const deviceId = typeof window !== 'undefined'
    ? localStorage.getItem('realssa_device_uuid') || ''
    : '';

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? '☀️ Morning Brief' : currentHour < 18 ? '🌤️ Afternoon Digest' : '🌙 Evening Recap';

  // Fetch all feeds in parallel and merge
  const fetchAllFeeds = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        FEEDS.map(path =>
          fetch(apiUrl(`${path}${path.includes('?') ? '&' : '?'}deviceId=${deviceId}&limit=50`))
            .then(r => r.ok ? r.json() : [])
            .then(d => Array.isArray(d) ? d : d.articles || [])
            .catch(() => [])
        )
      );

      const merged: Article[] = [];
      const seen = new Set<string>();

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          result.value.forEach((a: Article) => {
            const key = a.id || a.title;
            if (key && !seen.has(key)) {
              seen.add(key);
              merged.push(a);
            }
          });
        }
      });

      // Sort by date descending
      merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setAllArticles(merged);
      setArticles(merged.slice(0, PAGE_SIZE));
      setPage(1);
      setHasMore(merged.length > PAGE_SIZE);
    } catch (err) {
      console.error('ForYou fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchAllFeeds();
  }, [fetchAllFeeds]);

  // Infinite scroll — load next page from already-fetched articles
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const nextSlice = allArticles.slice(0, nextPage * PAGE_SIZE);
    setArticles(nextSlice);
    setPage(nextPage);
    setHasMore(nextSlice.length < allArticles.length);
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, allArticles]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleRead = (article: Article) => {
    if (!article.externalLink) return;
    navigate(`/read?url=${encodeURIComponent(article.externalLink)}&id=${article.id}&category=${encodeURIComponent(article.category || 'news')}&image=${encodeURIComponent(article.image || '')}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <div className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-background border-b border-border px-4 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              {greeting}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {allArticles.length > 0 ? `${allArticles.length} stories from across Africa & the world` : 'Loading your personalized feed...'}
            </p>
          </div>
          <button
            onClick={fetchAllFeeds}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            title="Refresh feed"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border animate-pulse">
                <div className="h-48 bg-muted rounded-t-xl" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20">
            <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Feed is loading</h3>
            <p className="text-muted-foreground">Fresh articles are being fetched. Check back in a moment.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {articles.map((article) => (
                <div
                  key={article.id || article.title}
                  onClick={() => handleRead(article)}
                  className="cursor-pointer"
                >
                  <NewsCard
                    id={article.id}
                    title={article.title}
                    excerpt={article.excerpt}
                    category={article.category as any}
                    image={article.image}
                    readTime={article.readTime || '5 min read'}
                    date={article.date}
                    externalLink={article.externalLink}
                  />
                </div>
              ))}
            </div>

            {/* Infinite scroll trigger */}
            <div ref={loaderRef} className="py-8 flex justify-center">
              {loadingMore && (
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              )}
              {!hasMore && articles.length > 0 && (
                <p className="text-sm text-muted-foreground">You've seen all {articles.length} stories. Refresh for more.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ForYou;
