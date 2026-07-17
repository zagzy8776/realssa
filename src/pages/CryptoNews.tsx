import { apiUrl, getArticleExternalLink } from '@/lib/api-base';
import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import CategoryBadge from "../components/CategoryBadge";
import SimpleImage from "../components/SimpleImage";
import Header from "../components/Header";
import CategorySearch from "@/components/CategorySearch";
import Footer from "../components/Footer";
import NewsTicker from "@/components/NewsTicker";
import Pagination from "@/components/Pagination";
import NewsCard from "@/components/NewsCard";
import SEO from "@/components/SEO";

type CategoryType = "afrobeats" | "nollywood" | "culture" | "fashion" | "tech" | "music" | "breaking" | "news" | "nigerian-news" | "nigerian-gaming" | "crypto-nigeria" | "lagos-fashion" | "nigerian-tech" | "nigerian-sports" | "nigerian-politics" | "nigerian-business" | "nigerian-lifestyle" | "entertainment" | "general";

interface CryptoNewsItem {
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

const CryptoNews = () => {
  const [cryptoNews, setCryptoNews] = useState<CryptoNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<CryptoNewsItem[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchCryptoNews = async () => {
      setLoading(true);
      try {
        // Use AbortController for timeout and cleanup
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        // Fetch crypto news from dedicated backend RSS endpoint
        const response = await fetch(apiUrl('/api/news/crypto'), {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Transform backend data to match our interface
        const rawItems = Array.isArray(data) ? data : [];
        const cryptoItems = rawItems.filter((item: { title?: string; excerpt?: string; description?: string; author?: string }) => {
            const text = `${item.title || ''} ${item.excerpt || ''} ${item.description || ''} ${item.author || ''}`.toLowerCase();
            return text.includes('crypto') || text.includes('bitcoin') || text.includes('coin') || text.includes('blockchain');
          });
        const cryptoNewsItems: CryptoNewsItem[] = (cryptoItems.length ? cryptoItems : rawItems.slice(0, 12))
          .map((item: { id?: string; link?: string; externalLink?: string; external_link?: string; title?: string; excerpt?: string; description?: string; contentSnippet?: string; image?: string; author?: string; creator?: string; date?: string; pubDate?: string; content?: string }) => ({
          id: item.id || item.link || crypto.randomUUID(),
          title: item.title || "Untitled",
          excerpt: item.excerpt || item.description || item.contentSnippet || "",
          category: "crypto-nigeria", // Default category for crypto content
          image: item.image || "https://images.unsplash.com/photo-1664575602540-9972445ad3bf?w=800",
          readTime: "5 min read", // Estimate
          author: item.author || item.creator || "Unknown",
          date: item.date || item.pubDate || new Date().toISOString(),
          externalLink: getArticleExternalLink(item),
          content: item.content || item.description || ""
        }));
        
        setCryptoNews(cryptoNewsItems);
        clearTimeout(timeoutId);
      } catch (error) {
        console.error("Error fetching crypto news:", error);
        // Fallback to mock data if backend fails
        const mockCryptoNews: CryptoNewsItem[] = [
          {
            id: "crypto-1",
            title: "Bitcoin Reaches New All-Time High",
            excerpt: "The leading cryptocurrency breaks through key resistance levels, sparking renewed investor interest.",
            category: "crypto-nigeria",
            image: "https://images.unsplash.com/photo-1664575602540-9972445ad3bf?w=800",
            readTime: "5 min read",
            author: "Crypto Reporter",
            date: new Date().toISOString(),
            externalLink: "#",
            content: "Bitcoin's latest rally signals growing institutional adoption."
          },
          {
            id: "crypto-2",
            title: "Nigerian Crypto Market Shows Resilience",
            excerpt: "Despite regulatory challenges, Nigerian crypto adoption continues to grow with innovative local solutions.",
            category: "crypto-nigeria",
            image: "https://images.unsplash.com/photo-1639762681057-47a944f0bda7?w=800",
            readTime: "4 min read",
            author: "Finance Editor",
            date: new Date().toISOString(),
            externalLink: "#",
            content: "Nigeria remains one of the world's leading crypto markets."
          }
        ];
        setCryptoNews(mockCryptoNews);
      } finally {
        setLoading(false);
      }
    };

    fetchCryptoNews();

    // Refresh every 10 minutes instead of 15 for better performance
    const interval = setInterval(fetchCryptoNews, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const totalPages = Math.ceil(cryptoNews.length / ARTICLES_PER_PAGE);
  const paginatedNews = cryptoNews.slice(
    (currentPage - 1) * ARTICLES_PER_PAGE,
    currentPage * ARTICLES_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO 
        title="Crypto & Tech News | Nigerian Startup Funding"
        description="Latest cryptocurrency trends, blockchain technology updates, and Nigerian tech startup funding news."
        keywords="Nigerian startup funding news, Crypto regulations in Africa, Tech news Africa, Bitcoin Africa, Web3 Nigeria"
      />
      <Header />
      <NewsTicker />
      <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden mb-12">
        <div className="absolute inset-0">
          <SimpleImage
            src="https://images.unsplash.com/photo-1664575602540-9972445ad3bf?w=800&q=75"
            alt="Crypto News"
            className="w-full h-full object-cover"
            fallback="https://placehold.co/800x400/000000/ffffff?text=Crypto+News"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/80 via-purple-500/80 to-pink-500/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80" />
          <div className="absolute inset-0 bg-background/60" />
        </div>

        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold">₿</span>
              </div>
              <div>
                <CategoryBadge category="crypto-nigeria" className="mb-2" />
                <span className="text-sm text-white/80 font-medium">CRYPTO NEWS</span>
              </div>
            </div>

            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Crypto Stories
            
          </h1>
          <div className="max-w-2xl mt-8">
            <CategorySearch 
              category="cryptonews"
              onSearchResults={(results) => setSearchResults(results as any)}
              onClearSearch={() => setSearchResults(null)}
            />
          </div>

            <p className="text-lg md:text-xl text-white/90 mb-8 max-w-3xl">
              Your gateway to the latest cryptocurrency news, market analysis, and blockchain developments.
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
                View All Crypto
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Latest News Grid */}
      <section id="latest" className="mb-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Latest Crypto News</h2>
          <CategoryBadge category="crypto-nigeria" />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="bg-card rounded-lg p-6 shadow-lg animate-pulse">
                <div className="h-48 bg-gray-300 rounded-lg mb-4"></div>
                <div className="h-6 bg-gray-300 rounded mb-2"></div>
                <div className="h-4 bg-gray-300 rounded mb-4"></div>
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : cryptoNews.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
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
        ) : (
          <div className="text-center py-12">
            <h3 className="text-xl font-semibold mb-2">No crypto news found</h3>
            <p className="text-muted-foreground">Check back later for updates from the blockchain world.</p>
          </div>
        )}

        {/* Pagination */}
        {!loading && cryptoNews.length > 0 && (
          <>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
            <p className="text-center text-sm text-muted-foreground mb-4 mt-4">
              Page {currentPage} of {totalPages} · {cryptoNews.length} articles
            </p>
          </>
        )}
      </section>
      </div>
      <Footer />
    </div>
  );
};

export default CryptoNews;
