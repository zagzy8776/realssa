import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import CategoryBadge from "../components/CategoryBadge";
import SimpleImage from "../components/SimpleImage";

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

const CryptoNews = () => {
  const [cryptoNews, setCryptoNews] = useState<CryptoNewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCryptoNews = async () => {
      setLoading(true);
      try {
        // Use AbortController for timeout and cleanup
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        // Fetch crypto news from backend RSS feeds with caching
        const response = await fetch('/api/crypto-news', {
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
        const cryptoNewsItems: CryptoNewsItem[] = data.map((item: { id?: string; link?: string; title?: string; excerpt?: string; description?: string; contentSnippet?: string; image?: string; author?: string; creator?: string; date?: string; pubDate?: string; content?: string }) => ({
          id: item.id || item.link || crypto.randomUUID(),
          title: item.title || "Untitled",
          excerpt: item.excerpt || item.description || item.contentSnippet || "",
          category: "crypto-nigeria", // Default category for crypto content
          image: item.image || "https://images.unsplash.com/photo-1664575602540-9972445ad3bf?w=800",
          readTime: "5 min read", // Estimate
          author: item.author || item.creator || "Unknown",
          date: item.date || item.pubDate || new Date().toISOString(),
          externalLink: item.link || "#",
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

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden mb-12">
        <div className="absolute inset-0">
          <SimpleImage
            src="https://images.unsplash.com/photo-1664575602540-9972445ad3bf?w=1920"
            alt="Crypto News"
            className="w-full h-full object-cover"
            fallback="https://placehold.co/1920x1080/000000/ffffff?text=Crypto+News"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[...Array(2)].map((_, index) => (
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
            {cryptoNews.map((news) => (
              <article key={news.id} className="bg-card rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <div className="relative mb-4">
                  <SimpleImage
                    src={news.image}
                    alt={news.title}
                    className="w-full h-48 object-cover rounded-lg"
                    fallback="https://placehold.co/400x200/000000/ffffff?text=Crypto+News"
                  />
                  <div className="absolute top-4 left-4">
                    <CategoryBadge category={news.category} />
                  </div>
                </div>

                <h3 className="text-xl font-bold mb-2 line-clamp-2">{news.title}</h3>
                <p className="text-muted-foreground mb-4 line-clamp-3">{news.excerpt}</p>

                <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                  <span>{news.author}</span>
                  <span>{new Date(news.date).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{news.readTime}</span>
                  <a
                    href={news.externalLink}
                    className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium"
                  >
                    Read Full Story
                    <ArrowRight size={16} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default CryptoNews;