import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Clock } from "lucide-react";

interface Article {
  id: string;
  title: string;
  excerpt: string;
  externalLink: string;
  author: string;
  date: string;
  category?: string;
}

const SearchBar = () => {
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch articles from both APIs
  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'https://realssa-production.up.railway.app';

        // Fetch both world and Nigerian news
        const [worldResponse, nigerianResponse] = await Promise.all([
          fetch(`${apiUrl}/api/news/world`),
          fetch(`${apiUrl}/api/news/nigerian`)
        ]);

        let worldArticles: Article[] = [];
        let nigerianArticles: Article[] = [];

        if (worldResponse.ok) {
          const worldData = await worldResponse.json();
          // Filter for international feeds like in WorldNews.tsx
          const internationalFeeds = [
            'BBC News', 'Al Jazeera', 'Variety', 'Rolling Stone',
            'The Verge', 'Wired', 'ESPN', 'CoinDesk', 'CoinTelegraph',
            'Bitcoin Magazine', 'TechCabal', 'IGN', 'GameSpot', 'PC Gamer', 'Kotaku',
            'The Business of Fashion', 'Fashionista', 'WWD', 'Fibre2Fashion'
          ];
          worldArticles = worldData.filter((article: Article) =>
            internationalFeeds.includes(article.author)
          );
        }

        if (nigerianResponse.ok) {
          nigerianArticles = await nigerianResponse.json();
        }

        // Combine and shuffle articles
        const combinedArticles = [...worldArticles, ...nigerianArticles];
        const shuffledArticles = combinedArticles.sort(() => Math.random() - 0.5);

        setArticles(shuffledArticles);
      } catch (err) {
        console.error('Error fetching articles:', err);
        setError('Failed to load news headlines');
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  // Rotate headlines every 6 seconds
  useEffect(() => {
    if (articles.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % articles.length);
    }, 6000); // 6 seconds

    return () => clearInterval(interval);
  }, [articles.length]);

  const handleSearch = () => {
    // TODO: Implement search functionality
    console.log("Searching for:", query);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const currentArticle = articles[currentIndex];

  return (
    <section className="py-8 md:py-12 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Search Input */}
          <div className="flex gap-2 mb-6">
            <Input
              type="text"
              placeholder="Search for news, articles, or fact-check information..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button onClick={handleSearch} className="px-6">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>

          {/* Rotating Headlines */}
          <div className="bg-background rounded-lg p-6 shadow-sm border">
            {loading ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-muted-foreground">Loading latest headlines...</p>
              </div>
            ) : error ? (
              <div className="text-center">
                <p className="text-muted-foreground">{error}</p>
              </div>
            ) : articles.length > 0 && currentArticle ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Latest News</span>
                  <span className="text-xs">({currentIndex + 1} of {articles.length})</span>
                </div>
                <h3
                  className="text-lg md:text-xl font-semibold line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                  onClick={() => window.open(currentArticle.externalLink, '_blank')}
                  title="Click to read full article"
                >
                  {currentArticle.title}
                </h3>
                <p className="text-muted-foreground text-sm line-clamp-2">
                  {currentArticle.excerpt}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{currentArticle.author}</span>
                  <div className="flex items-center gap-1">
                    <span>{new Date(currentArticle.date).toLocaleDateString()}</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </div>
                {/* Progress indicator */}
                <div className="w-full bg-muted rounded-full h-1 mt-4">
                  <div
                    className="bg-primary h-1 rounded-full transition-all duration-6000 ease-linear"
                    style={{ width: `${((currentIndex + 1) / articles.length) * 100}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-muted-foreground">No headlines available at the moment.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export { SearchBar };
