import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Globe2, ChevronRight } from "lucide-react";
import { apiUrl } from "@/lib/api-base";

/**
 * Country Trending Rail — tabbed horizontal rail showing the latest
 * headlines from each country feed (Nigeria, Ghana, Kenya, South Africa,
 * UK, USA, Netherlands). Lazy-loads per tab via /api/news/:country.
 */

interface CountryArticle {
  id: string;
  title: string;
  excerpt?: string;
  image?: string;
  date?: string;
  published_at?: string;
  source_name?: string;
  author?: string;
}

const COUNTRIES = [
  { key: "nigeria", label: "🇳🇬 Nigeria", path: "/nigeria", endpoint: "/api/news/nigerian" },
  { key: "ghana", label: "🇬🇭 Ghana", path: "/ghana", endpoint: "/api/news/ghana" },
  { key: "kenya", label: "🇰🇪 Kenya", path: "/kenya", endpoint: "/api/news/kenya" },
  { key: "south-africa", label: "🇿🇦 S. Africa", path: "/south-africa", endpoint: "/api/news/south-africa" },
  { key: "uk", label: "🇬🇧 UK", path: "/uk", endpoint: "/api/news/uk" },
  { key: "usa", label: "🇺🇸 USA", path: "/usa", endpoint: "/api/news/usa" },
  { key: "netherlands", label: "🇳🇱 Netherlands", path: "/netherlands", endpoint: "/api/news/netherlands" },
];

const normalize = (a: any): CountryArticle | null => {
  if (!a || !a.title) return null;
  return {
    id: a.id || a.story_hash || a.title,
    title: a.title,
    excerpt: a.excerpt || a.ai_summary || a.original_excerpt || "",
    image: a.image || a.image_url || "",
    date: a.date || a.published_at || "",
    source_name: a.source_name || a.author || "",
  };
};

const CountryTrendingRail = () => {
  const [active, setActive] = useState(0);
  const [cache, setCache] = useState<Record<string, CountryArticle[]>>({});
  const [loaded, setLoaded] = useState(false);
  const fetchedRef = useRef(false);

  const country = COUNTRIES[active];

  const fetchCountry = async (key: string, endpoint: string) => {
    try {
      const res = await fetch(apiUrl(`${endpoint}?limit=10`));
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.articles || data.items || [];
      const articles = list.map(normalize).filter(Boolean) as CountryArticle[];
      if (articles.length > 0) {
        setCache((prev) => ({ ...prev, [key]: articles }));
      }
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const el = document.getElementById("country-trending-anchor");
    const start = () => {
      // Prefetch the first two tabs
      fetchCountry(COUNTRIES[0].key, COUNTRIES[0].endpoint);
      fetchCountry(COUNTRIES[1].key, COUNTRIES[1].endpoint);
      setLoaded(true);
    };

    if (!el) {
      start();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          start();
          observer.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fetch on tab switch if not cached
  useEffect(() => {
    if (!cache[country.key]) {
      fetchCountry(country.key, country.endpoint);
    }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded) return null;

  const articles = cache[country.key] || [];

  return (
    <section className="px-3 sm:px-4 py-5 max-w-screen-xl mx-auto" id="country-trending-anchor">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4" style={{ color: "var(--nr-amber)" }} />
          <h2 className="nr-section-title mb-0">Trending by Country</h2>
        </div>
        <Link
          to="/world-directory"
          className="inline-flex items-center gap-1 text-xs font-bold text-white/60 hover:text-white transition-colors"
        >
          All countries <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Country tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
        {COUNTRIES.map((c, idx) => (
          <button
            key={c.key}
            onClick={() => setActive(idx)}
            className={`nr-pill flex-shrink-0 ${active === idx ? "nr-pill-active" : "nr-pill-inactive"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {articles.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
          {articles.map((article) => (
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
                    style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.15), transparent)" }}
                  >
                    <span className="text-3xl font-black" style={{ color: "var(--nr-amber)", opacity: 0.5 }}>
                      {(article.title || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
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
                  {article.source_name || ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center text-sm" style={{ color: "var(--nr-text-muted)" }}>
          Loading {country.label} headlines…
        </div>
      )}
    </section>
  );
};

export default CountryTrendingRail;
