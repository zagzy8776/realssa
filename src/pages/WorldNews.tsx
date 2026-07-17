import { apiUrl } from '@/lib/api-base';
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NewsCard from "@/components/NewsCard";
import NewsTicker from "@/components/NewsTicker";
import SEO from "@/components/SEO";
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import CategorySearch from "@/components/CategorySearch";
import { SkeletonGrid } from "@/components/SkeletonCard";
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import PullToRefresh from '@/components/PullToRefresh';

import { CategoryType } from "@/data/newsData";

interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: CategoryType;
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

const WorldNews = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Article[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchWorldNews = async (pageNum: number, isRefresh = false) => {
    if (pageNum === 1) setLoading(true);
    else setIsLoadingMore(true);

    try {
      const response = await fetchWithRetry(apiUrl(`/api/news/world?paginated=true&page=${pageNum}&limit=${ARTICLES_PER_PAGE}`));
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
      console.error("Error fetching World news:", err);
      if (pageNum === 1) setError("Network error while fetching news");
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchWorldNews(currentPage);
  }, [currentPage]);

  const handleRefresh = async () => {
    setCurrentPage(1);
    await fetchWorldNews(1, true);
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

  // Reset page when search term changes
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const paginatedArticles = searchResults !== null ? searchResults : articles;
  const totalPages = serverTotalPages;

  if (loading && currentPage === 1) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <NewsTicker />
        <div className="container mx-auto px-4 py-8 flex-grow">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">🌍 World News</h1>
            <p className="text-muted-foreground">Latest headlines from around the globe</p>
            <div className="max-w-2xl mx-auto mt-8">
              <CategorySearch 
                category="worldnews"
                onSearchResults={(results) => setSearchResults(results as any)}
                onClearSearch={() => setSearchResults(null)}
              />
            </div>
          </div>
          <SkeletonGrid count={9} columns={3} />
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <NewsTicker />
        <div className="container mx-auto px-4 py-8 flex-grow">
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
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <SEO 
        title="World News | Global Breaking News"
        description="Get the latest world news, international headlines, and global updates on politics, business, and entertainment."
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <NewsTicker />
        
        <div className="container mx-auto px-4 py-8 flex-grow">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">🌍 World News</h1>
            <p className="text-muted-foreground">Latest headlines from around the globe</p>
            <div className="max-w-2xl mx-auto mt-8">
              <CategorySearch 
                category="worldnews"
                onSearchResults={(results) => setSearchResults(results as any)}
                onClearSearch={() => setSearchResults(null)}
              />
            </div>
          </div>



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
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <div className="text-6xl mb-4">🌍</div>
              <h3 className="text-xl font-semibold mb-2">No stories found</h3>
              <p className="text-muted-foreground mb-6">
                Try adjusting your search or category filters.
              </p>
              <Button onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
              }}>
                Clear All Filters
              </Button>
            </div>
          )}
        </div>

        <Footer />
      </div>
    </PullToRefresh>
  );
};

export default WorldNews;
