import { apiUrl } from '@/lib/api-base';
import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import CategoryBadge from "../components/CategoryBadge";
import SimpleImage from "../components/SimpleImage";
import { SkeletonGrid } from "../components/SkeletonCard";
import Header from "../components/Header";
import CategorySearch from "@/components/CategorySearch";
import Footer from "../components/Footer";
import NewsTicker from "../components/NewsTicker";
import Pagination from "../components/Pagination";
import NewsCard from "../components/NewsCard";
import SEO from "../components/SEO";
import { fetchWithRetry } from '@/lib/fetchWithRetry';

type CategoryType = "afrobeats" | "nollywood" | "culture" | "fashion" | "tech" | "music" | "breaking" | "news" | "nigerian-news" | "nigerian-gaming" | "crypto-nigeria" | "lagos-fashion" | "nigerian-tech" | "nigerian-sports" | "nigerian-politics" | "nigerian-business" | "nigerian-lifestyle" | "entertainment" | "general";

interface SouthAfricaNewsItem {
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

const ARTICLES_PER_PAGE = 12;

const SouthAfrica = () => {
  const [southAfricaNews, setSouthAfricaNews] = useState<SouthAfricaNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SouthAfricaNewsItem[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchSouthAfricaNews = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchWithRetry(apiUrl('/api/news/south-africa'));
        if (response) {
          const data = await response.json();

          const mappedData: SouthAfricaNewsItem[] = (Array.isArray(data) ? data : []).map((item: any) => {
            let category: CategoryType = "news";
            const title = item.title || "";
            const excerpt = item.excerpt || "";

            if (title.toLowerCase().includes("music") ||
                title.toLowerCase().includes("artist") ||
                title.toLowerCase().includes("hip hop") ||
                title.toLowerCase().includes("kwaito") ||
                title.toLowerCase().includes("amapiano") ||
                excerpt.toLowerCase().includes("music")) {
              category = "afrobeats";
            } else if (title.toLowerCase().includes("fashion") ||
                       title.toLowerCase().includes("style") ||
                       excerpt.toLowerCase().includes("fashion")) {
              category = "fashion";
            } else if (title.toLowerCase().includes("tech") ||
                       title.toLowerCase().includes("technology") ||
                       title.toLowerCase().includes("startup") ||
                       excerpt.toLowerCase().includes("tech")) {
              category = "tech";
            } else if (title.toLowerCase().includes("culture") ||
                       title.toLowerCase().includes("traditional") ||
                       excerpt.toLowerCase().includes("culture")) {
              category = "culture";
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

          setSouthAfricaNews(mappedData);
        } else {
          setError("Could not load news. Please tap Retry.");
        }
      } catch (err) {
        console.error("Error fetching South Africa news:", err);
        setError("Network error while fetching news");
      } finally {
        setLoading(false);
      }
    };

    fetchSouthAfricaNews();

    const interval = setInterval(fetchSouthAfricaNews, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const totalPages = Math.ceil(southAfricaNews.length / ARTICLES_PER_PAGE);
  const paginatedNews = southAfricaNews.slice(
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
        title="South Africa News Today — Latest SA Headlines | RealSSA News"
        description="Follow the latest South Africa news including politics, Johannesburg & Cape Town updates, entertainment and sports — from RealSSA News."
        keywords="South Africa news, SA news today, Johannesburg news, Cape Town news, South African breaking news, RealSSA South Africa, SA politics, SA sports"
        url="/south-africa"
        section="South Africa"
      />
      <Header />
      <NewsTicker />
      <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden mb-12">
        <div className="absolute inset-0">
          <SimpleImage
            src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=75"
            alt="South Africa News"
            className="w-full h-full object-cover"
            fallback="https://placehold.co/800x400/000000/ffffff?text=South+Africa+News"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/80 via-yellow-500/80 to-green-500/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80" />
          <div className="absolute inset-0 bg-background/60" />
        </div>

        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold">🇿🇦</span>
              </div>
              <div>
                <CategoryBadge category="news" className="mb-2" />
                <span className="text-sm text-white/80 font-medium">SOUTH AFRICA NEWS</span>
              </div>
            </div>

            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              South African Stories
            
          </h1>
          <div className="max-w-2xl mt-8">
            <CategorySearch 
              category="southafrica"
              onSearchResults={(results) => setSearchResults(results as any)}
              onClearSearch={() => setSearchResults(null)}
            />
          </div>

            <p className="text-lg md:text-xl text-white/90 mb-8 max-w-3xl">
              Your gateway to the latest music, fashion, and culture from South Africa.
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href="#latest"
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-900 font-bold rounded-full hover:shadow-xl transition-all duration-300 hover:scale-105 group"
              >
                Read Latest News
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Latest News Grid */}
      <section id="latest" className="mb-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Latest South Africa News</h2>
          <CategoryBadge category="news" />
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

        {!loading && !error && southAfricaNews.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-xl font-bold mb-2">No South Africa News Right Now</h3>
            <p className="text-muted-foreground">We're pulling the latest from News24, IOL, and more. Check back soon!</p>
          </div>
        )}

        {loading ? (
          <SkeletonGrid count={4} variant="news" columns={2} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {paginatedNews.map((news) => (
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
        {!loading && southAfricaNews.length > 0 && (
          <div className="mt-12">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
            <p className="text-center text-sm text-muted-foreground mt-4">
              Page {currentPage} of {totalPages} · {southAfricaNews.length} articles
            </p>
          </div>
        )}
      </section>
      </div>
      <Footer />
    </div>
  );
};

export default SouthAfrica;
