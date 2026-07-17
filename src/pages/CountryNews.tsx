import { apiUrl } from '@/lib/api-base';
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Users, MapPin } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import CategorySearch from "@/components/CategorySearch";
import worldFeeds from "../data/world_feeds.json";
import NewsCard from "../components/NewsCard";
import Pagination from "../components/Pagination";

const ARTICLES_PER_PAGE = 12;

// SEO enrichment for top 20 African countries
const COUNTRY_META: Record<string, { flag: string; population: string; capital: string; intro: string }> = {
  nigeria: { flag: '🇳🇬', population: '220 million', capital: 'Abuja', intro: 'Nigeria is Africa\'s most populous nation and largest economy, a powerhouse of culture, business, and politics driving the continent forward.' },
  ghana: { flag: '🇬🇭', population: '33 million', capital: 'Accra', intro: 'Ghana is West Africa\'s beacon of democracy and one of the continent\'s fastest-growing economies, known for its stability and vibrant culture.' },
  kenya: { flag: '🇰🇪', population: '55 million', capital: 'Nairobi', intro: 'Kenya is East Africa\'s tech and business hub, home to Silicon Savannah and a thriving media landscape.' },
  'south-africa': { flag: '🇿🇦', population: '60 million', capital: 'Pretoria', intro: 'South Africa is the continent\'s most industrialised economy, a diverse nation at the southern tip of Africa with a rich political history.' },
  ethiopia: { flag: '🇪🇹', population: '126 million', capital: 'Addis Ababa', intro: 'Ethiopia is Africa\'s second most populous country and the seat of the African Union, with one of the fastest-growing economies on the continent.' },
  egypt: { flag: '🇪🇬', population: '105 million', capital: 'Cairo', intro: 'Egypt is North Africa\'s largest country and a historic civilisation bridging Africa and the Middle East, with a booming media and tourism sector.' },
  tanzania: { flag: '🇹🇿', population: '63 million', capital: 'Dodoma', intro: 'Tanzania is East Africa\'s largest country by area, home to Kilimanjaro, Zanzibar, and a rapidly growing economy driven by tourism and agriculture.' },
  uganda: { flag: '🇺🇬', population: '48 million', capital: 'Kampala', intro: 'Uganda is the Pearl of Africa, a landlocked East African nation with one of the youngest populations in the world and a growing tech scene.' },
  senegal: { flag: '🇸🇳', population: '17 million', capital: 'Dakar', intro: 'Senegal is West Africa\'s most stable democracy, a cultural hub known for its music, football, and growing digital economy.' },
  cameroon: { flag: '🇨🇲', population: '27 million', capital: 'Yaoundé', intro: 'Cameroon is Central Africa\'s most diverse nation, often called "Africa in miniature" for its range of landscapes, cultures, and languages.' },
  'ivory-coast': { flag: '🇨🇮', population: '27 million', capital: 'Yamoussoukro', intro: 'Côte d\'Ivoire is West Africa\'s economic powerhouse, the world\'s largest cocoa producer and a major hub for trade and finance in the region.' },
  morocco: { flag: '🇲🇦', population: '37 million', capital: 'Rabat', intro: 'Morocco is North Africa\'s gateway to Europe, a constitutional monarchy with a booming tourism industry and growing renewable energy sector.' },
  algeria: { flag: '🇩🇿', population: '45 million', capital: 'Algiers', intro: 'Algeria is Africa\'s largest country by area, a major energy producer with vast natural gas reserves and a strategic position in North Africa.' },
  angola: { flag: '🇦🇴', population: '35 million', capital: 'Luanda', intro: 'Angola is Southern Africa\'s second largest country, a major oil producer rebuilding rapidly after decades of civil war with significant infrastructure investment.' },
  mozambique: { flag: '🇲🇿', population: '32 million', capital: 'Maputo', intro: 'Mozambique is a Southeast African nation with vast natural gas reserves and a long Indian Ocean coastline, emerging as a key energy player.' },
  zimbabwe: { flag: '🇿🇼', population: '16 million', capital: 'Harare', intro: 'Zimbabwe is a landlocked Southern African nation with rich mineral resources and a resilient population navigating economic transformation.' },
  zambia: { flag: '🇿🇲', population: '19 million', capital: 'Lusaka', intro: 'Zambia is a landlocked Southern African country, one of the world\'s largest copper producers and a growing hub for agriculture and mining investment.' },
  rwanda: { flag: '🇷🇼', population: '13 million', capital: 'Kigali', intro: 'Rwanda is East Africa\'s most remarkable transformation story — from tragedy to one of Africa\'s cleanest, safest, and fastest-growing economies.' },
  mali: { flag: '🇲🇱', population: '22 million', capital: 'Bamako', intro: 'Mali is a vast West African nation with a rich ancient history, home to Timbuktu and significant gold and cotton resources.' },
  'burkina-faso': { flag: '🇧🇫', population: '22 million', capital: 'Ouagadougou', intro: 'Burkina Faso is a landlocked West African nation known for its cultural festivals and gold mining, navigating significant security challenges.' },
};

