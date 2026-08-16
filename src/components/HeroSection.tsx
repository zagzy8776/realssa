/**
 * HeroSection — RealSSA Newsroom Redesign
 * Full-bleed editorial breaking story hero.
 * Fetches the freshest article from /api/articles and renders it
 * as a dramatic, full-width card with dark gradient overlay.
 */
import { ArrowRight, Clock, Wifi } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { apiUrl } from "@/lib/api-base";

interface HeroArticle {
  id: string;
  title: string;
  category: string;
  source_name?: string;
  published_at?: string;
  image?: string;
  external_link?: string;
  ai_summary?: string;
  original_excerpt?: string;
}

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1600&q=80",
  "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1600&q=80",
  "https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?w=1600&q=80",
];

const formatTimeAgo = (dateStr?: string) => {
  if (!dateStr) return "";
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch { return ""; }
};

const getCategoryLabel = (cat: string) => {
  const map: Record<string, string> = {
    breaking: "Breaking", politics: "Politics", sports: "Sports",
    tech: "Tech", crypto: "Crypto", business: "Business",
    entertainment: "Entertainment", news: "News", general: "News",
    "nigerian-news": "Nigeria", "nigerian-politics": "Politics",
    "nigerian-sports": "Sports", "nigerian-tech": "Tech",
    culture: "Culture", nollywood: "Nollywood",
  };
  return map[cat?.toLowerCase()] || "News";
};

const isBreaking = (dateStr?: string) => {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 90 * 60 * 1000; // within 90 min
};

const HeroSection = () => {
  const [article, setArticle] = useState<HeroArticle | null>(null);
  const [imgError, setImgError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchHero = async () => {
      try {
        const res = await fetch(apiUrl("/api/articles?limit=5&sort=latest"), {
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        const articles: HeroArticle[] = Array.isArray(data)
          ? data
          : data.articles || data.data || [];

        // Pick first article that has an image
        const picked = articles.find(a => a.image && !/(logo|icon|brand|favicon)/i.test(a.image))
          || articles[0];
        if (picked) {
          setArticle(picked);
          setTimeout(() => setLoaded(true), 80);
        }
      } catch {
        // Use a placeholder so the hero still looks premium
        setArticle({
          id: "hero-placeholder",
          title: "Your Real-Time Window Into Africa and the World",
          category: "news",
          source_name: "RealSSA News Desk",
          published_at: new Date().toISOString(),
        });
        setTimeout(() => setLoaded(true), 80);
      }
    };
    fetchHero();
  }, []);

  const resolveImage = () => {
    if (imgError || !article?.image) {
      return FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
    }
    return article.image.startsWith("//") ? "https:" + article.image : article.image;
  };

  const linkTo = article?.external_link
    ? `/read?url=${encodeURIComponent(article.external_link)}&id=${encodeURIComponent(article.id || "")}`
    : article?.id ? `/article/${article.id}` : "#";

  const breaking = isBreaking(article?.published_at);
  const imgSrc = resolveImage();

  return (
    <section className="relative w-full px-3 sm:px-4 pt-2 pb-0">
      <Link to={linkTo} className="block group">
        <div
          className="nr-hero-card overflow-hidden"
          style={{
            minHeight: "clamp(280px, 55vw, 520px)",
            background: "#111118",
          }}
        >
          {/* ── Background Image ── */}
          <div className="absolute inset-0 z-0">
            <img
              src={imgSrc}
              alt={article?.title || ""}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              style={{ opacity: loaded ? 0.72 : 0, transition: "opacity 0.5s ease, transform 0.7s ease" }}
            />
            {/* Skeleton shimmer while loading */}
            {!loaded && (
              <div
                className="absolute inset-0 animate-pulse"
                style={{ background: "linear-gradient(135deg, #16161E 0%, #1C1C26 50%, #16161E 100%)" }}
              />
            )}
          </div>

          {/* ── Gradient overlay (bottom-to-top) ── */}
          <div
            className="absolute inset-0 z-10 nr-hero-gradient"
            style={{
              background: "linear-gradient(to top, rgba(10,10,15,0.98) 0%, rgba(10,10,15,0.65) 45%, rgba(10,10,15,0.2) 80%, transparent 100%)",
            }}
          />

          {/* ── BREAKING badge top-left ── */}
          {breaking && (
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
              <span
                className="nr-badge nr-badge-red flex items-center gap-1"
                style={{ animation: "pulse 2s ease-in-out infinite" }}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full bg-white"
                  style={{ animation: "pulse 1.2s ease-in-out infinite" }}
                />
                BREAKING
              </span>
            </div>
          )}

          {/* ── Live indicator (Wi-Fi pulse) top-right ── */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1">
            <Wifi size={11} className="text-amber-400" />
            <span style={{ fontSize: "0.6rem", color: "rgba(245,158,11,0.8)", fontWeight: 700, letterSpacing: "0.08em" }}>
              LIVE FEED
            </span>
          </div>

          {/* ── Bottom text content ── */}
          <div
            className="absolute bottom-0 left-0 right-0 z-20 p-4 sm:p-5"
            style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.5s ease 0.2s" }}
          >
            {/* Category + source + time */}
            <div className="nr-meta mb-2 flex-wrap">
              <span className="nr-badge" style={{ fontSize: "0.58rem" }}>
                {getCategoryLabel(article?.category || "news")}
              </span>
              {article?.source_name && (
                <>
                  <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", fontWeight: 600 }}>
                    {article.source_name.toUpperCase()}
                  </span>
                </>
              )}
              {article?.published_at && (
                <>
                  <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
                  <Clock size={10} style={{ color: "rgba(255,255,255,0.4)" }} />
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.65rem" }}>
                    {formatTimeAgo(article.published_at)}
                  </span>
                </>
              )}
            </div>

            {/* Main headline */}
            <h1
              className="nr-headline-xl mb-3 line-clamp-3 sm:line-clamp-2"
              style={{ textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}
            >
              {article?.title || "Loading latest news…"}
            </h1>

            {/* Read more CTA */}
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
                style={{ color: "#F59E0B", letterSpacing: "0.08em" }}
              >
                Read Full Story
                <ArrowRight
                  size={13}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
};

export default HeroSection;
