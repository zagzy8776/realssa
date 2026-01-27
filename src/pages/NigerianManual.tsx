import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SocialButtons from "@/components/SocialButtons";
import NewsTicker from "@/components/NewsTicker";
import LibrarySidebar from "@/components/LibrarySidebar";

const featuredArticles = [
  {
    title: "Understanding Nigerian Federalism",
    description: "A comprehensive guide to Nigeria's federal structure and its impact on governance",
    color: "bg-primary",
  },
  {
    title: "The Evolution of Nollywood",
    description: "From humble beginnings to global recognition: The story of Nigeria's film industry",
    color: "bg-emerald-500",
  },
  {
    title: "Nigeria's Economic Diversification",
    description: "Analyzing the challenges and opportunities in moving beyond oil dependence",
    color: "bg-blue-500",
  },
];

const topics = [
  { title: "Cultural Heritage", description: "Traditional festivals, languages, and customs" },
  { title: "Political Analysis", description: "Governance structures, elections, and policy-making" },
  { title: "Economic Insights", description: "Business trends, trade, and financial systems" },
  { title: "Social Dynamics", description: "Education, healthcare, and demographic trends" },
  { title: "Historical Perspectives", description: "Key events and figures that shaped Nigeria" },
  { title: "Contemporary Issues", description: "Current challenges and emerging trends" },
];

const NigerianManual = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SocialButtons />
      <NewsTicker />

      {/* Category Header */}
      <section className="py-12 md:py-20 bg-gradient-to-br from-primary to-primary/80">
        <div className="container mx-auto px-4 text-center">
          <span className="inline-block px-4 py-1 bg-primary text-primary-foreground rounded-full text-sm font-medium mb-4">
            THE NIGERIAN MANUAL
          </span>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-primary-foreground mb-4">
            THE NIGERIAN MANUAL
          </h1>
          <p className="text-primary-foreground/80 max-w-2xl mx-auto">
            Comprehensive guides and in-depth analysis of Nigerian culture, history, and contemporary issues
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
                <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 text-foreground">About THE NIGERIAN MANUAL</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  THE NIGERIAN MANUAL represents our flagship collection of explainers that provide comprehensive, well-researched insights into Nigerian society. From historical perspectives to contemporary issues, these articles offer depth and context that goes beyond surface-level reporting.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Our manual series covers a wide range of topics including cultural traditions, political developments, economic trends, and social dynamics that shape Nigeria's past, present, and future.
                </p>
              </article>

              {/* Featured Articles */}
              <article>
                <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-foreground">Featured Manual Articles</h2>
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

              {/* Topics */}
              <article>
                <h2 className="text-2xl md:text-3xl font-display font-bold mb-6 text-foreground">Topics Covered</h2>
                <ul className="space-y-3">
                  {topics.map((topic) => (
                    <li key={topic.title} className="text-muted-foreground">
                      <strong className="text-foreground">{topic.title}:</strong> {topic.description}
                    </li>
                  ))}
                </ul>
              </article>
            </div>

            {/* Sidebar */}
            <LibrarySidebar currentPage="nigerian-manual" />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default NigerianManual;
