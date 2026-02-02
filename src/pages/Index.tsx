import Header from "@/components/Header";
import SocialButtons from "@/components/SocialButtons";
import HeroSection from "@/components/HeroSection";
import { SearchBar } from "@/components/SearchBar";
import Footer from "@/components/Footer";
import LazyAd from "@/components/LazyAd";
import { useEffect, useState } from "react";
import ReadProgressBar from "@/components/ReadProgressBar";

const Index = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading for 1 second
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <ReadProgressBar />
      <Header />
      <SocialButtons />

      <main>
        <HeroSection />
        <SearchBar />

        {/* Loading State */}
        {loading && (
          <section className="py-12 md:py-16">
            <div className="container mx-auto px-4">
              <div className="bg-gray-100 rounded-lg p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading...</p>
              </div>
            </div>
          </section>
        )}

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