const CountryNews = () => {
  const { countryId } = useParams();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Safely get country data from JSON
  const countryData = countryId ? (worldFeeds as any)[countryId] : null;
  const countryName = countryData ? countryData.name : "Country";
  const meta = countryId ? COUNTRY_META[countryId] : null;

  useEffect(() => {
    if (!countryId) return;

    const fetchCountryNews = async () => {
      setLoading(true);
      setError(null);
      try {
        // Query the generic ingest endpoint to fetch articles for this category/country
        const response = await fetchWithRetry(apiUrl(`/api/news/search?category=${countryId}`));
        if (response) {
          const data = await response.json();
          setArticles(Array.isArray(data) ? data : []);
        } else {
          setError("Could not load news. Please try again later.");
        }
      } catch (err) {
        console.error("Error fetching country news:", err);
        setError("Network error while fetching news");
      } finally {
        setLoading(false);
      }
    };

    fetchCountryNews();
  }, [countryId]);

  if (!countryData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Country Not Found</h1>
          <Link to="/world-directory" className="text-primary hover:underline">
            Return to World Directory
          </Link>
        </div>
      </div>
    );
  }

  const baseArticles = searchResults || articles;
  const indexOfLastArticle = currentPage * ARTICLES_PER_PAGE;
  const indexOfFirstArticle = indexOfLastArticle - ARTICLES_PER_PAGE;
  const currentArticles = baseArticles.slice(indexOfFirstArticle, indexOfLastArticle);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${meta?.flag || ''} ${countryName} News Today — Latest Headlines | RealSSA`}
        description={meta ? `${meta.intro} Get the latest breaking news, top headlines and AI-summarized updates from ${countryName}. Population: ${meta.population}. Capital: ${meta.capital}.` : `Get the latest breaking news, top headlines, and AI-summarized updates from ${countryName}.`}
        keywords={`${countryName} news today, ${countryName} latest news, ${countryName} breaking news, ${countryName} headlines, ${meta?.capital || ''} news, Africa news, RealSSA`}
        url={`/country/${countryId}`}
      />
      <Header />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <Link to="/world-directory" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Directory
          </Link>

          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
            {meta?.flag} {countryName} News
          </h1>

          {/* SEO enrichment — country intro, population, capital */}
          {meta && (
            <div className="mb-6 p-4 bg-card border border-border rounded-xl">
              <p className="text-muted-foreground leading-relaxed mb-3">{meta.intro}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="w-4 h-4 text-primary" /> Capital: <strong className="text-foreground ml-1">{meta.capital}</strong>
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Users className="w-4 h-4 text-primary" /> Population: <strong className="text-foreground ml-1">{meta.population}</strong>
                </span>
              </div>
            </div>
          )}

          <h2 className="text-2xl font-bold mb-4 text-foreground">Latest News from {countryName}</h2>
          
          <div className="max-w-2xl mt-8">
            <CategorySearch 
              category={countryId}
              onSearchResults={(results) => setSearchResults(results as any)}
              onClearSearch={() => setSearchResults(null)}
            />
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90"
              >
                Retry
              </button>
            </div>
          ) : baseArticles.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-xl text-muted-foreground mb-4">No news found for {countryName} yet.</p>
              <p className="text-muted-foreground">Check back later as our AI engine crawls new updates.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-12">
                {currentArticles.map((article) => (
                  <NewsCard
                    key={article.id}
                    id={article.id}
                    title={article.title}
                    excerpt={article.excerpt}
                    category={article.category}
                    image={article.image}
                    date={article.date}
                    author={article.author}
                    readTime={article.readTime || "3 min read"}
                    externalLink={article.externalLink}
                    content={article.content}
                  />
                ))}
              </div>
              <Pagination
                currentPage={currentPage}
                totalItems={baseArticles.length}
                itemsPerPage={ARTICLES_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CountryNews;
