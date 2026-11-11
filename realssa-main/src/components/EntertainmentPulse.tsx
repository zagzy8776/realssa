import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Clock, Flame, Radio } from "lucide-react";
import { apiUrl } from "@/lib/api-base";

interface TrendSignal {
  id: string;
  title: string;
  snippet: string;
  heat: number;
  region: string;
  mentions: number;
  sourceCount: number;
  keywords: string[];
  whyHot: string[];
  searchUrl: string;
  publishedAt: string;
  signals: {
    recency: number;
    engagement: number;
    corroboration: number;
    velocity: number;
  };
}

const timeAgo = (iso: string) => {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "just now";

  const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const regionLabel = (region: string) => {
  if (!region || region === "global") return "Global";
  return region.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const EntertainmentPulse = () => {
  const [trends, setTrends] = useState<TrendSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannedAt, setScannedAt] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch(apiUrl("/api/entertainment/trends?limit=8"), {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        if (!response.ok) return;

        const data = await response.json();
        if (data?.ok && Array.isArray(data.trends)) setTrends(data.trends);
        if (data?.scannedAt) setScannedAt(data.scannedAt);
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          console.warn("Entertainment pulse unavailable");
        }
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, []);

  if (loading || trends.length === 0) return null;

  return (
    <section className="py-10 md:py-14 border-b border-border/60">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm uppercase tracking-wider">
              <Radio className="w-4 h-4" />
              Entertainment Pulse
            </div>
            <h2 className="text-2xl md:text-3xl font-display font-bold mt-1">
              What&apos;s accelerating right now
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Ranked by recency, independent coverage, search volume and social velocity.
              Every signal links to reporting, not to a publisher feed.
            </p>
          </div>

          {scannedAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              Scanned {timeAgo(scannedAt)}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trends.map((trend, index) => (
            <Link
              key={trend.id}
              to={trend.searchUrl}
              className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors hover:border-amber-500/50"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-sm font-bold text-amber-500">
                  {index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-amber-500 transition-colors">
                      {trend.title}
                    </h3>
                    <ArrowUpRight className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                  </div>

                  {trend.snippet && trend.snippet !== trend.title && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {trend.snippet}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 font-medium text-amber-500">
                      <Flame className="w-3.5 h-3.5" />
                      {trend.heat} heat
                    </span>
                    <span>{trend.sourceCount} source{trend.sourceCount === 1 ? "" : "s"}</span>
                    <span>{regionLabel(trend.region)}</span>
                    <span>{timeAgo(trend.publishedAt)}</span>
                  </div>

                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600"
                      style={{ width: `${Math.min(100, Math.max(8, trend.heat))}%` }}
                    />
                  </div>

                  {trend.whyHot?.[0] && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-1">
                      {trend.whyHot[0]}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EntertainmentPulse;
