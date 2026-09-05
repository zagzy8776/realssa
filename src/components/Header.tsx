import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Menu, X, ChevronDown, LogOut, Home, Newspaper, Radio, Globe, Moon, Sun, Bell, ArrowLeft, Copy, Check, Key, Search, ArrowRight, TrendingUp, WalletCards, Bookmark, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/api-base";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  { href: "/trending", label: "Trending", icon: TrendingUp },
  { href: "/sports", label: "Sports", icon: Radio },
  { href: "/market", label: "Market Hub", icon: WalletCards },
  { href: "/videos", label: "Videos", icon: Radio },
  { href: "/crypto", label: "Crypto", icon: Globe },
  { href: "/ads", label: "Advertise", icon: Newspaper },
  { href: "/admin-dashboard", label: "Dashboard", adminOnly: true },
];

const regionsLinks: { href: string; label: string; adminOnly?: boolean }[] = [];

const libraryLinks = [
  { href: "/bookmarks", label: "Saved stories", icon: Bookmark },
  { href: "/reading-history", label: "Reading history", icon: Newspaper },
  { href: "/library/nigerian-manual", label: "The Nigerian Manual", icon: Globe },
  { href: "/library/media-decode", label: "Media Decode", icon: Newspaper },
  { href: "/library/policy-brief", label: "Policy Brief", icon: Newspaper },
  { href: "/library/societal-architecture", label: "Societal Architecture", icon: Globe },
];

