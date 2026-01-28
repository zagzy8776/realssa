import Header from "@/components/Header";
import SocialButtons from "@/components/SocialButtons";
import HeroSection from "@/components/HeroSection";
import NewsCard from "@/components/NewsCard";
import SectionHeader from "@/components/SectionHeader";
import RotatingHeadlines from "@/components/RotatingHeadlines";
import Footer from "@/components/Footer";
import { NewsItem } from "@/data/newsData";
import { useEffect, useState } from "react";

const Index = () => {
  const [apiArticles, setApiArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingHistory, setReadingHistory] = useState<string[]>([]);

  // Load reading history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('readingHistory');
    if (savedHistory) {
      try {
        setReadingHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error("Failed to parse reading history:", error);
      }
    }
  }, []);

  // Auto-refresh content every 30 seconds
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch articles from backend API ONLY - no localStorage fallback
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/articles`);
        if (response.ok) {
          const articles = await response.json();
          setApiArticles(articles);
        } else {
          console.warn("Failed to fetch articles from API");
        }
      } catch (error) {
        console.error("Error fetching articles from API:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up auto-refresh interval
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Mark article as read and update history
  const markAsRead = (articleId: string) => {
    const newHistory = readingHistory.includes(articleId) 
      ? readingHistory 
      : [...readingHistory, articleId];
    
    setReadingHistory(newHistory);
    localStorage.setItem('readingHistory', JSON.stringify(newHistory));
  };

  // Get continue reading suggestions (articles not in history)
  const getContinueReading = () => {
    return apiArticles.filter(article => !readingHistory.includes(article.id)).slice(0, 3);
  };

  // Get recommendations based on reading history
  const getRecommendations = () => {
    if (readingHistory.length === 0) return apiArticles.slice(0, 4);
    
    // Get categories from reading history
    const readArticles = apiArticles.filter(article => readingHistory.includes(article.id));
    const readCategories = [...new Set(readArticles.map(article => article.category))];
    
    // Recommend articles from similar categories
    const recommendations = apiArticles.filter(article => 
      readCategories.includes(article.category) && !readingHistory.includes(article.id)
    );
    
    return recommendations.length > 0 ? recommendations.slice(0, 4) : apiArticles.slice(0, 4);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SocialButtons />
      <HeroSection />
      
      {/* Rotating Headlines Section */}
      <RotatingHeadlines />

      {/* Latest Stories Section - Admin Curated Content */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <SectionHeader title="Latest Stories" />
          
          {/* Show ONLY admin-posted articles in Latest Stories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Display ONLY API articles (admin-posted) */}
            {apiArticles.map((story, index) => (
              <div
                key={`api-${story.id}`}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <NewsCard
                  title={story.title}
                  excerpt={story.excerpt}
                  category={story.category}
                  image={story.image || "https://via.placeholder.com/400x250?text=EntertainmentGHC"}
                  readTime={story.readTime || "5 min read"}
                  date={story.date}
                  id={story.id}
                />
              </div>
            ))}
            
            {/* If no admin articles, show a message */}
            {apiArticles.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No articles posted yet. Admin can add content through the dashboard.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Continue Reading Section */}
      {readingHistory.length > 0 && getContinueReading().length > 0 && (
        <section className="py-12 md:py-16 bg-card/50">
          <div className="container mx-auto px-4">
            <SectionHeader title="Continue Reading" emoji="📚" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {getContinueReading().map((article, index) => (
                <NewsCard
                  key={`continue-${article.id}`}
                  title={article.title}
                  excerpt={article.excerpt}
                  category={article.category}
                  image={article.image || "https://via.placeholder.com/400x250?text=Continue+Reading"}
                  readTime={article.readTime || "5 min read"}
                  date={article.date}
                  id={article.id}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* You Might Also Like Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <SectionHeader title="You Might Also Like" emoji="🎯" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {getRecommendations().map((article, index) => (
              <NewsCard
                key={`recommend-${article.id}`}
                title={article.title}
                excerpt={article.excerpt}
                category={article.category}
                image={article.image || "https://via.placeholder.com/400x250?text=Recommended"}
                readTime={article.readTime || "5 min read"}
                date={article.date}
                id={article.id}
              />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
