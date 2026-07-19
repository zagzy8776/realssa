import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NewsCard from "@/components/NewsCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Landmark, MapPin, Trophy, ArrowRight, Share2, Award, Briefcase } from "lucide-react";
import { toast } from "sonner";

interface EntityProfile {
  role: string;
  state: string;
  constituency?: string;
  party: string;
  profile_image?: string;
  bio?: string;
  assets_summary?: string;
  voting_record?: any;
}

interface EntityArticle {
  id: number;
  title: string;
  original_excerpt: string;
  image?: string;
  published_at: string;
  source_name: string;
  category: string;
}

interface RelatedEntity {
  entity_name: string;
  entity_type: string;
  cooccurrence: number;
}

interface EntityData {
  name: string;
  isPolitician: boolean;
  profile: EntityProfile | null;
  articles: EntityArticle[];
  relatedEntities: RelatedEntity[];
}

export default function EntityHub() {
  const { name } = useParams<{ name: string }>();
  const [data, setData] = useState<EntityData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEntityData = async () => {
    try {
      setLoading(true);
      const host = window.location.hostname === "localhost" ? "http://localhost:5000" : "";
      const res = await fetch(`${host}/api/entities/${encodeURIComponent(name || "")}`);
      if (!res.ok) throw new Error("Failed to fetch entity details");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load topic details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntityData();
  }, [name]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `RealSSA Topic Hub — ${name}`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard!");
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case "person": return <User className="h-5 w-5 text-blue-500" />;
      case "organization": return <Landmark className="h-5 w-5 text-purple-500" />;
      case "location": return <MapPin className="h-5 w-5 text-red-500" />;
      case "sports_team": return <Trophy className="h-5 w-5 text-amber-500" />;
      default: return <Landmark className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-10">
        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-48 w-full" />
              </div>
            </div>
          </div>
        ) : !data ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-muted-foreground">Topic not found</h2>
            <Link to="/" className="text-primary mt-4 inline-block hover:underline">
              Go back home
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* --- Banner Header --- */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 text-white p-6 md:p-10 shadow-xl border border-white/10">
              <div className="absolute top-0 right-0 p-4">
                <button
                  onClick={handleShare}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition backdrop-blur"
                  title="Share Topic"
                >
                  <Share2 className="h-5 w-5 text-white" />
                </button>
              </div>

              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                {data.isPolitician && data.profile ? (
                  <Avatar className="h-28 w-28 border-4 border-primary shadow-lg bg-slate-800">
                    <AvatarImage src={data.profile.profile_image} alt={data.name} className="object-cover" />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {data.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-24 w-24 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur border border-white/20">
                    {getEntityIcon(data.relatedEntities[0]?.entity_type || "organization")}
                  </div>
                )}

                <div className="text-center md:text-left space-y-3">
                  <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 backdrop-blur">
                      RealSSA Knowledge Graph
                    </Badge>
                    {data.isPolitician && (
                      <Badge className="bg-primary text-primary-foreground">
                        Verified Politician
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight">{data.name}</h1>
                  {data.isPolitician && data.profile && (
                    <p className="text-purple-200 font-medium text-lg flex items-center justify-center md:justify-start gap-2">
                      <Award className="h-5 w-5" />
                      {data.profile.role} ({data.profile.party}) — {data.profile.state} State
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* --- Main Dashboard Grid --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Politician details OR Article feed */}
              <div className="lg:col-span-2 space-y-6">
                {/* Politician Info Section */}
                {data.isPolitician && data.profile && (
                  <Card className="border border-border/60 shadow-sm overflow-hidden">
                    <CardContent className="p-6 space-y-6">
                      <h2 className="text-xl font-bold flex items-center gap-2 border-b pb-3 border-border/80">
                        <Briefcase className="h-5 w-5 text-primary" /> Profile Details
                      </h2>
                      
                      {data.profile.bio && (
                        <div className="space-y-2">
                          <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">Biography</h3>
                          <p className="text-foreground/90 leading-relaxed text-sm">{data.profile.bio}</p>
                        </div>
                      )}

                      {data.profile.constituency && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/40 p-4 rounded-xl">
                          <div>
                            <span className="text-xs text-muted-foreground uppercase block font-semibold">Constituency</span>
                            <span className="font-medium text-sm text-foreground">{data.profile.constituency}</span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground uppercase block font-semibold">Political Party</span>
                            <span className="font-medium text-sm text-foreground">{data.profile.party}</span>
                          </div>
                        </div>
                      )}

                      {data.profile.assets_summary && (
                        <div className="space-y-2 bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl">
                          <h3 className="font-semibold text-amber-600 dark:text-amber-400 text-sm uppercase tracking-wider">Declared Assets & Net Worth</h3>
                          <p className="text-foreground/90 leading-relaxed text-sm">{data.profile.assets_summary}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Article Feed Section */}
                <div className="space-y-4">
                  <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                    Latest Coverage
                  </h2>
                  {data.articles.length === 0 ? (
                    <div className="text-center py-10 bg-muted/20 border border-dashed rounded-2xl">
                      <p className="text-muted-foreground text-sm">No recent articles found covering this topic.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {data.articles.map((art) => (
                        <NewsCard
                          key={art.id}
                          id={art.id.toString()}
                          title={art.title}
                          excerpt={art.original_excerpt}
                          image={art.image}
                          category={art.category}
                          source={art.source_name}
                          date={new Date(art.published_at).toLocaleDateString()}
                          readTime="3 min read"
                          sourceType="rss"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Knowledge Graph Connections & Related Topics */}
              <div className="space-y-6">
                <Card className="border border-border/60 shadow-sm bg-muted/20">
                  <CardContent className="p-6 space-y-6">
                    <h3 className="text-lg font-black tracking-tight border-b pb-3 border-border/80 flex items-center gap-2">
                      <Landmark className="h-5 w-5 text-primary" /> Topic Connections
                    </h3>

                    <div className="space-y-4">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        These are related people, places, and organizations frequently co-occurring in news articles mentioning <strong>{data.name}</strong>.
                      </p>

                      {data.relatedEntities.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No related connections detected yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {data.relatedEntities.map((ent) => (
                            <Link
                              key={ent.entity_name}
                              to={`/entity/${encodeURIComponent(ent.entity_name)}`}
                              className="flex items-center justify-between p-3 rounded-xl bg-background border hover:border-primary transition group hover:shadow-sm"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/5 transition">
                                  {getEntityIcon(ent.entity_type)}
                                </div>
                                <div className="text-left">
                                  <div className="font-semibold text-sm group-hover:text-primary transition">{ent.entity_name}</div>
                                  <div className="text-xs text-muted-foreground capitalize">{ent.entity_type}</div>
                                </div>
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition group-hover:translate-x-1" />
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
