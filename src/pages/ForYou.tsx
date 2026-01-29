import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Clock, 
  Calendar, 
  Bookmark, 
  Eye, 
  TrendingUp, 
  Sparkles,
  Star,
  Heart
} from 'lucide-react';
import NewsCard from '@/components/NewsCard';
import RotatingHeadlines from '@/components/RotatingHeadlines';

interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  image: string;
  readTime: string;
  date: string;
  source: string;
  externalLink?: string;
  isBookmarked?: boolean;
  readCount?: number;
  lastRead?: string;
}

interface ReadingHistoryItem {
  id: string;
  timestamp: string;
  readCount: number;
}

interface Preferences {
  categories: Record<string, number>;
}

const ForYou: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [readingHistory, setReadingHistory] = useState<ReadingHistoryItem[]>([]);
  const [preferences, setPreferences] = useState<Preferences>({ categories: {} });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchArticles();
    loadUserData();
  }, []);

  const loadUserData = () => {
    const savedBookmarks = localStorage.getItem('bookmarks');
    const savedHistory = localStorage.getItem('readingHistory');
    const savedPreferences = localStorage.getItem('preferences');
    
    if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));
    if (savedHistory) setReadingHistory(JSON.parse(savedHistory));
    if (savedPreferences) setPreferences(JSON.parse(savedPreferences));
  };

  const fetchArticles = async () => {
    try {
      const response = await fetch('/api/articles');
      const data = await response.json();
      
      // Filter out admin-only content for regular users
      const userArticles = data.filter((article: any) => 
        article.source !== 'admin-dashboard' && article.source !== 'admin-login'
      );
      
      setArticles(userArticles);
    } catch (error) {
      console.error('Error fetching articles:', error);
      toast({
        title: "Error",
        description: "Failed to load articles. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBookmark = (articleId: string) => {
    const newBookmarks = bookmarks.includes(articleId)
      ? bookmarks.filter(id => id !== articleId)
      : [...bookmarks, articleId];
    
    setBookmarks(newBookmarks);
    localStorage.setItem('bookmarks', JSON.stringify(newBookmarks));
    
    toast({
      title: bookmarks.includes(articleId) ? "Removed from bookmarks" : "Added to bookmarks",
      description: "Article saved for later reading",
    });
  };

  const handleReadMore = (articleId: string) => {
    // Update reading history
    const newHistory = [
      ...readingHistory.filter(item => item.id !== articleId),
      {
        id: articleId,
        timestamp: new Date().toISOString(),
        readCount: (readingHistory.find(item => item.id === articleId)?.readCount || 0) + 1
      }
    ];
    
    setReadingHistory(newHistory);
    localStorage.setItem('readingHistory', JSON.stringify(newHistory));
    
    // Update preferences based on category
    const article = articles.find(a => a.id === articleId);
    if (article) {
      const newPreferences = {
        ...preferences,
        categories: {
          ...preferences.categories,
          [article.category]: (preferences.categories?.[article.category] || 0) + 1
        }
      };
      setPreferences(newPreferences);
      localStorage.setItem('preferences', JSON.stringify(newPreferences));
    }
  };

  const getPersonalizedArticles = () => {
    if (!articles.length) return [];
    
    // AI-powered personalization logic
    const personalized = articles.map(article => {
      let score = 0;
      
      // Factor 1: Reading history (recent reads get lower priority)
      const historyItem = readingHistory.find(item => item.id === article.id);
      if (historyItem) {
        const daysSinceRead = (Date.now() - new Date(historyItem.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        score -= Math.min(daysSinceRead * 2, 10); // Penalize recent reads
        score += Math.log(historyItem.readCount) * 2; // Reward frequently read
      }
      
      // Factor 2: Category preferences
      const categoryScore = preferences.categories?.[article.category] || 0;
      score += categoryScore * 3;
      
      // Factor 3: Bookmark status
      if (bookmarks.includes(article.id)) {
        score += 5;
      }
      
      // Factor 4: Article freshness
      const daysOld = (Date.now() - new Date(article.date).getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 10 - daysOld);
      
      // Factor 5: Random discovery factor (20% weight)
      score += Math.random() * 2;
      
      return { ...article, score };
    });
    
    return personalized
      .sort((a, b) => b.score - a.score)
      .slice(0, 20); // Top 20 personalized articles
  };

  const getContinueReading = () => {
    return readingHistory
      .filter(item => item.readCount > 0)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3)
      .map(item => {
        const article = articles.find(a => a.id === item.id);
        return article ? { ...article, readCount: item.readCount } : null;
      })
      .filter(Boolean) as Article[];
  };

  const getTrendingNow = () => {
    return articles
      .sort((a, b) => {
        const aHistory = readingHistory.find(item => item.id === a.id);
        const bHistory = readingHistory.find(item => item.id === b.id);
        return (bHistory?.readCount || 0) - (aHistory?.readCount || 0);
      })
      .slice(0, 5);
  };

  const getYouMightAlsoLike = (currentCategory: string) => {
    return articles
      .filter(article => article.category === currentCategory && article.id !== currentCategory)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 4);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card rounded-xl p-6">
                  <div className="h-48 bg-muted rounded-lg mb-4"></div>
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
                  <div className="h-3 bg-muted rounded w-1/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const personalizedArticles = getPersonalizedArticles();
  const continueReading = getContinueReading();
  const trendingNow = getTrendingNow();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-full blur-3xl opacity-50"></div>
        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                For You
              </h1>
              <Sparkles className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-lg md:text-xl text-muted-foreground mb-8">
              AI-powered personalized content just for you. Based on your interests, reading history, and preferences.
            </p>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
              <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Eye className="w-5 h-5 text-primary" />
                    <span className="font-semibold">Continue Reading</span>
                  </div>
                  <p className="text-2xl font-bold">{continueReading.length}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold">Trending Now</span>
                  </div>
                  <p className="text-2xl font-bold">{trendingNow.length}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Bookmark className="w-5 h-5 text-orange-500" />
                    <span className="font-semibold">Saved</span>
                  </div>
                  <p className="text-2xl font-bold">{bookmarks.length}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-16">
        <ScrollArea className="h-auto">
          {/* Continue Reading Section */}
          {continueReading.length > 0 && (
            <section className="mb-16">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                  <Eye className="w-8 h-8 text-primary" />
                  Continue Reading
                </h2>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/')}
                  className="border-primary/20 hover:border-primary"
                >
                  View All
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {continueReading.map((article) => (
                  <Card key={article.id} className="group hover:shadow-lg transition-all duration-300">
                    <CardContent className="p-0">
                      <div className="relative h-48 overflow-hidden">
                        <img 
                          src={article.image} 
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
                        <div className="absolute top-3 left-3">
                          <Badge variant="secondary" className="bg-white/90">
                            {article.category}
                          </Badge>
                        </div>
                        <div className="absolute top-3 right-3 flex gap-2">
                          <Badge variant="outline" className="bg-white/90">
                            {article.readCount} reads
                          </Badge>
                        </div>
                      </div>
                      <div className="p-6">
                        <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                          {article.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                          {article.excerpt}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{new Date(article.date).toLocaleDateString()}</span>
                          <span>{article.readTime}</span>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button 
                            onClick={() => navigate(`/article/${article.id}`)}
                            className="flex-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600"
                          >
                            Continue Reading
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleBookmark(article.id)}
                            className={bookmarks.includes(article.id) ? "border-orange-500 text-orange-500" : ""}
                          >
                            <Bookmark className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Trending Now Section */}
          <section className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-purple-600" />
                Trending Now
              </h2>
              <Button 
                variant="outline" 
                onClick={() => navigate('/')}
                className="border-purple-500/20 hover:border-purple-500"
              >
                View All
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trendingNow.map((article, index) => (
                <Card key={article.id} className="group hover:shadow-lg transition-all duration-300 border-l-4 border-l-purple-500">
                  <CardContent className="p-0">
                    <div className="relative h-48 overflow-hidden">
                      <img 
                        src={article.image} 
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-3 left-3">
                        <Badge variant="secondary" className="bg-purple-500/20 text-purple-600 border-purple-500/30">
                          #{index + 1} Trending
                        </Badge>
                      </div>
                    </div>
                    <div className="p-6">
                      <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                        {article.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                        {article.excerpt}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(article.date).toLocaleDateString()}</span>
                        <span>{article.readTime}</span>
                      </div>
                      <Button 
                        onClick={() => navigate(`/article/${article.id}`)}
                        className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                      >
                        Read Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Personalized Recommendations */}
          <section className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <Star className="w-8 h-8 text-yellow-500" />
                Personalized for You
              </h2>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/')}
                  className="border-yellow-500/20 hover:border-yellow-500"
                >
                  View All
                </Button>
                <Button 
                  onClick={() => {
                    localStorage.removeItem('readingHistory');
                    localStorage.removeItem('bookmarks');
                    localStorage.removeItem('preferences');
                    window.location.reload();
                  }}
                  variant="ghost"
                  className="text-yellow-600 hover:text-yellow-700"
                >
                  Reset Preferences
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {personalizedArticles.map((article) => (
                <NewsCard
                  key={article.id}
                  title={article.title}
                  excerpt={article.excerpt}
                  category={article.category as any}
                  image={article.image}
                  readTime={article.readTime}
                  date={article.date}
                  id={article.id}
                  externalLink={article.externalLink}
                  onRead={handleReadMore}
                  onBookmark={handleBookmark}
                  showBookmark={true}
                />
              ))}
            </div>
          </section>

          {/* Rotating Headlines */}
          <section className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <Heart className="w-8 h-8 text-red-500" />
                What's Hot
              </h2>
            </div>
            <RotatingHeadlines />
          </section>
        </ScrollArea>
      </div>
    </div>
  );
};

export default ForYou;