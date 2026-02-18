// NewsSection.tsx
// Clean, fast-loading news interface inspired by Ghana page

import { useState, useEffect } from 'react';
import { ArrowRight, Newspaper } from 'lucide-react';
import CategoryBadge from '@/components/CategoryBadge';
import SimpleImage from '@/components/SimpleImage';

type CategoryType = "afrobeats" | "nollywood" | "culture" | "fashion" | "tech" | "music" | "breaking" | "news" | "nigerian-news" | "nigerian-gaming" | "crypto-nigeria" | "lagos-fashion" | "nigerian-tech" | "nigerian-sports" | "nigerian-politics" | "nigerian-business" | "nigerian-lifestyle" | "entertainment" | "general" | "sports" | "politics" | "business";

interface NewsArticle {
  id?: string;
  title: string;
  description?: string;
  excerpt?: string;
  image?: string;
  imageUrl?: string;
  category?: string;
  source?: string;
  author?: string;
  publishedAt?: string;
  date?: string;
  readTime?: string;
  url?: string;
  externalLink?: string;
  link?: string;
  content?: string;
}

export default function NewsSection() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  // Category inference based on content
  const inferCategory = (article: NewsArticle): CategoryType => {
    const title = (article.title || "").toLowerCase();
    const excerpt = (article.description || article.excerpt || "").toLowerCase();
    const source = (article.source || "").toLowerCase();
    
    if (title.includes("music") || title.includes("artist") || title.includes("afrobeats") || 
        title.includes("album") || title.includes("song") || excerpt.includes("music")) {
      return "music";
    }
    if (title.includes("fashion") || title.includes("style") || excerpt.includes("fashion")) {
      return "fashion";
    }
    if (title.includes("culture") || title.includes("traditional") || excerpt.includes("culture")) {
      return "culture";
    }
    if (title.includes("sports") || title.includes("football") || title.includes("soccer") || 
        title.includes("basketball") || excerpt.includes("sports")) {
      return "sports";
    }
    if (title.includes("politics") || title.includes("election") || title.includes("government")) {
      return "politics";
    }
    if (title.includes("business") || title.includes("economy") || title.includes("market")) {
      return "business";
    }
    if (title.includes("tech") || title.includes("technology") || title.includes("startup")) {
      return "tech";
    }
    if (title.includes("nollywood") || title.includes("movie") || title.includes("film")) {
      return "nollywood";
    }
    if (source.includes("crypto") || title.includes("crypto") || title.includes("bitcoin")) {
      return "general";
    }
    
    return "news";
  };

  // Fetch news from backend and RSS feeds
  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Try the news-feed endpoint with longer timeout (30 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch('https://realssa-news-agg-production.up.railway.app/news-feed', {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const articles = Array.isArray(data) ? data : data.data || data.articles || [];
        
        if (articles.length === 0) {
          throw new Error("No articles available");
        }
        
        // Remove duplicates based on title
        const uniqueArticles = articles.filter((article: NewsArticle, index: number, self: NewsArticle[]) =>
          index === self.findIndex((a: NewsArticle) => a.title === article.title)
        );
        
        setNews(uniqueArticles);
      } catch (err) {
        console.error('Error fetching news:', err);
        // Show a more user-friendly error
        setError("Unable to load news. The server may be busy fetching fresh articles. Please try again in a moment.");
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
    
    // Auto-refresh every 30 minutes
    const interval = setInterval(fetchNews, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);



  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden mb-12 rounded-2xl">
        <div className="absolute inset-0">
          <SimpleImage
            src="https://images.unsplash.com/photo-1504711432869-001077659a9a?w=1920"
            alt="News Hero"
            className="w-full h-full object-cover"
            fallback="https://placehold.co/1920x400/1a1a1a/ffffff?text=Latest+News"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/80 via-purple-600/80 to-pink-600/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80" />
          <div className="absolute inset-0 bg-background/40" />
        </div>

        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                <Newspaper className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <CategoryBadge category="breaking" className="mb-2" />
                <span className="text-sm text-white/80 font-medium">LATEST NEWS</span>
              </div>
            </div>

            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Today's Stories
            </h1>

            <p className="text-lg md:text-xl text-white/90 mb-8 max-w-3xl">
              Stay informed with the latest news from Nigeria, Ghana, and around the world. Curated from top sources.
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href="#latest"
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-900 font-bold rounded-full hover:shadow-xl transition-all duration-300 hover:scale-105 group"
              >
                Read Latest News
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <span className="inline-flex items-center gap-3 px-8 py-4 border-2 border-white text-white font-bold rounded-full">
                {news.length} Articles
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Latest News Grid */}
      <section id="latest" className="mb-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Latest Stories</h2>
          <CategoryBadge category="news" />
        </div>

        {error && (
          <div className="text-center py-8">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 inline-block">
              <p className="text-red-800 mb-4 text-sm">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors font-medium text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!loading && !error && news.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-xl font-bold mb-2">No News Available</h3>
            <p className="text-muted-foreground">We're pulling the latest from top sources. Check back soon!</p>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="bg-card rounded-lg p-6 shadow-lg animate-pulse">
                <div className="h-48 bg-gray-300 rounded-lg mb-4"></div>
                <div className="h-6 bg-gray-300 rounded mb-2"></div>
                <div className="h-4 bg-gray-300 rounded mb-4"></div>
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {news.map((article, index) => {
              const category = inferCategory(article);
              const imageUrl = article.image || article.imageUrl || '';
              const articleUrl = article.url || article.externalLink || article.link || '#';
              
              return (
                <article key={article.id || index} className="bg-card rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <div className="relative mb-4">
                    <SimpleImage
                      src={imageUrl}
                      alt={article.title}
                      className="w-full h-48 object-cover rounded-lg"
                      fallback="https://placehold.co/400x200/1a1a1a/ffffff?text=News"
                    />
                    <div className="absolute top-4 left-4">
                      <CategoryBadge category={category} />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold mb-2 line-clamp-2">{article.title}</h3>
                  <p className="text-muted-foreground mb-4 line-clamp-3">
                    {article.description || article.excerpt || 'Click to read the full story...'}
                  </p>

                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <span>{article.source || article.author || 'Unknown Source'}</span>
                    <span>
                      {article.publishedAt || article.date 
                        ? new Date(article.publishedAt || article.date || '').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Today'
                      }
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{article.readTime || '5 min read'}</span>
                    <a
                      href={articleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium"
                    >
                      Read Full Story
                      <ArrowRight size={16} />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
