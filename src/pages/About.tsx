import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SocialButtons from "@/components/SocialButtons";

const teamMembers = [
  { name: "Ama Serwaa", role: "Editor-in-Chief", emoji: "👤" },
  { name: "Kwame Nkrumah", role: "News & Politics Editor", emoji: "📰" },
  { name: "Akua Mensah", role: "Sports Editor", emoji: "⚽" },
  { name: "Yaw Tech", role: "Digital & Tech Editor", emoji: "📱" },
];

const values = [
  {
    title: "Authenticity",
    description: "We celebrate genuine African stories and voices, ensuring our content reflects the true spirit of the Sub-Saharan region.",
  },
  {
    title: "Quality",
    description: "We maintain high journalistic standards with well-researched, accurate, and engaging content.",
  },
  {
    title: "Innovation",
    description: "We embrace new technologies and storytelling formats to deliver content in exciting ways.",
  },
  {
    title: "Community",
    description: "We foster connections between readers, journalists, and communities across Sub-Saharan Africa and the diaspora.",
  },
];

const coverageAreas = [
  { title: "Sub-Saharan Africa News", description: "Comprehensive coverage of regional updates, politics, economics, and current affairs from Nigeria, Ghana, Kenya, South Africa and beyond" },
  { title: "Sports & Athletics", description: "Live scores, football news, athletics, and regional sports coverage" },
  { title: "Culture & Entertainment", description: "Nollywood, Afrobeats, fashion, music, and emerging lifestyle trends" },
  { title: "Crypto & Blockchain", description: "Digital assets, Bitcoin adoption, and creative technology news across Africa" },
  { title: "Jobs & Careers", description: "Remote work opportunities and employment news in the region" },
];

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SocialButtons />

      {/* Page Header */}
      <section className="py-12 md:py-20 bg-gradient-to-b from-card to-background">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
            About <span className="text-gradient-gold">RealSSA News</span>
          </h1>
          <div className="w-24 h-1 bg-primary mx-auto" />
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Mission */}
          <article className="mb-12">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 text-foreground">Our Mission</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              RealSSA News is Sub-Saharan Africa's premier digital news platform, dedicated to delivering accurate, timely, and engaging content about the vibrant current affairs, sports, culture, and business scenes across the region. We cover everything from local politics in Nigeria and Ghana to international sports events and tech innovation.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Our mission is to showcase the rich news landscape and creative talent of Sub-Saharan Africa while providing a platform for authentic regional voices. We believe in the power of storytelling to connect people and celebrate African journalism.
            </p>
          </article>

          {/* What We Cover */}
          <article className="mb-12">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 text-foreground">What We Cover</h2>
            <ul className="space-y-3">
              {coverageAreas.map((area) => (
                <li key={area.title} className="text-muted-foreground">
                  <strong className="text-foreground">{area.title}:</strong> {area.description}
                </li>
              ))}
            </ul>
          </article>

          {/* Team */}
          <article className="mb-12">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 text-foreground">Our Team</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              RealSSA News is powered by a passionate team of journalists, editors, and content creators who are deeply connected to the African news scene.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {teamMembers.map((member) => (
                <div key={member.name} className="text-center">
                  <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-card border border-border flex items-center justify-center text-3xl">
                    {member.emoji}
                  </div>
                  <h3 className="font-semibold text-foreground">{member.name}</h3>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                </div>
              ))}
            </div>
          </article>

          {/* Values */}
          <article className="mb-12">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-foreground">Our Values</h2>
            <div className="space-y-6">
              {values.map((value) => (
                <div key={value.title}>
                  <h3 className="text-lg font-semibold text-primary mb-2">{value.title}</h3>
                  <p className="text-muted-foreground">{value.description}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
