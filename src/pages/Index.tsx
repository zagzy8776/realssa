import Header from "@/components/Header";
import SocialButtons from "@/components/SocialButtons";
import HeroSection from "@/components/HeroSection";
import NewsCard from "@/components/NewsCard";
import SectionHeader from "@/components/SectionHeader";
import RotatingHeadlines from "@/components/RotatingHeadlines";
import Footer from "@/components/Footer";
import { NewsItem, CategoryType } from "@/data/newsData";
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
}

const Index = () => {
  const [apiArticles, setApiArticles] = useState<NewsItem[]>([]);
  const [nigerianNews, setNigerianNews] = useState<NigerianNewsItem[]>([]);
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

    // Fetch Nigerian news from RSS parser
    const fetchNigerianNews = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/nigerian-news`);
        if (response.ok) {
          const news = await response.json();
          setNigerianNews(news.slice(0, 6)); // Show only first 6 articles
        }
      } catch (error) {
        console.error("Error fetching Nigerian news:", error);
      }
    };

    fetchData();
    fetchNigerianNews();

    // Set up auto-refresh interval
    const interval = setInterval(() => {
      fetchData();
      fetchNigerianNews();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <SocialButtons />
      <HeroSection />
      
      {/* Rotating Headlines Section */}
      <section className="py-6 bg-orange-500">
        <div className="container mx-auto px-4">
          <RotatingHeadlines />
        </div>
      </section>

      {/* Featured Nigerian News - Clean Design */}
      {nigerianNews.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            {/* Section Header */}
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Featured Nigerian News</h2>
              <p className="text-xl text-gray-600">Today's most important stories from Nigeria</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Featured Story */}
              <div className="lg:col-span-2 cursor-pointer" onClick={() => window.open(nigerianNews[0].externalLink, '_blank')}>
                <div className="relative overflow-hidden rounded-xl">
                  <img 
                    src={nigerianNews[0].image} 
                    alt={nigerianNews[0].title}
                    className="w-full h-96 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/800x400?text=Featured+Nigerian+News';
                    }}
                  />
                  <div className="absolute top-4 left-4">
                    <div className="bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
                      FEATURED STORY
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-8">
                    <div className="flex items-center gap-4 mb-4">
                      <span className="bg-white/90 text-gray-900 px-3 py-1 rounded-full text-sm font-semibold">
                        {nigerianNews[0].author}
                      </span>
                      <span className="text-white/80 text-sm">
                        {new Date(nigerianNews[0].date).toLocaleDateString()}
                      </span>
                    </div>
                    <h2 className="text-white text-3xl font-bold leading-tight">
                      {nigerianNews[0].title}
                    </h2>
                  </div>
                </div>
                <div className="mt-6 bg-white rounded-xl p-6 shadow-sm">
                  <p className="text-gray-700 text-lg leading-relaxed mb-4">
                    {nigerianNews[0].excerpt}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-orange-500 font-semibold">Read Full Story →</span>
                    <span className="text-gray-500 text-sm">{nigerianNews[0].readTime}</span>
                  </div>
                </div>
              </div>

              {/* Secondary Featured Stories */}
              <div className="space-y-6">
                {nigerianNews.slice(1, 3).map((article, index) => (
                  <div 
                    key={`secondary-${article.id}`}
                    className="cursor-pointer bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                    onClick={() => window.open(article.externalLink, '_blank')}
                  >
                    <div className="relative overflow-hidden rounded-lg mb-4">
                      <img 
                        src={article.image} 
                        alt={article.title}
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/400x200?text=Nigerian+News';
                        }}
                      />
                      <div className="absolute top-2 right-2">
                        <div className="bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                          NIGERIAN NEWS
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-bold text-gray-900 text-xl line-clamp-2">
                        {article.title}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span>{article.author}</span>
                        <span>•</span>
                        <span>{new Date(article.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
                        {article.excerpt}
                      </p>
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <span className="text-orange-500 font-semibold text-sm">Read More →</span>
                        <span className="text-gray-400 text-xs">{article.readTime}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* World News Section */}
      {nigerianNews.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">🌍 World News</h2>
              <p className="text-xl text-gray-600">Global stories that matter</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {nigerianNews
                .filter(article => ['BBC News', 'Al Jazeera', 'Variety', 'Rolling Stone', 'The Verge', 'Wired', 'ESPN', 'CoinDesk', 'CoinTelegraph', 'IGN', 'GameSpot', 'PC Gamer', 'Kotaku', 'The Business of Fashion', 'Fashionista', 'WWD'].includes(article.author))
                .slice(0, 6)
                .map((article, index) => (
                  <div 
                    key={`world-${article.id}`} 
                    className="cursor-pointer bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                    onClick={() => window.open(article.externalLink, '_blank')}
                  >
                    <div className="relative overflow-hidden rounded-lg mb-4">
                      <img 
                        src={article.image} 
                        alt={article.title}
                        className="w-full h-56 object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/400x250?text=World+News';
                        }}
                      />
                      <div className="absolute top-2 right-2">
                        <div className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
                          WORLD NEWS
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                          {article.author}
                        </span>
                        <span className="text-gray-500 text-sm">{new Date(article.date).toLocaleDateString()}</span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-lg line-clamp-2">
                        {article.title}
                      </h3>
                      <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
                        {article.excerpt}
                      </p>
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <span className="text-blue-600 font-semibold text-sm">Read Full Story →</span>
                        <span className="text-gray-400 text-xs">{article.readTime}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            <div className="text-center mt-10">
              <a href="/world-news" className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-full text-lg font-semibold hover:bg-blue-700 transition-colors">
                <span>🌍</span>
                View All World News
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Continue Reading Section */}
      {readingHistory.length > 0 && getContinueReading().length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">📚 Continue Reading</h2>
              <p className="text-xl text-gray-600">Stories you might have missed</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {getContinueReading().map((article, index) => (
                <div 
                  key={`continue-${article.id}`}
                  className="cursor-pointer bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="relative overflow-hidden rounded-lg mb-4">
                    <img 
                      src={article.image} 
                      alt={article.title}
                      className="w-full h-56 object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/400x250?text=Continue+Reading';
                      }}
                    />
                    <div className="absolute top-2 right-2">
                      <div className="bg-purple-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
                        CONTINUE
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                        {article.category}
                      </span>
                      <span className="text-gray-500 text-sm">{new Date(article.date).toLocaleDateString()}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
                      {article.excerpt}
                    </p>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <span className="text-purple-600 font-semibold text-sm">Continue Reading →</span>
                      <span className="text-gray-400 text-xs">{article.readTime}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* You Might Also Like Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">🎯 You Might Also Like</h2>
            <p className="text-xl text-gray-600">Personalized recommendations just for you</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {getRecommendations().map((article, index) => (
              <div 
                key={`recommend-${article.id}`}
                className="cursor-pointer bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="relative overflow-hidden rounded-lg mb-4">
                  <img 
                    src={article.image} 
                    alt={article.title}
                    className="w-full h-56 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/400x250?text=Recommended';
                    }}
                  />
                  <div className="absolute top-2 right-2">
                    <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                      RECOMMENDED
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                      {article.category}
                    </span>
                    <span className="text-gray-500 text-sm">{new Date(article.date).toLocaleDateString()}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
                    {article.excerpt}
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-green-600 font-semibold text-sm">Read More →</span>
                    <span className="text-gray-400 text-xs">{article.readTime}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default Index;
