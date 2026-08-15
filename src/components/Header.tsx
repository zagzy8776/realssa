import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Menu, X, ChevronDown, LogOut, Home, Newspaper, Radio, Globe, Moon, Sun, Bell, ArrowLeft, Copy, Check, Key, Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/api-base";
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
import PointsBadgeHeader from "./PointsBadgeHeader";
import { useStreak } from "@/hooks/useStreak";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/ads", label: "Advertise", icon: Newspaper },
  { href: "/sports", label: "Sports" },
  { href: "/market", label: "Market Hub" },
  { href: "/videos", label: "Videos", icon: Radio },
  { href: "/crypto", label: "Crypto" },
  { href: "/admin-dashboard", label: "Dashboard", adminOnly: true },
];

const regionsLinks: { href: string; label: string; adminOnly?: boolean }[] = [];


const libraryLinks = [
  { href: "/bookmarks", label: "BOOKMARKS (SAVED)" },
  { href: "/reading-history", label: "READING HISTORY" },
  { href: "/library/nigerian-manual", label: "THE NIGERIAN MANUAL" },
  { href: "/library/media-decode", label: "MEDIA DECODE" },
  { href: "/library/policy-brief", label: "POLICY BRIEF" },
  { href: "/library/societal-architecture", label: "SOCIETAL ARCHITECTURE" },
];