const isDirectUrl = (str: string): boolean => {
  const pattern = new RegExp('^(https?:\\/\\/)?' + '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + '((\\d{1,3}\\.){3}\\d{1,3}))' + '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + '(\\?[;&a-z\\d%_.~+=-]*)?' + '(\\#[-a-z\\d_]*)?$', 'i');
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
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileSearch, setShowMobileSearch] = useState(true);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [suggestBox, setSuggestBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const [suggestions, setSuggestions] = useState<{ url: string; title: string; isSearch?: boolean }[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSecureOpen, setIsSecureOpen] = useState(false);
  const [importKey, setImportKey] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [shakeEnabled, setShakeEnabled] = useState(() => localStorage.getItem('realssa_shake_discover_enabled') !== 'false');

  useEffect(() => {
    let id = localStorage.getItem('realssa_device_uuid');
    if (!id) { id = 'dev-' + Math.random().toString(36).substring(2, 11); localStorage.setItem('realssa_device_uuid', id); }
    fetch(apiUrl(`/api/points/balance?deviceId=${id}`)).then(r => r.json()).then(d => { if (typeof d?.total_points === 'number') setRpPoints(d.total_points); }).catch(() => setRpPoints(0));
  }, []);

  useEffect(() => {
    const adminStatus = localStorage.getItem("isAdmin") === "true";
    setIsAdmin(adminStatus);
  }, []);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;
    const update = () => {
      if (isSearchFocused) { setShowMobileSearch(true); ticking = false; return; }
      const y = window.scrollY;
      setShowMobileSearch(y <= lastScrollY || y < 50);
      lastScrollY = y;
      ticking = false;
    };
    const handleScroll = () => { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isSearchFocused]);

  useEffect(() => {
    if (!isSearchFocused || suggestions.length === 0) { setSuggestBox(null); return; }
    const update = () => { const el = searchWrapRef.current; if (!el) return; const rect = el.getBoundingClientRect(); setSuggestBox({ top: rect.bottom + 4, left: rect.left, width: rect.width }); };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [isSearchFocused, suggestions.length, searchQuery]);

  const getHistoryMatches = (val: string) => {
    try {
      const hist = JSON.parse(localStorage.getItem("realssa_browser_history") || '[]') as { url: string; title: string }[];
      const q = val.toLowerCase();
      return hist.filter(h => h.url?.toLowerCase().includes(q) || h.title?.toLowerCase().includes(q)).map(h => ({ url: h.url, title: h.title })).slice(0, 3);
    } catch { return []; }
  };

  const handleAutocomplete = (val: string) => {
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    if (!val.trim()) { setSuggestions([]); return; }
    const trimmed = val.trim();
    const historyMatches = getHistoryMatches(trimmed);
    const selfSearch = { url: `realssa://search?q=${encodeURIComponent(trimmed)}`, title: trimmed, isSearch: true };
    setSuggestions([...historyMatches, selfSearch]);
    autocompleteTimer.current = setTimeout(() => {
      fetch(apiUrl(`/api/autocomplete?q=${encodeURIComponent(trimmed)}`))).then(r => r.json()).then(data => {
        const list = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
        setSuggestions([...historyMatches, selfSearch, ...list.filter((s: string) => s && s.toLowerCase() !== trimmed.toLowerCase()).slice(0, 5).map((s: string) => ({ url: `realssa://search?q=${encodeURIComponent(s)}`, title: s, isSearch: true }))]);
      }).catch(() => setSuggestions([...historyMatches, selfSearch]));
    }, 180);
  };

  const goToSuggestion = (s: { url: string; title: string; isSearch?: boolean }) => {
    const dest = s.isSearch ? `realssa://search?q=${encodeURIComponent(s.title)}` : s.url;
    setSearchQuery(s.isSearch ? s.title : s.url); setSuggestions([]); setIsSearchFocused(false); navigate(`/browser?url=${encodeURIComponent(dest)}`);
  };

  const toggleShake = (val: boolean) => { localStorage.setItem('realssa_shake_discover_enabled', val ? 'true' : 'false'); setShakeEnabled(val); };
  const visibleNavLinks = navLinks.filter(link => isAdmin || !link.adminOnly);
  const showBackButton = location.pathname !== "/";
  const handleBack = () => window.history.length > 1 ? navigate(-1) : navigate("/");

  return (
    <header className={cn("sticky top-0 z-[9999] border-b border-border/70 transition-all", isMenuOpen ? "bg-background" : "bg-background/90 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/75")}>
      <div className="container mx-auto px-3 sm:px-5 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 md:h-[72px] gap-3">
          <div className="flex items-center gap-1 min-w-0">
            {showBackButton && <button onClick={handleBack} className="h-10 w-10 shrink-0 rounded-full hover:bg-muted active:scale-95 transition flex items-center justify-center" aria-label="Go back"><ArrowLeft className="h-5 w-5" /></button>}
            <Link to="/" className="group flex items-center gap-2 shrink-0" aria-label="RealSSA home">
              <img src="/logo.png" alt="" className="h-8 sm:h-9 md:h-10 w-auto transition-transform group-hover:scale-[1.03]" />
              <span className="text-lg sm:text-xl md:text-2xl font-display font-black tracking-tight"><span className="text-foreground">Real</span><span className="text-gradient-gold">SSA</span></span>
            </Link>
          </div>

          <div className="hidden lg:flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 justify-center px-3">
            {visibleNavLinks.slice(0, 6).map(link => {
              const active = link.href === '/' ? location.pathname === '/' : location.pathname.startsWith(link.href);
              const Icon = link.icon;
              return <Link key={link.href} to={link.href} className={cn("px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all", active ? "bg-amber-500/10 text-amber-500" : "text-muted-foreground hover:text-foreground hover:bg-muted/70")}>{Icon && <Icon className="inline-block mr-1.5 h-3.5 w-3.5" />} {link.label}</Link>;
            })}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="hidden sm:block"><button onClick={() => navigate('/browser?url=realssa://search')} className="h-10 px-3 rounded-xl border border-border/70 bg-muted/35 hover:bg-muted/70 transition flex items-center gap-2 text-muted-foreground" aria-label="Open RealSSA browser search"><Search className="w-4 h-4" /><span className="hidden md:inline text-xs font-semibold">Search</span><kbd className="hidden lg:inline text-[10px] px-1.5 py-0.5 rounded border bg-background/70">/</kbd></button></div>
            <InviteButton variant="icon" />
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center transition" aria-label="Toggle menu">{isMenuOpen ? <X size={21} /> : <Menu size={21} />}</button>
          </div>
        </div>

        <div className={cn("border-t border-border/40 relative z-50 grid transition-[grid-template-rows,opacity] duration-200", showMobileSearch || isSearchFocused ? "grid-rows-[1fr] opacity-100 overflow-visible" : "grid-rows-[0fr] opacity-0 pointer-events-none overflow-hidden md:grid-rows-[1fr] md:opacity-100 md:overflow-visible")}>
          <div className="min-h-0 overflow-visible">
            <div ref={searchWrapRef} className="py-2.5 max-w-3xl mx-auto">
              <form onSubmit={e => { e.preventDefault(); if (!searchQuery.trim()) return; const dest = isDirectUrl(searchQuery.trim()) ? searchQuery.trim() : `realssa://search?q=${encodeURIComponent(searchQuery.trim())}`; navigate(`/browser?url=${encodeURIComponent(dest)}`); setIsSearchFocused(false); setSuggestions([]); }} className="flex items-center gap-2 rounded-2xl border border-border/80 bg-muted/35 px-3.5 py-2 focus-within:border-amber-500/50 focus-within:bg-background transition-all shadow-sm">
                <Search className="w-4 h-4 text-amber-500 shrink-0" />
                <input id="homepage-search-input" type="search" inputMode="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="Search RealSSA or enter a web address" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); handleAutocomplete(e.target.value); }} onFocus={() => setIsSearchFocused(true)} onBlur={() => setTimeout(() => { setIsSearchFocused(false); setSuggestions([]); }, 200)} className="w-full bg-transparent border-none text-[16px] md:text-sm font-medium focus:outline-none py-1.5" />
                {searchQuery && <button type="button" onClick={() => { setSearchQuery(''); setSuggestions([]); }} className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Clear search"><X className="w-4 h-4" /></button>}
              </form>
            </div>
          </div>
        </div>

        {suggestBox && createPortal(<div style={{ position: 'fixed', top: suggestBox.top, left: suggestBox.left, width: suggestBox.width }} className="z-[100000] rounded-2xl border border-border bg-background/98 backdrop-blur-xl shadow-2xl overflow-hidden">
          {suggestions.map((s, i) => <button key={`${s.url}-${i}`} type="button" onMouseDown={e => e.preventDefault()} onClick={() => goToSuggestion(s)} onTouchStart={e => { e.preventDefault(); goToSuggestion(s); }} className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-amber-500/10 text-left border-b border-border/30 last:border-0"><div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">{s.isSearch ? <Search className="w-3.5 h-3.5 text-amber-500" /> : <Globe className="w-3.5 h-3.5 text-amber-500" />}</div><div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{s.title}</div>{!s.isSearch && <div className="text-[10px] text-muted-foreground truncate">{s.url}</div>}{s.isSearch && s.title.toLowerCase() === searchQuery.trim().toLowerCase() && <div className="text-[10px] text-muted-foreground">Search with RealSSA</div>}</div><ArrowRight className="w-3.5 h-3.5 text-muted-foreground" /></button>)}
        </div>, document.body)}

        {isMenuOpen && <div onClick={() => setIsMenuOpen(false)} className="fixed inset-0 top-[57px] sm:top-[65px] md:top-[73px] bg-black/50 backdrop-blur-[2px] z-[9998]" aria-hidden="true" />}

        <nav className={cn("fixed right-0 bottom-0 top-[57px] sm:top-[65px] md:top-[73px] z-[9999] w-full max-w-md border-l border-border bg-background/98 backdrop-blur-2xl shadow-2xl transition-transform duration-300", isMenuOpen ? "translate-x-0" : "translate-x-full pointer-events-none")}>
          <div className="h-full overflow-y-auto p-4 sm:p-6 pb-28">
            <div className="mb-5 rounded-2xl border border-border/70 bg-muted/30 p-4"><WeatherWidget variant="glass" /></div>
            <div className="mb-6"><p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Explore</p><div className="grid grid-cols-2 gap-2">{visibleNavLinks.map(link => { const Icon = link.icon; return <Link key={link.href} to={link.href} onClick={() => setIsMenuOpen(false)} className={cn("flex items-center gap-2.5 rounded-2xl border border-border/60 px-3 py-3 text-sm font-semibold transition hover:border-amber-500/30 hover:bg-amber-500/5", location.pathname === link.href ? "bg-amber-500/10 text-amber-500" : "text-foreground/80")}>{Icon && <Icon className="h-4 w-4 shrink-0" />}<span className="truncate">{link.label}</span></Link>; })}</div></div>
            <div className="mb-6 border-t border-border/60 pt-5"><p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Your library</p>{libraryLinks.map(({ href, label, icon: Icon }) => <Link key={href} to={href} onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Icon className="h-4 w-4" />{label}</Link>)}</div>
            <div className="border-t border-border/60 pt-5 space-y-3"><p className="px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Personalize</p><div className="flex items-center justify-between rounded-2xl bg-muted/30 p-3"><div><div className="text-sm font-semibold">Reading streak</div><div className="text-xs text-muted-foreground">{streak} day{streak === 1 ? '' : 's'} · {rpPoints ?? 0} RP</div></div><button onClick={() => setIsStreakOpen(true)} className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-500">View</button></div><div className="flex items-center justify-between px-2 py-2"><span className="text-sm font-medium text-muted-foreground">Appearance</span><DarkModeToggle /></div><div className="flex items-center justify-between px-2 py-2"><span className="text-sm font-medium text-muted-foreground">Push notifications</span><PushNotificationManager iconOnly={false} /></div><div className="flex items-center justify-between px-2 py-2"><span className="text-sm font-medium text-muted-foreground">Shake to Discover</span><button onClick={() => toggleShake(!shakeEnabled)} className={cn("relative inline-flex h-6 w-11 rounded-full border-2 border-transparent transition", shakeEnabled ? "bg-amber-500" : "bg-muted")}><span className={cn("pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow transition", shakeEnabled ? "translate-x-5" : "translate-x-0")} /></button></div></div>
            {isAdmin && <button onClick={handleLogout} className="mt-5 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-destructive"><LogOut size={18} />Logout</button>}
          </div>
        </nav>
      </div>

      {isStreakOpen && createPortal(<div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setIsStreakOpen(false)}><div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between"><h3 className="text-lg font-bold">Reading Streak</h3><button onClick={() => setIsStreakOpen(false)} className="rounded-full p-2 hover:bg-muted" aria-label="Close"><X className="h-5 w-5" /></button></div><div className="mt-6 text-center"><div className="text-4xl font-black text-amber-500">{streak}</div><div className="text-sm text-muted-foreground">current reading days</div></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-muted/40 p-3 text-center"><div className="text-[10px] uppercase text-muted-foreground">Longest</div><div className="mt-1 font-bold">{longestStreak} days</div></div><div className="rounded-2xl bg-muted/40 p-3 text-center"><div className="text-[10px] uppercase text-muted-foreground">Points</div><div className="mt-1 font-bold text-amber-500">{rpPoints ?? 0} RP</div></div></div><div className="mt-5 text-center text-xs text-muted-foreground">Keep reading daily to grow your streak.</div><div className="mt-5 border-t border-border pt-4"><button onClick={() => setIsSecureOpen(!isSecureOpen)} className="flex w-full items-center justify-between text-xs font-bold text-muted-foreground"><span>Advanced settings · Restore profile</span><span>{isSecureOpen ? 'Hide' : 'Show'}</span></button>{isSecureOpen && <div className="mt-3 space-y-3"><input readOnly value={localStorage.getItem('realssa_device_uuid') || ''} className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-xs font-mono" /><div className="flex gap-2"><button onClick={() => { navigator.clipboard.writeText(localStorage.getItem('realssa_device_uuid') || ''); setIsCopied(true); toast({ title: 'Key Copied!' }); setTimeout(() => setIsCopied(false), 2000); }} className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold">{isCopied ? 'Copied' : 'Copy key'}</button><input placeholder="Paste secure key" value={importKey} onChange={e => setImportKey(e.target.value)} className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-xs" /><button onClick={() => { if (!importKey.trim()) return; localStorage.setItem('realssa_device_uuid', importKey.trim()); window.location.reload(); }} className="rounded-lg border px-3 py-2 text-xs font-semibold">Import</button></div></div>}</div></div></div>, document.body)}
    </header>
  );
};

export default Header;