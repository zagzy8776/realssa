import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SocialButtons from "@/components/SocialButtons";
import SectionHeader from "@/components/SectionHeader";
import NewsCard from "@/components/NewsCard";

const Culture = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SocialButtons />

      {/* Hero Section */}
      <section className="py-12 md:py-20 bg-gradient-to-r from-orange-500 to-yellow-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-4">African Culture & Heritage</h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Celebrating the rich cultural tapestry of Africa through entertainment, traditions, and modern expressions
          </p>
        </div>
      </section>

      {/* Culture News Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <SectionHeader title="Culture News & Features" emoji="🎭" />

          <div className="text-center py-8">
            <p className="text-muted-foreground">No culture news articles posted yet.</p>
            <p className="text-sm text-muted-foreground mt-2">Admins can post culture-related content through the admin dashboard.</p>
          </div>
        </div>
      </section>

      {/* Cultural Categories Section */}
      <section className="py-12 md:py-16 bg-card/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-display font-bold mb-8 text-center">Explore African Culture</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* African Cuisine */}
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-3">African Cuisine</h3>
              <p className="text-muted-foreground mb-4">
                Explore the diverse and flavorful culinary traditions of Africa, from West African jollof rice to East African injera.
              </p>
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 h-32 rounded-md flex items-center justify-center text-white font-semibold">
                African Food Culture
              </div>
            </div>

            {/* Traditional Music & Dance */}
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-3">Music & Dance</h3>
              <p className="text-muted-foreground mb-4">
                Experience the rhythmic heartbeat of Africa through traditional music, dance, and modern fusion styles.
              </p>
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-32 rounded-md flex items-center justify-center text-white font-semibold">
                African Rhythms
              </div>
            </div>

            {/* Fashion & Textiles */}
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-3">Fashion & Textiles</h3>
              <p className="text-muted-foreground mb-4">
                Learn about traditional African fabrics like kente, ankara, and kitenge, and their modern fashion interpretations.
              </p>
              <div className="bg-gradient-to-r from-blue-400 to-purple-500 h-32 rounded-md flex items-center justify-center text-white font-semibold">
                African Textiles
              </div>
            </div>

            {/* Language & Literature */}
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-3">Language & Literature</h3>
              <p className="text-muted-foreground mb-4">
                Discover the rich oral traditions, proverbs, and modern literary works from African writers and storytellers.
              </p>
              <div className="bg-gradient-to-r from-green-400 to-blue-500 h-32 rounded-md flex items-center justify-center text-white font-semibold">
                African Stories
              </div>
            </div>

            {/* Visual Arts */}
            <div className="bg-card p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-3">Visual Arts</h3>
              <p className="text-muted-foreground mb-4">
                Explore traditional and contemporary African art, from ancient sculptures to modern digital creations.
              </p>
              <div className="bg-gradient-to-r from-indigo-400 to-purple-500 h-32 rounded-md flex items-center justify-center text-white font-semibold">
                African Artistry
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cultural Impact Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-bold mb-6 text-center">The Impact of African Culture</h2>

            <div className="prose prose-lg max-w-none">
              <p className="mb-4">
                African culture has had a profound impact on global entertainment, influencing music, fashion, film, and art
                worldwide. From the rhythms of Afrobeats to the vibrant patterns of African textiles, the continent's cultural
                heritage continues to inspire creators around the world.
              </p>

              <h3 className="text-2xl font-semibold mt-8 mb-4">Global Cultural Exchange</h3>
              <p className="mb-4">
                African artists, musicians, and filmmakers are increasingly collaborating with international counterparts,
                creating a rich cultural exchange that benefits both African and global audiences.
              </p>

              <h3 className="text-2xl font-semibold mt-8 mb-4">Preserving Heritage</h3>
              <p className="mb-4">
                Many African countries are working to preserve their cultural heritage through digital archives, cultural
                festivals, and educational programs that pass traditional knowledge to younger generations.
              </p>

              <h3 className="text-2xl font-semibold mt-8 mb-4">Cultural Tourism</h3>
              <p className="mb-4">
                Cultural tourism is growing across Africa, with visitors coming to experience traditional festivals,
                historical sites, and authentic cultural experiences that showcase the continent's diversity.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Culture;