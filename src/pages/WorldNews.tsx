import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ExternalLink, Clock, Calendar, Globe, Film, Gamepad, TrendingUp, Shirt, Tv } from "lucide-react";
import CategoryBadge from "@/components/CategoryBadge";
import NewsCard from "@/components/NewsCard";

import { CategoryType } from "@/data/newsData";

interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: CategoryType;
  image: string;
  readTime: string;
  author: string;
  source: string;
  contentType: string;
  status: string;
  featured: boolean;
  externalLink: string;
  date: string;
}

const WorldNews = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");

  useEffect(() => {
    const fetchWorldNews = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/nigerian-news`);
        if (response.ok) {
          const data = await response.json();
          // Filter for international feeds only
          const internationalFeeds = [
            'BBC News', 'Al Jazeera', 'Variety', 'Rolling Stone', 
            'The Verge', 'Wired', 'ESPN', 'CoinDesk', 'CoinTelegraph',
            'Bitcoin Magazine', 'TechCabal', 'IGN', 'GameSpot', 'PC Gamer', 'Kotaku',
            'The Business of Fashion', 'Fashionista', 'WWD', 'Fibre2Fashion'
          ];
          const internationalArticles = data.filter(article => 
            internationalFeeds.includes(article.author)
          );
          setArticles(internationalArticles);
        } else {
          setError("Failed to fetch World news");
        }
      } catch (err) {
        console.error("Error fetching World news:", err);
        setError("Network error while fetching news");
      } finally {
        setLoading(false);
      }
    };

    fetchWorldNews();
  }, []);

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.excerpt.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || article.category === selectedCategory;
    const matchesSource = selectedSource === "all" || article.author === selectedSource;
    return matchesSearch && matchesCategory && matchesSource;
  });

  const uniqueCategories = Array.from(new Set(articles.map(article => article.category))).filter(Boolean);
  const uniqueSources = Array.from(new Set(articles.map(article => article.author))).filter(Boolean);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Fetching latest World news...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4 text-red-600">Error Loading News</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Debug: Show what's actually being returned
  if (articles.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4 text-red-600">No International Articles Found</h2>
            <p className="text-muted-foreground mb-6">
              The API returned data but no articles match the international feeds filter.
            </p>
            <div className="bg-gray-100 p-4 rounded-lg mb-6">
              <h3 className="font-semibold mb-2">Debug Info:</h3>
              <p>Total articles from API: {articles.length}</p>
              <p>Expected international feeds: BBC News, Al Jazeera, Variety, IGN, CoinDesk, etc.</p>
              <p>Check if RSS feeds are accessible and processing correctly.</p>
            </div>
            <Button onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">🌍 World News</h1>
          <p className="text-muted-foreground">Latest headlines from around the globe</p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search World news..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              onClick={() => setSelectedCategory("all")}
            >
              All Categories
            </Button>
            {uniqueCategories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                className="text-xs"
              >
                {category.replace('-', ' ')}
              </Button>
            ))}
          </div>
        </div>

        {/* Source Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Button
            variant={selectedSource === "all" ? "default" : "outline"}
            onClick={() => setSelectedSource("all")}
          >
            All Sources
          </Button>
          {uniqueSources.map(source => (
            <Button
              key={source}
              variant={selectedSource === source ? "default" : "outline"}
              onClick={() => setSelectedSource(source)}
              className="text-xs"
            >
              {source}
            </Button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Globe className="h-8 w-8 text-blue-500" />
                <div>
                  <div className="text-sm text-muted-foreground">Total Articles</div>
                  <div className="text-2xl font-bold">{articles.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Film className="h-8 w-8 text-orange-500" />
                <div>
                  <div className="text-sm text-muted-foreground">Categories</div>
                  <div className="text-2xl font-bold">{uniqueCategories.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Gamepad className="h-8 w-8 text-green-500" />
                <div>
                  <div className="text-sm text-muted-foreground">Sources</div>
                  <div className="text-2xl font-bold">{uniqueSources.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Articles Grid */}
        {filteredArticles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article, index) => (
              <Card key={article.id || index} className="hover:shadow-lg transition-shadow">
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/400x250?text=World+News';
                  }}
                />
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <CategoryBadge category={article.category} />
                    <Badge variant="secondary" className="text-xs">
                      {article.author}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg line-clamp-2">{article.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {article.excerpt}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {new Date(article.date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {article.readTime}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => window.open(article.externalLink, '_blank')}
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Read Full Article
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🌍</div>
            <h3 className="text-xl font-semibold mb-2">No international articles found</h3>
            <p className="text-muted-foreground mb-6">
              Try adjusting your search terms or filters to find what you're looking for.
            </p>
            <Button onClick={() => {
              setSearchTerm("");
              setSelectedCategory("all");
              setSelectedSource("all");
            }}>
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorldNews;