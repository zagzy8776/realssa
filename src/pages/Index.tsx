import Header from "@/components/Header";
import SocialButtons from "@/components/SocialButtons";
import HeroSection from "@/components/HeroSection";
import NewsCard from "@/components/NewsCard";
import NewsCardSkeleton from "@/components/NewsCardSkeleton";
import SectionHeader from "@/components/SectionHeader";
import RotatingHeadlines from "@/components/RotatingHeadlines";
import Footer from "@/components/Footer";
import LazyAd from "@/components/LazyAd";
import { NewsItem, CategoryType } from "@/data/newsData";
import { useEffect, useState } from "react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import ReadProgressBar from "@/components/ReadProgressBar";

interface NewsFeedItem {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  image: string;
  readTime: string;
  author: string;
  date: string;
  externalLink: string;
  source: string;
}

const Index = () => {
  const [apiArticles, setApiArticles] = useState<NewsItem[]>([]);
  const [nigerianNews, setNigerianNews] = useState<NewsFeedItem[]>([]);
  const [worldNews, setWorldNews] = useState<NewsFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingHistory, setReadingHistory] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Holographic Depth State
  const [gyroData, setGyroData] = useState({ beta: 0, gamma: 0, alpha: 0 });
  const [isGyroSupported, setIsGyroSupported] = useState(false);
  const [breakingNewsAlert, setBreakingNewsAlert] = useState(false);

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

  // Fetch all news data
  const fetchAllNews = async () => {
    setLoading(true);

    try {
      // Fetch articles from backend API
      const articlesResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/articles`);
      if (articlesResponse.ok) {
        const articles = await articlesResponse.json();
        setApiArticles(articles);
      }

      // Fetch Nigerian news
      const nigerianResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/news/nigerian`);
      if (nigerianResponse.ok) {
        const nigerian = await nigerianResponse.json();
        setNigerianNews(nigerian.slice(0, 10));
      }

      // Fetch World news
      const worldResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/news/world`);
      if (worldResponse.ok) {
        const world = await worldResponse.json();
        setWorldNews(world.slice(0, 10));
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching news:", error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh content every minute
  useEffect(() => {
    fetchAllNews();

    // Set up auto-refresh interval (1 minute)
    const interval = setInterval(() => {
      fetchAllNews();
    }, 60000); // Refresh every 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Holographic Depth Effects
  useEffect(() => {
    // Check for gyroscope support
    if (window.DeviceOrientationEvent && 'ontouchstart' in window) {
      setIsGyroSupported(true);
      
      const handleOrientation = (event: DeviceOrientationEvent) => {
        const { beta, gamma, alpha } = event;
        if (beta !== null && gamma !== null) {
          setGyroData({
            beta: beta,
            gamma: gamma,
            alpha: alpha || 0
          });
        }
      };

      window.addEventListener('deviceorientation', handleOrientation);
      
      // Simulate breaking news alert every 30 seconds
      const alertInterval = setInterval(() => {
        setBreakingNewsAlert(true);
        setTimeout(() => setBreakingNewsAlert(false), 3000);
      }, 30000);

      return () => {
        window.removeEventListener('deviceorientation', handleOrientation);
        clearInterval(alertInterval);
      };
    }
  }, []);

  // Calculate holographic depth transforms
  const getHolographicTransform = () => {
    if (!isGyroSupported) return {};
    
    const { beta, gamma } = gyroData;
    const tiltX = (gamma / 45) * 10; // Max 10px tilt
    const tiltY = (beta / 45) * 10;  // Max 10px tilt
    const depth = Math.min(Math.max((beta + 45) / 90, 0), 1); // 0 to 1 depth
    
    return {
      transform: `translate3d(${tiltX}px, ${tiltY}px, 0) scale(${0.98 + (depth * 0.02)})`,
      filter: `blur(${(1 - depth) * 0.5}px)`,
      transition: 'transform 0.1s ease-out, filter 0.1s ease-out'
    };
  };

  // Get breaking news animation class
  const getBreakingNewsClass = () => {
    return breakingNewsAlert 
      ? 'animate-pulse shadow-[0_0_20px_rgba(255,0,0,0.5)] scale-105' 
      : 'shadow-lg';
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100"
      style={getHolographicTransform()}
    >
      <Header />
      <SocialButtons />
      <HeroSection />
      
      {/* Rotating Headlines Section */}
      <section className="py-6 bg-orange-500">
        <div className="container mx-auto px-4">
          <RotatingHeadlines />
        </div>
      </section>

      {/* Nigeria's Most Trusted News Sources - Rotating Headlines */}
      {nigerianNews.length > 0 && (
        <section className="py-16 bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-white mb-4">🇳🇬 Nigeria's Most Trusted News Sources</h2>
              <p className="text-xl text-white/90 mb-8">Breaking headlines from Nigeria's leading news outlets</p>
            </div>
            
            {/* Rotating Headlines Display */}
            <div className={`bg-white/95 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/20 ${getBreakingNewsClass()}`}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Main Headline */}
                <div className="lg:col-span-1">
                  <div className="relative overflow-hidden rounded-xl h-64 lg:h-96">
                    <img 
                      src={nigerianNews[0].image} 
                      alt={nigerianNews[0].title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/600x400?text=Nigerian+News+Headline';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
                    <div className="absolute bottom-6 left-6 right-6">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="bg-white text-orange-600 px-4 py-2 rounded-full font-bold text-sm">
                          {nigerianNews[0].author}
                        </span>
                        <span className="text-white/80 text-sm">
                          {new Date(nigerianNews[0].date).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-white text-2xl lg:text-3xl font-bold leading-tight line-clamp-3">
                        {nigerianNews[0].title}
                      </h3>
                      <p className="text-white/90 text-sm mt-2 line-clamp-2">
                        {nigerianNews[0].excerpt}
                      </p>
                      <button 
                        className="mt-4 bg-orange-500 text-white px-6 py-2 rounded-full font-semibold hover:bg-orange-600 transition-colors"
                        onClick={() => window.open(nigerianNews[0].externalLink, '_blank')}
                      >
                        Read Full Story →
                      </button>
                    </div>
                  </div>
                </div>

                {/* Secondary Headlines */}
                <div className="lg:col-span-1 space-y-6">
                  {nigerianNews.slice(1, 4).map((article, index) => (
                    <div 
                      key={`trusted-${article.id}`}
                      className="bg-white/90 backdrop-blur-sm rounded-xl p-6 hover:bg-white/95 transition-all duration-300 cursor-pointer border border-white/30 shadow-lg hover:shadow-xl transform hover:scale-105"
                      onClick={() => window.open(article.externalLink, '_blank')}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-20 h-16 bg-gray-300 rounded-lg overflow-hidden">
                          <img 
                            src={article.image} 
                            alt={article.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/80x64?text=News';
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-semibold">
                              {article.author}
                            </span>
                            <span className="text-gray-500 text-xs">
                              {new Date(article.date).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="font-bold text-gray-900 text-lg line-clamp-2 mb-2">
                            {article.title}
                          </h4>
                          <p className="text-gray-600 text-sm line-clamp-2">
                            {article.excerpt}
                          </p>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-orange-500 text-sm font-semibold">Read More →</span>
                            <span className="text-gray-400 text-xs">{article.readTime}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* News Source Badges */}
            <div className="text-center mt-8">
              <div className="flex flex-wrap justify-center gap-4">
                {['Premium Times', 'Vanguard', 'Punch', 'Guardian', 'ThisDay', 'The Cable'].map((source, index) => (
                  <span key={source} className="bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium">
                    {source}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* News Feed Section with Selectors */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {/* Top Banner Ad */}
          <div className="mb-8">
            <LazyAd adType="banner" />
          </div>

          {/* News Feed Header with Selectors */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">📰 Latest News Feed</h2>
            <p className="text-xl text-gray-600 mb-8">Stay updated with the latest stories from Nigeria and around the world</p>
            
            {/* News Selectors */}
            <div className="flex justify-center gap-4 mb-8">
              <button className="bg-orange-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-orange-600 transition-colors">
                🇳🇬 Nigerian News
              </button>
              <button className="bg-blue-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-600 transition-colors">
                🌍 World News
              </button>
              <button className="bg-gray-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-600 transition-colors">
                🔄 Live Updates
              </button>
            </div>
            
            {/* Last Updated Info */}
            <div className="text-sm text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
              {loading && <span className="ml-2 animate-pulse">• Updating...</span>}
            </div>
          </div>

          {/* Nigerian News Grid */}
          {nigerianNews.length > 0 && (
            <div className="mb-16">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-3xl font-bold text-gray-900">🇳🇬 Nigerian News</h3>
                <a href="/nigerian-news" className="text-orange-500 font-semibold hover:text-orange-600">
                  View All →
                </a>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Story */}
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
                      <h2 className="text-white text-3xl font-bold leading-tight line-clamp-3">
                        {nigerianNews[0].title}
                      </h2>
                    </div>
                  </div>
                  <div className="mt-6 bg-white rounded-xl p-6 shadow-sm">
                    <p className="text-gray-700 text-lg leading-relaxed mb-4 line-clamp-3">
                      {nigerianNews[0].excerpt}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-orange-500 font-semibold">Read Full Story →</span>
                      <span className="text-gray-500 text-sm">{nigerianNews[0].readTime}</span>
                    </div>
                  </div>
                </div>

                {/* Secondary Stories */}
                <div className="space-y-6">
                  {nigerianNews.slice(1, 4).map((article, index) => (
                    <div 
                      key={`nigerian-${article.id}`}
                      className="cursor-pointer bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/30 hover:border-orange-200 transform hover:scale-105"
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
                            NIGERIAN
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h3 className="font-bold text-gray-900 text-lg line-clamp-2">
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
          )}

          {/* World News Grid */}
          {worldNews.length > 0 && (
            <div className="mb-16">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-3xl font-bold text-gray-900">🌍 World News</h3>
                <a href="/world-news" className="text-blue-500 font-semibold hover:text-blue-600">
                  View All →
                </a>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {worldNews.slice(0, 6).map((article, index) => (
                  <div 
                    key={`world-${article.id}`} 
                    className="cursor-pointer bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/30 hover:border-blue-200 transform hover:scale-105"
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
            </div>
          )}
        </div>
      </section>

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
                  className="cursor-pointer bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/30 hover:border-purple-200 transform hover:scale-105"
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
                className="cursor-pointer bg-white/95 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/30 hover:border-green-200 transform hover:scale-105"
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
