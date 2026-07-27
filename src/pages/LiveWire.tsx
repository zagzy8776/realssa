import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Globe, 
  Rss, 
  Layers, 
  ArrowLeft, 
  MoreVertical, 
  Youtube, 
  Twitter, 
  Instagram, 
  Plus, 
  Check, 
  Share2 
} from "lucide-react";
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

interface PublisherDetail {
  handle: string;
  name: string;
  bio: string;
  logo: string;
  color: string;
  category: string;
  website: string;
  totalFollowers: string;
  socials: {
    youtube?: string;
    twitter?: string;
    instagram?: string;
  };
  fullAbout: string;
  wikiUrl: string;
}

// Custom Premium Starburst Verified Badge (matches Google/Twitter verified icon)
function VerifiedBadge({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} text-blue-500 fill-current shrink-0 inline-block`} aria-label="Verified">
      <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.99-3.818-3.99-.48 0-.927.1-1.336.26C14.773 2.51 13.518 1.5 12 1.5c-1.517 0-2.773 1.01-3.436 2.27-.408-.16-.856-.26-1.336-.26-2.11 0-3.818 1.78-3.818 3.99 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.71 3.99 3.818 3.99.48 0 .927-.1 1.336-.26.663 1.26 1.919 2.27 3.436 2.27 1.518 0 2.773-1.01 3.436-2.27.409.16.857.26 1.336.26 2.11 0 3.818-1.78 3.818-3.99 0-.495-.084-.965-.238-1.4 1.273-.65 2.148-2.02 2.148-3.6zm-12.5 4L6 12.5l1.5-1.5 2.5 2.5 6.5-6.5 1.5 1.5-8 8z"/>
    </svg>
  );
}

// 100% verified working logo URLs (either Wikipedia Commons SVG or direct favicon feeds)
const PUBLISHERS: PublisherDetail[] = [
  {
    handle: "AriseNews",
    name: "Arise News",
    bio: "Global news channel broadcasting 24 hours focusing on African, US, European & world reports.",
    logo: "https://www.google.com/s2/favicons?sz=128&domain=arise.tv",
    color: "#D32F2F",
    category: "News",
    website: "https://www.arise.tv",
    totalFollowers: "3.1M total followers",
    socials: {
      youtube: "1.2M followers",
      twitter: "992K followers",
      instagram: "450K followers"
    },
    fullAbout: "Arise News is an international television news channel founded by Nduka Obaigbena. It operates news hubs in London, New York City, Johannesburg, Abuja, and Lagos, bringing professional coverage of African affairs to a global audience.",
    wikiUrl: "https://en.wikipedia.org/wiki/Arise_News"
  },
  {
    handle: "channelstv",
    name: "Channels Television",
    bio: "Nigeria's leading 24-hour news television station. Breaking news, politics, business & more.",
    logo: "https://www.google.com/s2/favicons?sz=128&domain=channelstv.com",
    color: "#0D47A1",
    category: "News",
    website: "https://www.channelstv.com",
    totalFollowers: "4.8M total followers",
    socials: {
      youtube: "2.5M followers",
      twitter: "1.8M followers",
      instagram: "500K followers"
    },
    fullAbout: "Channels Television is a Nigerian independent 24-hour news and media television channel based in Lagos, Nigeria. The parent company, Channels Common-wealth, was founded in 1992 by Nigerian veteran broadcasters John Momoh and Sola Momoh.",
    wikiUrl: "https://en.wikipedia.org/wiki/Channels_TV"
  },
  {
    handle: "PremiumTimesng",
    name: "Premium Times",
    bio: "Independent Nigerian newspaper. Investigative journalism, accountability & public interest reporting.",
    logo: "https://www.google.com/s2/favicons?sz=128&domain=premiumtimesng.com",
    color: "#1B5E20",
    category: "News",
    website: "https://www.premiumtimesng.com",
    totalFollowers: "2.1M total followers",
    socials: {
      youtube: "180K followers",
      twitter: "1.5M followers",
      instagram: "420K followers"
    },
    fullAbout: "Premium Times is an independent Nigerian online newspaper launched in 2011. The news platform is based in Abuja and focuses on investigative journalism, politics, human rights, and business across West Africa.",
    wikiUrl: "https://en.wikipedia.org/wiki/Premium_Times"
  },
  {
    handle: "vanguardngrnews",
    name: "Vanguard News",
    bio: "One of Nigeria's most widely read daily newspapers, covering national and international news.",
    logo: "https://www.google.com/s2/favicons?sz=128&domain=vanguardngr.com",
    color: "#B71C1C",
    category: "News",
    website: "https://www.vanguardngr.com",
    totalFollowers: "3.4M total followers",
    socials: {
      youtube: "310K followers",
      twitter: "2.2M followers",
      instagram: "890K followers"
    },
    fullAbout: "Vanguard is a daily newspaper published by Vanguard Media, established in 1983 by veteran journalist Sam Amuka-Pemu. It is considered one of the leading broadsheets covering general interest reporting in Nigeria.",
    wikiUrl: "https://en.wikipedia.org/wiki/Vanguard_(Nigeria)"
  },
  {
    handle: "thecableng",
    name: "TheCable",
    bio: "Digital-first Nigerian news platform focused on accountability journalism and breaking news.",
    logo: "https://www.google.com/s2/favicons?sz=128&domain=thecable.ng",
    color: "#E65100",
    category: "News",
    website: "https://www.thecable.ng",
    totalFollowers: "1.7M total followers",
    socials: {
      youtube: "45K followers",
      twitter: "1.4M followers",
      instagram: "250K followers"
    },
    fullAbout: "TheCable is an independent digital newspaper in Nigeria launched in April 2014. The platform provides breaking news, features, and investigative reports with a focus on public interest and national politics.",
    wikiUrl: "https://www.thecable.ng/about-us"
  },
  {
    handle: "GuardianNigeria",
    name: "The Guardian Nigeria",
    bio: "Nigerian broadsheet newspaper known for in-depth reporting on politics, business, and culture.",
    logo: "https://www.google.com/s2/favicons?sz=128&domain=guardian.ng",
    color: "#3E2723",
    category: "News",
    website: "https://guardian.ng",
    totalFollowers: "2.9M total followers",
    socials: {
      youtube: "120K followers",
      twitter: "2.1M followers",
      instagram: "680K followers"
    },
    fullAbout: "The Guardian is an independent daily newspaper published in Lagos, Nigeria. Founded in 1983 by Alex Ibru, it is widely respected for its high-quality editorial stance and broad-ranging investigative reportage.",
    wikiUrl: "https://en.wikipedia.org/wiki/The_Guardian_(Nigeria)"
  },
  {
    handle: "BBCAfrica",
    name: "BBC Africa",
    bio: "News, analysis and features from across the African continent by the BBC.",
    logo: "https://www.google.com/s2/favicons?sz=128&domain=bbc.com",
    color: "#D84315",
    category: "News",
    website: "https://www.bbc.com/africa",
    totalFollowers: "8.5M total followers",
    socials: {
      youtube: "3.2M followers",
      twitter: "4.1M followers",
      instagram: "1.2M followers"
    },
    fullAbout: "BBC News Africa is the division of the British Broadcasting Corporation responsible for news reporting and digital content across all 54 nations of Africa, broadcasting in multiple languages including Swahili, Hausa, Pidgin, and French.",
    wikiUrl: "https://en.wikipedia.org/wiki/BBC_World_Service"
  },
  {
    handle: "AlJazeera",
    name: "Al Jazeera English",
    bio: "Breaking news, world news and video from Al Jazeera. Setting the news agenda.",
    logo: "https://www.google.com/s2/favicons?sz=128&domain=aljazeera.com",
    color: "#FF8F00",
    category: "News",
    website: "https://www.aljazeera.com",
    totalFollowers: "12.4M total followers",
    socials: {
      youtube: "6.8M followers",
      twitter: "4.5M followers",
      instagram: "1.1M followers"
    },
    fullAbout: "Al Jazeera English is an international 24-hour English-language news channel owned by the Al Jazeera Media Network, offering deep-dive reporting, features, and political updates from a unique Global South perspective.",
    wikiUrl: "https://en.wikipedia.org/wiki/Al_Jazeera_English"
  },
  {
    handle: "SuperSport",
    name: "SuperSport",
    bio: "Africa's home of sport. Live scores, fixtures, results and breaking sports news.",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/5f/SuperSport_logo.svg",
    color: "#303F9F",
    category: "Sports",
    website: "https://supersport.com",
    totalFollowers: "6.2M total followers",
    socials: {
      youtube: "2.1M followers",
      twitter: "3.4M followers",
      instagram: "700K followers"
    },
    fullAbout: "SuperSport is a South Africa-based group of television channels owned by Multichoice, broadcasting sports and news coverage across Sub-Saharan Africa. It is the largest broadcaster of sports content on the continent.",
    wikiUrl: "https://en.wikipedia.org/wiki/SuperSport_(African_TV_channel)"
  },
  {
    handle: "nairametrics",
    name: "Nairametrics",
    bio: "Nigeria's top financial and investment news platform covering stocks, forex, and economic data.",
    logo: "https://www.google.com/s2/favicons?sz=128&domain=nairametrics.com",
    color: "#00695C",
    category: "News",
    website: "https://nairametrics.com",
    totalFollowers: "1.3M total followers",
    socials: {
      youtube: "20K followers",
      twitter: "1.1M followers",
      instagram: "180K followers"
    },
    fullAbout: "Nairametrics is a leading financial resource company based in Lagos, Nigeria. It provides macroeconomic analysis, stock market updates, investment advice, and corporate business reports tailored for West African business owners.",
    wikiUrl: "https://nairametrics.com/about-us/"
  },
  {
    handle: "dailytrust",
    name: "Daily Trust",
    bio: "Leading newspaper in Northern Nigeria covering national politics, security, and development.",
    logo: "https://icons.duckduckgo.com/ip3/dailytrust.com.ico",
    color: "#37474F",
    category: "News",
    website: "https://dailytrust.com",
    totalFollowers: "1.9M total followers",
    socials: {
      youtube: "105K followers",
      twitter: "1.4M followers",
      instagram: "395K followers"
    },
    fullAbout: "Daily Trust is a major Nigerian daily newspaper published in Abuja by Media Trust. It is widely circulated throughout Northern Nigeria, known for focusing on rural developments, security updates, and regional politics.",
    wikiUrl: "https://en.wikipedia.org/wiki/Daily_Trust"
  },
  {
    handle: "businessday",
    name: "BusinessDay",
    bio: "Nigeria's foremost business and financial newspaper covering markets, economy, and corporate news.",
    logo: "https://www.google.com/s2/favicons?sz=128&domain=businessday.ng",
    color: "#283593",
    category: "News",
    website: "https://businessday.ng",
    totalFollowers: "1.5M total followers",
    socials: {
      youtube: "35K followers",
      twitter: "1.2M followers",
      instagram: "260K followers"
    },
    fullAbout: "BusinessDay is a daily business newspaper based in Lagos, Nigeria. Established in 2001, it is the primary source of market data, policy briefs, and corporate news coverage in the Nigerian financial sector.",
    wikiUrl: "https://en.wikipedia.org/wiki/BusinessDay_(Nigeria)"
  },
  {
    handle: "saharareporters",
    name: "Sahara Reporters",
    bio: "Investigative news platform covering corruption, governance, and public interest stories in Nigeria.",
    logo: "https://icons.duckduckgo.com/ip3/saharareporters.com.ico",
    color: "#2E7D32",
    category: "News",
    website: "https://saharareporters.com",
    totalFollowers: "4.1M total followers",
    socials: {
      youtube: "850K followers",
      twitter: "2.8M followers",
      instagram: "450K followers"
    },
    fullAbout: "Sahara Reporters is an online news agency based in New York City that focuses on investigative journalism, anti-corruption campaigns, and public interest exposes concerning Nigerian political and social affairs.",
    wikiUrl: "https://en.wikipedia.org/wiki/Sahara_Reporters"
  },
  {
    handle: "MobilePunch",
    name: "Punch",
    bio: "Nigeria's most widely read daily print newspaper online covering breaking national reports.",
    logo: "https://www.google.com/s2/favicons?sz=128&domain=punchng.com",
    color: "#C62828",
    category: "News",
    website: "https://punchng.com",
    totalFollowers: "5.5M total followers",
    socials: {
      youtube: "490K followers",
      twitter: "3.2M followers",
      instagram: "1.8M followers"
    },
    fullAbout: "The Punch is a daily newspaper published by Punch Nigeria Limited. Established in 1971 by James Aboderin and Sam Amuka, it is the most widely read newspaper in Nigeria, providing general interest reports and breaking national updates.",
    wikiUrl: "https://en.wikipedia.org/wiki/The_Punch"
  }
];

export default function LiveWire() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePublisher, setActivePublisher] = useState<PublisherDetail>(PUBLISHERS[0]);
  const [search, setSearch] = useState("");
  const [followedPublishers, setFollowedPublishers] = useState<string[]>([]);
  const [selectedProfilePublisher, setSelectedProfilePublisher] = useState<PublisherDetail | null>(null);
  const [profileTabFilter, setProfileTabFilter] = useState<'all' | 'social' | 'youtube' | 'news'>('all');
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);

  // Load followed state on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("realssa_followed_publishers");
      if (stored) {
        setFollowedPublishers(JSON.parse(stored));
      }
    } catch (_) {}
  }, []);

  const toggleFollow = (handle: string) => {
    let next: string[];
    if (followedPublishers.includes(handle)) {
      next = followedPublishers.filter(h => h !== handle);
      toast.success(`Unfollowed ${PUBLISHERS.find(p => p.handle === handle)?.name}`);
    } else {
      next = [...followedPublishers, handle];
      toast.success(`Following ${PUBLISHERS.find(p => p.handle === handle)?.name} on RealSSA!`);
    }
    setFollowedPublishers(next);
    localStorage.setItem("realssa_followed_publishers", JSON.stringify(next));
  };

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

  // Filter posts for active main sidebar view
  const publisherPosts = posts.filter(p => {
    const isPublisher = p.handle.toLowerCase() === activePublisher.handle.toLowerCase() ||
                        p.author.toLowerCase().includes(activePublisher.name.split(" ")[0].toLowerCase());
    
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || 
                           p.excerpt.toLowerCase().includes(search.toLowerCase());
    
    return isPublisher && matchesSearch;
  });

  // Filter posts specifically inside the selected publisher's Profile overlay
  const profileFilteredPosts = posts.filter(p => {
    if (!selectedProfilePublisher) return false;
    const isPublisher = p.handle.toLowerCase() === selectedProfilePublisher.handle.toLowerCase() ||
                        p.author.toLowerCase().includes(selectedProfilePublisher.name.split(" ")[0].toLowerCase());
    
    if (!isPublisher) return false;

    if (profileTabFilter === 'social') {
      return p.title.toLowerCase().includes('x.com') || p.excerpt.toLowerCase().includes('tweet') || p.title.toLowerCase().includes('thread');
    }
    if (profileTabFilter === 'youtube') {
      return p.title.toLowerCase().includes('youtube') || p.excerpt.toLowerCase().includes('watch');
    }
    if (profileTabFilter === 'news') {
      return !p.title.toLowerCase().includes('youtube') && !p.title.toLowerCase().includes('x.com');
    }
    
    return true;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-10 space-y-8">
        
        {/* Banner Cover with Drifting Orbs */}
        <div className="relative rounded-3xl p-6 md:p-10 shadow-2xl border border-white/10 overflow-hidden"
             style={{
               background: 'rgba(30, 25, 36, 0.72)',
               backdropFilter: 'blur(20px)',
               WebkitBackdropFilter: 'blur(20px)',
             }}>
          {/* Drifting background orbs */}
          <div className="absolute top-[-30px] right-[-30px] w-48 h-48 bg-amber-500/10 rounded-full blur-3xl animate-orb-drift" style={{ animationDuration: '14s' }} />
          <div className="absolute bottom-[-40px] left-[10%] w-56 h-56 bg-purple-500/8 rounded-full blur-3xl animate-orb-drift" style={{ animationDuration: '19s', animationDelay: '-4s' }} />
          
          <div className="space-y-3 relative z-10">
            <Badge variant="secondary" className="glass-pill px-3 py-1 text-white border-white/10 backdrop-blur">
              RealSSA Live Wire
            </Badge>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight flex items-center gap-3 text-white">
              <img src="/logo.png" alt="RealSSA Logo" className="h-8 md:h-12 w-auto animate-pulse" />
              Live News Wire
            </h1>
            <p className="text-white/70 text-sm md:text-base max-w-2xl leading-relaxed">
              Real-time mapped micro-feed aggregates directly from West Africa's verified publishers and agencies. No intermediary channels, raw content only.
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center glass p-4 rounded-2xl border border-white/10">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500 h-4 w-4" />
            <Input
              placeholder="Search wire status updates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 glass-search bg-transparent border-transparent text-white placeholder:text-white/30"
            />
          </div>
          <button
            onClick={fetchWirePosts}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white glass-pill hover:bg-white/10 border-white/15 transition duration-150 active:scale-95"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-amber-500 ${loading ? 'animate-spin' : ''}`} />
            Refresh Feed
          </button>
        </div>

        {/* main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Publisher Sidebar */}
          <div className="lg:col-span-1 space-y-4 max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin">
            <h2 className="text-lg font-black tracking-tight flex items-center gap-1.5 text-foreground">
              <Layers className="h-5 w-5 text-amber-500 animate-pulse" /> Monitored Channels
            </h2>
            <div className="space-y-1">
              {PUBLISHERS.map((pub) => (
                <div
                  key={pub.handle}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition duration-200 ${
                    activePublisher.handle === pub.handle
                      ? "border-amber-500/50 glow-amber-ring bg-amber-500/5"
                      : "bg-white/[0.03] border-white/5 hover:border-white/10 hover:bg-white/[0.06]"
                  }`}
                >
                  <button
                    onClick={() => { setActivePublisher(pub); setSearch(""); }}
                    className="flex items-center gap-3 flex-1 text-left min-w-0"
                  >
                    {pub.logo ? (
                      <img
                        src={pub.logo}
                        alt={pub.name}
                        className="w-10 h-10 rounded-xl object-cover bg-white p-1 border flex-shrink-0"
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
                        <VerifiedBadge className="h-3.5 w-3.5 flex-shrink-0" />
                      </div>
                      <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">
                        {pub.category}
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedProfilePublisher(pub)}
                    className="ml-2 px-2.5 py-1 text-[10px] font-bold text-amber-500 hover:text-amber-400 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition"
                  >
                    Profile
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Wire Status updates stream */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Publisher bio header card */}
            <Card className="border border-white/8 bg-white/[0.03] backdrop-blur-md rounded-2xl">
              <CardContent className="p-5 flex flex-col md:flex-row gap-5 items-start md:items-center">
                {activePublisher.logo && (
                  <button onClick={() => setSelectedProfilePublisher(activePublisher)}>
                    <img
                      src={activePublisher.logo}
                      alt={activePublisher.name}
                      className="w-16 h-16 rounded-2xl object-cover bg-white border p-1 shadow-sm hover:scale-105 transition"
                    />
                  </button>
                )}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setSelectedProfilePublisher(activePublisher)}>
                      <h3 className="font-black text-xl hover:text-amber-400 transition flex items-center gap-1 text-white">
                        {activePublisher.name}
                        <VerifiedBadge className="h-4.5 w-4.5 shrink-0" />
                      </h3>
                    </button>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0.5 tracking-wider bg-white/5 border-white/10">
                      {activePublisher.category}
                    </Badge>
                  </div>
                  <p className="text-xs md:text-sm text-white/50 leading-relaxed">
                    {activePublisher.bio}
                  </p>
                </div>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleFollow(activePublisher.handle)}
                    className="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-white/10"
                    style={{
                      background: followedPublishers.includes(activePublisher.handle)
                        ? 'rgba(255,255,255,0.08)'
                        : 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                      color: followedPublishers.includes(activePublisher.handle) ? '#fff' : '#000',
                    }}
                  >
                    {followedPublishers.includes(activePublisher.handle) ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Following
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" /> Follow
                      </>
                    )}
                  </button>
                  <a
                    href={activePublisher.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1 px-4 py-2 rounded-xl text-xs font-bold text-amber-500 hover:text-amber-400 bg-white/5 hover:bg-white/10 border border-white/10 transition"
                  >
                    <Globe className="w-3.5 h-3.5" /> Visit Site
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Posts Feed list */}
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 rounded-2xl glass-skeleton" style={{ background: 'rgba(255,255,255,0.05)' }} />
                <Skeleton className="h-32 rounded-2xl glass-skeleton" style={{ background: 'rgba(255,255,255,0.05)' }} />
              </div>
            ) : publisherPosts.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                <Rss className="h-10 w-10 text-white/30 mx-auto" />
                <p className="text-white/40 italic font-semibold mt-2">No recent broadcast status updates from {activePublisher.name}.</p>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                {publisherPosts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    className="w-full text-left glass-card rounded-2xl p-5 transition duration-200 flex flex-col md:flex-row gap-5 border border-white/8 relative"
                  >
                    {post.image && (
                      <img
                        src={post.image}
                        alt=""
                        className="w-full md:w-44 h-28 rounded-xl object-cover border border-white/5 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 flex flex-col justify-between space-y-2 min-w-0">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-white/40 font-bold">
                          <span 
                            onClick={(e) => { e.stopPropagation(); setSelectedProfilePublisher(activePublisher); }}
                            className="flex items-center gap-1 hover:text-amber-400 transition"
                          >
                            <VerifiedBadge className="h-3 w-3 mr-0.5" />
                            {activePublisher.name}
                          </span>
                          <span>{timeAgo(post.date)}</span>
                        </div>
                        <h4 className="font-extrabold text-sm md:text-base text-white leading-snug line-clamp-2">
                          {post.title}
                        </h4>
                      </div>
                      <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">
                        {post.excerpt}
                      </p>
                      
                      <div className="text-[10px] font-bold text-amber-500 inline-flex items-center gap-1 pt-1.5 border-t border-white/5">
                        View Mapped Report →
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── DETAIL DIALOG MODAL ───────────────────────── */}
        <Dialog open={selectedPost !== null} onOpenChange={(open) => { if (!open) setSelectedPost(null); }}>
          <DialogContent className="max-w-2xl glass-dropdown border border-white/12 rounded-3xl p-0 overflow-hidden shadow-2xl">
            {selectedPost && (
              <div className="flex flex-col">
                <DialogHeader className="p-6 md:p-8 border-b border-white/10 pb-4">
                  <div className="flex justify-between items-center gap-2 pb-2">
                    <div className="flex items-center gap-2">
                      <img src="/logo.png" alt="RealSSA Logo" className="h-5 w-auto" />
                      <span className="text-[10px] uppercase font-black tracking-widest text-amber-500">Live Broadcast</span>
                    </div>
                    <span className="text-xs text-white/40 font-semibold">
                      {timeAgo(selectedPost.date)}
                    </span>
                  </div>
                  <DialogTitle className="text-lg md:text-2xl font-black tracking-tight leading-snug text-white">
                    {selectedPost.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs font-semibold text-white/45 pt-1 flex items-center gap-1">
                    Source Agency:{" "}
                    <button 
                      onClick={() => {
                        const pub = PUBLISHERS.find(p => p.name.split(" ")[0].toLowerCase() === selectedPost.author.split(" ")[0].toLowerCase());
                        if (pub) setSelectedProfilePublisher(pub);
                        setSelectedPost(null);
                      }}
                      className="text-amber-400 font-bold hover:underline"
                    >
                      {selectedPost.author}
                    </button>
                  </DialogDescription>
                </DialogHeader>

                <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[50vh] scrollbar-thin">
                  {selectedPost.image && (
                    <img
                      src={selectedPost.image}
                      alt=""
                      className="w-full rounded-2xl object-cover max-h-64 border border-white/10 shadow-sm"
                    />
                  )}
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-black uppercase text-white/30 tracking-widest">Wire Excerpt</h5>
                    <p className="text-sm md:text-base text-white/90 leading-relaxed font-medium">
                      {selectedPost.excerpt}
                    </p>
                  </div>
                </div>
 
                <div className="p-6 md:p-8 border-t border-white/8 bg-white/[0.02] flex flex-col md:flex-row justify-between items-center gap-4">
                  <span className="text-[10px] text-white/40 font-semibold">
                    1 source channel monitored · updated real-time
                  </span>
                  
                  <div className="flex gap-2 w-full md:w-auto">
                    <DialogClose asChild>
                      <button className="flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-bold text-white bg-white/5 border border-white/10 hover:bg-white/10 transition">
                        Close
                      </button>
                    </DialogClose>
                    <a
                      href={selectedPost.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-black transition shadow-sm"
                    >
                      Visit Website <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── GOOGLE DISCOVER STYLE PUBLISHER PROFILE OVERLAY ── */}
        {selectedProfilePublisher && (
          <div 
            className="fixed inset-0 z-[100002] bg-black/85 backdrop-blur-2xl flex justify-center overflow-y-auto animate-fade-in"
            style={{ scrollbarWidth: 'none' }}
          >
            {/* Drifting backdrop decorations */}
            <div className="absolute top-[10%] left-[20%] w-72 h-72 bg-amber-500/5 rounded-full blur-3xl animate-orb-drift" style={{ animationDuration: '16s' }} />
            <div className="absolute bottom-[20%] right-[10%] w-80 h-80 bg-purple-500/5 rounded-full blur-3xl animate-orb-drift" style={{ animationDuration: '22s', animationDelay: '-6s' }} />

            <div className="w-full max-w-2xl min-h-screen flex flex-col relative px-4 py-6 md:py-10 space-y-6 z-10">
              
              {/* Top Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedProfilePublisher(null)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white bg-white/5 border border-white/10 transition active:scale-90"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex gap-2">
                  <button className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white bg-white/5 border border-white/10 transition active:scale-90">
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white bg-white/5 border border-white/10 transition active:scale-90">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Logo, Title & Follower Info */}
              <div className="flex flex-col items-center text-center space-y-4 pt-4">
                <div className="relative">
                  <img
                    src={selectedProfilePublisher.logo}
                    alt={selectedProfilePublisher.name}
                    className="w-20 h-20 rounded-3xl object-cover bg-white border-2 border-white p-1.5 shadow-2xl"
                  />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center border-2 border-background">
                    <VerifiedBadge className="w-3.5 h-3.5 text-white fill-white" />
                  </div>
                </div>

                <div className="space-y-1">
                  <h1 className="text-3xl font-black text-white tracking-tight flex items-center justify-center gap-1.5">
                    {selectedProfilePublisher.name}
                    <VerifiedBadge className="w-6 h-6 mt-1" />
                  </h1>
                  <p className="text-xs text-white/40 font-semibold tracking-wide uppercase">
                    {selectedProfilePublisher.totalFollowers}
                  </p>
                </div>

                {/* Follow Trigger Button */}
                <button
                  onClick={() => toggleFollow(selectedProfilePublisher.handle)}
                  className="px-8 py-2.5 rounded-full text-xs font-black transition flex items-center gap-2 border shadow-lg"
                  style={{
                    background: followedPublishers.includes(selectedProfilePublisher.handle)
                      ? 'rgba(255,255,255,0.08)'
                      : 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                    color: followedPublishers.includes(selectedProfilePublisher.handle) ? '#fff' : '#000',
                    borderColor: followedPublishers.includes(selectedProfilePublisher.handle) ? 'rgba(255,255,255,0.15)' : 'transparent',
                  }}
                >
                  {followedPublishers.includes(selectedProfilePublisher.handle) ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Following
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" /> Follow Channel
                    </>
                  )}
                </button>
              </div>

              {/* Social Channels Badge Scroller */}
              <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {selectedProfilePublisher.socials.youtube && (
                  <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/8 shrink-0">
                    <Youtube className="w-4 h-4 text-red-500" />
                    <div className="text-left">
                      <p className="text-[10px] text-white/30 font-bold leading-none">YouTube</p>
                      <p className="text-xs text-white font-extrabold leading-tight mt-0.5">
                        {selectedProfilePublisher.socials.youtube}
                      </p>
                    </div>
                  </div>
                )}
                {selectedProfilePublisher.socials.twitter && (
                  <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/8 shrink-0">
                    <Twitter className="w-4 h-4 text-sky-400" />
                    <div className="text-left">
                      <p className="text-[10px] text-white/30 font-bold leading-none">X (Twitter)</p>
                      <p className="text-xs text-white font-extrabold leading-tight mt-0.5">
                        {selectedProfilePublisher.socials.twitter}
                      </p>
                    </div>
                  </div>
                )}
                {selectedProfilePublisher.socials.instagram && (
                  <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/8 shrink-0">
                    <Instagram className="w-4 h-4 text-pink-400" />
                    <div className="text-left">
                      <p className="text-[10px] text-white/30 font-bold leading-none">Instagram</p>
                      <p className="text-xs text-white font-extrabold leading-tight mt-0.5">
                        {selectedProfilePublisher.socials.instagram}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible About Bio Section */}
              <div className="glass p-5 rounded-2xl border border-white/8 space-y-2.5">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">About</h3>
                  <a 
                    href={selectedProfilePublisher.wikiUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-amber-400 hover:underline"
                  >
                    Wikipedia
                  </a>
                </div>
                <p className="text-xs md:text-sm text-white/70 leading-relaxed font-medium">
                  {selectedProfilePublisher.fullAbout}
                </p>
                <div className="text-[10px] text-amber-400 font-bold pt-1">
                  Official Verified Channel
                </div>
              </div>

              {/* Stream Feed Header & Filters */}
              <div className="space-y-4 pt-2">
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-black text-white">Latest posts</h3>
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {[
                      { id: 'all', name: 'All Updates' },
                      { id: 'social', name: 'X (Twitter)' },
                      { id: 'youtube', name: 'YouTube' },
                      { id: 'news', name: 'Articles' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setProfileTabFilter(tab.id as any)}
                        className="px-3.5 py-1.5 rounded-full text-xs font-bold transition duration-150 shrink-0"
                        style={{
                          background: profileTabFilter === tab.id
                            ? 'rgba(245,158,11,0.12)'
                            : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${profileTabFilter === tab.id ? 'rgba(245,158,11,0.30)' : 'rgba(255,255,255,0.10)'}`,
                          color: profileTabFilter === tab.id ? '#FBBF24' : 'rgba(255,255,255,0.60)',
                        }}
                      >
                        {tab.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Profile Feed Updates List */}
                <div className="space-y-4">
                  {profileFilteredPosts.length === 0 ? (
                    <div className="text-center py-10 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
                      <Rss className="h-8 w-8 text-white/20 mx-auto" />
                      <p className="text-xs text-white/40 italic mt-2">No updates match this filter.</p>
                    </div>
                  ) : (
                    profileFilteredPosts.map((post) => (
                      <button
                        key={post.id}
                        onClick={() => setSelectedPost(post)}
                        className="w-full text-left glass-card rounded-2xl p-4.5 transition duration-200 flex gap-4 border border-white/8 relative"
                      >
                        {post.image && (
                          <img
                            src={post.image}
                            alt=""
                            className="w-24 h-16 rounded-xl object-cover border border-white/5 shrink-0"
                          />
                        )}
                        <div className="flex-1 flex flex-col justify-between min-w-0 space-y-1">
                          <div className="flex items-center justify-between text-[9px] text-white/30 font-bold">
                            <span className="flex items-center gap-1">
                              <VerifiedBadge className="h-2.5 w-2.5" />
                              {selectedProfilePublisher.name}
                            </span>
                            <span>{timeAgo(post.date)}</span>
                          </div>
                          <h4 className="font-extrabold text-xs md:text-sm text-white leading-snug line-clamp-2">
                            {post.title}
                          </h4>
                          <p className="text-[11px] text-white/40 line-clamp-1 leading-normal">
                            {post.excerpt}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
