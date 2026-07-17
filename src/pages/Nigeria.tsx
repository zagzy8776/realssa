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

const Nigeria = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      try {
        const response = await fetchWithRetry(apiUrl("/api/news/nigerian"));
        if (response) {
          const data = await response.json();
          setNews(Array.isArray(data) ? data : []);
        } else {
          setError("Could not load news. Please tap Retry.");
        }
      } catch (err) {
        console.error("Error fetching Nigeria news:", err);
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <NewsTicker />

      {/* Hero Section — CSS gradient only, no heavy image */}
      <section className="relative overflow-hidden mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-green-700 via-green-600 to-emerald-800" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60" />
        <div className="relative container mx-auto px-4 py-14 md:py-20">
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold">🇳🇬</span>
              </div>
              <span className="text-sm text-white/80 font-semibold uppercase tracking-wide">Nigeria News</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
              Nigerian Stories
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-6 max-w-3xl">
              Breaking news, politics, business, entertainment and more — live from Nigeria's top sources.
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

      {/* News Grid */}
      <section id="latest" className="container mx-auto px-4 pb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl md:text-3xl font-bold">🇳🇬 Latest Nigeria News</h2>
          {!loading && <span className="text-sm text-muted-foreground">{news.length} articles</span>}
        </div>

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

        {!loading && !error && news.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-xl font-bold mb-2">No News Right Now</h3>
            <p className="text-muted-foreground">We're pulling the latest from Punch, Vanguard, Premium Times and more. Check back soon!</p>
          </div>
        )}

        {loading ? (
          <SkeletonGrid count={12} variant="news" columns={2} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {paginatedNews.map((item) => (
              <a
                key={item.id}
                href={item.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-card text-foreground rounded-xl overflow-hidden shadow hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-border"
              >
                <div className="relative">
                  <SimpleImage
                    src={item.image}
                    alt={item.title}
                    className="w-full h-36 md:h-44 object-cover"
                    fallback="https://placehold.co/400x200/1a1a2e/ffffff?text=Nigeria+News"
                  />
                  <div className="absolute top-2 left-2">
                    <CategoryBadge category={item.category as any} />
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="text-foreground text-sm font-bold line-clamp-2 mb-1 group-hover:text-primary transition-colors leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.excerpt}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate max-w-[60%]">{item.author}</span>
                    <span className="flex items-center gap-1 text-primary font-medium">
                      Read <ArrowRight size={10} />
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && news.length > ARTICLES_PER_PAGE && (
          <>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
            <p className="text-center text-sm text-muted-foreground mb-4">
              Page {currentPage} of {totalPages} · {news.length} articles
            </p>
          </>
        )}
      </section>

      <Footer />
    </div>
  );
};

export default Nigeria;
