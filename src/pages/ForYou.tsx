import { apiUrl } from '@/lib/api-base';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingUp, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import NewsCard from '@/components/NewsCard';
import TrendingNearYouRail from '@/components/TrendingNearYouRail';

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

const ForYou: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const navigate = useNavigate();

  const deviceId = typeof window !== 'undefined'
    ? localStorage.getItem('realssa_device_uuid') || ''
    : '';

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? '☀️ Morning Brief' : currentHour < 18 ? '🌤️ Afternoon Digest' : '🌙 Evening Recap';

  const fetchPage = useCallback(async (cursor: string | null, reset = false) => {
    try {
      // Build exclude list from already-seen IDs (cap at 100 to keep URL short)
      const excludeList = Array.from(seenIds.current).slice(-100).join(',');

      const params = new URLSearchParams();
      if (deviceId) params.set('deviceId', deviceId);
      if (cursor) params.set('cursor', cursor);
      if (excludeList) params.set('exclude', excludeList);

      const res = await fetch(apiUrl(`/api/feed/foryou?${params.toString()}`));
      if (!res.ok) throw new Error('Feed fetch failed');

      const data = await res.json();
      const incoming: Article[] = (data.articles || []).filter((a: Article) => {
        if (!a.id || seenIds.current.has(a.id)) return false;
        seenIds.current.add(a.id);
        return true;
      });

      setArticles(prev => reset ? incoming : [...prev, ...incoming]);
      setNextCursor(data.nextCursor || null);
      setHasMore(!!data.nextCursor && incoming.length > 0);
    } catch (err) {
      console.error('[ForYou] fetch error:', err);
      setHasMore(false);
    }
  }, [deviceId]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    seenIds.current.clear();
    fetchPage(null, true).finally(() => setLoading(false));
  }, [fetchPage]);

  // Refresh
  const handleRefresh = useCallback(() => {
    setLoading(true);
    seenIds.current.clear();
    setArticles([]);
    setNextCursor(null);
    setHasMore(true);
    fetchPage(null, true).finally(() => setLoading(false));
  }, [fetchPage]);

  // Load next page
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    await fetchPage(nextCursor);
    setLoadingMore(false);
  }, [loadingMore, hasMore, nextCursor, fetchPage]);

  // IntersectionObserver — triggers loadMore when sentinel enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1, rootMargin: '200px' }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleRead = (article: Article) => {
    if (!article.externalLink) return;
    navigate(`/read?url=${encodeURIComponent(article.externalLink)}&id=${article.id}&category=${encodeURIComponent(article.category || 'news')}&image=${encodeURIComponent(article.image || '')}&title=${encodeURIComponent(article.title || '')}`);
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
              {articles.length > 0 ? `${articles.length} stories — your feed, your way` : 'Loading your personalized feed...'}
            </p>
          </div>
          <button
            onClick={handleRefresh}
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
            <TrendingNearYouRail />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {articles.map((article) => (
                <div
                  key={article.id}
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

            {/* Infinite scroll sentinel */}
            <div ref={loaderRef} className="py-8 flex justify-center">
              {loadingMore && (
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              )}
              {!hasMore && articles.length > 0 && (
                <button
                  onClick={handleRefresh}
                  className="text-sm text-primary underline"
                >
                  Refresh for more stories
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ForYou;
