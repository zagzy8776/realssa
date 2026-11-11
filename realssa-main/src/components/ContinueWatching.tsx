import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Play, Clock, ChevronRight } from "lucide-react";

/**
 * Continue Watching — surfaces the reader's recent reading history
 * (stored in localStorage by the app's telemetry hooks) as a horizontal
 * rail of compact cards. Drives re-engagement and session length.
 */

interface HistoryItem {
  id: string;
  title: string;
  category?: string;
  image?: string;
  url?: string;
  readAt: number; // epoch ms
}

const HISTORY_KEY = "realssa_reading_history_v1";
const MAX_ITEMS = 8;

const formatTimeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const CATEGORY_COLORS: Record<string, string> = {
  sports: "#22C55E",
  politics: "#EF4444",
  tech: "#3B82F6",
  business: "#F59E0B",
  entertainment: "#A855F7",
  world: "#06B6D4",
  nigeria: "#16A34A",
  netherlands: "#F97316",
};

const ContinueWatching = () => {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const list: HistoryItem[] = Array.isArray(parsed) ? parsed : parsed?.items || [];
      // Keep only items from the last 7 days, newest first
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const fresh = list
        .filter((i) => i && i.id && i.title && i.readAt > cutoff)
        .sort((a, b) => b.readAt - a.readAt)
        .slice(0, MAX_ITEMS);
      setItems(fresh);
    } catch {
      /* ignore */
    }
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="px-3 sm:px-4 py-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: "var(--nr-amber)" }} />
          <h2 className="nr-section-title mb-0">Continue Reading</h2>
        </div>
        <Link
          to="/reading-history"
          className="inline-flex items-center gap-1 text-xs font-bold text-white/60 hover:text-white transition-colors"
        >
          Full history <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
        {items.map((item) => {
          const color = CATEGORY_COLORS[item.category || ""] || "var(--nr-amber)";
          const linkTo = item.url
            ? `/read?url=${encodeURIComponent(item.url)}`
            : `/article/${item.id}`;
          return (
            <Link
              key={item.id}
              to={linkTo}
              className="flex-shrink-0 w-56 sm:w-64 snap-start nr-card overflow-hidden group"
              style={{ borderRadius: 12 }}
            >
              <div className="relative w-full aspect-video overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
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
                      {(item.title || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ background: "rgba(0,0,0,0.45)" }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: "var(--nr-amber)" }}
                  >
                    <Play className="w-4 h-4 text-black ml-0.5" fill="currentColor" />
                  </div>
                </div>
              </div>
              <div className="p-3">
                <p
                  className="text-sm font-bold text-white leading-snug line-clamp-2"
                  style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                >
                  {item.title}
                </p>
                <p className="mt-1.5 text-[11px] font-semibold" style={{ color: "var(--nr-text-muted)" }}>
                  {formatTimeAgo(item.readAt)}
                  {item.category ? ` · ${item.category}` : ""}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default ContinueWatching;
