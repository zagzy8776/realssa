import { apiUrl } from '@/lib/api-base';
import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import CategoryBadge from "../components/CategoryBadge";
import SimpleImage from "../components/SimpleImage";
import { SkeletonGrid } from "../components/SkeletonCard";
import Header from "../components/Header";
import Footer from "../components/Footer";
import NewsTicker from "../components/NewsTicker";
import Pagination from "../components/Pagination";
import NewsCard from "../components/NewsCard";
import SEO from "../components/SEO";
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import CategorySearch from "@/components/CategorySearch";

type CategoryType = "afrobeats" | "nollywood" | "culture" | "fashion" | "tech" | "music" | "breaking" | "news" | "nigerian-news" | "nigerian-gaming" | "crypto-nigeria" | "lagos-fashion" | "nigerian-tech" | "nigerian-sports" | "nigerian-politics" | "nigerian-business" | "nigerian-lifestyle" | "entertainment" | "general";

interface GhanaNewsItem {
  id: string;
  title: string;
  excerpt: string;
  category: CategoryType;
  image: string;
  readTime: string;
  author: string;
  date: string;
  externalLink: string;
  content?: string;
}

interface ApiGhanaItem {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  image: string;
  readTime: string;
  author: string;
  date: string;
  externalLink: string;
  content?: string;
}

const ARTICLES_PER_PAGE = 12;

const Ghana = () => {
  const [ghanaNews, setGhanaNews] = useState<GhanaNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<GhanaNewsItem[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchGhanaNews = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchWithRetry(apiUrl('/api/news/ghana'));
        if (response) {
          const data = await response.json();

          // Map API response to component's expected format
          const mappedData: GhanaNewsItem[] = (Array.isArray(data) ? data : []).map((item: ApiGhanaItem) => {
            // Category inference based on content
            let category: CategoryType = "news";
            const title = item.title || "";
            const excerpt = item.excerpt || "";

            if (title.toLowerCase().includes("music") ||
                title.toLowerCase().includes("artist") ||
                title.toLowerCase().includes("afrobeats") ||
                title.toLowerCase().includes("highlife") ||
                excerpt.toLowerCase().includes("music")) {
              category = "afrobeats";
            } else if (title.toLowerCase().includes("fashion") ||
                       title.toLowerCase().includes("style") ||
                       excerpt.toLowerCase().includes("fashion")) {
              category = "fashion";
            } else if (title.toLowerCase().includes("culture") ||
                       title.toLowerCase().includes("traditional") ||
                       excerpt.toLowerCase().includes("culture")) {
              category = "culture";
            } else if (title.toLowerCase().includes("sports") ||
                       title.toLowerCase().includes("football") ||
                       title.toLowerCase().includes("soccer") ||
                       excerpt.toLowerCase().includes("sports")) {
              category = "general";
            }

            return {
              id: item.id,
              title: item.title,
              excerpt: item.excerpt,
              category,
              image: item.image,
              readTime: item.readTime || "5 min read",
              author: item.author,
              date: item.date,
              externalLink: item.externalLink,
              content: item.content
            };
          });

          setGhanaNews(mappedData);
        } else {
          setError("Could not load news. Please tap Retry.");
        }
      } catch (err) {
        console.error("Error fetching Ghana news:", err);
        setError("Network error while fetching news");
      } finally {
        setLoading(false);
      }
    };

    fetchGhanaNews();

    const interval = setInterval(fetchGhanaNews, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const baseArticles = searchResults !== null ? searchResults : ghanaNews;
  const totalPages = Math.ceil(baseArticles.length / ARTICLES_PER_PAGE);
  const paginatedArticles = baseArticles.slice(
    (currentPage - 1) * ARTICLES_PER_PAGE,
    currentPage * ARTICLES_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Ghana News Today — Latest Headlines from Ghana | RealSSA News"
        description="Stay updated with the latest Ghana news, politics, entertainment, sports and business from RealSSA News. Your trusted source for breaking news from Ghana."
        keywords="Ghana news today, Ghana latest news, Ghana breaking news, RealSSA Ghana, Accra news, Ghanaian news, Ghana politics, Ghana entertainment, Ghana sports"
        url="/ghana"
        section="Ghana"
      />
      <Header />
      <NewsTicker />
      <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden mb-12">
        <div className="absolute inset-0">
          <SimpleImage
            src="https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=75"
            alt="Ghana News"
            className="w-full h-full object-cover"
            fallback="https://placehold.co/800x400/000000/ffffff?text=Ghana+News"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/80 via-yellow-500/80 to-red-500/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80" />
          <div className="absolute inset-0 bg-background/60" />
        </div>

        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold">🇬🇭</span>
              </div>
              <div>
                <CategoryBadge category="news" className="mb-2" />
                <span className="text-sm text-white/80 font-medium">GHANA NEWS</span>
              </div>
            </div>

            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Ghanaian Stories
            </h1>

            <p className="text-lg md:text-xl text-white/90 mb-8 max-w-3xl">
              Your gateway to the latest news, culture, and entertainment from Ghana.
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href="#latest"
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-900 font-bold rounded-full hover:shadow-xl transition-all duration-300 hover:scale-105 group"
              >
                Read Latest News
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="/nigerian-news"
                className="inline-flex items-center gap-3 px-8 py-4 border-2 border-white text-white font-bold rounded-full hover:bg-white hover:text-gray-900 transition-all duration-300"
              >
                View All News
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Latest News Grid */}
      <section id="latest" className="mb-12">
        <div className="mb-12 border-b border-border pb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">🇬🇭</span>
            <h1 className="text-3xl md:text-5xl font-display font-bold">Ghana News</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">
            The latest breaking news, politics, business, and entertainment from across Ghana.
          </p>
        </div>

        <CategorySearch 
          category="ghana" 
          onSearchResults={setSearchResults} 
          isLoading={loading} 
        />

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

        {loading ? (
          <SkeletonGrid count={4} variant="news" columns={2} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {paginatedArticles.map((news) => (
              <NewsCard
                key={news.id}
                title={news.title}
                excerpt={news.excerpt}
                category={news.category}
                image={news.image}
                readTime={news.readTime}
                date={news.date}
                href={`/article/${news.id}`}
                id={news.id}
                externalLink={news.externalLink}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && baseArticles.length > 0 && (
          <>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
            <p className="text-center text-sm text-muted-foreground mb-4">
              Page {currentPage} of {totalPages} · {baseArticles.length} articles
            </p>
          </>
        )}
      </section>
      </div>
      <Footer />
    </div>
  );
};

export default Ghana;
