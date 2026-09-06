import React, { useEffect, useRef, useState } from 'react';
import { Menu, X, ChevronDown, LogOut, Home, Newspaper, Radio, Globe, Moon, Sun, Bell, ArrowLeft, Copy, Check, Key, Search, ArrowRight, Monitor } from 'lucide-react';
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
import { motion, AnimatePresence } from 'framer-motion';
import RealSSAChat from './RealSSAChat';

const navLinks = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Advertise', href: '/ads', icon: Newspaper },
  { label: 'Sports', href: '/sports', icon: Radio },
  { label: 'Market Hub', href: '/market', icon: Globe },
  { label: 'Browser', href: '/browser', icon: Monitor },
  { label: 'Videos', href: '/videos', icon: Radio },
  { label: 'Crypto', href: '/crypto', icon: Globe },
  { label: 'Dashboard', href: '/admin-dashboard', icon: Newspaper },
];

const categoryPills = [
  { label: 'Breaking', href: '/for-you' },
  { label: 'Nigeria', href: '/nigeria' },
  { label: 'Sports', href: '/sports' },
  { label: 'Entertainment', href: '/entertainment' },
  { label: 'World', href: '/world-news' },
  { label: 'Crypto', href: '/crypto' },
  { label: 'Trending', href: '/trending' },
  { label: 'Culture', href: '/culture' },
];

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
  const [suggestions, setSuggestions] = useState<{ url: string; title: string; isSearch?: boolean }[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [compactHeader, setCompactHeader] = useState(false);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inviteCode = user?.id ? `RSSA-${user.id.slice(0, 6).toUpperCase()}` : 'RSSA-GUEST';

  useEffect(() => {
    const onScroll = () => setCompactHeader(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setIsSearchFocused(false);
  }, [location.pathname]);

  useEffect(() => () => {
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
  }, []);

  const handleAutocomplete = (val: string) => {
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    if (!val.trim()) { setSuggestions([]); return; }
    const trimmed = val.trim();
    const historyMatches = getHistoryMatches(trimmed);
    const selfSearch = { url: `realssa://search?q=${encodeURIComponent(trimmed)}`, title: trimmed, isSearch: true };
    setSuggestions([...historyMatches, selfSearch]);
    autocompleteTimer.current = setTimeout(() => {
      fetch(apiUrl(`/api/autocomplete?q=${encodeURIComponent(trimmed)}`)).then(r => r.json()).then(data => {
        const list = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
        setSuggestions([...historyMatches, selfSearch, ...list.filter((s: string) => s && s.toLowerCase() !== trimmed.toLowerCase()).slice(0, 5).map((s: string) => ({ url: `realssa://search?q=${encodeURIComponent(s)}`, title: s, isSearch: true }))]);
      }).catch(() => setSuggestions([...historyMatches, selfSearch]));
    }, 180);
  };

  const goToSuggestion = (s: { url: string; title: string; isSearch?: boolean }) => {
    const dest = s.isSearch ? `realssa://search?q=${encodeURIComponent(s.title)}` : s.url;
    setSearchQuery(s.isSearch ? s.title : s.url); setSuggestions([]); setIsSearchFocused(false); navigate(`/browser?url=${encodeURIComponent(dest)}`);
  };

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSuggestions([]);
    setIsSearchFocused(false);
    navigate(`/browser?url=${encodeURIComponent(`realssa://search?q=${encodeURIComponent(q)}`)}`);
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setInviteCopied(true);
      toast({ title: 'Invite code copied' });
      setTimeout(() => setInviteCopied(false), 1800);
    } catch {
      toast({ title: 'Could not copy code', variant: 'destructive' });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <header className={cn('sticky top-0 z-[9999] border-b border-border/80 bg-background/98 backdrop-blur-xl transition-[box-shadow,background-color]', compactHeader && 'shadow-md')}>
      <div className="rssa-shell">
        <div className="flex min-h-16 items-center gap-3 py-2">
          <button className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm lg:hidden" onClick={() => setMobileOpen(v => !v)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'}>
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link to="/" className="flex min-w-0 shrink-0 items-center gap-2.5" aria-label="RealSSA News home">
            <img src="/logo.png" alt="RealSSA Logo" className="h-10 w-10 shrink-0 rounded-xl object-contain sm:h-11 sm:w-11" />
            <div className="min-w-0">
              <div className="font-serif text-xl font-black tracking-tight text-foreground sm:text-2xl">Real<span className="text-gradient-gold">SSA</span></div>
              <div className="hidden text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground sm:block">News Intelligence</div>
            </div>
          </Link>

          <nav className="ml-1 hidden items-center gap-0.5 xl:flex" aria-label="Primary navigation">
            {navLinks.map(({ label, href, icon: Icon }) => {
              const active = location.pathname === href || (href !== '/' && location.pathname.startsWith(href));
              return (
                <Link key={href} to={href} className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:bg-muted hover:text-foreground', active && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground')}>
                  <Icon size={14} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="relative ml-auto hidden w-[min(25vw,320px)] lg:block">
            <form onSubmit={submitSearch} className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={16} />
              <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); handleAutocomplete(e.target.value); }} onFocus={() => setIsSearchFocused(true)} onKeyDown={e => { if (e.key === 'Escape') { setIsSearchFocused(false); setSuggestions([]); } }} placeholder="Search or enter URL..." className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-4 text-sm font-medium text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15" aria-label="Search RealSSA or enter a URL" />
            </form>
            <AnimatePresence>
              {isSearchFocused && suggestions.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="absolute left-0 right-0 top-12 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
                  {suggestions.slice(0, 7).map((suggestion, index) => (
                    <button key={`${suggestion.title}-${index}`} onMouseDown={e => e.preventDefault()} onClick={() => goToSuggestion(suggestion)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-muted">
                      <span className="truncate">{suggestion.title}</span><ArrowRight size={14} className="shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden items-center gap-1 sm:flex">
            <Link to="/notifications" className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-muted" aria-label="Notifications">
              <Bell size={18} />
              {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[9px] font-bold leading-4 text-destructive-foreground">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </Link>
            <button onClick={toggleTheme} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-muted" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          <button onClick={() => setInviteOpen(v => !v)} className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground md:flex" aria-expanded={inviteOpen}>
            <Key size={15} />
            <span>{points.toLocaleString()} XP</span>
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="hidden items-center gap-2 overflow-x-auto border-t border-border/70 py-2 md:flex">
          {categoryPills.map(pill => {
            const active = location.pathname === pill.href || (pill.href !== '/' && location.pathname.startsWith(pill.href));
            return <Link key={pill.href} to={pill.href} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-foreground/70 transition hover:bg-muted hover:text-foreground', active && 'bg-foreground text-background')}>{pill.label}</Link>;
          })}
          {currentArticle && <span className="ml-auto hidden shrink-0 items-center gap-2 text-xs font-medium text-foreground/60 xl:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />Now playing: {currentArticle.title}</span>}
          {weather?.temperature != null && <span className="ml-auto hidden shrink-0 text-xs font-medium text-foreground/60 lg:block">{weather.temperature}° · {weather.location}</span>}
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="border-t border-border/70 bg-background lg:hidden">
            <div className="rssa-shell grid gap-2 py-4">
              <Link to="/browser" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-2xl border-2 border-primary/35 bg-primary/10 px-4 py-3.5 text-sm font-bold text-foreground shadow-sm">
                <Monitor size={18} className="text-primary" />
                <span className="flex-1">Open RealSSA Browser</span>
                <ArrowRight size={16} className="text-primary" />
              </Link>

              <form onSubmit={submitSearch} className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={16} />
                <input autoFocus value={searchQuery} onChange={e => { setSearchQuery(e.target.value); handleAutocomplete(e.target.value); }} placeholder="Search or enter URL..." className="h-11 w-full rounded-2xl border border-border bg-card pl-9 pr-4 text-base font-medium text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15" aria-label="Search RealSSA or enter a URL" />
              </form>

              <div className="grid grid-cols-2 gap-2">
                {navLinks.map(({ label, href, icon: Icon }) => {
                  const active = location.pathname === href || (href !== '/' && location.pathname.startsWith(href));
                  return <Link key={href} to={href} onClick={() => setMobileOpen(false)} className={cn('flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-card px-3 py-3 text-sm font-semibold text-foreground', active && 'border-primary/40 bg-primary/10 font-bold')}><Icon size={16} className={active ? 'text-primary' : 'text-muted-foreground'} />{label}</Link>;
                })}
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-3 text-foreground">
                <div><div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your progress</div><div className="mt-1 text-sm font-semibold">{points.toLocaleString()} XP · {streak} day streak</div></div>
                <button onClick={toggleTheme} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border" aria-label="Toggle theme">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
              </div>
              {user && <button onClick={handleSignOut} className="flex items-center gap-2 rounded-2xl border border-destructive/20 px-3 py-3 text-left text-sm font-semibold text-destructive"><LogOut size={16} />Sign out</button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {inviteOpen && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute right-4 top-[4.5rem] z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-4 text-foreground shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><div className="font-semibold">Invite friends</div><p className="mt-1 text-xs text-muted-foreground">Share your RealSSA invite code and keep your streak moving.</p></div>
              <button onClick={() => setInviteOpen(false)} className="rounded-full p-1.5 hover:bg-muted" aria-label="Close invite panel"><X size={16} /></button>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-3"><code className="flex-1 text-sm font-bold tracking-wider">{inviteCode}</code><button onClick={copyInvite} className="rounded-lg border border-border bg-background p-2" aria-label="Copy invite code">{inviteCopied ? <Check size={15} /> : <Copy size={15} />}</button></div>
          </motion.div>
        )}
      </AnimatePresence>

      <RealSSAChat />
    </header>
  );
};

export default Header;
