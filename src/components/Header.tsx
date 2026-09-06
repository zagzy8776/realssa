import React, { useEffect, useRef, useState } from 'react';
import { Bell, BookOpen, ChevronDown, Clock3, Globe2, Home, KeyRound, LogOut, Menu, MonitorSmartphone, Moon, Newspaper, Radio, Search, Sparkles, Sun, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import { useGlobalAudio } from '@/contexts/GlobalAudioContext';
import { apiUrl } from '@/lib/api-base';
import { cn } from '@/lib/utils';
import { useXPStore } from '@/stores/useXPStore';
import { useWeather } from '@/hooks/useWeather';
import { getHistoryMatches } from '@/lib/searchHistory';
import RealSSAChat from './RealSSAChat';

const primaryLinks = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'News', href: '/nigeria', icon: Newspaper },
  { label: 'Sports', href: '/sports', icon: Radio },
  { label: 'Markets', href: '/market', icon: Globe2 },
  { label: 'Browser', href: '/browser', icon: MonitorSmartphone },
  { label: 'Videos', href: '/videos', icon: Radio },
  { label: 'Crypto', href: '/crypto', icon: Sparkles },
];

const categoryLinks = [
  { label: 'Breaking', href: '/for-you' },
  { label: 'Nigeria', href: '/nigeria' },
  { label: 'Politics', href: '/nigerian-news' },
  { label: 'Sports', href: '/sports' },
  { label: 'Entertainment', href: '/entertainment' },
  { label: 'World', href: '/world-news' },
  { label: 'Crypto', href: '/crypto' },
  { label: 'Trending', href: '/trending' },
  { label: 'Culture', href: '/culture' },
];

