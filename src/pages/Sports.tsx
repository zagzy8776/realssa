import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import Parser from 'rss-parser';
import CategoryBadge from "../components/CategoryBadge";
import SimpleImage from "../components/SimpleImage";

type CategoryType = "afrobeats" | "nollywood" | "culture" | "fashion" | "tech" | "music" | "breaking" | "news" | "nigerian-news" | "nigerian-gaming" | "crypto-nigeria" | "lagos-fashion" | "nigerian-tech" | "nigerian-sports" | "nigerian-politics" | "nigerian-business" | "nigerian-lifestyle" | "entertainment" | "general";

interface SportsNewsItem {
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

const Sports = () => {
  const [sportsNews, setSportsNews] = useState<SportsNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parser = new Parser();

    const RSS_FEEDS = [
      // Start with these 8–10 strong ones (Nigerian + global football focus)
      "https://www.pulsesports.ng/feed",
      "https://www.goal.com/en-ng/rss",
      "https://www.sports247.ng/feed",
      "https://www.completesports.com/feed/",
      "https://guardian.ng/feed/?cat=football",
      "https://dailypost.ng/category/sports/feed/",
      "https://feeds.bbci.co.uk/sport/football/rss.xml",
      "https://www.espn.com/espn/rss/soccer/news",
      "https://www.skysports.com/rss/11095", // Sky Sports Football
      "https://www.goal.com/en/rss", // Global Goal
    ];

    const fetchSportsNews = async () => {
      setLoading(true);
      setError(null);
      const allItems: SportsNewsItem[] = [];

      try {
        for (const url of RSS_FEEDS) {
          try {
            const feed = await parser.parseURL(url);
            feed.items?.slice(0, 4).forEach((item, index) => { // Limit 4 per feed to avoid overload
              const title = item.title || "Untitled";
              const excerpt = item.contentSnippet || item.description || "";

              // Simple category inference — improve as needed
              let category: CategoryType = "nigerian-sports";
              if (title.toLowerCase().includes("super eagles") ||
                  title.toLowerCase().includes("npfl") ||
                  title.toLowerCase().includes("nigeria") ||
                  title.toLowerCase().includes("afcon")) {
                category = "nigerian-sports";
              } else if (excerpt.toLowerCase().includes("premier league") ||
                         title.toLowerCase().includes("champions league")) {
                category = "general"; // or add more categories
              }

              allItems.push({
                id: item.guid || item.link || `sports-${url}-${index}`,
                title,
                excerpt,
                category,
                // Image: try to extract from content (basic regex) or use fallback
                image: extractImageFromContent(item.content || item.description || "") ||
                       "https://images.unsplash.com/photo-1543113853-25e39c370c76?w=800",
                readTime: "5 min read", // Can estimate later
                author: item.creator || feed.title || "Unknown",
                date: item.isoDate || item.pubDate || new Date().toISOString(),
                externalLink: item.link || "#",
              });
            });
          } catch (feedErr) {
            console.warn(`Failed to parse feed ${url}:`, feedErr);
            // Continue to next feed — don't crash whole page
          }
        }

        // Sort newest first, take top 10–15
        const sorted = allItems
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 12);

        setSportsNews(sorted.length > 0 ? sorted : []); // fallback empty if all failed
      } catch (err) {
        console.error("RSS fetch error:", err);
        setError("Failed to load sports news. Check your connection or try later.");
      } finally {
        setLoading(false);
      }
    };

    fetchSportsNews();

    // Optional: auto-refresh every 30 minutes
    const interval = setInterval(fetchSportsNews, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Helper to extract first image from RSS content HTML (basic)
  const extractImageFromContent = (content: string) => {
    const match = content.match(/<img[^>]+src=["'](.*?)["']/i);
    return match ? match[1] : null;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden mb-12">
        <div className="absolute inset-0">
          <SimpleImage
            src="https://images.unsplash.com/photo-1543113853-25e39c370c76?w=1920"
            alt="Sports News"
            className="w-full h-full object-cover"
            fallback="https://placehold.co/1920x1080/000000/ffffff?text=Sports+News"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/80 via-green-500/80 to-red-500/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80" />
          <div className="absolute inset-0 bg-background/60" />
        </div>

        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold">⚽</span>
              </div>
              <CategoryBadge category="nigerian-sports" className="mb-2" />
              <span className="text-sm text-white/80 font-medium">SPORTS NEWS</span>
            </div>

            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Sports Stories
            </h1>

            <p className="text-lg md:text-xl text-white/90 mb-8 max-w-3xl">
              Your gateway to the latest sports news, scores, and highlights from Nigeria and beyond.
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
                View All Sports
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Latest News Grid */}
      <section id="latest" className="mb-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Latest Sports News</h2>
          <CategoryBadge category="nigerian-sports" />
        </div>

        {error && (
          <div className="text-center py-8 text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && sportsNews.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-xl font-bold mb-2">No Sports News Right Now</h3>
            <p className="text-muted-foreground">We're pulling the latest from Pulse, Goal, BBC and more. Check back soon!</p>
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
            {sportsNews.map((news) => (
              <article key={news.id} className="bg-card rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <div className="relative mb-4">
                  <SimpleImage
                    src={news.image}
                    alt={news.title}
                    className="w-full h-48 object-cover rounded-lg"
                    fallback="https://placehold.co/400x200/000000/ffffff?text=Sports+News"
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

export default Sports;
