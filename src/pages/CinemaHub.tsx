import React, { useState, useEffect, useRef, useCallback } from 'react';
import VideoNews from "@/pages/VideoNews";
import { Play, Info, Search, Star, Film, Tv, X, Clock, EyeOff, Youtube, Loader2, Share2, Activity, Shield, Trophy } from 'lucide-react';
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import { apiUrl } from "@/lib/api-base";
import CinemaPlayer from "@/components/CinemaPlayer";
import SportsPlayer from "@/components/SportsPlayer";

interface MovieOrShow {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  r2_poster_url?: string;
  r2_backdrop_url?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  media_type: 'movie' | 'tv';
  genre_ids?: number[];
}

interface Episode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  r2_still_url?: string;
  still_path?: string;
  air_date?: string;
}

export default function CinemaHub() {
  const [activeTab, setActiveTab] = useState<'movies' | 'news' | 'sports'>('movies');

  // Catalog state — single flat list, infinite scroll
  const [catalog, setCatalog] = useState<MovieOrShow[]>([]);
  const [heroPool, setHeroPool] = useState<MovieOrShow[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);
  const [featured, setFeatured] = useState<MovieOrShow | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const seenIds = useRef<Set<number>>(new Set());

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MovieOrShow[]>([]);
  const [suggestions, setSuggestions] = useState<MovieOrShow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Detail Modal
  const [selectedMedia, setSelectedMedia] = useState<MovieOrShow | null>(null);
  const [mediaDetails, setMediaDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);

  // Player
  const [activePlayer, setActivePlayer] = useState<{
    tmdbId: number; mediaType: 'movie' | 'tv'; season: number; episode: number; title: string;
  } | null>(null);

  // Sports Stream Player & Matches State
  const [activeSportsPlayer, setActiveSportsPlayer] = useState<{
    channelId: string | number; title: string;
  } | null>(null);
  const [sportsMatches, setSportsMatches] = useState<any[]>([]);
  const [sportsSearchQuery, setSportsSearchQuery] = useState('');
  const [sportsMatchesLoading, setSportsMatchesLoading] = useState(false);
  const [selectedSportMatch, setSelectedSportMatch] = useState<any | null>(null);

  // ── Continue Watching (localStorage persistence) ──
  const [continueWatching, setContinueWatching] = useState<Array<{
    tmdbId: number; title: string; poster: string | null;
    mediaType: 'movie' | 'tv'; season: number; episode: number; timestamp: number;
  }>>([]);

  // ── Data Saver Mode (auto-detects Nigerian low-bandwidth connections) ──
  const [dataSaver, setDataSaver] = useState(false);

  // ── Time-aware content (night = thrillers, morning = news first) ──
  const [timeOfDay, setTimeOfDay] = useState<'night' | 'morning' | 'day'>('day');

  // ── Trailer preview on hero banner ──
  const [heroTrailerKey, setHeroTrailerKey] = useState<string | null>(null);

  // ── Initial Load ──
  useEffect(() => { fetchPage(1, true); }, []);

  // ── Load Sports Matches when activeTab === 'sports' ──
  useEffect(() => {
    if (activeTab === 'sports') {
      setSportsMatchesLoading(true);
      fetch(apiUrl('/api/sports/stream-schedule'))
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          setSportsMatches(Array.isArray(data) ? data : []);
          setSportsMatchesLoading(false);
        })
        .catch(() => {
          setSportsMatches([]);
          setSportsMatchesLoading(false);
        });
    }
  }, [activeTab]);

  // ── Data saver: auto-detect via navigator.connection ──
  useEffect(() => {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      const check = () => {
        const slow = conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g' || conn.saveData;
        setDataSaver(slow);
      };
      check();
      conn.addEventListener?.('change', check);
      return () => conn.removeEventListener?.('change', check);
    }
  }, []);

  // ── Scraper & DevTools Anti-Hack Protection ──
  useEffect(() => {
    if (import.meta.env?.MODE === 'development') return;

    // 1. Disable right-click context menu
    const preventContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', preventContextMenu);

    // 2. Disable inspect keyboard shortcuts (F12, Ctrl+Shift+I/J/C, Ctrl+U)
    const preventShortcuts = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
      ) {
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', preventShortcuts);

    // 3. Disable text selection
    const preventSelection = (e: Event) => e.preventDefault();
    document.addEventListener('selectstart', preventSelection);

    // 4. Anti-DevTools Debugger Loop
    // Triggers debugger breakpoint if browser devtools console is open, freezing the window
    const antiDevTools = setInterval(() => {
      const startTime = Date.now();
      debugger; // Breakpoint triggers if DevTools console is open
      const duration = Date.now() - startTime;
      if (duration > 100) {
        // DevTools opened, clear body or slow down execution
        try {
          const main = document.querySelector('main');
          if (main) main.style.filter = 'blur(10px)';
        } catch (_) {}
      }
    }, 1000);

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventShortcuts);
      document.removeEventListener('selectstart', preventSelection);
      clearInterval(antiDevTools);
    };
  }, []);

  // ── Time of day detection for contextual hero ──
  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 21 || h < 5) setTimeOfDay('night');        // Late night → thrillers/horror
    else if (h >= 5 && h < 10) setTimeOfDay('morning'); // Morning → news nudge
    else setTimeOfDay('day');
  }, []);

  // ── Continue Watching: load from localStorage ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem('realssa:continue_watching');
      if (raw) setContinueWatching(JSON.parse(raw));
    } catch (_) {}
  }, []);

  // ── URL Deep-linking: ?id=...&type=... or ?play=... ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mediaId = params.get('id') || params.get('play');
    const mediaType = params.get('type') || 'movie';

    if (mediaId) {
      const idNum = parseInt(mediaId);
      if (!isNaN(idNum)) {
        // Construct dummy item to fetch and open drawer
        const dummy: MovieOrShow = {
          id: idNum,
          media_type: mediaType as 'movie' | 'tv',
          overview: '',
          poster_path: '',
          backdrop_path: ''
        };
        handleOpenDetails(dummy);

        // If play parameter was used, auto-trigger play once data loads
        if (params.has('play')) {
          setTimeout(() => {
            handlePlayMedia(dummy);
          }, 1200);
        }
      }
    }
  }, []);

  // ── IntersectionObserver for infinite scroll ──
  useEffect(() => {
    if (isSearching) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore && !isSearching) {
          loadNextPage();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadingMore, hasMore, isSearching]);

  // ── Close suggestions on outside click ──
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const fetchPage = async (pageNum: number, isFirst = false) => {
    if (isFirst) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetch(apiUrl(`/api/cinema/trending?page=${pageNum}&time_window=week`));
      const data = await res.json();
      const raw: MovieOrShow[] = data.results || [];

      // Deduplicate by id — never show same card twice
      const fresh = raw.filter(item => {
        if (seenIds.current.has(item.id)) return false;
        seenIds.current.add(item.id);
        return true;
      });

      if (isFirst) {
        setCatalog(fresh);
        // Build hero rotation pool: items with backdrop + overview
        const pool = fresh.filter(i => i.backdrop_path && i.overview && (i.vote_average ?? 0) >= 6);
        setHeroPool(pool);
        setFeatured(pool[0] || fresh[0] || null);
        setHeroIdx(0);
      } else {
        setCatalog(prev => [...prev, ...fresh]);
        // Expand hero pool with quality items from new page
        const newPool = fresh.filter(i => i.backdrop_path && i.overview && (i.vote_average ?? 0) >= 6);
        setHeroPool(prev => [...prev, ...newPool]);
      }

      setHasMore(fresh.length > 0 && pageNum < 20);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to fetch catalog:', err);
    } finally {
      if (isFirst) setLoading(false);
      else setLoadingMore(false);
    }
  };

  const loadNextPage = useCallback(() => {
    if (loadingMore || !hasMore) return;
    fetchPage(page + 1);
  }, [page, loadingMore, hasMore]);

  // ── Hero auto-rotation every 6 seconds ──
  useEffect(() => {
    if (heroPool.length < 2) return;
    const timer = setInterval(() => {
      setHeroIdx(prev => {
        const next = (prev + 1) % heroPool.length;
        setFeatured(heroPool[next]);
        return next;
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [heroPool]);

  // ── Autocomplete (debounced 300ms) ──
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      if (!value.trim()) { setIsSearching(false); setSearchResults([]); }
      return;
    }

    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/cinema/search?q=${encodeURIComponent(value)}`));
        const data = await res.json();
        // Filter: must be movie/tv, must have a real poster, must have a known rating
        const results = (data.results || []).filter((i: MovieOrShow) =>
          (i.media_type === 'movie' || i.media_type === 'tv') &&
          i.poster_path &&
          (i.vote_average ?? 0) > 0
        );
        setSuggestions(results.slice(0, 8));
        setShowSuggestions(results.length > 0);
      } catch (_) {}
    }, 300);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    const q = searchQuery.trim();
    if (!q) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setSearchLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/cinema/search?q=${encodeURIComponent(q)}`));
      const data = await res.json();
      const results = (data.results || []).filter((i: MovieOrShow) =>
        i.media_type === 'movie' || i.media_type === 'tv'
      );
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearchLoading(false);
      // Keep query visible so user can edit and search again
    }
  };

  const handleSuggestionClick = (item: MovieOrShow) => {
    setShowSuggestions(false);
    setSuggestions([]);
    // Keep search query for context but close suggestion list
    // Open detail immediately
    handleOpenDetails(item);
  };

  const clearSearch = () => {
    setIsSearching(false);
    setSearchResults([]);
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // ── Detail Modal ──
  const handleOpenDetails = async (media: MovieOrShow) => {
    setSelectedMedia(media);
    setMediaDetails(null);
    setSeasons([]);
    setEpisodes([]);
    setSelectedEpisode(null);
    setDetailsLoading(true);
    try {
      const pathType = media.media_type === 'tv' ? 'shows' : 'movies';
      const res = await fetch(apiUrl(`/api/cinema/${pathType}/${media.id}`));
      const details = await res.json();
      setMediaDetails(details);
      if (media.media_type === 'tv') {
        const rawSeasons = details.seasons || [];
        const regularSeasons = rawSeasons.filter((s: any) => s.season_number > 0);
        const activeSeasons = regularSeasons.length > 0 ? regularSeasons : rawSeasons;
        setSeasons(activeSeasons);
        if (activeSeasons.length > 0) {
          setSelectedSeasonNum(activeSeasons[0].season_number);
          fetchSeasonEpisodes(media.id, activeSeasons[0].season_number);
        }
      }
    } catch (err) {
      console.error('Failed to load details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchSeasonEpisodes = async (showId: number, seasonNum: number) => {
    setEpisodesLoading(true);
    setEpisodes([]);
    try {
      const res = await fetch(apiUrl(`/api/cinema/shows/${showId}/season/${seasonNum}`));
      const data = await res.json();
      setEpisodes(data.episodes || []);
    } catch (err) {
      console.error('Episodes fetch failed:', err);
    } finally {
      setEpisodesLoading(false);
    }
  };

  const handleSeasonChange = (seasonNum: number) => {
    setSelectedSeasonNum(seasonNum);
    if (selectedMedia) fetchSeasonEpisodes(selectedMedia.id, seasonNum);
  };

  // ── Save to Continue Watching history ──
  const saveToWatchHistory = (media: MovieOrShow, season = 1, episode = 1) => {
    const entry = {
      tmdbId: media.id,
      title: media.title || media.name || '',
      poster: media.r2_poster_url || (media.poster_path ? `https://image.tmdb.org/t/p/w300${media.poster_path}` : null),
      mediaType: (media.media_type || 'movie') as 'movie' | 'tv',
      season,
      episode,
      timestamp: Date.now(),
    };
    setContinueWatching(prev => {
      // Remove existing entry for same title, prepend new one, cap at 10
      const filtered = prev.filter(i => i.tmdbId !== media.id);
      const updated = [entry, ...filtered].slice(0, 10);
      try { localStorage.setItem('realssa:continue_watching', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
  };

  const handleEpisodeSelect = (ep: Episode) => {
    if (!selectedMedia) return;
    setSelectedEpisode(ep);
    const showName = selectedMedia.title || selectedMedia.name || 'Show';
    saveToWatchHistory(selectedMedia, ep.season_number, ep.episode_number);
    setActivePlayer({
      tmdbId: selectedMedia.id,
      mediaType: 'tv',
      season: ep.season_number,
      episode: ep.episode_number,
      title: `${showName} · S${ep.season_number}E${ep.episode_number} · ${ep.name}`
    });
  };

  const handlePlayMedia = (media: MovieOrShow) => {
    saveToWatchHistory(media, 1, 1);
    setActivePlayer({
      tmdbId: media.id,
      mediaType: (media.media_type || 'movie') as 'movie' | 'tv',
      season: 1, episode: 1,
      title: media.title || media.name || 'Movie'
    });
  };

  const getPoster = (item: MovieOrShow) =>
    item.r2_poster_url || (item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : null);

  const getBackdrop = (item: MovieOrShow) =>
    item.r2_backdrop_url || (item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null);

  const getYear = (item: MovieOrShow) => {
    const d = item.release_date || item.first_air_date || '';
    return d ? d.substring(0, 4) : '';
  };

  const getRating = (item: MovieOrShow) => ((item.vote_average ?? 0)).toFixed(1);

  const formatGenres = (genres: any[]) =>
    genres?.length ? genres.slice(0, 3).map(g => g.name).join(' · ') : '';

  // Split catalog into movies and shows for the two sections
  const movies = catalog.filter(i => i.media_type === 'movie');
  const shows = catalog.filter(i => i.media_type === 'tv');

  const MediaCard = ({ item }: { item: MovieOrShow }) => {
    const posterUrl = getPoster(item);
    return (
      <div
        onClick={() => handleOpenDetails(item)}
        className="group relative cursor-pointer rounded-xl overflow-hidden border border-white/5 hover:border-amber-500/50 transition-all duration-200 hover:scale-[1.03] hover:shadow-lg hover:shadow-black/60 bg-zinc-900 aspect-[2/3]"
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={item.title || item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-950 flex flex-col items-center justify-center p-3 text-center select-none">
            <div className="w-10 h-10 rounded-full bg-zinc-800/80 flex items-center justify-center mb-2.5 text-zinc-500 group-hover:text-amber-400 group-hover:bg-amber-500/10 transition-colors">
              {item.media_type === 'tv' ? <Tv size={18} /> : <Film size={18} />}
            </div>
            <p className="text-zinc-400 text-[10px] font-extrabold max-w-full truncate px-1 uppercase tracking-wider">
              {item.media_type === 'tv' ? 'TV Series' : 'Movie'}
            </p>
          </div>
        )}
        {/* Gradient overlay always visible at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

        {/* Play icon on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-11 h-11 bg-amber-500/95 rounded-full flex items-center justify-center shadow-xl">
            <Play size={18} className="fill-black ml-0.5" />
          </div>
        </div>

        {/* Title + meta */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <p className="text-white text-[11px] font-bold leading-tight line-clamp-2">{item.title || item.name}</p>
          <div className="flex items-center gap-1.5 mt-1">
            {(item.vote_average ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-amber-400 text-[9px] font-bold">
                <Star size={8} className="fill-current" />{getRating(item)}
              </span>
            )}
            {getYear(item) && <span className="text-zinc-500 text-[9px]">{getYear(item)}</span>}
            <span className="ml-auto text-[8px] uppercase font-bold bg-zinc-800/80 px-1.5 py-0.5 rounded text-zinc-400">
              {item.media_type === 'tv' ? 'TV' : 'FILM'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">

      {/* ── Tab Bar — always visible ── */}
      <div className="bg-black/90 backdrop-blur-md border-b border-zinc-900 sticky top-14 z-40 px-4 py-2">
        <div className="container mx-auto flex items-center gap-2">
          <button
            onClick={() => setActiveTab('movies')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${
              activeTab === 'movies' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Film size={13} /> Movies & Shows
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${
              activeTab === 'news' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Youtube size={13} /> Live News
          </button>
          <button
            onClick={() => setActiveTab('sports')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${
              activeTab === 'sports' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Activity size={13} /> Live Sports TV
          </button>
        </div>
      </div>

      {/* ── Live News Tab ── */}
      {activeTab === 'news' && (
        <div className="flex-1 overflow-auto">
          <VideoNews />
        </div>
      )}

      {/* ── Live Sports TV Tab ── */}
      {activeTab === 'sports' && (
        <div className="flex-1 overflow-y-auto px-4 py-6 container mx-auto max-w-6xl">
          {/* Header */}
          <div className="text-center max-w-xl mx-auto mb-8">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center justify-center gap-2 mb-2">
              <Trophy className="text-amber-500 animate-pulse" size={24} />
              RealSSA Live Sports TV
            </h2>
            <p className="text-xs text-zinc-400">Search active clubs or leagues to stream any match live in HD with redirect-hijack protection.</p>
          </div>

          {/* Search Live Matches & Clubs */}
          <div className="relative w-full max-w-md mx-auto mb-8">
            <div className="relative flex items-center">
              <Search className="absolute left-4 text-zinc-500" size={16} />
              <input
                type="text"
                placeholder="Search live clubs, leagues or sports..."
                value={sportsSearchQuery}
                onChange={e => setSportsSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 text-zinc-200 placeholder-zinc-500 rounded-full pl-11 pr-5 py-3 text-sm outline-none transition-colors"
              />
              {sportsSearchQuery && (
                <button
                  onClick={() => setSportsSearchQuery('')}
                  className="absolute right-4 text-zinc-500 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Live Matches Scoreboard / Stream Center */}
          <div className="mb-10">
            <h3 className="text-sm font-extrabold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping shrink-0" />
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 absolute shrink-0" />
              Live Sports Fixtures
            </h3>

            {sportsMatchesLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-7 h-7 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (() => {
              const query = sportsSearchQuery.toLowerCase().trim();
              const filtered = sportsMatches.filter(m => {
                if (!query) return true;
                return (
                  m.event?.toLowerCase().includes(query) ||
                  m.sport?.toLowerCase().includes(query)
                );
              });

              if (filtered.length === 0) {
                return (
                  <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-8 text-center text-zinc-500 text-xs">
                    No active live matches found matching your search.
                  </div>
                );
              }

              // Group by sport category
              const groups: { [key: string]: typeof sportsMatches } = {};
              filtered.forEach(m => {
                const sp = m.sport || 'General Sports';
                if (!groups[sp]) groups[sp] = [];
                groups[sp].push(m);
              });

              return (
                <div className="space-y-8">
                  {Object.entries(groups).map(([sportName, items]) => (
                    <div key={sportName} className="space-y-3">
                      <h4 className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                        <Trophy size={12} className="text-amber-500" />
                        {sportName}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {items.map((match, idx) => (
                          <div
                            key={idx}
                            className="bg-zinc-900/60 border border-zinc-850 hover:border-amber-500/20 rounded-2xl p-4 flex items-center justify-between gap-4 transition-all hover:bg-zinc-900/90 group"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 text-[9px] text-zinc-500 font-extrabold uppercase tracking-wider mb-1.5">
                                <span className="flex items-center gap-1 bg-red-950/40 text-red-400 px-2 py-0.5 rounded border border-red-900/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                  {match.time || 'LIVE'}
                                </span>
                                <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-white/5 font-bold">
                                  {match.channels?.length || 0} Servers
                                </span>
                              </div>
                              <h4 className="text-zinc-200 font-black text-xs leading-snug group-hover:text-white transition-colors truncate">
                                {match.event}
                              </h4>
                            </div>
                            <button
                              onClick={() => setSelectedSportMatch(match)}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-black rounded-xl flex items-center gap-1 transition-all border border-amber-600 active:scale-95 shrink-0"
                            >
                              <Play size={10} className="fill-black" /> Watch
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>


          {/* ── Sport Match Watch Drawer (rbtv+ style) ── */}
          {selectedSportMatch && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-black/85 backdrop-blur-sm animate-in fade-in">
              <div className="w-full sm:max-w-md h-[55vh] sm:h-[60vh] bg-zinc-950 border border-zinc-900 sm:border-l rounded-t-3xl sm:rounded-2xl overflow-y-auto relative flex flex-col p-6 shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-right duration-300">
                
                <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-5 shrink-0">
                  <div className="flex items-center gap-2">
                    <Trophy className="text-amber-500" size={16} />
                    <span className="text-zinc-200 font-extrabold text-xs sm:text-sm truncate max-w-[200px] sm:max-w-[240px]">
                      {selectedSportMatch.event}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedSportMatch(null)}
                    className="p-1 bg-zinc-900 hover:bg-zinc-800 rounded-full border border-white/5 text-zinc-400 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Match Status Details */}
                <div className="flex flex-col items-center justify-center gap-1.5 p-4 bg-zinc-900/50 rounded-2xl border border-zinc-900 mb-6 text-center">
                  <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider">{selectedSportMatch.sport}</span>
                  <div className="flex items-center gap-3 text-sm font-black text-white mt-1">
                    <span>{selectedSportMatch.event}</span>
                  </div>
                  <span className="text-[10px] text-amber-500 font-black uppercase flex items-center gap-1 mt-1 bg-amber-950/20 px-2 py-0.5 rounded border border-amber-900/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Kickoff: {selectedSportMatch.time || 'Live Now'}
                  </span>
                </div>

                {/* Server Selection list (rbtv+ style) */}
                <div className="flex-1 flex flex-col justify-center">
                  <p className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider mb-3.5">Select Streaming Server</p>
                  
                  <div className="grid grid-cols-1 gap-2.5">
                    {selectedSportMatch.channels && selectedSportMatch.channels.length > 0 ? (
                      selectedSportMatch.channels.map((srv: any, index: number) => (
                        <button
                          key={index}
                          onClick={() => {
                            setActiveSportsPlayer({
                              channelId: srv.id,
                              title: `${selectedSportMatch.event} (${srv.name})`
                            });
                            setSelectedSportMatch(null);
                          }}
                          className="w-full flex items-center justify-between p-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 hover:border-amber-500/30 rounded-xl text-left transition-all group"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-black text-zinc-100 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Server {index + 1}
                            </p>
                            <p className="text-[9px] text-zinc-500 font-semibold mt-0.5">{srv.name}</p>
                          </div>
                          <Play size={12} className="text-zinc-600 group-hover:text-amber-400 group-hover:fill-amber-400 transition-colors shrink-0" />
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-6 text-xs text-zinc-500">
                        No active channels mapped to this event. Try fallback broadcast channels below.
                      </div>
                    )}
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* Curated 24/7 Broadcast Channels */}
          <div className="mt-8 border-t border-zinc-900 pt-8 mb-6">
            <h3 className="text-sm font-extrabold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Tv size={14} />
              Live Sports Broadcast Channels
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                { id: 28, name: 'SuperSport Premier League', theme: 'from-red-600/10 to-zinc-900 border-red-500/20 text-orange-400 hover:border-orange-500/40' },
                { id: 45, name: 'SuperSport La Liga', theme: 'from-indigo-600/10 to-zinc-900 border-indigo-500/20 text-indigo-400 hover:border-indigo-500/40' },
                { id: 31, name: 'SuperSport Football', theme: 'from-emerald-600/10 to-zinc-900 border-emerald-500/20 text-emerald-400 hover:border-emerald-500/40' },
                { id: 27, name: 'SuperSport Grandstand', theme: 'from-amber-600/10 to-zinc-900 border-amber-500/20 text-amber-400 hover:border-amber-500/40' },
                { id: 3, name: 'Sky Sports Premier League', theme: 'from-red-600/10 to-zinc-900 border-red-500/20 text-red-400 hover:border-red-500/40' },
                { id: 2, name: 'Sky Sports Main Event', theme: 'from-zinc-700/10 to-zinc-900 border-zinc-500/20 text-zinc-400 hover:border-zinc-500/40' },
                { id: 18, name: 'TNT Sports 1', theme: 'from-pink-600/10 to-zinc-900 border-pink-500/20 text-pink-400 hover:border-pink-500/40' },
                { id: 19, name: 'TNT Sports 2', theme: 'from-violet-600/10 to-zinc-900 border-violet-500/20 text-violet-400 hover:border-violet-500/40' },
                { id: 33, name: 'ESPN US', theme: 'from-red-600/10 to-zinc-900 border-red-500/20 text-red-500 hover:border-red-500/40' },
                { id: 34, name: 'ESPN 2 US', theme: 'from-zinc-700/10 to-zinc-900 border-zinc-500/20 text-zinc-400 hover:border-zinc-500/40' },
                { id: 39, name: 'beIN Sports US', theme: 'from-blue-600/10 to-zinc-900 border-blue-500/20 text-blue-400 hover:border-blue-500/40' },
                { id: 46, name: 'LaLiga TV', theme: 'from-amber-600/10 to-zinc-900 border-amber-500/20 text-amber-400 hover:border-amber-500/40' },
              ].map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setActiveSportsPlayer({ channelId: ch.id, title: ch.name })}
                  className={`relative flex flex-col p-4 bg-gradient-to-br ${ch.theme} rounded-2xl border text-left hover:scale-[1.02] transition-all hover:shadow-lg hover:shadow-black/50 group`}
                >
                  <span className="text-[8px] uppercase font-extrabold tracking-widest text-zinc-500">Live Network Feed</span>
                  <span className="text-zinc-200 font-extrabold text-xs mt-1.5 leading-tight group-hover:text-white transition-colors">{ch.name}</span>
                  <div className="mt-4 flex items-center justify-between w-full">
                    <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-zinc-400 font-bold border border-white/5">24/7 TV</span>
                    <Play size={10} className="text-zinc-500 group-hover:text-amber-400 transition-colors shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>
      )}



      {/* ── Movies & Shows Tab ── */}
      {activeTab === 'movies' && (
        <>
          {/* Hero Banner */}
          {!isSearching && featured && (
            <section className="relative w-full h-[56vh] sm:h-[75vh] flex flex-col justify-end overflow-hidden">
              <div className="absolute inset-0">
                <img src={getBackdrop(featured)} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-black/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent" />
              </div>
              <div className="container mx-auto px-4 pb-8 sm:pb-14 relative z-10 max-w-3xl">
                <span className="bg-amber-500 text-black text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 mb-3">
                  <Film size={10} className="fill-current" /> Featured
                </span>
                <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight">
                  {featured.title || featured.name}
                </h1>
                <div className="flex items-center gap-2 mt-2 text-xs text-zinc-300 font-semibold flex-wrap">
                  {(featured.vote_average ?? 0) > 0 && (
                    <span className="text-amber-400 flex items-center gap-0.5">
                      <Star size={12} className="fill-current" />{getRating(featured)}
                    </span>
                  )}
                  {getYear(featured) && <><span>·</span><span>{getYear(featured)}</span></>}
                  <span>·</span>
                  <span className="uppercase bg-zinc-800 px-2 py-0.5 rounded text-[9px] font-bold">{featured.media_type}</span>
                </div>
                <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed max-w-lg mt-3 line-clamp-3">{featured.overview}</p>
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => handlePlayMedia(featured)}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold px-6 py-2.5 text-xs sm:text-sm rounded-full flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/30"
                  >
                    <Play size={15} className="fill-current" /> Watch Now
                  </button>
                  <button
                    onClick={() => handleOpenDetails(featured)}
                    className="bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold px-6 py-2.5 text-xs sm:text-sm rounded-full flex items-center gap-2 backdrop-blur-md"
                  >
                    <Info size={15} /> More Info
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Main Content Area */}
          <main className="container mx-auto px-4 py-6 flex-1">

            {/* ── Data Saver Banner (auto-shown on 2G/slow networks) ── */}
            {dataSaver && (
              <div className="mb-4 flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5">
                <span className="text-emerald-400 text-sm">📶</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-emerald-400">Data Saver Active</p>
                  <p className="text-[10px] text-zinc-500">Slow connection detected — lower-quality streams loaded to save your data</p>
                </div>
                <button onClick={() => setDataSaver(false)} className="text-zinc-600 hover:text-zinc-400 text-xs">✕</button>
              </div>
            )}

            {/* ── Time-aware greeting ── */}
            {!isSearching && (
              <p className="text-[10px] uppercase font-extrabold text-zinc-600 tracking-widest mb-4">
                {timeOfDay === 'night' ? '🌙 Late Night Cinema' : timeOfDay === 'morning' ? '☀️ Good Morning — Start Your Day' : '🔥 Popular Releases'}
              </p>
            )}

            {/* ── Continue Watching Row ── */}
            {!isSearching && continueWatching.length > 0 && (
              <div className="mb-7">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-extrabold text-zinc-300 flex items-center gap-1.5">
                    <Clock size={12} className="text-amber-500" /> Continue Watching
                  </p>
                  <button
                    onClick={() => {
                      localStorage.removeItem('realssa:continue_watching');
                      setContinueWatching([]);
                    }}
                    className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {continueWatching.map(item => (
                    <button
                      key={`${item.tmdbId}-${item.season}-${item.episode}`}
                      onClick={() => setActivePlayer({
                        tmdbId: item.tmdbId,
                        mediaType: item.mediaType,
                        season: item.season,
                        episode: item.episode,
                        title: item.title,
                      })}
                      className="flex-shrink-0 w-28 group"
                    >
                      <div className="relative w-28 h-40 rounded-xl overflow-hidden border border-zinc-800 group-hover:border-amber-500/50 transition-all">
                        {item.poster
                          ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                          : <div className="w-full h-full bg-zinc-900 flex items-center justify-center"><Film size={24} className="text-zinc-700" /></div>
                        }
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
                            <Play size={14} className="fill-black ml-0.5" />
                          </div>
                        </div>
                        {item.mediaType === 'tv' && (
                          <div className="absolute bottom-1.5 left-1.5 bg-black/70 text-[9px] font-bold text-amber-400 px-1.5 py-0.5 rounded backdrop-blur-sm">
                            S{item.season}E{item.episode}
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1 truncate text-left">{item.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Search Bar with Live Autocomplete ── */}
            <div ref={searchRef} className="relative w-full max-w-xl mx-auto mb-8">
              <form onSubmit={handleSearch} className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Search any movie or TV show..."
                  value={searchQuery}
                  onChange={e => handleSearchInput(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 text-zinc-200 placeholder-zinc-500 rounded-full pl-5 pr-14 py-3 text-sm outline-none transition-colors"
                />
                <button
                  type="submit"
                  className="absolute right-2 p-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-full transition-colors"
                >
                  {searchLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
              </form>

              {/* ── Live Autocomplete Dropdown ── */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full mt-2 left-0 right-0 bg-zinc-900/98 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/80 z-50 overflow-hidden backdrop-blur-sm">
                  <p className="text-[9px] uppercase font-extrabold text-zinc-600 px-4 pt-3 pb-1 tracking-widest">Suggestions</p>
                  {suggestions.map(item => (
                    <button
                      key={item.id}
                      onMouseDown={() => handleSuggestionClick(item)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 transition-colors text-left"
                    >
                      {getPoster(item) ? (
                        <img
                          src={getPoster(item)!}
                          alt=""
                          className="w-9 h-12 object-cover rounded-lg shrink-0 border border-white/5"
                        />
                      ) : (
                        <div className="w-9 h-12 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 border border-white/5 text-zinc-500">
                          {item.media_type === 'tv' ? <Tv size={14} /> : <Film size={14} />}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-zinc-100 truncate">{item.title || item.name}</p>
                        <p className="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
                          {item.media_type === 'tv' ? <Tv size={9} /> : <Film size={9} />}
                          <span className="uppercase font-bold">{item.media_type === 'tv' ? 'Series' : 'Movie'}</span>
                          {getYear(item) && <><span>·</span><span>{getYear(item)}</span></>}
                          {(item.vote_average ?? 0) > 0 && (
                            <span className="text-amber-400 flex items-center gap-0.5 ml-1">
                              <Star size={9} className="fill-current" />{getRating(item)}
                            </span>
                          )}
                        </p>
                      </div>
                      <Play size={14} className="text-zinc-600 shrink-0" />
                    </button>
                  ))}
                  <div className="border-t border-zinc-800 px-4 py-2">
                    <button
                      onMouseDown={(e) => { e.preventDefault(); handleSearch(e as any); }}
                      className="text-xs text-amber-500 font-bold hover:text-amber-400"
                    >
                      See all results for "{searchQuery}" →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Search Results Grid ── */}
            {isSearching && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-extrabold text-white">
                    Results for <span className="text-amber-400">"{searchQuery}"</span>
                  </h3>
                  <button
                    onClick={() => { setIsSearching(false); setSearchResults([]); setSearchQuery(''); }}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors"
                  >
                    <X size={12} /> Clear
                  </button>
                </div>
                {searchLoading ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="aspect-[2/3] bg-zinc-900 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                    {searchResults.map(item => <MediaCard key={item.id} item={item} />)}
                  </div>
                ) : (
                  <div className="text-center py-16 text-zinc-600 flex flex-col items-center gap-3">
                    <EyeOff size={36} />
                    <p className="text-sm">No results for "{searchQuery}"</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Catalog: Two-section vertical scroll ── */}
            {!isSearching && (
              <div className="space-y-10">

                {/* Loading shimmer */}
                {loading && (
                  <>
                    <div>
                      <div className="h-5 w-40 bg-zinc-900 rounded-full animate-pulse mb-4" />
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                        {[...Array(12)].map((_, i) => (
                          <div key={i} className="aspect-[2/3] bg-zinc-900 rounded-xl animate-pulse" />
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {!loading && (
                  <>
                    {/* Popular Movies */}
                    {movies.length > 0 && (
                      <div>
                        <h3 className="text-base sm:text-lg font-extrabold text-white mb-4 flex items-center gap-2">
                          🔥 Popular Movies
                        </h3>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                          {movies.map(item => <MediaCard key={item.id} item={item} />)}
                        </div>
                      </div>
                    )}

                    {/* Trending Series */}
                    {shows.length > 0 && (
                      <div>
                        <h3 className="text-base sm:text-lg font-extrabold text-white mb-4 flex items-center gap-2">
                          📺 Trending Series
                        </h3>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                          {shows.map(item => <MediaCard key={item.id} item={item} />)}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ── Infinite Scroll Sentinel ── */}
                <div ref={sentinelRef} className="py-4 flex items-center justify-center">
                  {loadingMore && (
                    <div className="flex items-center gap-2 text-zinc-500 text-xs font-semibold">
                      <Loader2 size={16} className="animate-spin text-amber-500" />
                      Loading more...
                    </div>
                  )}
                  {!hasMore && !loading && (
                    <p className="text-zinc-700 text-xs">You've seen everything — check back later for new releases.</p>
                  )}
                </div>

              </div>
            )}
          </main>
        </>
      )}

      {/* ── Detail Drawer ── */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="w-full sm:max-w-xl h-[93vh] sm:h-[90vh] bg-zinc-950 border border-zinc-900 sm:border-l rounded-t-3xl sm:rounded-2xl overflow-y-auto relative flex flex-col shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-right duration-300">

            {/* Backdrop */}
            <div className="relative h-52 sm:h-64 w-full shrink-0 bg-zinc-900">
              {getBackdrop(selectedMedia) ? (
                <img src={getBackdrop(selectedMedia)!} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-black/30 to-transparent" />
              <button
                onClick={() => setSelectedMedia(null)}
                className="absolute top-4 right-4 p-2 bg-black/70 hover:bg-zinc-800 rounded-full border border-white/10 text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 flex-1 flex flex-col gap-5">
              <div>
                <span className="bg-zinc-800 text-zinc-300 text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-full">
                  {selectedMedia.media_type === 'movie' ? '🎬 Movie' : '📺 TV Series'}
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-2 leading-snug">
                  {selectedMedia.title || selectedMedia.name}
                </h2>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-400 font-semibold flex-wrap">
                  {(selectedMedia.vote_average ?? 0) > 0 && (
                    <span className="text-amber-400 flex items-center gap-0.5">
                      <Star size={11} className="fill-current" />{getRating(selectedMedia)}
                    </span>
                  )}
                  {getYear(selectedMedia) && <><span>·</span><span>{getYear(selectedMedia)}</span></>}
                  {mediaDetails?.runtime && <><span>·</span><span className="flex items-center gap-0.5"><Clock size={11} />{mediaDetails.runtime}m</span></>}
                </div>
                {mediaDetails?.genres?.length > 0 && (
                  <p className="text-[10px] text-zinc-600 uppercase font-bold mt-1.5 tracking-wide">
                    {formatGenres(mediaDetails.genres)}
                  </p>
                )}

                {/* Watchmode Streaming Availability Badges */}
                {mediaDetails?.streaming_sources?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[9px] uppercase font-extrabold text-zinc-600 tracking-widest mb-2">Also streaming on</p>
                    <div className="flex flex-wrap gap-1.5">
                      {mediaDetails.streaming_sources.map((src: any, i: number) => (
                        <span
                          key={i}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                            src.type === 'free'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                          }`}
                        >
                          {src.type === 'free' ? '🆓 ' : ''}{src.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-[10px] uppercase font-extrabold text-zinc-500 tracking-wider mb-1.5">Synopsis</h4>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">{selectedMedia.overview}</p>
              </div>


              {detailsLoading ? (
                <div className="flex justify-center p-8">
                  <div className="w-7 h-7 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="border-t border-zinc-900 pt-4 flex flex-col gap-4">
                  {/* Share buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const title = selectedMedia.title || selectedMedia.name || 'Movie';
                        const url = `https://www.realssanews.com.ng/videos?id=${selectedMedia.id}&type=${selectedMedia.media_type || 'movie'}`;
                        const text = `🍿 Watch "${title}" on RealSSA Cinema! Streaming is super fast and saves 80% data:\n\n${url}`;
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      <Share2 size={13} /> WhatsApp
                    </button>
                    <button
                      onClick={() => {
                        const title = selectedMedia.title || selectedMedia.name || 'Movie';
                        const url = `https://www.realssanews.com.ng/videos?id=${selectedMedia.id}&type=${selectedMedia.media_type || 'movie'}`;
                        const text = `🍿 Watch "${title}" on RealSSA Cinema! Streaming is super fast and saves 80% data:\n\n${url}`;
                        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      <Share2 size={13} /> Telegram
                    </button>
                  </div>

                  {selectedMedia.media_type === 'movie' ? (
                    // Movie play button
                    <div>
                      <button
                        onClick={() => handlePlayMedia(selectedMedia)}
                        className="w-full flex items-center justify-center gap-2.5 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 rounded-2xl font-extrabold text-black text-sm shadow-lg shadow-amber-500/25 transition-all active:scale-95"
                      >
                        <Play size={18} className="fill-black" /> Watch Now
                      </button>
                      <p className="text-[10px] text-zinc-600 text-center mt-2">Server 1 plays instantly · Tap Servers to switch</p>
                    </div>
                  ) : (
                    // TV episodes
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">Episodes</h4>
                        {seasons.length > 1 && (
                          <select
                            value={selectedSeasonNum}
                            onChange={e => handleSeasonChange(parseInt(e.target.value))}
                            className="bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500"
                          >
                            {seasons.map(s => (
                              <option key={s.id} value={s.season_number}>
                                {s.name || `Season ${s.season_number}`}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      {episodesLoading ? (
                        <div className="flex justify-center p-6">
                          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="space-y-2 pr-1">
                          {episodes.map(ep => (
                            <button
                              key={ep.id}
                              onClick={() => handleEpisodeSelect(ep)}
                              className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-200 ${
                                selectedEpisode?.id === ep.id
                                  ? 'bg-amber-500/10 border-amber-500/40'
                                  : 'bg-zinc-900/60 border-zinc-900 hover:border-zinc-700 hover:bg-zinc-900'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-zinc-200 truncate">
                                  Ep {ep.episode_number}: {ep.name}
                                </p>
                                <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{ep.overview}</p>
                              </div>
                              <div className="ml-3 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-md shrink-0">
                                <Play size={12} className="fill-black ml-0.5" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── RealSSA Player ── */}
      {activePlayer && (
        <CinemaPlayer
          tmdbId={activePlayer.tmdbId}
          mediaType={activePlayer.mediaType}
          season={activePlayer.season}
          episode={activePlayer.episode}
          title={activePlayer.title}
          onClose={() => setActivePlayer(null)}
        />
      )}
      {/* ── RealSSA Sports Player ── */}
      {activeSportsPlayer && (
        <SportsPlayer
          channelId={activeSportsPlayer.channelId}
          title={activeSportsPlayer.title}
          onClose={() => setActiveSportsPlayer(null)}
        />
      )}


      <Footer />
    </div>
  );
}
