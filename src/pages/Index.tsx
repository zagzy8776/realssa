import Header from "@/components/Header";
import SocialButtons from "@/components/SocialButtons";
import HeroSection from "@/components/HeroSection";
import NewsCard from "@/components/NewsCard";
import SectionHeader from "@/components/SectionHeader";
import Footer from "@/components/Footer";
import { latestStories, nigeriaNews, NewsItem } from "@/data/newsData";
import { useEffect, useState } from "react";

const Index = () => {
  const [userNews, setUserNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    // Load user-posted news from localStorage
    const storedNews = localStorage.getItem('userNews');
    if (storedNews) {
      try {
        setUserNews(JSON.parse(storedNews));
      } catch (error) {
        console.error("Failed to parse user news:", error);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SocialButtons />
      <HeroSection />

      {/* Latest Stories Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <SectionHeader title="Latest Stories" />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {latestStories.map((story, index) => (
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

      {/* User Posted News Section - Only show if there are user-posted articles */}
          {userNews.length > 0 && (
            <section className="py-12 md:py-16">
              <div className="container mx-auto px-4">
                <SectionHeader title="Community News" emoji="📰" />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {userNews.map((story, index) => (
                    <div
                      key={story.id}
                      className="animate-fade-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <NewsCard
                        title={story.title}
                        excerpt={story.excerpt}
                        category={story.category}
                        image={story.image || "https://via.placeholder.com/400x250?text=EntertainmentGHC"} // Fallback to placeholder image
                        readTime={story.readTime}
                        date={story.date}
                        href={`/article/${story.id}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

      <Footer />
    </div>
  );
};

export default Index;