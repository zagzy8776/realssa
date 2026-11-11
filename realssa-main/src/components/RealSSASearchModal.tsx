import { useState, useEffect, useRef } from "react";
import { Search, X, Sparkles, Share2, ExternalLink, ArrowRight, Check } from "lucide-react";
import { apiUrl } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

const TRENDING_CHIPS = [
  "Naira FX Rate Today",
  "Lagos Traffic Update",
  "Tinubu Economic Policy",
  "Premier League Standings",
  "AFCON Qualifiers Fixtures",
  "Wizkid Tour Dates",
  "Crypto Tax Laws Nigeria"
];

const isDirectUrl = (str: string): boolean => {
  const pattern = new RegExp(
    '^(https?:\\/\\/)?' + // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))' + // ip
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port/path
    '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
    '(\\#[-a-z\\d_]*)?$', // fragment locator
    'i'
  );
  return pattern.test(str) || (str.includes('.') && !str.includes(' ') && str.length > 4);
};

export default function RealSSASearchModal({ isOpen, onClose, initialQuery = "" }: SearchModalProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    answer: string;
    sources: { title: string; url: string }[];
    provider: string;
  } | null>(null);
  const [webResults, setWebResults] = useState<{ title: string; url: string; snippet: string; source: string; date: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const [visibleCount, setVisibleCount] = useState(3);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      if (initialQuery && !searchResult) {
        handleSearch(initialQuery);
      }
    }
  }, [isOpen, initialQuery]);

  // Keyboard shortcut listener (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim();
    if (isDirectUrl(q)) {
      let destination = q;
      if (!/^https?:\/\//i.test(q)) {
        destination = `https://${q}`;
      }
      navigate(`/read?url=${encodeURIComponent(destination)}`);
      onClose();
      return;
    }
    setLoading(true);
    setSearchResult(null);
    setWebResults([]);
    setVisibleCount(3);

    try {
      const [aiRes, webRes] = await Promise.all([
        fetch(apiUrl('/api/search/ai'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q })
        }),
        fetch(apiUrl(`/api/search/web?q=${encodeURIComponent(q)}&limit=8`))
      ]);

      const data = await aiRes.json();
      if (aiRes.ok && data.success) {
        setSearchResult({
          answer: data.answer,
          sources: data.sources || [],
          provider: data.provider || 'RealSSA AI Search'
        });
      }

      if (webRes.ok) {
        const webData = await webRes.json();
        if (webData.success && webData.results) {
          setWebResults(webData.results);
        }
      }
    } catch (err: any) {
      toast({
        title: "Search Notice",
        description: err.message || "Could not fetch search result. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleShareWhatsApp = () => {
    if (!searchResult) return;
    const shareText = `🚨 *RealSSA AI Search Answer for "${query}"*\n\n${searchResult.answer.slice(0, 300)}…\n\nSearch more on RealSSA 📰👇\nhttps://realssanews.com.ng`;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  // Prevent background body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 left-0 right-0 z-[999999] bg-black/90 backdrop-blur-xl h-[100dvh] max-h-[100dvh] w-screen max-w-full overflow-x-hidden overflow-y-auto flex flex-col justify-start sm:justify-center items-center p-2 sm:p-4 box-border cursor-pointer overscroll-none"
    >
      {/* Inner Modal Content Box (Stop propagation to prevent closing when clicking inside) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl h-full max-h-[100dvh] sm:max-h-[92dvh] bg-card border border-amber-500/40 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col min-w-0 overflow-x-hidden overflow-y-auto box-border cursor-default my-auto mx-auto"
      >
        
        {/* Sticky Header Bar with Title & Always-Visible Close Button */}
        <div className="w-full flex items-center justify-between p-3 sm:p-5 bg-card/95 backdrop-blur-md border-b border-border/40 shrink-0 min-w-0 box-border">
          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 font-extrabold text-sm sm:text-base shrink-0">
              ⚡
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-lg font-bold font-display flex items-center gap-1.5 leading-tight truncate">
                RealSSA <span className="text-gradient-gold">AI Search</span>
              </h2>
              <p className="hidden sm:block text-[11px] text-muted-foreground truncate">
                Neural Web & Multi-Database Engine
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer shadow-md active:scale-95 shrink-0 min-w-max"
            title="Close Search (or press ESC)"
          >
            <X className="w-4 h-4" /> <span>Close</span>
          </button>
        </div>

        {/* Scrollable Main Content Container (Dynamic 100dvh Viewport Support & pb-24 for Keyboard) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5 space-y-4 pb-24 min-w-0 box-border">
          
          {/* Central Search Form Input — text-base (16px) PREVENTS MOBILE ZOOMING */}
          <form onSubmit={handleFormSubmit} className="w-full min-w-0 space-y-3 box-border">
            <div className="w-full flex items-center gap-2 min-w-0 box-border">
              <div className="relative flex-1 min-w-0">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Ask anything... (e.g., CBN Naira Rate)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full min-w-0 bg-background border-2 border-amber-500/40 focus:border-amber-500 rounded-2xl pl-10 pr-9 py-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-inner font-medium text-foreground box-border"
                />
                <Search className="w-4 h-4 text-amber-500 absolute left-3.5 top-1/2 -translate-y-1/2 shrink-0 pointer-events-none" />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-extrabold text-xs sm:text-sm px-3.5 sm:px-5 py-3 rounded-2xl transition-all flex items-center gap-1.5 shadow shrink-0 min-w-max active:scale-95 cursor-pointer"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Search <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </form>

          {/* Quick Trending Search Chips */}
          {!searchResult && !loading && (
            <div className="w-full min-w-0 space-y-2.5 box-border">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0" /> Popular Intelligence Queries
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full min-w-0 box-border">
                {TRENDING_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQuery(chip);
                      handleSearch(chip);
                    }}
                    className="bg-background border border-border hover:border-amber-500/50 hover:bg-amber-500/10 text-xs px-3.5 py-2.5 rounded-xl transition-all font-medium text-muted-foreground hover:text-amber-400 text-left truncate w-full min-w-0 box-border"
                  >
                    🔍 {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading State Skeleton */}
          {loading && (
            <div className="bg-background/50 border border-amber-500/30 rounded-2xl p-5 space-y-4 animate-pulse w-full min-w-0 box-border">
              <div className="h-4 bg-amber-500/20 rounded w-1/3"></div>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded w-full"></div>
                <div className="h-3 bg-muted rounded w-5/6"></div>
                <div className="h-3 bg-muted rounded w-4/6"></div>
              </div>
              <div className="text-xs text-amber-500 font-mono">Synthesizing verified AI search intelligence...</div>
            </div>
          )}

          {/* Search Results Display */}
          {searchResult && (
            <div className="bg-background border border-amber-500/40 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5 animate-in fade-in duration-300 w-full min-w-0 box-border">
              
              {/* Header Badge */}
              <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-2">
                <span className="bg-amber-500/20 text-amber-400 text-xs font-extrabold px-3 py-1 rounded-full uppercase border border-amber-500/30 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> RealSSA AI Verified Answer
                </span>
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="text-xs text-green-500 hover:text-green-400 font-bold flex items-center gap-1 bg-green-500/10 px-2.5 py-1 rounded-lg border border-green-500/20 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" /> <span>WhatsApp Share</span>
                </button>
              </div>

              {/* Formatted Answer Output */}
              <div className="prose prose-invert max-w-none text-xs sm:text-sm md:text-base leading-relaxed whitespace-pre-line text-foreground break-words font-normal">
                {searchResult.answer}
              </div>

              {/* Sources & Citations */}
              {searchResult.sources && searchResult.sources.length > 0 && (
                <div className="border-t border-border pt-4 space-y-2 w-full min-w-0">
                  <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider block">
                    Verified Reference Sources ({searchResult.sources.length})
                  </span>
                  <div className="flex flex-wrap gap-2 w-full min-w-0">
                    {searchResult.sources.map((src, idx) => {
                      const directUrl = src.url.startsWith('/read?url=')
                        ? decodeURIComponent(src.url.replace('/read?url=', ''))
                        : src.url;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            navigate(`/browser?url=${encodeURIComponent(directUrl)}&title=${encodeURIComponent(src.title || '')}`);
                            onClose();
                          }}
                          className="text-xs bg-muted/60 hover:bg-muted text-primary hover:underline px-2.5 py-1 rounded-lg border border-border flex items-center gap-1.5 max-w-full truncate cursor-pointer text-left"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0 text-amber-500" />
                          <span className="truncate">{src.title || directUrl}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="pt-2 border-t border-border/30 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSearchResult(null);
                    setWebResults([]);
                  }}
                  className="text-xs text-amber-500 hover:underline font-bold"
                >
                  ⚡ Ask another question
                </button>
              </div>
            </div>
          )}

          {/* Web Search Results List */}
          {webResults.length > 0 && (
            <div className="space-y-3 pt-2">
              <span className="text-xs font-extrabold uppercase text-amber-500 tracking-wider block">
                🌐 Web Results ({webResults.length})
              </span>
              <div className="space-y-2.5">
                {webResults.slice(0, visibleCount).map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      navigate(`/browser?url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(item.title || '')}`);
                      onClose();
                    }}
                    className="block text-left w-full bg-background hover:bg-muted/40 border border-border hover:border-amber-500/40 p-3.5 rounded-xl transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1 truncate">
                      <ExternalLink className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="font-semibold text-foreground truncate">{item.source || new URL(item.url).hostname}</span>
                      <span>•</span>
                      <span className="truncate">{item.url}</span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-amber-500 group-hover:underline line-clamp-1 mb-1">
                      {item.title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.snippet}
                    </p>
                  </button>
                ))}
              </div>
              {/* See More Button */}
              {visibleCount < webResults.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount(v => Math.min(v + 3, webResults.length))}
                  className="w-full py-2.5 rounded-xl border border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5 hover:bg-amber-500/10 text-amber-500 text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  ↓ See More Results ({webResults.length - visibleCount} remaining)
                </button>
              )}
              {visibleCount >= webResults.length && webResults.length > 3 && (
                <p className="text-center text-[11px] text-muted-foreground py-1">All {webResults.length} results shown</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
