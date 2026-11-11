import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SocialButtons from "@/components/SocialButtons";
import NewsTicker from "@/components/NewsTicker";
import LibrarySidebar from "@/components/LibrarySidebar";

const featuredArticles = [
  {
    title: "Education Reform Policy Analysis",
    description: "Examining the impact of recent education policy changes on access and quality",
    color: "bg-red-600",
  },
  {
    title: "Healthcare Policy Implementation",
    description: "Assessing the effectiveness of universal healthcare initiatives",
    color: "bg-emerald-500",
  },
  {
    title: "Economic Stimulus Programs",
    description: "Evaluating the short-term and long-term impacts of economic recovery policies",
    color: "bg-blue-500",
  },
];

const framework = [
  { title: "Policy Context", description: "Historical background and reasons for the policy" },
  { title: "Key Provisions", description: "Detailed breakdown of what the policy entails" },
  { title: "Implementation Challenges", description: "Practical obstacles to effective execution" },
  { title: "Stakeholder Analysis", description: "Who benefits and who may be adversely affected" },
  { title: "Impact Assessment", description: "Measuring the policy's effectiveness and outcomes" },
  { title: "Recommendations", description: "Suggestions for improvement or alternative approaches" },
];

const sectors = [
  { title: "Education", description: "Curriculum reforms, funding, and access" },
  { title: "Healthcare", description: "Public health initiatives and healthcare delivery" },
  { title: "Economic Policy", description: "Taxation, trade, and industrial development" },
  { title: "Social Welfare", description: "Poverty alleviation and social protection programs" },
  { title: "Environmental Policy", description: "Conservation and climate change mitigation" },
  { title: "Technology & Innovation", description: "Digital transformation and R&D policies" },
];

const PolicyBrief = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SocialButtons />
      <NewsTicker />

      {/* Category Header */}
      <section className="py-12 md:py-20 bg-gradient-to-br from-red-600 to-red-700">
        <div className="container mx-auto px-4 text-center">
          <span className="inline-block px-4 py-1 bg-red-600 text-white rounded-full text-sm font-medium mb-4">
            POLICY BRIEF
          </span>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
            POLICY BRIEF
          </h1>
          <p className="text-white/80 max-w-2xl mx-auto">
            In-depth examination of specific policies and their societal impacts
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-12">
              {/* About */}
              <article>
                <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 text-foreground">About POLICY BRIEF</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  POLICY BRIEF provides comprehensive analysis of specific policies, legislation, and government initiatives that shape our society. These articles go beyond surface-level reporting to examine the intended and unintended consequences of policy decisions.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Our policy briefs analyze the historical context, implementation challenges, stakeholder perspectives, and potential outcomes of key policies across various sectors.
                </p>
              </article>

              {/* Featured Articles */}
              <article>
                <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-foreground">Featured Policy Analysis</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {featuredArticles.map((article) => (
                    <a
                      key={article.title}
                      href="#"
                      className="group block bg-card rounded-xl overflow-hidden border border-border hover:border-primary transition-colors"
                    >
                      <div className={`h-32 ${article.color} opacity-80`} />
                      <div className="p-4">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                          {article.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">{article.description}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </article>

              {/* Framework */}
              <article>
                <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-foreground">Our Policy Analysis Framework</h2>
                <p className="text-muted-foreground mb-4">Each POLICY BRIEF follows a comprehensive analytical framework:</p>
                <ul className="space-y-3">
                  {framework.map((item) => (
                    <li key={item.title} className="text-muted-foreground">
                      <strong className="text-foreground">{item.title}:</strong> {item.description}
                    </li>
                  ))}
                </ul>
              </article>

              {/* Sectors */}
              <article>
                <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-foreground">Policy Sectors We Cover</h2>
                <ul className="space-y-3">
                  {sectors.map((sector) => (
                    <li key={sector.title} className="text-muted-foreground">
                      <strong className="text-foreground">{sector.title}:</strong> {sector.description}
                    </li>
                  ))}
                </ul>
              </article>
            </div>

            {/* Sidebar */}
            <LibrarySidebar currentPage="policy-brief" />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PolicyBrief;
