import { apiUrl } from '@/lib/api-base';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import NewsCard from '@/components/NewsCard';

interface NewsArticle {
  id?: string;
  title: string;
  excerpt?: string;
  image?: string;
  category?: string;
  author?: string;
  date?: string;
  readTime?: string;
  externalLink?: string;
}

interface NewsSectionProps {
  categoryFilter?: string;
}

export default function NewsSection({ categoryFilter }: NewsSectionProps = {}) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = categoryFilter
        ? `/api/news/${categoryFilter}`
        : '/api/news/breaking?diverse=true';

      const res = await fetch(apiUrl(endpoint), {
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const articles: NewsArticle[] = Array.isArray(data) ? data : data.articles || [];

      // Deduplicate by title
      const seen = new Set<string>();
      const unique = articles.filter(a => {
        if (seen.has(a.title)) return false;
        seen.add(a.title);
        return true;
      });

      setNews(unique);
    } catch (err) {
      setError('Unable to load news. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 20 * 60 * 1000); // refresh every 20 mins
    return () => clearInterval(interval);
  }, [categoryFilter]);

  const handleRead = (article: NewsArticle) => {
    if (!article.externalLink) return;
    navigate(`/read?url=${encodeURIComponent(article.externalLink)}&id=${article.id || ''}&category=${encodeURIComponent(article.category || 'news')}&image=${encodeURIComponent(article.image || '')}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <div className="bg-gradient-to-r from-red-500/10 via-orange-500/10 to-background border-b border-border px-4 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Zap className="w-6 h-6 text-red-500" />
              {categoryFilter ? categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1) : 'Breaking News'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {news.length > 0 ? `${news.length} latest stories` : 'Fetching latest stories...'}
            </p>
          </div>
          <button
            onClick={fetchNews}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
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
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">{error}</p>
            <button
              onClick={fetchNews}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-medium"
            >
              Retry
            </button>
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No stories available right now. Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {news.map((article, index) => (
              <div
                key={article.id || index}
                onClick={() => handleRead(article)}
                className="cursor-pointer"
              >
                <NewsCard
                  id={article.id || String(index)}
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
        )}
      </div>
    </div>
  );
}
