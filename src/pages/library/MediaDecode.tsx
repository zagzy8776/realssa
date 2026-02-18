import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SocialButtons from "@/components/SocialButtons";
import SectionHeader from "@/components/SectionHeader";

const MediaDecode = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SocialButtons />

      {/* Hero Section */}
      <section className="py-12 md:py-20 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-4">Media Decode</h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Understanding the complex world of African media, entertainment, and digital culture
          </p>
        </div>
      </section>

      {/* Main Content Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto prose prose-lg">
            <h2 className="text-3xl font-display font-bold mb-6">Decoding African Media Landscape</h2>

            <p className="mb-4">
              The African media and entertainment industry is undergoing rapid transformation, driven by digital innovation,
              changing consumer behaviors, and global connectivity. This guide helps you understand the key trends,
              challenges, and opportunities shaping Africa's media future.
            </p>

            <h3 className="text-2xl font-semibold mt-8 mb-4">Digital Transformation</h3>
            <p className="mb-4">
              African media is increasingly moving online, with streaming platforms, digital news, and social media
              becoming primary sources of entertainment and information for millions across the continent.
            </p>

            <h3 className="text-2xl font-semibold mt-8 mb-4">Mobile Revolution</h3>
            <p className="mb-4">
              With mobile penetration exceeding 80% in many African countries, smartphones have become the primary
              device for media consumption, creating new opportunities for content creators and distributors.
            </p>

            <h3 className="text-2xl font-semibold mt-8 mb-4">Content Localization</h3>
            <p className="mb-4">
              The demand for locally relevant content is growing, with African audiences seeking stories that reflect
              their cultures, languages, and experiences. This has led to a boom in local content production.
            </p>

            <h3 className="text-2xl font-semibold mt-8 mb-4">Monetization Challenges</h3>
            <p className="mb-4">
              While digital platforms offer new distribution channels, monetization remains a challenge due to
              fragmented markets, payment infrastructure limitations, and competition from global platforms.
            </p>

            <h3 className="text-2xl font-semibold mt-8 mb-4">Regulatory Environment</h3>
            <p className="mb-4">
              African governments are increasingly focusing on media regulation, with policies aimed at supporting
              local content, protecting intellectual property, and ensuring fair competition in the digital space.
            </p>
          </div>
        </div>
      </section>

      {/* Media Trends Section */}
      <section className="py-12 md:py-16 bg-card/50">
        <div className="container mx-auto px-4">
          <SectionHeader title="Emerging Media Trends" emoji="📊" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Trend 1 */}
            <div className="bg-card p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Social Media Influence</h3>
              <p className="text-muted-foreground">
                African creators are leveraging platforms like TikTok, Instagram, and YouTube to build global audiences
                and monetize their content through brand partnerships and direct fan engagement.
              </p>
            </div>

            {/* Trend 2 */}
            <div className="bg-card p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Podcasting Growth</h3>
              <p className="text-muted-foreground">
                Podcasting is experiencing rapid growth across Africa, with creators exploring diverse topics from
                business and technology to culture and entertainment in local languages.
              </p>
            </div>

            {/* Trend 3 */}
            <div className="bg-card p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Gaming Expansion</h3>
              <p className="text-muted-foreground">
                Africa's gaming industry is expanding, with local game developers creating culturally relevant games
                and esports gaining popularity among young audiences.
              </p>
            </div>

            {/* Trend 4 */}
            <div className="bg-card p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Virtual Events</h3>
              <p className="text-muted-foreground">
                The pandemic accelerated the adoption of virtual events, and hybrid formats are now becoming standard
                for concerts, conferences, and cultural festivals across Africa.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Resources Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <SectionHeader title="Media Resources" emoji="📚" />

          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl font-semibold mb-4">Recommended Reading</h3>
            <ul className="list-disc list-inside space-y-2 mb-6">
              <li>African Media Barometer - Annual reports on media freedom</li>
              <li>Digital Africa Report - Trends in African digital media</li>
              <li>Afrostream Research - African streaming market analysis</li>
              <li>Balancing Act News - African telecoms and media news</li>
            </ul>

            <h3 className="text-2xl font-semibold mb-4">Industry Events</h3>
            <ul className="list-disc list-inside space-y-2 mb-6">
              <li>Africom - African communications conference</li>
              <li>Nollywood Week - Nigerian film industry event</li>
              <li>African Podcast Festival - Celebrating African audio content</li>
              <li>Digital Media Africa - Media innovation conference</li>
            </ul>

            <h3 className="text-2xl font-semibold mb-4">Research Organizations</h3>
            <ul className="list-disc list-inside space-y-2">
              <li>African Media Initiative</li>
              <li>Highway Africa - Media research center</li>
              <li>African Digital Media Institute</li>
              <li>Wits Journalism - African media studies</li>
            </ul>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default MediaDecode;