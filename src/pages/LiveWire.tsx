import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Search, RefreshCw, ExternalLink, Globe, Rss, Layers, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface SocialPost {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  handle: string;
  date: string;
  externalLink: string;
  image?: string;
  category: string;
}

const PUBLISHERS = [
  {
    handle: "channelstv",
    name: "Channels Television",
    bio: "Nigeria's leading 24-hour news television station. Breaking news, politics, business & more.",
    logo: "https://www.channelstv.com/wp-content/uploads/2018/01/channels-tv-logo.png",
    color: "#0D47A1",
    category: "News",
    website: "https://www.channelstv.com"
  },
  {
    handle: "PremiumTimesng",
    name: "Premium Times",
    bio: "Independent Nigerian newspaper. Investigative journalism, accountability & public interest reporting.",
    logo: "https://www.premiumtimesng.com/wp-content/uploads/2013/01/premium-times-logo.png",
    color: "#1B5E20",
    category: "News",
    website: "https://www.premiumtimesng.com"
  },
  {
    handle: "vanguardngrnews",
    name: "Vanguard News",
    bio: "One of Nigeria's most widely read daily newspapers, covering national and international news.",
    logo: "https://www.vanguardngr.com/wp-content/uploads/2018/09/vanguard-logo.png",
    color: "#B71C1C",
    category: "News",
    website: "https://www.vanguardngr.com"
  },
  {
    handle: "thecableng",
    name: "TheCable",
    bio: "Digital-first Nigerian news platform focused on accountability journalism and breaking news.",
    logo: "https://www.thecable.ng/wp-content/uploads/2015/01/thecable-logo.png",
    color: "#E65100",
    category: "News",
    website: "https://www.thecable.ng"
  },
  {
    handle: "GuardianNigeria",
    name: "The Guardian Nigeria",
    bio: "Nigerian broadsheet newspaper known for in-depth reporting on politics, business, and culture.",
    logo: "https://guardian.ng/wp-content/uploads/2016/05/guardian-logo.png",
    color: "#3E2723",
    category: "News",
    website: "https://guardian.ng"
  },
  {
    handle: "BBCAfrica",
    name: "BBC Africa",
    bio: "News, analysis and features from across the African continent by the BBC.",
    logo: "https://upload.wikimedia.org/wikipedia/commons/e/eb/BBC_World_News_logo_%282019%29.svg",
    color: "#D84315",
    category: "News",
    website: "https://www.bbc.com/africa"
  },
  {
    handle: "AlJazeera",
    name: "Al Jazeera English",
    bio: "Breaking news, world news and video from Al Jazeera. Setting the news agenda.",
    logo: "https://upload.wikimedia.org/wikipedia/commons/f/f2/Al_jazeera_red_logo.png",
    color: "#FF8F00",
    category: "News",
    website: "https://www.aljazeera.com"
  },
  {
    handle: "SuperSport",
    name: "SuperSport",
    bio: "Africa's home of sport. Live scores, fixtures, results and breaking sports news.",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/5f/SuperSport_logo.svg",
    color: "#303F9F",
    category: "Sports",
    website: "https://supersport.com"
  },
  {
    handle: "nairametrics",
    name: "Nairametrics",
    bio: "Nigeria's top financial and investment news platform covering stocks, forex, and economic data.",
    logo: "https://nairametrics.com/wp-content/uploads/2019/01/nairametrics-logo.png",
    color: "#00695C",
    category: "News",
    website: "https://nairametrics.com"
  },
  {
    handle: "dailytrust",
    name: "Daily Trust",
    bio: "Leading newspaper in Northern Nigeria covering national politics, security, and development.",
    logo: "https://www.dailytrust.com.ng/wp-content/uploads/2019/01/daily-trust-logo.png",
    color: "#37474F",
    category: "News",
    website: "https://dailytrust.com"
  },
  {
    handle: "businessday",
    name: "BusinessDay",
    bio: "Nigeria's foremost business and financial newspaper covering markets, economy, and corporate news.",
    logo: "https://businessday.ng/wp-content/uploads/2019/01/businessday-logo.png",
    color: "#283593",
    category: "News",
    website: "https://businessday.ng"
  },
  {
    handle: "saharareporters",
    name: "Sahara Reporters",
    bio: "Investigative news platform covering corruption, governance, and public interest stories in Nigeria.",
    logo: "https://saharareporters.com/sites/default/files/logo_0.png",
    color: "#2E7D32",
    category: "News",
    website: "https://saharareporters.com"
  },
  {
    handle: "MobilePunch",
    name: "Punch",
    bio: "Nigeria's most widely read daily print newspaper online covering breaking national reports.",
    logo: "https://punchng.com/wp-content/uploads/2021/04/punch-logo.png",
    color: "#C62828",
    category: "News",
    website: "https://punchng.com"
  }
];