type Suggestion = { url: string; title: string; isSearch?: boolean };

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const { unreadCount } = useNotifications();
  const { currentArticle } = useGlobalAudio();
  const { points, streak } = useXPStore();
  const weather = useWeather();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
    setSearchFocused(false);
    setSuggestions([]);
  }, [location.pathname]);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  const goSearch = (query: string) => {
    const q = query.trim();
    if (!q) return;
    setSuggestions([]);
    setSearchFocused(false);
    setSearchQuery(q);
    navigate(`/browser?url=${encodeURIComponent(`realssa://search?q=${encodeURIComponent(q)}`)}`);
  };

  const handleAutocomplete = (value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const trimmed = value.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    const local = getHistoryMatches(trimmed);
    const searchSuggestion: Suggestion = {
      url: `realssa://search?q=${encodeURIComponent(trimmed)}`,
      title: `Search RealSSA for “${trimmed}”`,
      isSearch: true,
    };
    setSuggestions([...local, searchSuggestion]);
    searchTimer.current = setTimeout(() => {
      fetch(apiUrl(`/api/autocomplete?q=${encodeURIComponent(trimmed)}`))
        .then(res => (res.ok ? res.json() : []))
        .then(data => {
          const terms = Array.isArray(data?.[1]) ? data[1] : [];
          const live = terms
            .filter((term: unknown): term is string => typeof term === 'string' && term.trim() && term.toLowerCase() !== trimmed.toLowerCase())
            .slice(0, 5)
            .map((term: string) => ({ url: `realssa://search?q=${encodeURIComponent(term)}`, title: term, isSearch: true }));
          setSuggestions([...local, searchSuggestion, ...live]);
        })
        .catch(() => setSuggestions([...local, searchSuggestion]));
    }, 220);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    goSearch(searchQuery);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const active = (href: string) => location.pathname === href || (href !== '/' && location.pathname.startsWith(href));

  return (
    <>
      <header className={cn(
        'sticky top-0 z-[9999] border-b border-border/80 bg-background/95 backdrop-blur-2xl transition-shadow',
        compact && 'shadow-[0_8px_30px_rgba(0,0,0,0.08)]'
      )}>
        <div className="mx-auto max-w-[1500px] px-3 sm:px-5 lg:px-7">
          <div className="flex min-h-[68px] items-center gap-3 lg:min-h-[76px]">
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-card text-foreground shadow-sm lg:hidden"
              aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <Link to="/" className="group flex min-w-0 shrink-0 items-center gap-3" aria-label="RealSSA News home">
              <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:h-12 sm:w-12">
                <img src="/logo.png" alt="RealSSA" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 leading-none">
                <div className="font-serif text-[22px] font-black tracking-[-0.04em] text-foreground sm:text-[25px]">
                  Real<span className="text-primary">SSA</span>
                </div>
                <div className="mt-1 hidden text-[9px] font-black uppercase tracking-[0.28em] text-muted-foreground sm:block">News Intelligence</div>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
              {primaryLinks.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors',
                    active(href) ? 'bg-foreground text-background' : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>

            <div className="ml-auto hidden min-w-0 flex-1 justify-end gap-2 md:flex lg:ml-4">
              <div className="relative w-full max-w-[380px]">
                <form onSubmit={submitSearch} className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={17} />
                  <input
                    value={searchQuery}
                    onChange={e => handleAutocomplete(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onKeyDown={e => { if (e.key === 'Escape') { setSearchFocused(false); setSuggestions([]); } }}
                    placeholder="Search RealSSA or enter a URL"
                    className="h-11 w-full rounded-2xl border border-border bg-card pl-11 pr-4 text-sm font-semibold text-foreground outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                    aria-label="Search RealSSA or enter a URL"
                  />
                </form>
                {searchFocused && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-[52px] overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-2xl">
                    {suggestions.slice(0, 7).map((item, index) => (
                      <button
                        key={`${item.title}-${index}`}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => item.isSearch ? goSearch(item.title.replace(/^Search RealSSA for “|”$/g, '')) : navigate(`/browser?url=${encodeURIComponent(item.url)}`)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted"
                      >
                        <Search size={14} className="shrink-0 text-primary" />
                        <span className="truncate">{item.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Link to="/notifications" className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground hover:bg-muted" aria-label="Notifications">
                <Bell size={18} />
                {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[9px] font-black leading-4 text-destructive-foreground">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </Link>
              <button onClick={toggleTheme} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground hover:bg-muted" aria-label="Toggle theme">
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button onClick={() => setAccountOpen(v => !v)} className="hidden h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-black text-foreground xl:flex" aria-expanded={accountOpen}>
                <KeyRound size={15} className="text-primary" />
                {points.toLocaleString()} XP
                <ChevronDown size={14} className="text-muted-foreground" />
              </button>
            </div>

            <Link to="/browser" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-primary/35 bg-primary/10 text-primary shadow-sm lg:hidden" aria-label="Open RealSSA Browser">
              <MonitorSmartphone size={19} />
            </Link>
          </div>

          <div className="hidden items-center gap-2 overflow-x-auto border-t border-border/70 py-2.5 md:flex">
            <span className="mr-2 flex shrink-0 items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Live desk</span>
            {categoryLinks.map(({ label, href }) => (
              <Link key={href} to={href} className={cn('shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground/65 hover:bg-muted hover:text-foreground', active(href) && 'bg-muted text-foreground')}>
                {label}
              </Link>
            ))}
            <span className="ml-auto hidden shrink-0 items-center gap-3 text-xs font-semibold text-muted-foreground xl:flex">
              {weather?.temperature != null && <span>{weather.location} · {weather.temperature}°</span>}
              {currentArticle && <span className="inline-flex items-center gap-2"><Clock3 size={12} />{currentArticle.title}</span>}
            </span>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-border/80 bg-background/98 lg:hidden">
            <div className="mx-auto max-w-[1500px] space-y-3 px-3 py-4 sm:px-5">
              <div className="grid grid-cols-2 gap-2">
                <Link to="/browser" onClick={() => setMobileOpen(false)} className="col-span-2 flex min-h-14 items-center gap-3 rounded-2xl border-2 border-primary/30 bg-primary/10 px-4 text-sm font-black text-foreground shadow-sm">
                  <MonitorSmartphone size={19} className="text-primary" />
                  <span className="flex-1">Open RealSSA Browser</span>
                  <span className="text-primary">Open</span>
                </Link>
                <Link to="/for-you" onClick={() => setMobileOpen(false)} className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-bold text-foreground"><BookOpen size={16} className="text-primary" />For You</Link>
                <Link to="/trending" onClick={() => setMobileOpen(false)} className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-bold text-foreground"><Sparkles size={16} className="text-primary" />Trending</Link>
              </div>

              <form onSubmit={submitSearch} className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={17} />
                <input
                  value={searchQuery}
                  onChange={e => handleAutocomplete(e.target.value)}
                  placeholder="Search RealSSA or enter a URL"
                  className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-4 text-base font-semibold text-foreground outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                  aria-label="Search RealSSA or enter a URL"
                />
              </form>

              <div className="grid grid-cols-2 gap-2">
                {primaryLinks.map(({ label, href, icon: Icon }) => (
                  <Link key={href} to={href} onClick={() => setMobileOpen(false)} className={cn('flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-bold text-foreground', active(href) && 'border-primary/40 bg-primary/10')}>
                    <Icon size={16} className={active(href) ? 'text-primary' : 'text-muted-foreground'} />{label}
                  </Link>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Reader progress</div>
                  <div className="mt-1 text-sm font-bold text-foreground">{points.toLocaleString()} XP · {streak} day streak</div>
                </div>
                <button onClick={toggleTheme} className="grid h-10 w-10 place-items-center rounded-xl border border-border text-foreground" aria-label="Toggle theme">
                  {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-border/70 pt-2">
                <button onClick={() => setChatOpen(true)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-foreground hover:bg-muted"><Sparkles size={16} className="text-primary" />RealSSA Assistant</button>
                {user && <button onClick={handleSignOut} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-destructive hover:bg-destructive/5"><LogOut size={16} />Sign out</button>}
              </div>
            </div>
          </div>
        )}

        {accountOpen && (
          <div className="absolute right-4 top-[74px] z-[10000] hidden w-80 rounded-2xl border border-border bg-card p-4 text-foreground shadow-2xl xl:block">
            <div className="text-sm font-black">RealSSA account</div>
            <div className="mt-1 text-xs text-muted-foreground">{points.toLocaleString()} XP · {streak} day streak</div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted p-3 text-sm font-bold">
              <KeyRound size={15} className="text-primary" /> Your progress is synced locally.
            </div>
            {user && <button onClick={handleSignOut} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-destructive"><LogOut size={15} />Sign out</button>}
          </div>
        )}
      </header>
      <RealSSAChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
};

export default Header;
