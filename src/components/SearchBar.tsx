import { apiUrl } from '@/lib/api-base';
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Clock, X, Newspaper } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  fetchSiteSuggestions,
  trackSuggestionClick,
  type ArticleMatch,
  type SearchSuggestion,
  type SiteSuggestion
} from "@/lib/searchSuggest";

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
  const [siteSuggestions, setSiteSuggestions] = useState<SiteSuggestion[]>([]);
  const [articleSuggestions, setArticleSuggestions] = useState<ArticleMatch[]>([]);
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

  // Autocomplete: debounce 250ms, site-first suggestions + article matches
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (q.trim().length < 2) {
      setSiteSuggestions([]);
      setArticleSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      const payload = await fetchSiteSuggestions(q);
      setSiteSuggestions(payload.site.slice(0, 6));
      setArticleSuggestions(payload.articles.slice(0, 3));
      setShowSuggestions(true);
    }, 250);
  };

  const goSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    trackSuggestionClick(trimmed);
    setShowSuggestions(false);
    setQuery(trimmed);
    navigate(`/browser?url=${encodeURIComponent(`realssa://search?q=${encodeURIComponent(trimmed)}`)}`);
  };

  const handleSearch = () => {
    goSearch(query);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
    if (e.key === "Escape") setShowSuggestions(false);
  };

  const handleSuggestionClick = (item: SearchSuggestion) => {
    if (item.type === 'article') {
      trackSuggestionClick(item.title);
      setShowSuggestions(false);
      navigate(`/article/${item.id}`);
      return;
    }
    goSearch(item.term);
  };

  const currentArticle = articles[currentIndex];

  return (
    <section className="py-8 md:py-12 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Real URL-detecting Search Input */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const q = query.trim();
              if (q) {
                // Direct URL redirection helper
                const isDirectUrl = (str: string): boolean => {
                  const pattern = new RegExp(
                    '^(https?:\\/\\/)?' + // protocol
                    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain
                    '((\\d{1,3}\\.){3}\\d{1,3}))' + // ip
                    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port/path
                    '(\\?[;&a-z\\d%_.~+=-]*)?' + // query
                    '(\\#[-a-z\\d_]*)?$', // fragment
                    'i'
                  );
                  return pattern.test(str) || (str.includes('.') && !str.includes(' ') && str.length > 4);
                };

                if (isDirectUrl(q)) {
                  let destination = q;
                  if (!/^https?:\/\//i.test(q)) {
                    destination = `https://${q}`;
                  }
                  navigate(`/browser?url=${encodeURIComponent(destination)}`);
                } else {
                  navigate(`/browser?url=${encodeURIComponent(`realssa://search?q=${encodeURIComponent(q)}`)}`);
                }
              }
            }}
            className="relative flex items-center gap-3 bg-background border-2 border-amber-500/40 hover:border-amber-500 rounded-2xl px-4 py-2 shadow-lg mb-6 group"
          >
            <Search className="w-5 h-5 text-amber-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search news or paste a direct URL (e.g. www.google.com)..."
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyPress}
              onFocus={() => { if (query.trim().length >= 2) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 160)}
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-base md:text-sm py-1.5 focus:ring-0"
            />
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-extrabold px-4 py-2 rounded-xl uppercase flex items-center gap-1 shadow transition-all active:scale-95 shrink-0"
            >
              ⚡ Search
            </button>
          </form>

          {/* Site-first autocomplete dropdown (always offers RealSSA terms) */}
          {showSuggestions && (siteSuggestions.length > 0 || articleSuggestions.length > 0) && (
            <div className="relative z-30 -mt-3 mb-6 overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl">
              {siteSuggestions.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Suggested on RealSSA
                  </p>
                  {siteSuggestions.map(suggestion => (
                    <button
                      key={`site-${suggestion.term}`}
                      type="button"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-amber-500/10 hover:text-amber-600"
                    >
                      <Search size={14} className="shrink-0 text-amber-500" />
                      <span className="truncate">{suggestion.title}</span>
                      {suggestion.term.includes('realssa') && (
                        <span className="ml-auto shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-600">
                          RealSSA
                        </span>
                      )}
                    </button>
                  ))}
                </>
              )}

              {articleSuggestions.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-3 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Matching stories
                  </p>
                  {articleSuggestions.map(article => (
                    <button
                      key={article.id}
                      type="button"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => handleSuggestionClick(article)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <Newspaper size={14} className="shrink-0 text-muted-foreground" />
                      <span className="truncate">{article.title}</span>
                      {article.category && (
                        <span className="ml-auto shrink-0 text-[10px] font-bold uppercase text-muted-foreground">
                          {article.category}
                        </span>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

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