export default function LiveWire() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePublisher, setActivePublisher] = useState(PUBLISHERS[0]);
  const [search, setSearch] = useState("");
  
  // Modal State
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);

  const fetchWirePosts = async () => {
    try {
      setLoading(true);
      const host = window.location.hostname === "localhost" ? "http://localhost:5000" : "";
      const res = await fetch(`${host}/api/news/social?limit=100`);
      
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      console.warn("Failed to fetch Live Wire feeds");
      toast.error("Could not fetch Live Wire feed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWirePosts();
  }, []);

  const getInitials = (name: string) => {
    return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  };

  const timeAgo = (dateStr: string) => {
    try {
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000 / 60);
      if (diff < 1) return "just now";
      if (diff < 60) return `${diff}m ago`;
      if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
      return `${Math.floor(diff / 1440)}d ago`;
    } catch {
      return "";
    }
  };

  // Filter posts by selected publisher and search query
  const publisherPosts = posts.filter(p => {
    const isPublisher = p.handle.toLowerCase() === activePublisher.handle.toLowerCase() ||
                        p.author.toLowerCase().includes(activePublisher.name.split(" ")[0].toLowerCase());
    
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || 
                          p.excerpt.toLowerCase().includes(search.toLowerCase());
    
    return isPublisher && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-10 space-y-8">
        
        {/* Banner Cover */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-10 shadow-xl border border-white/10 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="space-y-3 relative z-10">
            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 backdrop-blur">
              RealSSA Live Wire
            </Badge>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight flex items-center gap-3">
              <img src="/logo.png" alt="RealSSA Logo" className="h-8 md:h-12 w-auto animate-pulse" />
              Live News Wire
            </h1>
            <p className="text-indigo-200 text-sm md:text-base max-w-2xl">
              Real-time mapped micro-feed aggregates directly from West Africa's verified publishers and agencies. No intermediary channels, raw content only.
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-muted/20 p-4 rounded-2xl border">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search wire status updates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-border/80"
            />
          </div>
          <button
            onClick={fetchWirePosts}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-background border hover:bg-muted/50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Feed
          </button>
        </div>

        {/* main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Publisher Sidebar */}
          <div className="lg:col-span-1 space-y-4 max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin">
            <h2 className="text-lg font-black tracking-tight flex items-center gap-1.5 text-foreground">
              <Layers className="h-5 w-5 text-primary" /> Monitored Channels
            </h2>
            <div className="space-y-1">
              {PUBLISHERS.map((pub) => (
                <button
                  key={pub.handle}
                  onClick={() => { setActivePublisher(pub); setSearch(""); }}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition duration-200 ${
                    activePublisher.handle === pub.handle
                      ? "bg-primary/5 border-primary/50 shadow-sm"
                      : "bg-card border-border/40 hover:border-border hover:bg-muted/10"
                  }`}
                >
                  {pub.logo ? (
                    <img
                      src={pub.logo}
                      alt={pub.name}
                      className="w-10 h-10 rounded-xl object-cover bg-white p-1 border"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      style={{ backgroundColor: pub.color }}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    >
                      {getInitials(pub.name)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="font-extrabold text-sm text-foreground truncate">{pub.name}</span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 fill-blue-500 flex-shrink-0" />
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">
                      {pub.category}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Wire Status updates stream */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Publisher bio header card */}
            <Card className="border border-border/60 bg-muted/10">
              <CardContent className="p-6 flex flex-col md:flex-row gap-5 items-start md:items-center">
                {activePublisher.logo && (
                  <img
                    src={activePublisher.logo}
                    alt={activePublisher.name}
                    className="w-16 h-16 rounded-2xl object-cover bg-white border p-1 shadow-sm"
                  />
                )}
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-xl">{activePublisher.name}</h3>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0.5 tracking-wider bg-background/50">
                      {activePublisher.category}
                    </Badge>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                    {activePublisher.bio}
                  </p>
                </div>
                <a
                  href={activePublisher.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline flex-shrink-0"
                >
                  <Globe className="w-3.5 h-3.5" /> Visit Site
                </a>
              </CardContent>
            </Card>

            {/* Posts Feed list */}
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
              </div>
            ) : publisherPosts.length === 0 ? (
              <div className="text-center py-16 bg-muted/5 rounded-3xl border-2 border-dashed border-border/50">
                <Rss className="h-10 w-10 text-muted-foreground/60 mx-auto" />
                <p className="text-muted-foreground italic font-semibold mt-2">No recent broadcast status updates from {activePublisher.name}.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {publisherPosts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    className="w-full text-left bg-card hover:bg-muted/15 border border-border/60 hover:border-primary/45 rounded-2xl p-5 transition duration-200 flex flex-col md:flex-row gap-5 hover:shadow-sm"
                  >
                    {post.image && (
                      <img
                        src={post.image}
                        alt=""
                        className="w-full md:w-44 h-28 rounded-xl object-cover border flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <div className="flex-1 flex flex-col justify-between space-y-2">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-bold">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-blue-500 fill-blue-500" />
                            {activePublisher.name}
                          </span>
                          <span>{timeAgo(post.date)}</span>
                        </div>
                        <h4 className="font-extrabold text-sm md:text-base text-foreground leading-snug line-clamp-2">
                          {post.title}
                        </h4>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {post.excerpt}
                      </p>
                      
                      <div className="text-[10px] font-bold text-primary inline-flex items-center gap-1 pt-1.5 border-t border-border/10">
                        View Mapped Report →
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* --- detail Dialog Modal --- */}
        <Dialog open={selectedPost !== null} onOpenChange={(open) => { if (!open) setSelectedPost(null); }}>
          <DialogContent className="max-w-2xl bg-card border border-border/80 rounded-3xl p-0 overflow-hidden shadow-2xl">
            {selectedPost && (
              <div className="flex flex-col">
                <DialogHeader className="p-6 md:p-8 border-b pb-4">
                  <div className="flex justify-between items-center gap-2 pb-2">
                    <div className="flex items-center gap-2">
                      <img src="/logo.png" alt="RealSSA Logo" className="h-5 w-auto" />
                      <span className="text-[10px] uppercase font-black tracking-widest text-primary">Live Broadcast</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-semibold">
                      {timeAgo(selectedPost.date)}
                    </span>
                  </div>
                  <DialogTitle className="text-lg md:text-2xl font-black tracking-tight leading-snug text-foreground">
                    {selectedPost.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs font-semibold text-muted-foreground pt-1 flex items-center gap-1">
                    Source Agency: <span className="text-foreground font-bold">{selectedPost.author}</span>
                  </DialogDescription>
                </DialogHeader>

                <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[50vh] scrollbar-thin">
                  {selectedPost.image && (
                    <img
                      src={selectedPost.image}
                      alt=""
                      className="w-full rounded-2xl object-cover max-h-64 border shadow-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Wire Excerpt</h5>
                    <p className="text-sm md:text-base text-foreground/90 leading-relaxed font-medium">
                      {selectedPost.excerpt}
                    </p>
                  </div>
                </div>

                <div className="p-6 md:p-8 border-t bg-muted/20 flex flex-col md:flex-row justify-between items-center gap-4">
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    1 source channel monitored · updated real-time
                  </span>
                  
                  <div className="flex gap-2 w-full md:w-auto">
                    <DialogClose asChild>
                      <button className="flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-bold bg-background border hover:bg-muted/50 transition">
                        Close
                      </button>
                    </DialogClose>
                    <a
                      href={selectedPost.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-primary text-primary-foreground hover:bg-primary/95 transition shadow-sm"
                    >
                      Visit Website <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </main>

      <Footer />
    </div>
  );
}
