import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const SearchBar = () => {
  const [query, setQuery] = useState("");

  const handleSearch = () => {
    // TODO: Implement search functionality
    console.log("Searching for:", query);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <section className="py-8 md:py-12 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-2">
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
        </div>
      </div>
    </section>
  );
};

export { SearchBar };
