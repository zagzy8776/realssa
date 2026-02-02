import { ArrowRight } from "lucide-react";
import CategoryBadge from "./CategoryBadge";
import SimpleImage from "./SimpleImage";
import { useEffect, useState } from "react";

interface NigerianNewsItem {
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

interface HeroSectionProps {
  stories?: NigerianNewsItem[];
}

const HeroSection = ({ stories }: HeroSectionProps) => {
  const [breakingNews, setBreakingNews] = useState<NigerianNewsItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBreakingNews = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/news/nigerian`);
        if (response.ok) {
          const news = await response.json();
          if (news.length > 0) {
            setBreakingNews(news[0]); // Use the most recent story as breaking news
          }
        }
      } catch (error) {
        console.error("Error fetching breaking news:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBreakingNews();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchBreakingNews, 30000);
    return () => clearInterval(interval);
  }, []);

  const latestStory = stories?.[0];
  const heroImage = latestStory?.image || "https://images.unsplash.com/photo-1504711432869-001077659a9a?w=800";

  return (
    <section className="relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <SimpleImage
          src={heroImage}
          alt={breakingNews?.title || "Nigerian news"}
          className="w-full h-full object-cover transition-all duration-1000"
          fallback="https://placehold.co/1920x1080/FFA500/000000?text=Nigerian+News"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/80 via-red-500/80 to-yellow-500/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80" />
        <div className="absolute inset-0 bg-background/60" />
      </div>

      {/* Content */}
      <div className="relative container mx-auto px-4 py-16 md:py-24 lg:py-32">
        <div className="max-w-4xl animate-fade-in">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold">🇳🇬</span>
            </div>
            <div>
              <CategoryBadge category="nigerian-news" className="mb-2" />
              <span className="text-sm text-white/80 font-medium">BREAKING NEWS</span>
            </div>
          </div>
          
          {loading ? (
            <div>
              <div className="h-12 bg-white/20 rounded-lg mb-6 animate-pulse"></div>
              <div className="h-6 bg-white/20 rounded-lg mb-4 animate-pulse w-3/4"></div>
              <div className="h-6 bg-white/20 rounded-lg mb-4 animate-pulse w-1/2"></div>
            </div>
          ) : breakingNews ? (
            <>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-tight mb-6 line-clamp-3">
                {breakingNews.title}
              </h1>

              <p className="text-lg md:text-xl text-white/90 mb-8 max-w-3xl line-clamp-3">
                {breakingNews.excerpt || breakingNews.content?.substring(0, 150) + '...'}
              </p>

              <div className="flex flex-wrap items-center gap-6 text-sm text-white/80 mb-10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>{breakingNews.category || 'Featured'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>{new Date(breakingNews.date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>{breakingNews.readTime || '5 min read'}</span>
                </div>
              </div>


            </>
          ) : (
            <div>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-tight mb-6">
                EntertainmentGHC News
              </h1>

              <p className="text-lg md:text-xl text-white/90 mb-8 max-w-3xl">
                Your ultimate destination for African entertainment news, culture, and lifestyle. Stay informed with the latest stories from across the continent.
              </p>
            </div>
          )}
          
          <div className="flex flex-wrap gap-4">
            <a
              href={breakingNews?.externalLink || "/nigerian-news"}
              target={breakingNews ? "_blank" : "_self"}
              rel={breakingNews ? "noopener noreferrer" : ""}
              className="inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-900 font-bold rounded-full hover:shadow-xl transition-all duration-300 hover:scale-105 group"
            >
              {breakingNews ? "Read Full Story" : "Read Latest News"}
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
  );
};

export default HeroSection;
