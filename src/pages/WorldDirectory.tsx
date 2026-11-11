import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import { Globe, MapPin, ChevronRight, Search } from "lucide-react";
import worldFeeds from "../data/world_feeds.json";

// Group countries by continent
const groupedByContinent = Object.entries(worldFeeds).reduce((acc, [slug, data]) => {
  if (!acc[data.continent]) acc[data.continent] = [];
  acc[data.continent].push({ slug, ...data });
  return acc;
}, {} as Record<string, any[]>);

// Sort continents and countries alphabetically
const continents = Object.keys(groupedByContinent).sort();
continents.forEach(continent => {
  groupedByContinent[continent].sort((a, b) => a.name.localeCompare(b.name));
});

const WorldDirectory = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredContinents = continents.map(continent => {
    const filteredCountries = groupedByContinent[continent].filter(country => 
      country.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return { name: continent, countries: filteredCountries };
  }).filter(c => c.countries.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Global News Directory | RealSSA News"
        description="Explore the latest news from 195 countries around the world. RealSSA News provides automated, AI-summarized headlines globally."
        keywords="World News, Global News, International Headlines, RSS Aggregator"
        url="/world-directory"
      />
      <Header />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4 inline-flex items-center gap-3 justify-center">
              <Globe className="w-10 h-10 text-primary" />
              World Directory
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Select a country below to instantly view the latest top headlines and AI summaries from that region.
            </p>
          </div>

          <div className="max-w-xl mx-auto mb-16 relative">
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="Search for any country..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-full border border-border bg-card/50 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-lg"
              />
            </div>
          </div>

          <div className="space-y-16">
            {filteredContinents.length === 0 ? (
              <div className="text-center py-12">
                <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-xl text-muted-foreground">No countries found matching "{searchTerm}"</p>
              </div>
            ) : (
              filteredContinents.map((continent) => (
                <div key={continent.name} className="animate-fade-in">
                  <h2 className="text-2xl font-bold font-display border-b border-border pb-2 mb-6 text-foreground flex items-center">
                    {continent.name}
                    <span className="ml-3 text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full">
                      {continent.countries.length}
                    </span>
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {continent.countries.map((country) => (
                      <Link 
                        key={country.slug}
                        to={`/country/${country.slug}`}
                        className="group flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all duration-300"
                      >
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">{country.name}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default WorldDirectory;
