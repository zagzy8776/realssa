import { useState, useEffect, useRef } from "react";
import { Search, X, Sparkles, Share2, ExternalLink, ArrowRight, Check } from "lucide-react";
import { apiUrl } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

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

export default function RealSSASearchModal({ isOpen, onClose, initialQuery = "" }: SearchModalProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    answer: string;
    sources: { title: string; url: string }[];
    provider: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
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
    setLoading(true);
    setSearchResult(null);

    try {
      const res = await fetch(apiUrl('/api/search/ai'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim() })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSearchResult({
          answer: data.answer,
          sources: data.sources || [],
          provider: data.provider || 'RealSSA AI Search'
        });
      } else {
        throw new Error(data.message || 'Search failed');
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-start justify-center pt-8 md:pt-16 px-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-3xl p-6 md:p-8 max-w-3xl w-full shadow-2xl space-y-6 mb-16 relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Minimalist Google-Style Branding Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 font-extrabold text-lg">
            ⚡
          </div>
          <div>
            <h2 className="text-xl font-bold font-display flex items-center gap-2">
              RealSSA <span className="text-gradient-gold">AI Search</span>
            </h2>
            <p className="text-xs text-muted-foreground">Search anything across Africa & the global web</p>
          </div>
        </div>

        {/* Central Search Form Input */}
        <form onSubmit={handleFormSubmit} className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask anything... (e.g., CBN Naira Rate, Lagos Traffic, AFCON Results)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-background border-2 border-border focus:border-amber-500 rounded-2xl pl-12 pr-28 py-4 text-base md:text-lg focus:outline-none focus:ring-4 focus:ring-amber-500/20 shadow-inner font-medium"
          />
          <Search className="w-5 h-5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>Search <ArrowRight className="w-3.5 h-3.5" /></>
            )}
          </button>
        </form>

        {/* Quick Trending Search Chips */}
        {!searchResult && !loading && (
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Popular Intelligence Queries
            </span>
            <div className="flex flex-wrap gap-2">
              {TRENDING_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(chip);
                    handleSearch(chip);
                  }}
                  className="bg-background border border-border hover:border-amber-500/50 hover:bg-amber-500/10 text-xs px-3.5 py-2 rounded-xl transition-all font-medium text-muted-foreground hover:text-amber-400"
                >
                  🔍 {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading State Skeleton */}
        {loading && (
          <div className="bg-background/50 border border-amber-500/30 rounded-2xl p-6 space-y-4 animate-pulse">
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
          <div className="bg-background border border-amber-500/40 rounded-2xl p-6 shadow-xl space-y-6 animate-in fade-in duration-300">
            
            {/* Header Badge */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="bg-amber-500/20 text-amber-400 text-xs font-extrabold px-3 py-1 rounded-full uppercase border border-amber-500/30 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> RealSSA AI Verified Answer
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">{searchResult.provider}</span>
            </div>

            {/* Formatted Answer Output */}
            <div className="prose prose-invert max-w-none text-sm md:text-base leading-relaxed whitespace-pre-line text-foreground">
              {searchResult.answer}
            </div>

            {/* Sources & Citations */}
            {searchResult.sources && searchResult.sources.length > 0 && (
              <div className="border-t border-border pt-4 space-y-2">
                <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                  Verified Reference Sources ({searchResult.sources.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {searchResult.sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.url.startsWith('/') ? src.url : `/read?url=${encodeURIComponent(src.url)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-muted/60 hover:bg-muted text-xs px-3 py-1.5 rounded-lg text-amber-400 font-medium transition-colors border border-border"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[200px]">{src.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Share Action Footer */}
            <div className="border-t border-border pt-4 flex items-center justify-between">
              <button
                onClick={handleShareWhatsApp}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow"
              >
                <Share2 className="w-4 h-4" /> Share Answer on WhatsApp
              </button>
              <button
                onClick={() => {
                  setQuery("");
                  setSearchResult(null);
                }}
                className="text-xs text-muted-foreground hover:underline"
              >
                Ask another question
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
