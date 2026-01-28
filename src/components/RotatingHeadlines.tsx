import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import CategoryBadge from "@/components/CategoryBadge";
import { CategoryType } from "@/data/newsData";

interface HeadlineItem {
  id: string;
  title: string;
  category: CategoryType;
  image: string;
  readTime: string;
  date: string;
  excerpt: string;
  featured: boolean;
  contentType: string;
}

const RotatingHeadlines = () => {
  const [headlines, setHeadlines] = useState<HeadlineItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch featured articles for headlines
  useEffect(() => {
    const fetchHeadlines = async () => {
      try {
        setIsLoading(true);
        
        // Try to fetch from backend API first
        let apiArticles: HeadlineItem[] = [];
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/articles/featured`);
          if (response.ok) {
            apiArticles = await response.json();
          }
        } catch (apiError) {
          console.warn("API fetch failed for headlines:", apiError);
        }

        // Get user news from localStorage as fallback
        const userNews = JSON.parse(localStorage.getItem('userNews') || '[]');

        // Combine all sources and filter for featured content
        const allArticles = [...apiArticles, ...userNews];
        const featuredArticles = allArticles
          .filter((article: HeadlineItem) => article.featured || article.contentType === 'headline')
          .slice(0, 5); // Limit to 5 headlines maximum

        setHeadlines(featuredArticles);
      } catch (error) {
        console.error("Error fetching headlines:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHeadlines();
  }, []);

  // Auto-rotation effect
  useEffect(() => {
    if (!isPlaying || headlines.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % headlines.length);
    }, 8000); // Change every 8 seconds

    return () => clearInterval(interval);
  }, [isPlaying, headlines.length]);

  const nextHeadline = () => {
    setCurrentIndex((prev) => (prev + 1) % headlines.length);
  };

  const prevHeadline = () => {
    setCurrentIndex((prev) => (prev - 1 + headlines.length) % headlines.length);
  };

  const goToHeadline = (index: number) => {
    setCurrentIndex(index);
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 py-16">
        <div className="container mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                <div className="h-4 bg-gray-300 rounded w-5/6"></div>
              </div>
              <div className="h-64 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (headlines.length === 0) {
    return null;
  }

  const currentHeadline = headlines[currentIndex];

  return (
    <div className="bg-gradient-to-r from-primary/10 to-secondary/10 py-16">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold">Featured Headlines</h2>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-2"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <div className="flex gap-2">
              {headlines.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToHeadline(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-primary' : 'bg-gray-400'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="md:flex">
            <div className="md:w-1/2">
              <img
                src={currentHeadline.image}
                alt={currentHeadline.title}
                className="w-full h-64 md:h-full object-cover"
              />
            </div>
            <div className="md:w-1/2 p-8">
              <div className="flex items-center gap-4 mb-4">
                <CategoryBadge category={currentHeadline.category} />
                <span className="text-sm text-muted-foreground">{currentHeadline.date}</span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{currentHeadline.readTime}</span>
              </div>
              
              <h3 className="text-2xl font-bold mb-4 line-clamp-3">
                {currentHeadline.title}
              </h3>
              
              <p className="text-muted-foreground mb-6 line-clamp-4">
                {currentHeadline.excerpt}
              </p>

              <div className="flex items-center justify-between">
                <Link to={`/article/${currentHeadline.id}`}>
                  <Button variant="outline">
                    Read Full Story
                  </Button>
                </Link>
                
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={prevHeadline}
                    disabled={headlines.length <= 1}
                    className="flex items-center gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={nextHeadline}
                    disabled={headlines.length <= 1}
                    className="flex items-center gap-2"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Mini preview thumbnails */}
        {headlines.length > 1 && (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4">
            {headlines.map((headline, index) => (
              <button
                key={headline.id}
                onClick={() => goToHeadline(index)}
                className={`relative group overflow-hidden rounded-lg transition-transform ${
                  index === currentIndex ? 'scale-105' : 'scale-100 hover:scale-105'
                }`}
              >
                <img
                  src={headline.image}
                  alt={headline.title}
                  className="w-full h-24 object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">View</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <span className="text-white text-xs truncate block">{headline.title}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RotatingHeadlines;