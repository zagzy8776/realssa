import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { apiUrl } from "@/lib/api-base";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NewsTicker from "@/components/NewsTicker";
import Pagination from "@/components/Pagination";
import { SkeletonGrid } from "@/components/SkeletonCard";
import SimpleImage from "@/components/SimpleImage";
import CategoryBadge from "@/components/CategoryBadge";
import { ArrowRight } from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  image: string;
  readTime: string;
  author: string;
  date: string;
  externalLink: string;
}

const ARTICLES_PER_PAGE = 12;

const Netherlands = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      try {
        const response = await fetchWithRetry(apiUrl("/api/news/netherlands"));
        if (response) {
          const data = await response.json();
          setNews(Array.isArray(data) ? data : (data?.articles ?? []));
        } else {
          setError("Could not load news. Please tap Retry.");
        }
      } catch (err) {
        console.error("Error fetching Netherlands news:", err);
        setError("Network error while fetching news");
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
    // Auto-refresh every 15 minutes
    const interval = setInterval(fetchNews, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const totalPages = Math.ceil(news.length / ARTICLES_PER_PAGE);
  const paginatedNews = news.slice(
    (currentPage - 1) * ARTICLES_PER_PAGE,
    currentPage * ARTICLES_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <NewsTicker />
        <div className="container mx-auto px-4 py-8">
          <SkeletonGrid count={12} />
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
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Error</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <NewsTicker />

      {/* Hero Section — CSS gradient only, no heavy image */}
      <section className="relative overflow-hidden mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-red-500 to-orange-600" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60" />
        <div className="relative container mx-auto px-4 py-14 md:py-20">
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold">🇳🇱</span>
              </div>
              <span className="text-sm text-white/80 font-semibold uppercase tracking-wide">Netherlands News</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
              Dutch Stories
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-6 max-w-3xl">
              Breaking news, politics, business, entertainment and more — live from the Netherlands' top sources.
            </p>
            <a
              href="#latest"
              className="inline-flex items-center gap-3 px-7 py-3 bg-white text-gray-900 font-bold rounded-full hover:shadow-xl transition-all duration-300 hover:scale-105 group"
            >
              Read Latest News
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 pb-8" id="latest">
        {news.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">No News Available</h2>
            <p className="text-muted-foreground">There are currently no news articles available for the Netherlands.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
              {paginatedNews.map((item) => (
                <Link
                  key={item.id}
                  to={`/article/${item.id}`}
                  className="group block"
                >
                  <div className="bg-card rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="aspect-[16/9] relative overflow-hidden">
                      <SimpleImage
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-4">
                      <CategoryBadge category={item.category} className="mb-2" />
                      <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {item.excerpt}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{item.author}</span>
                        <span>{item.date}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Netherlands;