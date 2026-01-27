import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SocialButtons from "@/components/SocialButtons";
import SectionHeader from "@/components/SectionHeader";

const SocietalArchitecture = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SocialButtons />

      {/* Hero Section */}
      <section className="py-12 md:py-20 bg-gradient-to-r from-green-600 to-emerald-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-4">Societal Architecture</h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Exploring the structures that shape African societies and their entertainment ecosystems
          </p>
        </div>
      </section>

      {/* Main Content Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto prose prose-lg">
            <h2 className="text-3xl font-display font-bold mb-6">The Framework of African Societies</h2>

            <p className="mb-4">
              African societies are built on complex social, cultural, and economic structures that influence how
              entertainment is created, distributed, and consumed. Understanding these societal architectures helps
              us appreciate the unique dynamics of African entertainment industries.
            </p>

            <h3 className="text-2xl font-semibold mt-8 mb-4">Cultural Foundations</h3>
            <p className="mb-4">
              African entertainment is deeply rooted in cultural traditions, with storytelling, music, dance, and visual
              arts playing central roles in community life. These cultural foundations provide the basis for modern
              entertainment industries.
            </p>

            <h3 className="text-2xl font-semibold mt-8 mb-4">Social Structures</h3>
            <p className="mb-4">
              Family, community, and social networks form the backbone of African societies. Entertainment often serves
              as a means of social cohesion, education, and cultural preservation within these structures.
            </p>

            <h3 className="text-2xl font-semibold mt-8 mb-4">Economic Systems</h3>
            <p className="mb-4">
              The informal economy plays a significant role in African entertainment, with many creators operating
              in informal networks before transitioning to formal industry structures as they gain success.
            </p>

            <h3 className="text-2xl font-semibold mt-8 mb-4">Urban vs Rural Dynamics</h3>
            <p className="mb-4">
              African entertainment ecosystems exhibit different characteristics in urban centers versus rural areas,
              with cities often serving as hubs for professional production while rural areas maintain strong
              traditional cultural practices.
            </p>
          </div>
        </div>
      </section>

      {/* Societal Components Section */}
      <section className="py-12 md:py-16 bg-card/50">
        <div className="container mx-auto px-4">
          <SectionHeader title="Key Societal Components" emoji="🏛️" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Component 1 */}
            <div className="bg-card p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Education Systems</h3>
              <p className="text-muted-foreground">
                Formal and informal education systems shape the skills and knowledge base of African creators.
                Many entertainment professionals learn through apprenticeship models and informal training.
              </p>
            </div>

            {/* Component 2 */}
            <div className="bg-card p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Governance Structures</h3>
              <p className="text-muted-foreground">
                Government policies, regulations, and cultural institutions play crucial roles in supporting or
                constraining the growth of entertainment industries across different African countries.
              </p>
            </div>

            {/* Component 3 */}
            <div className="bg-card p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Technological Infrastructure</h3>
              <p className="text-muted-foreground">
                The availability and accessibility of technology infrastructure, from internet connectivity to
                production equipment, significantly impacts the development of digital entertainment.
              </p>
            </div>

            {/* Component 4 */}
            <div className="bg-card p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Financial Ecosystems</h3>
              <p className="text-muted-foreground">
                Access to funding, investment, and monetization platforms determines the sustainability and growth
                potential of African entertainment businesses and individual creators.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Case Studies Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <SectionHeader title="Societal Impact Case Studies" emoji="📖" />

          <div className="space-y-8">
            {/* Case Study 1 */}
            <div className="bg-card p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Nollywood's Community Impact</h3>
              <p className="text-muted-foreground mb-4">
                Nigeria's film industry has created thousands of jobs and transformed local economies,
                particularly in Lagos and other production hubs. It has also influenced social norms and
                cultural perceptions across Africa.
              </p>
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 h-24 rounded-md flex items-center justify-center text-white font-semibold">
                Nollywood Impact
              </div>
            </div>

            {/* Case Study 2 */}
            <div className="bg-card p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Afrobeats Global Influence</h3>
              <p className="text-muted-foreground mb-4">
                The global success of Afrobeats has put African music on the world stage, creating new
                economic opportunities while also shaping global perceptions of African culture and
                creativity.
              </p>
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-24 rounded-md flex items-center justify-center text-white font-semibold">
                Global Music Impact
              </div>
            </div>

            {/* Case Study 3 */}
            <div className="bg-card p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Digital Transformation</h3>
              <p className="text-muted-foreground mb-4">
                The rise of digital platforms has democratized content creation, allowing African creators
                to bypass traditional gatekeepers and reach global audiences directly through social media
                and streaming services.
              </p>
              <div className="bg-gradient-to-r from-blue-400 to-indigo-500 h-24 rounded-md flex items-center justify-center text-white font-semibold">
                Digital Revolution
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Future Trends Section */}
      <section className="py-12 md:py-16 bg-card/50">
        <div className="container mx-auto px-4">
          <SectionHeader title="Future Societal Trends" emoji="🔮" />

          <div className="max-w-4xl mx-auto prose prose-lg">
            <h3 className="text-2xl font-semibold mb-4">Youth Empowerment</h3>
            <p className="mb-4">
              Africa's youthful population is driving innovation in entertainment, with young creators leveraging
              digital tools to express their identities and address social issues through music, film, and digital art.
            </p>

            <h3 className="text-2xl font-semibold mb-4">Cultural Preservation</h3>
            <p className="mb-4">
              There is growing interest in preserving traditional cultural expressions while adapting them for
              contemporary audiences, creating a bridge between heritage and modern entertainment forms.
            </p>

            <h3 className="text-2xl font-semibold mb-4">Economic Formalization</h3>
            <p className="mb-4">
              As African entertainment industries mature, there is a trend toward formalization of business
              structures, professional training, and industry standards that support sustainable growth.
            </p>

            <h3 className="text-2xl font-semibold mb-4">Cross-Cultural Collaboration</h3>
            <p className="mb-4">
              Increased collaboration between African creators and global partners is leading to innovative
              hybrid cultural expressions that blend African traditions with international influences.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default SocietalArchitecture;