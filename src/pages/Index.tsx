import Header from "@/components/Header";
import SocialButtons from "@/components/SocialButtons";
import HeroSection from "@/components/HeroSection";
import { SearchBar } from "@/components/SearchBar";
import Footer from "@/components/Footer";
import LazyAd from "@/components/LazyAd";
import LiveScores from "@/components/LiveScores";
import ScorebatEmbed from "@/components/ScorebatEmbed";
import SportsLeagueTables from "@/components/SportsLeagueTables";
import { useEffect, useState } from "react";
import ReadProgressBar from "@/components/ReadProgressBar";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

const Index = () => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fallback API URL if environment variable is not set
      const apiUrl = import.meta.env.VITE_API_URL || 'https://realssa-production.up.railway.app';
      
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }
      
      const response = await fetch(`${apiUrl}/api/articles/featured`);
      if (!response.ok) {
        throw new Error('Failed to fetch stories');
      }
      const data = await response.json();
      setStories(data);
    } catch (err) {
      console.error('Error fetching stories:', err);
      setError('Stories temporarily unavailable');
    } finally {
      setLoading(false);
    }
  };

  // Initialize pull-to-refresh functionality
  usePullToRefresh({
    onRefresh: fetchStories,
    threshold: 100,
    disabled: loading
  });

  // Fallback image function
  const getFallbackImage = (item) => {
    if (item.image && item.image !== 'https://placehold.co/600x400') {
      // Fix URLs that start with "//" by prepending "https:"
      let imageUrl = item.image;
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      }
      return imageUrl;
    }

    // Use the specified fallback image
    return 'https://images.unsplash.com/photo-1504711432869-001077659a9a?w=800';
  };

  return (
    <div className="min-h-screen bg-background">
      <ReadProgressBar />
      <Header />
      <SocialButtons />

      <main>
        <HeroSection stories={stories} />
        <SearchBar />

        {/* Advertisement */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4">
            <LazyAd />
          </div>
        </section>

        {/* Live Scores Section */}
        <section className="container mx-auto px-4 mb-8">
          <LiveScores />
        </section>

        {/* Scorebat Live Sports Embed */}
        <section className="container mx-auto px-4 mb-8">
          <ScorebatEmbed />
        </section>

        {/* Sports League Tables Section */}
        <section className="container mx-auto px-4 mb-8">
          <SportsLeagueTables />
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
