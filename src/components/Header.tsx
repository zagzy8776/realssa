import { useState, useEffect } from "react";
import { Menu, X, ChevronDown, LogOut, Home, Newspaper, Radio, Globe, Moon, Sun, Bell, ArrowLeft, Copy, Check, Key, Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import DarkModeToggle from "./DarkModeToggle";
import PushNotificationManager from "./PushNotificationManager";
import { useToast } from "@/hooks/use-toast";
import WeatherWidget from "./WeatherWidget";
import InviteButton from "./InviteButton";
import { useStreak } from "@/hooks/useStreak";


import RealSSASearchModal from "./RealSSASearchModal";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/ads", label: "📢 Advertise" },
  { href: "/sports", label: "⚽ Sports" },
  { href: "/market", label: "📊 Market Hub" },
  { href: "/wire", label: "📢 Live Wire" },
  { href: "/events", label: "📅 Events Calendar" },
  { href: "/world-news", label: "🌍 World", icon: Globe },
  { href: "/videos", label: "📺 Videos", icon: Radio },
  { href: "/crypto", label: "₿ Crypto" },
  { href: "/admin-dashboard", label: "Dashboard", adminOnly: true },
];

const regionsLinks = [
  { href: "/nigeria", label: "🇳🇬 Nigeria" },
  { href: "/ghana", label: "🇬🇭 Ghana" },
  { href: "/kenya", label: "🇰🇪 Kenya" },
  { href: "/south-africa", label: "🇿🇦 South Africa" },
  { href: "/uk", label: "🇬🇧 UK" },
  { href: "/usa", label: "🇺🇸 USA" },
  { href: "/culture", label: "Culture" },
  { href: "/entertainment", label: "🎬 Entertainment" },
  { href: "/nigerian-news", label: "Nigerian News" },
  { href: "/jobs", label: "💼 Jobs" },
  { href: "/world-directory", label: "🗺️ World Directory" },
  { href: "/post-news", label: "Post News", adminOnly: true },
];


