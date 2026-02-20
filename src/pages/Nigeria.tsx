import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SocialButtons from "@/components/SocialButtons";
import SectionHeader from "@/components/SectionHeader";
import NewsCard from "@/components/NewsCard";
import { SkeletonGrid } from "@/components/SkeletonCard";
import { nigeriaNews } from "@/data/newsData";

const Nigeria = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading for better UX
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SocialButtons />

      {/* Hero Section */}
      <section className="py-12 md:py-20 bg-gradient-to-r from-green-600 to-green-800 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-4">Nigeria Entertainment</h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Explore the vibrant world of Nigerian entertainment - from Nollywood to Afrobeats and beyond
          </p>
        </div>
      </section>

      {/* Nigeria News Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <SectionHeader title="Nigeria Entertainment News" emoji="🇳🇬" />

          {loading ? (
            <SkeletonGrid count={8} variant="news" columns={4} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {nigeriaNews.map((story, index) => (
                <div
                  key={story.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <NewsCard
                    title={story.title}
                    excerpt={story.excerpt}
                    category={story.category}
                    image={story.image}
                    readTime={story.readTime}
                    date={story.date}
                    href="#"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* About Nigeria Entertainment Section */}
      <section className="py-12 md:py-16 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-bold mb-6 text-center">About Nigerian Entertainment</h2>

            <div className="prose prose-lg max-w-none">
              <p className="mb-4">
                Nigeria's entertainment industry is one of the most vibrant and influential in Africa, with global reach and impact.
                From the world-famous Nollywood film industry to the chart-topping Afrobeats music scene, Nigerian creators are shaping
                global culture.
              </p>

              <h3 className="text-2xl font-semibold mt-8 mb-4">Nollywood: Africa's Film Powerhouse</h3>
              <p className="mb-4">
                Nollywood is the second-largest film industry in the world by volume, producing thousands of movies annually.
                Nigerian films are known for their compelling storytelling, cultural authenticity, and innovative production techniques.
              </p>

              <h3 className="text-2xl font-semibold mt-8 mb-4">Afrobeats: Global Music Phenomenon</h3>
              <p className="mb-4">
                Nigerian artists like Burna Boy, Wizkid, Davido, and Tiwa Savage have taken Afrobeats to the global stage,
                collaborating with international superstars and dominating charts worldwide.
              </p>

              <h3 className="text-2xl font-semibold mt-8 mb-4">Fashion & Culture</h3>
              <p className="mb-4">
                Nigerian fashion designers are gaining international recognition for their innovative designs that blend
                traditional African aesthetics with contemporary styles. Lagos Fashion Week is a major event in the global
                fashion calendar.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Nigeria;
