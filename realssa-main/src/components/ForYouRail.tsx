import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ChevronRight } from "lucide-react";
import { apiUrl } from "@/lib/api-base";

/**
 * For You Rail — personalized horizontal feed on the homepage.
 * Pulls from /api/feed/foryou (device-affinity ranked) and shows a
 * compact horizontal rail of 6 cards. "See more" links to /for-you.
 */

interface ForYouArticle {
  id: string;
  title: string;
  excerpt?: string;
  category?: string;
  image?: string;
  author?: string;
  date?: string;
  readTime?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  sports: "#22C55E",
  politics: "#EF4444",
  tech: "#3B82F6",
  business: "#F59E0B",
  entertainment: "#A855F7",
  world: "#06B6D4",
  nigeria: "#16A34A",
  netherlands: "#F97316",
  crypto: "#F59E0B",
  culture: "#EC4899",
};

const ForYouRail = () => {
  const [articles, setArticles] = useState<ForYouArticle[]>([]);
  const [loaded, setLoaded] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchForYou = async () => {
      try {
        const deviceId = localStorage.getItem("realssa_device_uuid") || "";
        const params = new URLSearchParams();
        if (deviceId) params.set("deviceId", deviceId);
        const res = await fetch(apiUrl(`/api/feed/foryou?${params.toString()}`));
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.articles) && data.articles.length > 0) {
          setArticles(data.articles.slice(0, 8));
        }
      } catch {
        /* silent — rail simply stays hidden */
      } finally {
        setLoaded(true);
      }
    };

    // Lazy-load: only fetch when the rail scrolls near the viewport
    const el = document.getElementById("foryou-rail-anchor");
    if (!el) {
      fetchForYou();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchForYou();
          observer.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!loaded || articles.length === 0) return null;

  return (
    <section className="px-3 sm:px-4 py-5 max-w-screen-xl mx-auto" id="foryou-rail-anchor">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: "var(--nr-amber)" }} />
          <h2 className="nr-section-title mb-0">For You</h2>
        </div>
        <Link
          to="/for-you"
          className="inline-flex items-center gap-1 text-xs font-bold text-white/60 hover:text-white transition-colors"
        >
          See all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
        {articles.map((article) => {
          const color = CATEGORY_COLORS[article.category || ""] || "var(--nr-amber)";
          return (
            <Link
              key={article.id}
              to={`/article/${article.id}`}
              className="flex-shrink-0 w-52 sm:w-60 snap-start nr-card overflow-hidden group"
              style={{ borderRadius: 12 }}
            >
              <div className="relative w-full aspect-video overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
                {article.image ? (
                  <img
                    src={article.image}
                    alt={article.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${color}33, transparent)` }}
                  >
                    <span className="text-3xl font-black" style={{ color, opacity: 0.5 }}>
                      {(article.title || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                {article.category && (
                  <span
                    className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                    style={{ background: "rgba(0,0,0,0.7)", color }}
                  >
                    {article.category}
                  </span>
                )}
              </div>
              <div className="p-3">
                <p
                  className="text-sm font-bold text-white leading-snug"
                  style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                >
                  {article.title}
                </p>
                <p className="mt-1.5 text-[11px] font-semibold" style={{ color: "var(--nr-text-muted)" }}>
                  {article.author || ""}
                  {article.readTime ? ` · ${article.readTime}` : ""}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default ForYouRail;
