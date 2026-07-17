import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Home, Newspaper, ArrowLeft, Trophy } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Page Not Found | RealSSA News"
        description="The page you're looking for doesn't exist. Head back to RealSSA News for the latest breaking news from Africa."
      />
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="text-center max-w-lg mx-auto">
          {/* Large branded 404 */}
          <div className="mb-6 select-none">
            <span className="text-[120px] md:text-[160px] font-display font-black leading-none text-gradient-gold">
              404
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-3">
            Page Not Found
          </h1>
          <p className="text-muted-foreground text-base mb-8 leading-relaxed">
            The page <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{location.pathname}</span> doesn't exist.
            <br />
            It may have been moved, deleted, or never existed.
          </p>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-all duration-200 active:scale-95"
            >
              <ArrowLeft size={18} />
              Go Back
            </button>
            <button
              onClick={() => navigate("/")}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all duration-200 active:scale-95 shadow-lg"
            >
              <Home size={18} />
              Home
            </button>
          </div>

          {/* Quick nav links */}
          <div className="mt-10 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground mb-4 font-medium">Or browse a section:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                { label: "📰 Breaking News", path: "/news" },
                { label: "🇳🇬 Nigeria", path: "/nigeria" },
                { label: "⚽ Sports", path: "/sports" },
                { label: "🌍 World News", path: "/world-news" },
                { label: "📺 Videos", path: "/videos" },
              ].map(({ label, path }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="px-4 py-2 rounded-full bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 hover:text-foreground transition-all duration-200"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default NotFound;
