import Header from "@/components/Header";
import SocialButtons from "@/components/SocialButtons";
import HeroSection from "@/components/HeroSection";
import { SearchBar } from "@/components/SearchBar";
import Footer from "@/components/Footer";
import LazyAd from "@/components/LazyAd";
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

  // Get current story for main display - ensure it's always defined
  const currentStory = stories[currentIndex] || {
    id: 'fallback',
    title: 'Stories temporarily unavailable',
    excerpt: 'Please try again in a moment.',
    category: 'news',
    image: 'https://images.unsplash.com/photo-1504711432869-001077659a9a?q=80&w=800&auto=format&fit=crop',
    readTime: '1 min read',
    author: 'Realssa',
    date: new Date().toISOString(),
    href: '#',
    externalLink: '#'
  };

  // Debug logging to help identify issues
  console.log('Index.tsx debug:', {
    storiesLength: stories.length,
    currentIndex,
    currentStory: currentStory?.title || 'undefined',
    stories: stories.map(s => s.title).slice(0, 3)
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
      </main>

      <Footer />
    </div>
  );
};

export default Index;