const isDirectUrl = (str: string): boolean => {
  const pattern = new RegExp(
    '^(https?:\\/\\/)?' + // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))' + // ip
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port/path
    '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
    '(\\#[-a-z\\d_]*)?$', // fragment locator
    'i'
  );
  return pattern.test(str) || (str.includes('.') && !str.includes(' ') && str.length > 4);
};

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const { streak, longestStreak } = useStreak();
  const [isStreakOpen, setIsStreakOpen] = useState(false);
  const [rpPoints, setRpPoints] = useState<number | null>(null);

  useEffect(() => {
    let id = localStorage.getItem('realssa_device_uuid');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('realssa_device_uuid', id);
    }
    fetch(apiUrl(`/api/points/balance?deviceId=${id}`))
      .then(r => r.json())
      .then(d => { if (typeof d?.total_points === 'number') setRpPoints(d.total_points); })
      .catch(() => setRpPoints(0));
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileSearch, setShowMobileSearch] = useState(true);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [suggestBox, setSuggestBox] = useState<{ top: number; left: number; width: number } | null>(null);

  // ── Autocomplete Suggestions state ──────────────────────────────────────
  const [suggestions, setSuggestions] = useState<{ url: string; title: string; isSearch?: boolean }[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Scroll handler to collapse mobile search bar on scroll down (keep open while typing).
  // rAF-throttled so we only touch state once per frame — avoids re-render churn
  // and jank on low-end phones.
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const update = () => {
      if (isSearchFocused) {
        setShowMobileSearch(true);
        ticking = false;
        return;
      }
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setShowMobileSearch(false);
      } else {
        setShowMobileSearch(true);
      }
      lastScrollY = currentScrollY;
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isSearchFocused]);


  // Keep portal dropdown aligned under the search bar
  useEffect(() => {
    if (!isSearchFocused || suggestions.length === 0) {
      setSuggestBox(null);
      return;
    }
    const update = () => {
      const el = searchWrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setSuggestBox({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isSearchFocused, suggestions.length, searchQuery]);

  const getHistoryMatches = (val: string) => {
    try {
      const histStr = localStorage.getItem("realssa_browser_history");
      if (!histStr) return [];
      const hist: { url: string; title: string }[] = JSON.parse(histStr);
      const q = val.toLowerCase();
      return hist
        .filter((h) => h.url?.toLowerCase().includes(q) || h.title?.toLowerCase().includes(q))
        .map((h) => ({ url: h.url, title: h.title, isSearch: false as const }))
        .slice(0, 3);
    } catch {
      return [];
    }
  };

  // ── Autocomplete — same behavior as InAppBrowser address bar ─────────────
  const handleAutocomplete = (val: string) => {
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    if (!val.trim()) {
      setSuggestions([]);
      return;
    }

    const trimmed = val.trim();
    const historyMatches = getHistoryMatches(trimmed);
    const selfSearch = {
      url: `realssa://search?q=${encodeURIComponent(trimmed)}`,
      title: trimmed,
      isSearch: true as const,
    };

    // Instant feedback (history + typed query) like a real browser
    setSuggestions([...historyMatches, selfSearch]);

    autocompleteTimer.current = setTimeout(() => {
      fetch(apiUrl(`/api/autocomplete?q=${encodeURIComponent(trimmed)}`))
        .then((res) => res.json())
        .then((data: unknown) => {
          const list = Array.isArray(data) && Array.isArray(data[1]) ? (data[1] as string[]) : [];
          const searchSuggestions = list
            .filter((s) => s && s.toLowerCase() !== trimmed.toLowerCase())
            .map((s) => ({
              url: `realssa://search?q=${encodeURIComponent(s)}`,
              title: s,
              isSearch: true as const,
            }))
            .slice(0, 5);
          setSuggestions([...historyMatches, selfSearch, ...searchSuggestions]);
        })
        .catch(() => {
          setSuggestions([...historyMatches, selfSearch]);
        });
    }, 180);
  };

  const goToSuggestion = (s: { url: string; title: string; isSearch?: boolean }) => {
    const dest = s.isSearch
      ? `realssa://search?q=${encodeURIComponent(s.title)}`
      : s.url;
    setSearchQuery(s.isSearch ? s.title : s.url);
    setSuggestions([]);
    setIsSearchFocused(false);
    navigate(`/browser?url=${encodeURIComponent(dest)}`);
  };

  const [isSecureOpen, setIsSecureOpen] = useState(false);
  const [importKey, setImportKey] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const [shakeEnabled, setShakeEnabled] = useState(() => {
    return localStorage.getItem('realssa_shake_discover_enabled') !== 'false';
  });

  const toggleShake = (val: boolean) => {
    localStorage.setItem('realssa_shake_discover_enabled', val ? 'true' : 'false');
    setShakeEnabled(val);
  };

  // Lock body scroll and allow Escape to close streak modal
  useEffect(() => {
    if (!isStreakOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsStreakOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isStreakOpen]);

  // Global keyboard shortcut ('/' or 'Ctrl+K') to focus homepage Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        const input = document.getElementById('homepage-search-input');
        if (input) {
          e.preventDefault();
          (input as HTMLInputElement).focus();
        }
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
    { name: "Trending", path: "/trending" },
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
      "sticky top-0 z-[9999] border-b transition-colors",
      isMenuOpen ? "bg-background/95" : "glass-nav"
    )} style={{ marginTop: isMenuOpen ? 'calc(-1 * env(safe-area-inset-top, 0px))' : undefined }}>
      {/* Safe-area fill strip — covers the status-bar zone with the header background */}
      <div
        className={isMenuOpen ? "bg-background/95" : "glass-nav-fill bg-background dark:bg-[#16131A]/96"}
        style={{ height: 'env(safe-area-inset-top, 0px)' }}
        aria-hidden="true"
      />
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
                <span className="text-slate-900 dark:text-white font-black">Real</span>
                <span className="text-gradient-gold font-black">SSA</span>
              </h1>
            </Link>
          </div>

          {/* Gamification Streak & Weather */}
          <div className="flex items-center gap-1 md:gap-2 animate-in fade-in zoom-in duration-500 shrink-0">
            <button
              onClick={() => setIsStreakOpen((open) => !open)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full active:scale-95 transition-all cursor-pointer border ${streak > 0
                ? 'bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30 text-orange-500'
                : 'bg-muted hover:bg-muted/80 border-border text-foreground'
                }`}
              title="Click to view Reading Streak & Points"
            >
              <span className={`font-bold text-xs ${streak > 0 ? 'text-orange-500' : 'text-gray-400'}`}>STREAK {streak}</span>
              <span className="hidden sm:inline text-muted-foreground/40 text-[10px] font-light">|</span>
              <span className="hidden sm:inline font-bold text-xs text-amber-500">{rpPoints !== null ? rpPoints : 0} RP</span>
            </button>
            <div className="hidden md:block">
              <WeatherWidget />
            </div>
          </div>

          {/* Reading Streak Calendar Modal — portaled to body so backdrop-blur on header doesn't trap it on iOS */}
          {isStreakOpen && createPortal(
            <div
              className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setIsStreakOpen(false)}
              role="dialog"
              aria-modal="true"
              aria-label="Reading streak"
            >
              <div
                className="relative w-full max-w-sm bg-gradient-to-br from-card to-background border border-border rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col gap-6 animate-in zoom-in-95 duration-250"
                onClick={(e) => e.stopPropagation()}
              >

                {/* Background glow effects */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg text-foreground flex items-center gap-1.5">
                    Reading Streak
                  </h3>
                  <button
                    onClick={() => setIsStreakOpen(false)}
                    className="p-1 rounded-full hover:bg-muted text-muted-foreground transition"
                    aria-label="Close streak modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center text-2xl font-bold text-orange-500 shadow-inner relative group">
                    <span className="group-hover:scale-110 transition duration-300 transform inline-block">STREAK</span>
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
                    <div className="text-lg font-bold text-foreground mt-1">{longestStreak} days</div>
                  </div>
                  <div className="bg-muted/40 rounded-2xl p-3 border border-border/50 text-center">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Habit Level</div>
                    <div className="text-lg font-bold text-orange-500 mt-1">
                      {streak >= 30 ? 'Expert' : streak >= 7 ? 'Regular' : 'Novice'}
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
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border transition-all duration-300 ${idx === todayIdx
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
                    className="w-full flex items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground hover:underline"
                  >
                    <span className="flex items-center gap-1">Advanced Settings (Restore Profile)</span>
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
                            className="flex-1 px-3 py-1.5 rounded-lg border bg-background text-base md:text-xs font-mono focus:outline-none"
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
            </div>,
            document.body
          )}

          {/* Header Action Controls (Invite, Hamburger Menu) */}
          <div className="flex items-center gap-1.5 md:gap-2.5 ml-1 shrink-0">
            <InviteButton variant="icon" />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2.5 text-foreground rounded-lg hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Integrated RealSSA Search Bar Gateway.
            Collapse uses grid-rows transition (0fr → 1fr) instead of max-height so
            it animates smoothly AND removes itself from flow when hidden — no more
            content jumping up/down each time the scroll direction flips on mobile. */}
        <div className={cn(
          "border-t border-border/40 bg-background/95 dark:bg-[#1A1622]/95 backdrop-blur-md relative z-50 grid transition-[grid-template-rows,opacity] duration-300 shadow-lg motion-reduce:transition-none",
          showMobileSearch || isSearchFocused
            ? "grid-rows-[1fr] opacity-100 overflow-visible"
            : "grid-rows-[0fr] opacity-0 border-t-0 pointer-events-none overflow-hidden md:grid-rows-[1fr] md:opacity-100 md:border-t md:overflow-visible"
        )}>
          <div className="min-h-0 overflow-hidden md:overflow-visible">

            <div ref={searchWrapRef} className="py-2.5 px-3 max-w-4xl mx-auto relative">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!searchQuery.trim()) return;
                  const dest = isDirectUrl(searchQuery.trim())
                    ? searchQuery.trim()
                    : `realssa://search?q=${encodeURIComponent(searchQuery.trim())}`;

                  navigate(`/browser?url=${encodeURIComponent(dest)}`);
                  setIsSearchFocused(false);
                  setSuggestions([]);
                }}
                className="relative flex items-center gap-2 md:gap-3 glass-search px-3 md:px-4 py-2 focus-within:border-amber-500/50 group min-w-0"
              >
                <Search className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="relative flex-1 min-w-0">
                  <input
                    id="homepage-search-input"
                    type="search"
                    inputMode="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="Search or enter URL..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      handleAutocomplete(e.target.value);
                    }}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => {
                      setTimeout(() => {
                        setIsSearchFocused(false);
                        setSuggestions([]);
                      }, 200);
                    }}
                    className="w-full min-w-0 bg-transparent border-none text-[16px] md:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none py-1.5 pr-7"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(''); setSuggestions([]); }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-black text-[10px] md:text-xs font-extrabold px-2.5 md:px-3.5 py-1.5 rounded-xl uppercase flex items-center gap-1 shrink-0 shadow-sm transition-transform active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  SEARCH
                </button>
              </form>

              {/* Autocomplete dropdown — portaled so sticky/overflow header can't clip it */}
              {isSearchFocused && suggestions.length > 0 && suggestBox && createPortal(
                <div
                  className="fixed glass-dropdown rounded-xl overflow-hidden z-[100000] animate-in fade-in slide-in-from-top-1 duration-150"
                  style={{
                    top: suggestBox.top,
                    left: suggestBox.left,
                    width: suggestBox.width,
                  }}
                  role="listbox"
                  aria-label="Search suggestions"
                >
                  {suggestions.map((s, i) => (
                    <button
                      key={`${s.isSearch ? "s" : "h"}-${s.title}-${i}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        goToSuggestion(s);
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        goToSuggestion(s);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-amber-500/10 transition-colors text-left group border-b border-border/10 last:border-0"
                    >
                      {s.isSearch ? (
                        <Search className="w-3 h-3 text-amber-500 shrink-0" />
                      ) : (
                        <Globe className="w-3 h-3 text-amber-500 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-foreground truncate">{s.title}</div>
                        {!s.isSearch && (
                          <div className="text-[10px] text-muted-foreground truncate">{s.url}</div>
                        )}
                        {s.isSearch && s.title.toLowerCase() === searchQuery.trim().toLowerCase() && (
                          <div className="text-[10px] text-muted-foreground truncate">Search with RealSSA</div>
                        )}
                      </div>
                      <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-amber-400 shrink-0" />
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </div>
          </div>
        </div>

        {/* Mobile Drawer Dimmed Backdrop */}
        {isMenuOpen && (
          <div
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] transition-opacity duration-300 animate-in fade-in cursor-pointer"
            aria-hidden="true"
          />
        )}

        {/* Universal Navigation Drawer - Sleek Slide-out style */}
        <nav
          className={cn(
            "transition-all duration-300 ease-in-out fixed right-0 bottom-0 top-14 md:top-20 bg-background/97 backdrop-blur-md border-l border-border z-[9999] w-full sm:w-80 shadow-2xl flex flex-col opacity-100",
            isMenuOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
          )}
        >
          <div className="flex-1 overflow-y-auto pb-24 custom-scrollbar flex flex-col gap-1 p-2">

            {/* Extended Weather Widget inside Drawer (Desktop/Tablet detail) */}
            <div className="px-4 py-3 border-b border-border/40 mb-2">
              <WeatherWidget variant="glass" />
            </div>

            {/* Main Navigation Links */}
            {visibleNavLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200",
                  "text-muted-foreground hover:text-primary hover:bg-muted",
                  "active:scale-[0.98] active:bg-muted/80"
                )}
              >
                <span>{link.label}</span>
              </Link>
            ))}

            {/* Regions Section */}
            <div className="px-4 py-2 mt-2 border-t border-border/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Regions</p>
              <div className="flex flex-col gap-1">
                {visibleRegionsLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all duration-200",
                      "text-muted-foreground hover:text-primary hover:bg-muted",
                      "active:scale-[0.98] active:bg-muted/80"
                    )}
                  >
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>

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
                      "flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all duration-200",
                      "text-muted-foreground hover:text-primary hover:bg-muted",
                      "active:scale-[0.98] active:bg-muted/80"
                    )}
                  >
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Admin Logout Button - Drawer */}
            {isAdmin && (
              <button
                onClick={handleLogout}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200",
                  "text-muted-foreground hover:text-destructive hover:bg-muted",
                  "active:scale-[0.98] active:bg-muted/80"
                )}
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            )}

            {/* Settings Section */}
            <div className="px-4 py-3 mt-1 border-t border-border/50 pb-8">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Settings</p>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Appearance</span>
                  <DarkModeToggle />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Push Notifications</span>
                  <PushNotificationManager iconOnly={false} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Shake to Discover</span>
                  <button
                    onClick={() => toggleShake(!shakeEnabled)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2",
                      shakeEnabled ? "bg-amber-500" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out",
                        shakeEnabled ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
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
