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

// RSS feeds for crypto news
const RSS_FEEDS = [
  // Global / high-quality
  "https://cointelegraph.com/rss",
  "https://www.coindesk.com/arc/outboundfeeds/rss/",
  "https://cryptopotato.com/feed/",
  "https://cryptoslate.com/feed/",
  "https://news.bitcoin.com/feed/",
  "https://decrypt.co/feed",

  // Nigeria / Africa focused
  "https://nairametrics.com/category/cryptocurrency/feed/",
  "https://zycrypto.com/feed/",
  "https://blockvila.com/blog/feed/",
  "https://feeds.feedburner.com/nigeriabitcoincommunity",
  "https://sec.gov.ng/feeds/fintech-news.rss",
  "https://thecryptobasic.com/feed/"
];

// Helper function to infer category based on content
const inferCategory = (content: string): CategoryType => {
  const text = content.toLowerCase();
  if (text.includes("nigeria") || text.includes("nigerian") || text.includes("lagos") || text.includes("abuja")) {
    return "crypto-nigeria";
  }
  if (text.includes("bitcoin") || text.includes("btc")) {
    return "crypto-nigeria"; // Could be separate category if needed
  }
  if (text.includes("ethereum") || text.includes("eth")) {
    return "crypto-nigeria"; // Could be separate category if needed
  }
  return "crypto-nigeria"; // Default to crypto-nigeria for crypto content
};

// Helper function to extract image from content
const extractImage = (content: string): string | null => {
  const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
  if (imgMatch) {
    return imgMatch[1];
  }
  return null;
};

// Helper function to estimate read time
const calculateReadTime = (content: string): string => {
  const wordCount = content.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / 200); // Average reading speed
  return `${minutes} min read`;
};

const CryptoNews = () => {
  const [cryptoNews, setCryptoNews] = useState<CryptoNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCryptoNews = async () => {
      setLoading(true);
      setError(null);
      try {
        const allItems: CryptoNewsItem[] = [];

        // Fetch from RSS feeds
        for (const url of RSS_FEEDS) {
          try {
            const response = await fetch(`/api/rss?url=${encodeURIComponent(url)}`);
            if (!response.ok) continue;

            const feed = await response.json();
            
            feed.items?.slice(0, 3).forEach((item: { title?: string; content?: string; description?: string; creator?: string; guid?: string; link?: string; isoDate?: string; pubDate?: string }) => {
              const title = item.title || "Untitled";
              const content = item.content || item.description || "";
              const excerpt = content.replace(/<[^>]*>/g, "").substring(0, 150) + "...";
              const category = inferCategory(title + " " + content);
              const image = extractImage(content) || "https://images.unsplash.com/photo-1664575602540-9972445ad3bf?w=800";
              const readTime = calculateReadTime(content);
              const author = item.creator || feed.title || "Unknown";
              const date = item.isoDate || item.pubDate || new Date().toISOString();

              allItems.push({
                id: item.guid || item.link || crypto.randomUUID(),
                title,
                excerpt,
                category,
                image,
                readTime,
                author,
                date,
                externalLink: item.link || "#",
                content
              });
            });
          } catch (feedError) {
            console.warn(`Failed to fetch feed ${url}:`, feedError);
          }
        }

        // Sort by date, dedupe, and take top 10
        const sorted = allItems
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .filter((item, index, arr) => 
            arr.findIndex(t => t.title === item.title) === index // Remove duplicates
          )
          .slice(0, 10);

        setCryptoNews(sorted);
      } catch (err) {
        console.error("RSS fetch failed:", err);
        setError("Failed to load crypto news. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchCryptoNews();

    // Refresh every 15 minutes
    const interval = setInterval(fetchCryptoNews, 15 * 60 * 1000);
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

      {/* Error Message */}
      {error && (
        <div className="mb-8 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
          <p className="text-red-500">{error}</p>
        </div>
      )}

      {/* Latest News Grid */}
      <section id="latest" className="mb-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Latest Crypto News</h2>
          <CategoryBadge category="crypto-nigeria" />
        </div>

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
        ) : cryptoNews.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No crypto news available at the moment. Please check back later.</p>
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
                    target="_blank"
                    rel="noopener noreferrer"
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