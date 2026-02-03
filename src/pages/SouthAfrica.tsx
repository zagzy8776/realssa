import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import CategoryBadge from "../components/CategoryBadge";
import SimpleImage from "../components/SimpleImage";

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

const SouthAfrica = () => {
  const [southAfricaNews, setSouthAfricaNews] = useState<SouthAfricaNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSouthAfricaNews = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/news/south-africa`);
        if (response.ok) {
          const data = await response.json();

          // Map API response to component's expected format
          const mappedData: SouthAfricaNewsItem[] = data.map((item: ApiSouthAfricaItem) => {
            // Category inference based on content
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
          setError("Failed to fetch South Africa news");
        }
      } catch (err) {
        console.error("Error fetching South Africa news:", err);
        setError("Network error while fetching news");
      } finally {
        setLoading(false);
      }
    };

    fetchSouthAfricaNews();

    // Optional: auto-refresh every 30 minutes
    const interval = setInterval(fetchSouthAfricaNews, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden mb-12">
        <div className="absolute inset-0">
          <SimpleImage
            src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1920"
            alt="South Africa News"
            className="w-full h-full object-cover"
            fallback="https://placehold.co/1920x1080/000000/ffffff?text=South+Africa+News"
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
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Latest South Africa News</h2>
          <CategoryBadge category="news" />
        </div>

        {error && (
          <div className="text-center py-8 text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && southAfricaNews.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-xl font-bold mb-2">No South Africa News Right Now</h3>
            <p className="text-muted-foreground">We're pulling the latest from News24, IOL, and more. Check back soon!</p>
          </div>
        )}

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
            {southAfricaNews.map((news) => (
              <article key={news.id} className="bg-card rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <div className="relative mb-4">
                  <SimpleImage
                    src={news.image}
                    alt={news.title}
                    className="w-full h-48 object-cover rounded-lg"
                    fallback="https://placehold.co/400x200/000000/ffffff?text=South+Africa+News"
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

export default SouthAfrica;