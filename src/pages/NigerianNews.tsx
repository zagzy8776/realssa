import { apiUrl } from '@/lib/api-base';
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NewsCard from "@/components/NewsCard";
import NewsTicker from "@/components/NewsTicker";
import SEO from "@/components/SEO";
import { SkeletonGrid } from "@/components/SkeletonCard";
import CategorySearch from "@/components/CategorySearch";
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import PullToRefresh from '@/components/PullToRefresh';

interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  image: string;
  readTime: string;
  author: string;
  source: string;
  contentType: string;
  status: string;
  featured: boolean;
  externalLink: string;
  date: string;
}

const ARTICLES_PER_PAGE = 12;

const NigerianNews = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Article[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchNewsData = async (pageNum: number, isRefresh = false) => {
    if (pageNum === 1) setLoading(true);
    else setIsLoadingMore(true);

    try {
      const response = await fetchWithRetry(apiUrl(`/api/news/nigerian?paginated=true&page=${pageNum}&limit=${ARTICLES_PER_PAGE}`));
      if (response) {
        const data = await response.json();
        const newArticles = data.articles || (Array.isArray(data) ? data : []);
        
        if (isRefresh || pageNum === 1) {
          setArticles(newArticles);
        } else {
          setArticles(prev => [...prev, ...newArticles]);
        }
        setServerTotalPages(data.pagination?.totalPages || Math.ceil((Array.isArray(data) ? data.length : 0) / ARTICLES_PER_PAGE) || 1);
      } else if (pageNum === 1) {
        setError("Could not load news. Please tap Retry.");
      }
    } catch (err) {
      console.error("Error fetching news:", err);
      if (pageNum === 1) setError("Network error while fetching news");
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchNewsData(currentPage);
  }, [currentPage]);

  const handleRefresh = async () => {
    setCurrentPage(1);
    await fetchNewsData(1, true);
  };

  const { observerTarget } = useInfiniteScroll({
    onLoadMore: () => {
      if (currentPage < serverTotalPages && !loading && !isLoadingMore) {
        setCurrentPage(prev => prev + 1);
      }
    },
    hasMore: currentPage < serverTotalPages,
    isLoading: loading || isLoadingMore
  });

  const paginatedArticles = searchResults !== null ? searchResults : articles;
  const totalPages = serverTotalPages;

  if (loading && currentPage === 1) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <NewsTicker />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">🇳🇬 Nigerian News</h1>
            <p className="text-muted-foreground">Latest headlines from Nigeria's top newspapers</p>
          </div>
          <SkeletonGrid count={9} columns={3} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <NewsTicker />
        <div className="container mx-auto px-4 py-8">
          {error && (
            <div className="text-center py-12 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800 mb-6">
              <p className="text-4xl mb-3">📡</p>
              <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-1">Could not load news</h3>
              <p className="text-sm text-muted-foreground mb-4">The server may be waking up. Please wait a moment.</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full transition-colors"
              >
                🔄 Retry
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <SEO 
        title="Latest Nigerian News & Breaking Updates"
        description="Stay updated with the latest political news, business updates, and breaking stories across Nigeria."
        keywords="Latest political news in Nigeria today, Lagos business updates, Nigerian economy breaking news, Nigeria news, Naija news"
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <NewsTicker />
        <div className="container mx-auto px-4 py-8 flex-grow">
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">🇳🇬 Nigerian News</h1>
            <p className="text-muted-foreground">Latest headlines from Nigeria's top newspapers</p>
          </div>

          {/* Search and Filter */}
          <CategorySearch 
            category="nigerian-news" 
            onSearchResults={setSearchResults} 
            isLoading={loading} 
          />


          {/* Articles Grid */}
          {paginatedArticles.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {paginatedArticles.map((article, index) => (
                  <NewsCard
                    key={article.id || index}
                    title={article.title}
                    excerpt={article.excerpt}
                    category={article.category}
                    image={article.image}
                    readTime={article.readTime}
                    date={article.date}
                    href={`/article/${article.id}`}
                    id={article.id}
                    externalLink={article.externalLink}
                  />
                ))}
              </div>

              {/* Infinite Scroll Target */}
              {currentPage < totalPages && (
                <div ref={observerTarget} className="py-8 text-center text-muted-foreground flex justify-center items-center">
                  {isLoadingMore ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
                      <span>Loading more stories...</span>
                    </div>
                  ) : (
                    <span>Scroll for more</span>
                  )}
                </div>
              )}

              <p className="text-center text-sm text-muted-foreground mb-4 pt-4">
                {paginatedArticles.length} articles loaded
              </p>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📰</div>
              <h3 className="text-xl font-semibold mb-2">No articles found</h3>
              <p className="text-muted-foreground mb-6">
                Try adjusting your search terms or filters to find what you're looking for.
              </p>
              <Button onClick={() => {
                setSearchResults(null);
              }}>
                Clear Filters
              </Button>
            </div>
          )}
        </div>
        <Footer />
      </div>
    </PullToRefresh>
  );
};

export default NigerianNews;
