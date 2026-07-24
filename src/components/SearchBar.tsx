import { apiUrl } from '@/lib/api-base';
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Clock, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAiSearchOpen, setIsAiSearchOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Article[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch articles from both APIs
  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      setError(null);
      try {
        const [worldResponse, nigerianResponse] = await Promise.all([
          fetch(apiUrl('/api/news/world')),
          fetch(apiUrl('/api/news/nigerian'))
        ]);
        let worldArticles: Article[] = [];
        let nigerianArticles: Article[] = [];
        if (worldResponse.ok) {
          const worldData = await worldResponse.json();
          worldArticles = Array.isArray(worldData) ? worldData : [];
        }
        if (nigerianResponse.ok) {
          nigerianArticles = await nigerianResponse.json();
        }
        const combinedArticles = [...worldArticles, ...nigerianArticles];
        setArticles(combinedArticles.sort(() => Math.random() - 0.5));
      } catch (err) {
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
    }, 6000);
    return () => clearInterval(interval);
  }, [articles]);

  // Autocomplete: debounce 300ms
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/search/suggest?q=${encodeURIComponent(q)}`));
        if (res.ok) {
          const data = await res.json();
          setSuggestions(Array.isArray(data) ? data.slice(0, 6) : []);
          setShowSuggestions(true);
        }
      } catch { setSuggestions([]); }
    }, 300);
  };

  const handleSearch = () => {
    if (query.trim()) {
      setShowSuggestions(false);
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
    if (e.key === "Escape") setShowSuggestions(false);
  };

  const handleSuggestionClick = (article: Article) => {
    setShowSuggestions(false);
    setQuery(article.title);
    const link = article.externalLink
      ? `/read?url=${encodeURIComponent(article.externalLink)}&category=${encodeURIComponent(article.category || 'news')}&id=${encodeURIComponent(article.id)}`
      : `/article/${article.id}`;
    navigate(link);
  };

  const currentArticle = articles[currentIndex];

  return (
    <section className="py-8 md:py-12 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Glowing AI Search Input Trigger */}
          <div
            onClick={() => setIsAiSearchOpen(true)}
            className="relative flex items-center gap-3 bg-background border-2 border-amber-500/40 hover:border-amber-500 rounded-2xl px-4 py-3.5 shadow-lg cursor-pointer transition-all hover:shadow-amber-500/10 mb-6 group"
          >
            <Search className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1 text-sm md:text-base font-medium text-muted-foreground group-hover:text-foreground">
              {query || "Ask RealSSA anything... (e.g. CBN Naira Rate, Lagos Traffic, AFCON Results)"}
            </div>
            <span className="bg-amber-500 text-black text-xs font-extrabold px-3 py-1 rounded-xl uppercase flex items-center gap-1 shadow">
              ⚡ AI Search
            </span>
          </div>

          <RealSSASearchModal
            isOpen={isAiSearchOpen}
            onClose={() => setIsAiSearchOpen(false)}
            initialQuery={query}
          />

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
