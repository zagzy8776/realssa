import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SocialButtons from "@/components/SocialButtons";

const teamMembers = [
  { name: "Ama Serwaa", role: "Editor-in-Chief", emoji: "👤" },
  { name: "Kwame Nkrumah", role: "Music Editor", emoji: "🎤" },
  { name: "Akua Mensah", role: "Film & TV Editor", emoji: "🎬" },
  { name: "Yaw Tech", role: "Digital & Tech Editor", emoji: "📱" },
];

const values = [
  {
    title: "Authenticity",
    description: "We celebrate genuine African stories and voices, ensuring our content reflects the true spirit of the continent.",
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
    description: "We foster connections between artists, creators, and audiences across Africa and the diaspora.",
  },
];

const coverageAreas = [
  { title: "Afrobeats & Music", description: "Latest releases, artist interviews, and industry trends" },
  { title: "Nollywood & Ghanaian Cinema", description: "Film reviews, box office news, and behind-the-scenes coverage" },
  { title: "Culture & Lifestyle", description: "Traditional festivals, fashion, cuisine, and emerging trends" },
  { title: "Technology & Innovation", description: "AI in entertainment, digital platforms, and creative tech" },
  { title: "Nigeria Entertainment", description: "Comprehensive coverage of Africa's largest entertainment industry" },
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
            About <span className="text-gradient-gold">EntertainmentGHC</span>
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
              EntertainmentGHC is Ghana's premier entertainment news platform, dedicated to delivering accurate, timely, and engaging content about the vibrant entertainment scene in Ghana and across Africa. We cover everything from Afrobeats music and Nollywood films to cultural festivals and fashion trends.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Our mission is to showcase the rich cultural heritage and creative talent of Ghana while providing a platform for emerging artists and established stars alike. We believe in the power of storytelling to connect people and celebrate African creativity.
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
              EntertainmentGHC is powered by a passionate team of journalists, editors, and content creators who are deeply connected to the African entertainment scene.
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
