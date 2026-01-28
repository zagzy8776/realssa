import Header from "@/components/Header";
import SocialButtons from "@/components/SocialButtons";
import HeroSection from "@/components/HeroSection";
import NewsCard from "@/components/NewsCard";
import SectionHeader from "@/components/SectionHeader";
import RotatingHeadlines from "@/components/RotatingHeadlines";
import Footer from "@/components/Footer";
import { latestStories, nigeriaNews, NewsItem } from "@/data/newsData";
import { useEffect, useState } from "react";

const Index = () => {
  const [userNews, setUserNews] = useState<NewsItem[]>([]);
  const [apiArticles, setApiArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Load user-posted news from localStorage
      const storedNews = localStorage.getItem('userNews');
      if (storedNews) {
        try {
          setUserNews(JSON.parse(storedNews));
        } catch (error) {
          console.error("Failed to parse user news:", error);
        }
      }

      // Fetch articles from backend API
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
  }, []);

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
          
          {/* Show admin-posted articles and user-posted articles in Latest Stories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Display API articles first (admin-posted) */}
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

            {/* Display user-posted news */}
            {userNews.map((story, index) => (
              <div
                key={`user-${story.id}`}
                className="animate-fade-in"
                style={{ animationDelay: `${(apiArticles.length + index) * 100}ms` }}
              >
                <NewsCard
                  title={story.title}
                  excerpt={story.excerpt}
                  category={story.category}
                  image={story.image || "https://via.placeholder.com/400x250?text=EntertainmentGHC"}
                  readTime={story.readTime}
                  date={story.date}
                  id={story.id}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nigeria News Section */}
      <section className="py-12 md:py-16 bg-card/50">
        <div className="container mx-auto px-4">
          <SectionHeader title="Nigeria Entertainment News" emoji="🇳🇬" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {nigeriaNews.map((story, index) => (
              <div
                key={story.id}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <NewsCard
                  title={story.title}
                  excerpt={story.excerpt}
                  category={story.category}
                  image={story.image}
                  readTime={story.readTime}
                  date={story.date}
                  href={story.href}
                />
              </div>
            ))}
          </div>
        </div>
      </section>


      <Footer />
    </div>
  );
};

export default Index;