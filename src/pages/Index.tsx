import Header from "@/components/Header";
import SocialButtons from "@/components/SocialButtons";
import HeroSection from "@/components/HeroSection";
import { SearchBar } from "@/components/SearchBar";
import NewsCard from "@/components/NewsCard";
import NewsCardSkeleton from "@/components/NewsCardSkeleton";
import SectionHeader from "@/components/SectionHeader";
import Footer from "@/components/Footer";
import LazyAd from "@/components/LazyAd";
import { NewsItem } from "@/data/newsData";
import { useEffect, useState } from "react";
import ReadProgressBar from "@/components/ReadProgressBar";

const Index = () => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchNews();
  }, []);

  // Auto-rotate featured stories every 5 seconds
  useEffect(() => {
    if (newsItems.length > 0) {
      const timer = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % newsItems.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [newsItems]);

  const fetchNews = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/news/featured`);
      if (!response.ok) {
        throw new Error('Failed to fetch news');
      }
      const data = await response.json();
      setNewsItems(data);
    } catch (err) {
      console.error('Error fetching news:', err);
      setError('News temporarily unavailable');
    } finally {
      setLoading(false);
    }
  };

  // Get current story for main display
  const currentStory = newsItems[currentIndex];

  // Fallback image function
  const getFallbackImage = (item: NewsItem) => {
    if (item.image && item.image !== 'https://placehold.co/600x400') {
      return item.image;
    }
    
    // Generate category-specific fallback images
    const title = (item.title || '').toLowerCase();
    if (title.includes('nigeria') || title.includes('africa')) {
      return 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=800&auto=format&fit=crop';
    } else if (title.includes('music') || title.includes('artist') || title.includes('entertainment')) {
      return 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=800&auto=format&fit=crop';
    } else if (title.includes('politics') || title.includes('government')) {
      return 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?q=80&w=800&auto=format&fit=crop';
    } else if (title.includes('business') || title.includes('economy')) {
      return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800&auto=format&fit=crop';
    } else if (title.includes('sports') || title.includes('football')) {
      return 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=800&auto=format&fit=crop';
    } else {
      return 'https://images.unsplash.com/photo-1504711432869-001077659a9a?q=80&w=800&auto=format&fit=crop';
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

        {/* Auto-Rotating Hero Slider */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            {loading ? (
              <div className="bg-gray-100 rounded-lg p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading latest stories...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">{error}</p>
                <button
                  onClick={fetchNews}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : newsItems.length > 0 ? (
              <div className="relative">
                {/* Current Story Display */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="relative h-64 md:h-auto">
                      <img
                        src={getFallbackImage(currentStory)}
                        alt={currentStory.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = getFallbackImage(currentStory);
                        }}
                      />
                      <div className="absolute top-4 left-4">
                        <span className="bg-black/70 text-white px-2 py-1 text-sm rounded">
                          {currentStory.category}
                        </span>
                      </div>
                    </div>
                    <div className="p-6">
                      <h2 className="text-2xl font-bold mb-4 line-clamp-3">
                        {currentStory.title}
                      </h2>
                      <p className="text-muted-foreground mb-6 line-clamp-4">
                        {currentStory.excerpt}
                      </p>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                        <span>{currentStory.author || 'Realssa'}</span>
                        <span>{new Date(currentStory.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-4">
                        <button
                          onClick={() => window.open(currentStory.externalLink || `/article/${currentStory.id}`, '_blank')}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                          Read Full Story
                        </button>
                        <button
                          onClick={() => setCurrentIndex((prev) => (prev + 1) % newsItems.length)}
                          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                        >
                          Next Story
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Story Navigation */}
                <div className="flex justify-center mt-6 space-x-2">
                  {newsItems.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      className={`w-3 h-3 rounded-full transition-colors ${
                        index === currentIndex ? 'bg-primary' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No stories available at the moment.</p>
              </div>
            )}
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