const libraryLinks = [
  { href: "/reading-list", label: "WISDOM LIBRARY (SAVED)" },
  { href: "/reading-history", label: "READING HISTORY" },
  { href: "/library/nigerian-manual", label: "THE NIGERIAN MANUAL" },
  { href: "/library/media-decode", label: "MEDIA DECODE" },
  { href: "/library/policy-brief", label: "POLICY BRIEF" },
  { href: "/library/societal-architecture", label: "SOCIETAL ARCHITECTURE" },
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const { streak, longestStreak } = useStreak();
  const [isStreakOpen, setIsStreakOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    answer: string;
    sources: { title: string; url: string; snippet?: string }[];
    provider: string;
  } | null>(null);

  const handleInlineSearch = async (queryToSearch: string) => {
    if (!queryToSearch.trim()) return;
    setSearchLoading(true);
    setSearchResult(null);

    try {
      const res = await fetch(apiUrl('/api/search/ai'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryToSearch.trim() })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSearchResult({
          answer: data.answer,
          sources: data.sources || [],
          provider: data.provider || 'RealSSA AI Search'
        });
      } else {
        throw new Error(data.message || 'Search failed');
      }
    } catch (err: any) {
      toast({
        title: "Search Notice",
        description: err.message || "Could not fetch search result. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const [isSecureOpen, setIsSecureOpen] = useState(false);
  const [importKey, setImportKey] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  // Global keyboard shortcut ('/' or 'Ctrl+K') to open AI Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const categoryPills = [
    { name: "Breaking", path: "/for-you" },
    { name: "Nigeria", path: "/nigeria" },
    { name: "Sports", path: "/sports" },
    { name: "Entertainment", path: "/entertainment" },
    { name: "World", path: "/world-news" },
    { name: "Crypto", path: "/crypto" },
    { name: "🎬 Reels", path: "/reels" },
    { name: "Culture", path: "/culture" },
  ];

  // Check admin status on component mount
  useEffect(() => {
    const adminStatus = localStorage.getItem("isAdmin") === "true";
    setIsAdmin(adminStatus);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("adminUsername");
    setIsAdmin(false);
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully",
      variant: "default",
    });
    navigate("/");
    setIsMenuOpen(false);
  };

  // Filter navLinks to show only appropriate links for current user
  const visibleNavLinks = navLinks.filter(link =>
    isAdmin || !link.adminOnly
  );
  const visibleRegionsLinks = regionsLinks.filter(link =>
    isAdmin || !link.adminOnly
  );

  const showBackButton = location.pathname !== "/";

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <header className={cn(
      "sticky top-0 z-[9999] pt-[env(safe-area-inset-top)] border-b border-border transition-colors",
      isMenuOpen ? "bg-background" : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    )}>
      <div className="container mx-auto px-3 md:px-4">
        <div className="flex items-center justify-between h-14 md:h-20">
          {/* Logo & Back Button Container */}
          <div className="flex items-center gap-1 md:gap-2">
            {showBackButton && (
              <button 
                onClick={handleBack} 
                className="p-1.5 mr-0.5 text-foreground/80 hover:text-foreground active:scale-95 transition-all rounded-full hover:bg-accent flex items-center justify-center"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
              </button>
            )}
            <Link to="/" className="flex items-center flex-shrink-0 gap-2">
              <img src="/logo.png" alt="RealSSA Logo" className="h-8 md:h-10 w-auto" />
              <h1 className="text-sm sm:text-lg md:text-2xl font-display font-bold tracking-tight whitespace-nowrap flex-shrink-0">
                <span className="text-foreground">Real</span>
                <span className="text-gradient-gold">SSA</span>
              </h1>
            </Link>
          </div>

          {/* Gamification Streak & Weather */}
          <div className="flex items-center gap-1.5 md:gap-2 animate-in fade-in zoom-in duration-500">
            <button
              onClick={() => setIsStreakOpen(true)}
              className={`flex items-center gap-1 px-2 py-0.5 md:px-3 md:py-1 rounded-full active:scale-95 transition-all cursor-pointer ${
                streak > 0 ? 'bg-orange-100 dark:bg-orange-950/60 hover:bg-orange-200' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-250'
              }`}
            >
              <span className={`font-bold text-xs md:text-sm ${streak > 0 ? 'text-orange-500' : 'text-gray-400 animate-pulse'}`}>🔥 {streak}</span>
              <span className={`hidden sm:inline text-xs font-medium ${streak > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500'}`}>Streak</span>
            </button>
            <div>
              <WeatherWidget />
            </div>
          </div>

          <RealSSASearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

          {/* Reading Streak Calendar Modal */}
          {isStreakOpen && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="relative w-full max-w-sm bg-gradient-to-br from-card to-background border border-border rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col gap-6 animate-in zoom-in-95 duration-250">
                
                {/* Background glow effects */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg text-foreground flex items-center gap-1.5">
                    ⚡ Reading Streak
                  </h3>
                  <button 
                    onClick={() => setIsStreakOpen(false)}
                    className="p-1 rounded-full hover:bg-muted text-muted-foreground transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center text-4xl shadow-inner relative group">
                    <span className="group-hover:scale-110 transition duration-300 transform inline-block">🔥</span>
                    <span className="absolute inset-0 rounded-full border-2 border-orange-500/20 animate-ping"></span>
                  </div>
                  
                  <div>
                    <div className="text-3xl font-extrabold tracking-tight text-foreground">{streak} Days</div>
                    <p className="text-xs text-muted-foreground mt-0.5">Your current daily reading habit</p>
                  </div>
                </div>

                {/* Milestones / Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-2xl p-3 border border-border/50 text-center">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Longest Streak</div>
                    <div className="text-lg font-bold text-foreground mt-1">🏆 {longestStreak} days</div>
                  </div>
                  <div className="bg-muted/40 rounded-2xl p-3 border border-border/50 text-center">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Habit Level</div>
                    <div className="text-lg font-bold text-orange-500 mt-1">
                      {streak >= 30 ? '🔥 Expert' : streak >= 7 ? '⭐ Regular' : '🌱 Novice'}
                    </div>
                  </div>
                </div>

                {/* 7-Day Calendar Checklist */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 tracking-wider">Weekly Progress</h4>
                  <div className="flex justify-between gap-1">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => {
                      const todayIdx = (new Date().getDay() + 6) % 7; // Map Mon-Sun to 0-6
                      const isActive = idx <= todayIdx;
                      return (
                        <div key={idx} className="flex flex-col items-center gap-1.5 flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border transition-all duration-300 ${
                            idx === todayIdx
                              ? 'bg-orange-500 text-white border-orange-500 scale-[1.05] shadow-md shadow-orange-500/20'
                              : isActive
                                ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25'
                                : 'bg-muted text-muted-foreground border-border'
                          }`}>
                            {idx === todayIdx && streak > 0 ? '✓' : day}
                          </div>
                          <span className="text-[9px] font-semibold text-muted-foreground/60">{day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="text-center text-xs text-muted-foreground px-4 leading-relaxed">
                  {streak > 0 
                    ? "Fantastic! You've read today's news to secure your streak. See you tomorrow!"
                    : "Read any summary article today to start your reading streak flame!"}
                </div>

                {/* Secure Identity Accordion */}
                <div className="border-t border-border/40 pt-4 mt-1 text-left">
                  <button
                    onClick={() => setIsSecureOpen(!isSecureOpen)}
                    className="w-full flex items-center justify-between text-xs font-bold text-primary hover:underline"
                  >
                    <span className="flex items-center gap-1">🛡️ Secure Your Streak</span>
                    <span>{isSecureOpen ? "Hide" : "Show"}</span>
                  </button>
                  
                  {isSecureOpen && (
                    <div className="space-y-3 mt-3 animate-in fade-in duration-200">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Your reading streak and saved data are saved to your anonymous key. Save it to restore your profile on other devices.
                      </p>
                      
                      {/* Export key */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={localStorage.getItem('realssa_device_uuid') || ""}
                          className="flex-1 px-3 py-1.5 rounded-lg border bg-muted/30 text-xs font-mono select-all focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            const uuid = localStorage.getItem('realssa_device_uuid') || "";
                            navigator.clipboard.writeText(uuid);
                            setIsCopied(true);
                            toast({
                              title: "Key Copied!",
                              description: "Your anonymous profile key has been copied to your clipboard.",
                            });
                            setTimeout(() => setIsCopied(false), 2000);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground font-semibold flex items-center gap-1 hover:bg-primary/95 transition duration-150"
                        >
                          {isCopied ? <Check size={12} /> : <Copy size={12} />}
                          <span>Copy</span>
                        </button>
                      </div>

                      {/* Import key */}
                      <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/20">
                        <span className="text-[10px] font-bold text-muted-foreground">Restore on another device:</span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Paste secure key here..."
                            value={importKey}
                            onChange={(e) => setImportKey(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-lg border bg-background text-xs font-mono focus:outline-none"
                          />
                          <button
                            onClick={async () => {
                              if (!importKey.trim()) return;
                              localStorage.setItem('realssa_device_uuid', importKey.trim());
                              toast({
                                title: "Key Imported!",
                                description: "Syncing your reading streak and library data...",
                              });
                              window.location.reload();
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/95 transition duration-150 border border-border flex items-center gap-1"
                          >
                            <Key size={12} />
                            <span>Import</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
            {visibleNavLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}

            {/* Admin Logout Button - Desktop */}
            {isAdmin && (
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-muted-foreground hover:text-destructive transition-colors duration-200 flex items-center gap-2"
              >
                <LogOut size={16} /> Logout
              </button>
            )}

            {/* Library Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200">
                Library <ChevronDown size={14} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {libraryLinks.map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link to={link.href} className="cursor-pointer">
                      {link.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

            {/* Regions Dropdown — desktop */}
            <div className="hidden lg:block">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200">
                  Regions <ChevronDown size={14} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52 max-h-[60vh] overflow-y-auto">
                  {visibleRegionsLinks.map((link) => (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link to={link.href} className="cursor-pointer">
                        {link.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop-only controls */}
            <div className="hidden lg:flex items-center gap-3 ml-4">
              <InviteButton />
              <div className="flex items-center gap-1 border-l border-border pl-3">
                <DarkModeToggle />
                <PushNotificationManager iconOnly={true} />
              </div>
            </div>

            {/* Mobile-only controls */}
            <div className="lg:hidden flex items-center gap-1 ml-1">
              <InviteButton variant="icon" />
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2.5 text-foreground rounded-lg hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
        </div>

        {/* Native Floating Glassmorphism Overlay AI Search Panel */}
        <div className="border-t border-border/40 bg-background">
          {/* Collapsed Single-Line Header Bar */}
          <div className="py-2.5 px-3">
            <div
              onClick={() => setIsSearchOpen(true)}
              className="relative flex items-center gap-3 bg-card border border-amber-500/40 hover:border-amber-500 rounded-2xl px-4 py-2.5 shadow-sm cursor-pointer transition-all hover:shadow-amber-500/10 group max-w-4xl mx-auto"
            >
              <Search className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="flex-1 text-xs md:text-sm font-medium text-muted-foreground group-hover:text-foreground truncate">
                Ask RealSSA anything... (e.g. CBN Naira Rate, Lagos Traffic, AFCON Results)
              </div>
              <span className="bg-amber-500 hover:bg-amber-400 text-black text-[10px] md:text-xs font-extrabold px-3 py-1 rounded-xl uppercase flex items-center gap-1 shrink-0 shadow-sm transition-transform active:scale-95">
                ⚡ AI SEARCH
              </span>
            </div>
          </div>

          {/* Floating Glassmorphism Overlay Panel */}
          {isSearchOpen && (
            <div
              onClick={() => setIsSearchOpen(false)}
              className="fixed inset-x-0 top-[110px] sm:top-[125px] bottom-0 z-[99999] bg-black/85 backdrop-blur-xl flex flex-col justify-start items-center p-3 sm:p-5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 cursor-pointer overscroll-none"
            >
              {/* Inner Floating Glass Card (Stop propagation so clicking inside doesn't close) */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-card/95 border-2 border-amber-500/50 rounded-3xl p-4 sm:p-6 max-w-2xl w-full shadow-2xl space-y-4 flex flex-col max-h-[100dvh] sm:max-h-[85dvh] overflow-hidden cursor-default box-border backdrop-blur-2xl"
              >
                {/* Header Control Row */}
                <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 font-extrabold text-sm shrink-0">
                      ⚡
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-bold font-display flex items-center gap-1.5 truncate">
                        RealSSA <span className="text-gradient-gold">AI Search</span>
                      </h3>
                      <p className="hidden sm:block text-[11px] text-muted-foreground truncate">Neural Web & Multi-Database Engine</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsSearchOpen(false)}
                    className="px-3 py-1 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 text-xs font-extrabold transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95 shadow-sm"
                  >
                    <X className="w-3.5 h-3.5" /> <span>Close</span>
                  </button>
                </div>

                {/* Scrollable Main Content Container (Input, Popular Queries & AI Answers) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1 pb-20 min-w-0 box-border">
                  
                  {/* Search Input Form — 16px text-base PREVENTS MOBILE ZOOMING */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleInlineSearch(searchQuery);
                    }}
                    className="space-y-3 shrink-0"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 min-w-0">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Ask anything... (e.g. CBN Naira Rate, Lagos Traffic)"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-background border-2 border-amber-500/40 focus:border-amber-500 rounded-2xl pl-10 pr-9 py-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-inner font-medium text-foreground box-border"
                        />
                        <Search className="w-4 h-4 text-amber-500 absolute left-3.5 top-1/2 -translate-y-1/2 shrink-0 pointer-events-none" />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={searchLoading || !searchQuery.trim()}
                        className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-extrabold text-xs sm:text-sm px-4 py-3 rounded-2xl transition-all flex items-center gap-1 shadow shrink-0 active:scale-95 cursor-pointer min-w-max"
                      >
                        {searchLoading ? (
                          <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>Search ⚡</>
                        )}
                      </button>
                    </div>
                  </form>

                  {/* Popular Intelligence Queries */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                      🔥 Popular Intelligence Queries
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        "CBN Naira Exchange Rate Today",
                        "Lagos Traffic & Fuel Price Update",
                        "Tinubu Economic & Business Policy",
                        "Premier League & Football Standings",
                        "AFCON Qualifiers & Super Eagles Fixtures",
                        "Tech Startups & Funding News Africa"
                      ].map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSearchQuery(chip);
                            handleInlineSearch(chip);
                          }}
                          className="px-3.5 py-2.5 rounded-xl bg-background hover:bg-amber-500/10 text-muted-foreground hover:text-amber-400 text-xs font-medium transition-all text-left border border-border/60 hover:border-amber-500/40 shrink-0 cursor-pointer truncate shadow-xs"
                        >
                          🔍 {chip}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI Streaming Result Card */}
                  {searchLoading && (
                    <div className="bg-background/80 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
                      <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
                      <span className="text-xs text-amber-500 font-bold">Synthesizing Neural Web & Database context...</span>
                    </div>
                  )}

                  {searchResult && (
                    <div className="bg-background border border-amber-500/40 rounded-2xl p-4 sm:p-5 space-y-3 shadow-inner animate-in fade-in duration-300">
                      <div className="flex items-center justify-between border-b border-border/30 pb-2 flex-wrap gap-2">
                        <span className="bg-amber-500/10 text-amber-500 text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase border border-amber-500/20">
                          ⚡ {searchResult.provider}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const shareText = `🚨 *RealSSA AI Search Answer for "${searchQuery}"*\n\n${searchResult.answer.slice(0, 300)}…\n\nSearch more on RealSSA 📰👇\nhttps://realssanews.com.ng`;
                            window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
                          }}
                          className="text-xs text-green-500 hover:text-green-400 font-bold flex items-center gap-1 bg-green-500/10 px-2.5 py-1 rounded-lg border border-green-500/20 cursor-pointer"
                        >
                          <span>💬 Share WhatsApp</span>
                        </button>
                      </div>

                      <div className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-line font-normal break-words">
                        {searchResult.answer}
                      </div>

                      {searchResult.sources && searchResult.sources.length > 0 && (
                        <div className="pt-2 border-t border-border/20">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                            Verified Sources:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {searchResult.sources.slice(0, 4).map((src, idx) => (
                              <a
                                key={idx}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] bg-muted/60 hover:bg-muted text-primary hover:underline px-2 py-0.5 rounded-md border border-border/40 truncate max-w-[200px]"
                              >
                                🔗 {src.title || src.url}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Navigation - Slide-out style */}
        <nav
          className={cn(
            "lg:hidden transition-all duration-300 ease-in-out fixed inset-x-0 bottom-0 top-[136px] md:top-[160px] bg-background z-[9999] opacity-100",
            isMenuOpen ? "max-h-[calc(100vh-136px)] overflow-y-auto pb-24 opacity-100 custom-scrollbar block" : "max-h-0 overflow-hidden opacity-0 hidden"
          )}
        >

          <div className="flex flex-col gap-1">
            {/* Main Navigation Links - Larger touch targets */}
            {visibleNavLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-base font-medium rounded-lg transition-all duration-200",
                  "text-muted-foreground hover:text-primary hover:bg-muted",
                  "active:scale-[0.98] active:bg-muted/80"
                )}
              >
                {link.icon && <link.icon size={18} />}
                <span>{link.label}</span>
              </Link>
            ))}

            {/* Admin Logout Button - Mobile */}
            {isAdmin && (
              <button
                onClick={handleLogout}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-base font-medium rounded-lg transition-all duration-200",
                  "text-muted-foreground hover:text-destructive hover:bg-muted",
                  "active:scale-[0.98] active:bg-muted/80"
                )}
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            )}

            {/* Library Section */}
            <div className="px-4 py-2 mt-2 border-t border-border/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Library</p>
              <div className="flex flex-col gap-1">
                {libraryLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200",
                      "text-muted-foreground hover:text-primary hover:bg-muted",
                      "active:scale-[0.98] active:bg-muted/80"
                    )}
                  >
                    <Globe size={16} />
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Settings Section */}
            <div className="px-4 py-3 mt-1 border-t border-border/50 pb-8">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Settings</p>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Appearance</span>
                  <DarkModeToggle />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Push Notifications</span>
                  <PushNotificationManager iconOnly={false} />
                </div>
              </div>
            </div>

          </div>
        </nav>

      </div>
    </header>
  );
};

export default Header;
