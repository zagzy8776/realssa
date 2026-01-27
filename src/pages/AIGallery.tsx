import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SocialButtons from "@/components/SocialButtons";
import SectionHeader from "@/components/SectionHeader";

const AIGallery = () => {
  // Sample AI-generated entertainment images
  const aiImages = [
    {
      id: 1,
      title: "Afrobeats Concert",
      description: "AI-generated Afrobeats concert scene",
      url: "https://via.placeholder.com/400x300?text=AI+Afrobeats+Concert",
      category: "Music"
    },
    {
      id: 2,
      title: "Nollywood Film Scene",
      description: "AI-generated Nollywood movie scene",
      url: "https://via.placeholder.com/400x300?text=AI+Nollywood+Scene",
      category: "Film"
    },
    {
      id: 3,
      title: "African Fashion Show",
      description: "AI-generated African fashion runway",
      url: "https://via.placeholder.com/400x300?text=AI+Fashion+Show",
      category: "Fashion"
    },
    {
      id: 4,
      title: "Cultural Festival",
      description: "AI-generated traditional African festival",
      url: "https://via.placeholder.com/400x300?text=AI+Cultural+Festival",
      category: "Culture"
    },
    {
      id: 5,
      title: "Music Studio",
      description: "AI-generated modern music production studio",
      url: "https://via.placeholder.com/400x300?text=AI+Music+Studio",
      category: "Music"
    },
    {
      id: 6,
      title: "Film Premiere",
      description: "AI-generated African film premiere event",
      url: "https://via.placeholder.com/400x300?text=AI+Film+Premiere",
      category: "Film"
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SocialButtons />

      {/* Hero Section */}
      <section className="py-12 md:py-20 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-4">AI Entertainment Gallery</h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Explore AI-generated visions of African entertainment's future
          </p>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <SectionHeader title="AI-Generated Entertainment Art" emoji="🤖" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {aiImages.map((image) => (
              <div key={image.id} className="group cursor-pointer">
                <div className="overflow-hidden rounded-lg mb-4">
                  <img
                    src={image.url}
                    alt={image.title}
                    className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="text-xl font-semibold mb-2">{image.title}</h3>
                <p className="text-muted-foreground mb-2">{image.description}</p>
                <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                  {image.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About AI in Entertainment Section */}
      <section className="py-12 md:py-16 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-bold mb-6 text-center">AI in African Entertainment</h2>

            <div className="prose prose-lg max-w-none">
              <p className="mb-4">
                Artificial Intelligence is revolutionizing the African entertainment industry, from music production to film
                making and fashion design. AI tools are enabling creators to push boundaries and explore new creative
                possibilities.
              </p>

              <h3 className="text-2xl font-semibold mt-8 mb-4">AI in Music Production</h3>
              <p className="mb-4">
                African musicians are using AI tools to create innovative beats, enhance vocal production, and even generate
                new musical ideas. AI-powered platforms help artists experiment with different sounds and styles.
              </p>

              <h3 className="text-2xl font-semibold mt-8 mb-4">AI in Film and Video</h3>
              <p className="mb-4">
                From scriptwriting assistance to visual effects and video editing, AI is transforming African film production.
                Nollywood filmmakers are adopting AI tools to improve production quality and efficiency.
              </p>

              <h3 className="text-2xl font-semibold mt-8 mb-4">AI in Fashion Design</h3>
              <p className="mb-4">
                African fashion designers are using AI to create unique patterns, predict trends, and even generate virtual
                fashion shows. AI helps blend traditional African aesthetics with futuristic designs.
              </p>

              <h3 className="text-2xl font-semibold mt-8 mb-4">The Future of AI Entertainment</h3>
              <p className="mb-4">
                As AI technology continues to evolve, we can expect even more exciting innovations in African entertainment.
                From AI-generated music to virtual reality experiences, the future looks bright for African creators.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AIGallery;