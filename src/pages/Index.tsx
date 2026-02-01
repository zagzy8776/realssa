import Header from "@/components/Header";
import SocialButtons from "@/components/SocialButtons";
import HeroSection from "@/components/HeroSection";
import { SearchBar } from "@/components/SearchBar";
import NewsCard from "@/components/NewsCard";
import NewsCardSkeleton from "@/components/NewsCardSkeleton";
import SectionHeader from "@/components/SectionHeader";
import RotatingHeadlines from "@/components/RotatingHeadlines";
import Footer from "@/components/Footer";
import LazyAd from "@/components/LazyAd";
import { NewsItem } from "@/data/newsData";
import { useEffect, useState } from "react";
import ReadProgressBar from "@/components/ReadProgressBar";

const Index = () => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/articles');
      if (!response.ok) {
        throw new Error('Failed to fetch news');
      }
      const data = await response.json();
      setNewsItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ReadProgressBar />
      <Header />
      <SocialButtons />

      <main>
        <HeroSection />
        <SearchBar />

        {/* Latest Stories Section */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <SectionHeader
              title="Latest Stories"
            />

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <NewsCardSkeleton key={i} />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">{error}</p>
                <button
                  onClick={fetchNews}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {newsItems.slice(0, 9).map((item) => (
                  <NewsCard
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    excerpt={item.excerpt}
                    category={item.category}
                    image={item.image}
                    readTime={item.readTime}
                    date={item.date}
                    href={item.href}
                    externalLink={item.externalLink}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Rotating Headlines */}
        <section className="py-8 md:py-12 bg-muted/30">
          <div className="container mx-auto px-4">
            <RotatingHeadlines />
          </div>
        </section>

        {/* Advertisement */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4">
            <LazyAd />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
