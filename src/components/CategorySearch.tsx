import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { apiUrl } from "@/lib/api-base";

interface CategorySearchProps {
  category: string;
  onSearchResults: (results: any[] | null) => void;
  isLoading?: boolean;
}

const COMMON_KEYWORDS: Record<string, string[]> = {
  "nigerian-news": ["Lagos", "Abuja", "Elections", "Economy", "Security", "Tinubu"],
  "sports": ["Super Eagles", "Premier League", "AFCON", "Transfers", "Chelsea"],
  "crypto": ["Bitcoin", "Ethereum", "Blockchain", "Startups", "Fintech"],
  "world": ["USA", "Europe", "Middle East", "UN", "Economy"],
  "ghana": ["Accra", "Elections", "Economy", "Cedi", "Politics"],
  "kenya": ["Nairobi", "Ruto", "Economy", "Taxes", "Tech"],
  "south-africa": ["Johannesburg", "Eskom", "Economy", "ANC", "Cape Town"],
  "all": ["Breaking", "Politics", "Sports", "Economy", "Tech"]
};

export default function CategorySearch({ category, onSearchResults, isLoading }: CategorySearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const keywords = COMMON_KEYWORDS[category] || COMMON_KEYWORDS["all"];

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      onSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(apiUrl(`/api/news/search?q=${encodeURIComponent(query)}&category=${category}`));
      if (response.ok) {
        const data = await response.json();
        onSearchResults(Array.isArray(data) ? data : []);
      } else {
        onSearchResults([]);
      }
    } catch (err) {
      console.error("Search failed:", err);
      onSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm) {
        performSearch(searchTerm);
      } else {
        onSearchResults(null);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, category]);

  const handleKeywordClick = (keyword: string) => {
    setSearchTerm(keyword);
    performSearch(keyword);
  };

  const filteredKeywords = searchTerm
    ? keywords.filter(k => k.toLowerCase().includes(searchTerm.toLowerCase()))
    : keywords;

  return (
    <div className="relative flex flex-col gap-3 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${category.replace('-', ' ')}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          className="pl-10 h-12 text-base rounded-full border-border bg-card shadow-sm focus-visible:ring-1 focus-visible:ring-amber-500"
        />
        {(isSearching || isLoading) && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary animate-spin" />
        )}
      </div>
      
      {/* Suggestions Dropdown */}
      {isFocused && filteredKeywords.length > 0 && (
        <div className="absolute top-14 left-0 right-0 z-[100] bg-card border border-border shadow-2xl rounded-2xl p-4 flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2.5 mb-1 block">
            {searchTerm ? "Suggested Keywords" : "Popular Searches"}
          </span>
          <div className="flex flex-col">
            {filteredKeywords.map(keyword => (
              <button
                key={keyword}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevents input blur
                  handleKeywordClick(keyword);
                }}
                className="w-full text-left px-3 py-2.5 text-sm font-medium hover:bg-amber-500/10 hover:text-amber-500 rounded-lg transition-colors flex items-center gap-2 group text-foreground"
              >
                <Search size={14} className="text-muted-foreground group-hover:text-amber-500 transition-colors" />
                <span>{keyword}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
