import React, { useState, useEffect, useRef, useCallback } from 'react';
import VideoNews from "@/pages/VideoNews";
import { Play, Info, Search, Star, Film, Tv, X, Clock, EyeOff, Youtube, Loader2, Share2, Activity, Shield, Trophy } from 'lucide-react';
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import { apiUrl } from "@/lib/api-base";
import CinemaPlayer from "@/components/CinemaPlayer";
import SportsPlayer from "@/components/SportsPlayer";
import Header from "@/components/Header";
import ReadProgressBar from "@/components/ReadProgressBar";

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

const FALLBACK_CATALOG: MovieOrShow[] = [
  {
    id: 572802,
    title: "Spider-Man: Brand New Day",
    overview: "Peter Parker's life is turned upside down when a new villain emerges in New York, forcing him to balance his personal life with his heroic duties.",
    poster_path: "/iPOn6DinuVyLY17YM9mKuPofV08.jpg",
    backdrop_path: "/5rhTDKUhPYvpdQIijFIs5VoWsON.jpg",
    r2_poster_url: "https://image.tmdb.org/t/p/w500/iPOn6DinuVyLY17YM9mKuPofV08.jpg",
    r2_backdrop_url: "https://image.tmdb.org/t/p/original/5rhTDKUhPYvpdQIijFIs5VoWsON.jpg",
    release_date: "2024-05-15",
    vote_average: 7.9,
    media_type: "movie"
  },
  {
    id: 124364,
    name: "House of the Dragon",
    overview: "The story of the House Targaryen, set 200 years before the events of Game of Thrones.",
    poster_path: "/7V0Ebks0GgpKvQ7QbLAIdX5dos4.jpg",
    backdrop_path: "/7V0Ebks0GgpKvQ7QbLAIdX5dos4.jpg",
    r2_poster_url: "https://image.tmdb.org/t/p/w500/7V0Ebks0GgpKvQ7QbLAIdX5dos4.jpg",
    r2_backdrop_url: "https://image.tmdb.org/t/p/original/7V0Ebks0GgpKvQ7QbLAIdX5dos4.jpg",
    first_air_date: "2022-08-21",
    vote_average: 8.4,
    media_type: "tv"
  },
  {
    id: 119051,
    name: "Reacher",
    overview: "Jack Reacher, a veteran military police investigator, is falsely accused of murder and finds himself in the middle of a deadly conspiracy.",
    poster_path: "/f1VCQIG2iCyOookdgOzwtUpwWC0.jpg",
    backdrop_path: "/f1VCQIG2iCyOookdgOzwtUpwWC0.jpg",
    r2_poster_url: "https://image.tmdb.org/t/p/w500/f1VCQIG2iCyOookdgOzwtUpwWC0.jpg",
    r2_backdrop_url: "https://image.tmdb.org/t/p/original/f1VCQIG2iCyOookdgOzwtUpwWC0.jpg",
    first_air_date: "2022-02-04",
    vote_average: 8.1,
    media_type: "tv"
  },
  {
    id: 823464,
    title: "Godzilla x Kong: The New Empire",
    overview: "Two ancient titans, Godzilla and Kong, clash in an epic battle as humans unravel their intertwined origins and connection to Skull Island.",
    poster_path: "/bMG4TxKlN6u865rLE75n7LIaz6l.jpg",
    backdrop_path: "/jv46Jy02FTQz3m6Ri46JmU4866s.jpg",
    r2_poster_url: "https://image.tmdb.org/t/p/w500/bMG4TxKlN6u865rLE75n7LIaz6l.jpg",
    r2_backdrop_url: "https://image.tmdb.org/t/p/original/jv46Jy02FTQz3m6Ri46JmU4866s.jpg",
    release_date: "2024-03-27",
    vote_average: 7.2,
    media_type: "movie"
  }
];

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

  // Horizontal scroll rail refs
  const movieRailRef = useRef<HTMLDivElement>(null);
  const showRailRef = useRef<HTMLDivElement>(null);

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
  const [selectedSportFilter, setSelectedSportFilter] = useState('All');

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

    // Skip inspect/anti-hack loops on mobile to avoid background thread CPU throttling
    const isMobile = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) return;

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

    // 4. Anti-DevTools Debugger Loop (checked every 3 seconds)
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
    }, 3000);

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
      if (isFirst) {
        setCatalog(FALLBACK_CATALOG);
        const pool = FALLBACK_CATALOG.filter(i => i.backdrop_path && i.overview && (i.vote_average ?? 0) >= 6);
        setHeroPool(pool);
        setFeatured(pool[0] || FALLBACK_CATALOG[0] || null);
        setHeroIdx(0);
        setHasMore(false);
      }
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

  const handleNextHero = () => {
    if (heroPool.length === 0) return;
    const next = (heroIdx + 1) % heroPool.length;
    setHeroIdx(next);
    setFeatured(heroPool[next]);
  };

  const handlePrevHero = () => {
    if (heroPool.length === 0) return;
    const prev = (heroIdx - 1 + heroPool.length) % heroPool.length;
    setHeroIdx(prev);
    setFeatured(heroPool[prev]);
  };

  const scrollRail = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const { scrollLeft, clientWidth } = ref.current;
      const offset = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      ref.current.scrollTo({ left: scrollLeft + offset, behavior: 'smooth' });
    }
  };

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
        className="group relative cursor-pointer rounded-2xl overflow-hidden border border-white/5 hover:border-amber-500/35 transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_12px_28px_rgba(0,0,0,0.85),0_8px_24px_rgba(245,158,11,0.12)] bg-zinc-900 aspect-[2/3] select-none"
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={item.title || item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-950 flex flex-col items-center justify-center p-3 text-center">
            <div className="w-10 h-10 rounded-full bg-zinc-800/80 flex items-center justify-center mb-2.5 text-zinc-500 group-hover:text-amber-400 group-hover:bg-amber-500/10 transition-colors">
              {item.media_type === 'tv' ? <Tv size={18} /> : <Film size={18} />}
            </div>
            <p className="text-zinc-400 text-[10px] font-extrabold max-w-full truncate px-1 uppercase tracking-wider">
              {item.media_type === 'tv' ? 'TV Series' : 'Movie'}
            </p>
          </div>
        )}
        
        {/* Shadow Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />

        {/* Ambient top highlight */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Play Icon Badge */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100">
          <div className="w-12 h-12 bg-amber-500 hover:bg-amber-400 text-black rounded-full flex items-center justify-center shadow-xl shadow-amber-500/25 active:scale-90 transition-transform">
            <Play size={20} className="fill-black ml-1" />
          </div>
        </div>

        {/* Card Metadata info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
          <p className="text-white text-xs font-black leading-tight line-clamp-1 group-hover:line-clamp-2 transition-all">{item.title || item.name}</p>
          <div className="flex items-center gap-1.5 mt-1 opacity-80 group-hover:opacity-100 transition-opacity">
            {(item.vote_average ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-amber-400 text-[9px] font-bold bg-amber-500/10 px-1 py-0.5 rounded">
                <Star size={9} className="fill-current" />{getRating(item)}
              </span>
            )}
            {getYear(item) && <span className="text-zinc-400 text-[9px] font-bold">{getYear(item)}</span>}
            <span className="ml-auto text-[8px] uppercase font-black bg-zinc-800/80 px-1.5 py-0.5 rounded text-zinc-400 border border-white/5">
              {item.media_type === 'tv' ? 'TV' : 'FILM'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <ReadProgressBar />
      <Header />

      {/* ── Tab Bar — Floating Glassmorphic Pill ── */}
      <div className="sticky top-16 z-40 px-4 py-3 flex justify-center pointer-events-none">
        <div className="pointer-events-auto bg-zinc-950/65 backdrop-blur-2xl border border-white/10 p-1.5 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)] flex items-center gap-1 max-w-full overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('movies')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-300 select-none ${
              activeTab === 'movies'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md shadow-amber-500/20 font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Film size={14} className={activeTab === 'movies' ? 'fill-black' : ''} />
            <span className="whitespace-nowrap">Movies & Shows</span>
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-300 select-none ${
              activeTab === 'news'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md shadow-amber-500/20 font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Youtube size={14} />
            <span className="whitespace-nowrap">Live News</span>
          </button>
          <button
            onClick={() => setActiveTab('sports')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-300 select-none ${
              activeTab === 'sports'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md shadow-amber-500/20 font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity size={14} />
            <span className="whitespace-nowrap">Live Sports</span>
          </button>
        </div>
      </div>

      {/* ── Live News Tab ── */}
      {activeTab === 'news' && (
        <div className="flex-1 overflow-auto">
          <VideoNews isEmbedded={true} />
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
            <p className="text-xs text-zinc-400 font-semibold mt-1">Search active clubs or leagues to stream any match live in HD with redirect-hijack protection.</p>
          </div>


          {/* Search Live Matches & Clubs */}
          <div className="relative w-full max-w-md mx-auto mb-6">
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

          {/* Sport Filter Tabs (Pills) */}
          <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none shrink-0">
            {['All', 'Football', 'Basketball', 'F1 / Motor', 'Combat', 'Tennis', 'Other'].map(tab => (
              <button
                key={tab}
                onClick={() => setSelectedSportFilter(tab)}
                className={`px-4 py-2 rounded-full text-xs font-black transition-all shrink-0 active:scale-95 ${
                  selectedSportFilter === tab
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-850 hover:bg-zinc-850'
                }`}
              >
                {tab === 'Football' ? '⚽ ' : tab === 'Basketball' ? '🏀 ' : tab === 'F1 / Motor' ? '🏎️ ' : tab === 'Combat' ? '🥊 ' : tab === 'Tennis' ? '🎾 ' : ''}
                {tab}
              </button>
            ))}
          </div>

          {/* Live Matches Scoreboard / Stream Center */}
          <div className="mb-10">
            <h3 className="text-sm font-extrabold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping shrink-0" />
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 absolute shrink-0" />
              Live Sports Fixtures
            </h3>

            {sportsMatchesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="bg-zinc-900/40 border border-zinc-850 rounded-2xl p-4 animate-pulse flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 bg-zinc-800 rounded w-1/3" />
                      <div className="h-4 bg-zinc-800 rounded w-2/3" />
                    </div>
                    <div className="w-16 h-8 bg-zinc-800 rounded-xl" />
                  </div>
                ))}
              </div>
            ) : (() => {
              const query = sportsSearchQuery.toLowerCase().trim();
              const filtered = sportsMatches.filter(m => {
                const matchesQuery = !query ||
                  m.event?.toLowerCase().includes(query) ||
                  m.sport?.toLowerCase().includes(query);

                if (!matchesQuery) return false;
                if (selectedSportFilter === 'All') return true;

                const sport = (m.sport || '').toLowerCase();
                if (selectedSportFilter === 'Football') {
                  return sport.includes('football') || sport.includes('soccer') || sport.includes('league') || sport.includes('champions');
                }
                if (selectedSportFilter === 'Basketball') {
                  return sport.includes('basketball') || sport.includes('nba');
                }
                if (selectedSportFilter === 'F1 / Motor') {
                  return sport.includes('f1') || sport.includes('formula') || sport.includes('racing') || sport.includes('motor');
                }
                if (selectedSportFilter === 'Combat') {
                  return sport.includes('ufc') || sport.includes('mma') || sport.includes('boxing') || sport.includes('wrestling') || sport.includes('fight') || sport.includes('combat');
                }
                if (selectedSportFilter === 'Tennis') {
                  return sport.includes('tennis');
                }
                // Other
                const known = ['football', 'soccer', 'league', 'champions', 'basketball', 'nba', 'f1', 'formula', 'racing', 'motor', 'ufc', 'mma', 'boxing', 'wrestling', 'fight', 'combat', 'tennis'];
                const isKnown = known.some(k => sport.includes(k));
                return !isKnown;
              });

              if (filtered.length === 0) {
                return (
                  <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-8 text-center text-zinc-500 text-xs">
                    No active live matches found matching your filters.
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
                        {items.map((match, idx) => {
                          const parseTeams = (event: string) => {
                            const delimiters = [' vs ', ' VS ', ' - ', ' @ '];
                            for (const d of delimiters) {
                              if (event.includes(d)) {
                                const parts = event.split(d);
                                return { home: parts[0].trim(), away: parts[1].trim() };
                              }
                            }
                            return { home: event, away: null };
                          };
                          const { home, away } = parseTeams(match.event);

                          return (
                            <div
                              key={idx}
                              className="bg-zinc-950/60 backdrop-blur-md border border-white/10 hover:border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between gap-3.5 transition-all hover:bg-zinc-900/45 group relative overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
                            >
                              {/* Upper banner row */}
                              <div className="flex items-center justify-between text-[9px] text-zinc-500 font-extrabold uppercase tracking-wider">
                                <span className="flex items-center gap-1 bg-red-950/40 text-red-400 px-2 py-0.5 rounded-full border border-red-900/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                  {match.time || 'LIVE'}
                                </span>
                                <span className="bg-white/5 text-zinc-400 px-2 py-0.5 rounded border border-white/5 font-extrabold">
                                  {match.sport || 'Sports'}
                                </span>
                              </div>

                              {/* Scoreboard body row */}
                              <div className="flex-1 flex flex-col gap-2">
                                {away ? (
                                  <>
                                    <div className="flex items-center gap-3">
                                      <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-[10px] font-black text-amber-500 select-none">
                                        {home.substring(0, 1)}
                                      </div>
                                      <span className="text-zinc-200 font-bold text-xs sm:text-[13px] group-hover:text-white transition-colors truncate">{home}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-[10px] font-black text-amber-500 select-none">
                                        {away.substring(0, 1)}
                                      </div>
                                      <span className="text-zinc-200 font-bold text-xs sm:text-[13px] group-hover:text-white transition-colors truncate">{away}</span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-[11px] font-bold text-amber-500">
                                      ⚽
                                    </div>
                                    <span className="text-zinc-200 font-bold text-xs sm:text-[13px] group-hover:text-white transition-colors line-clamp-2 leading-snug">{match.event}</span>
                                  </div>
                                )}
                              </div>

                              {/* Button action row */}
                              <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1.5">
                                <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                                  {match.id ? 'Direct stream' : 'Redirect lookup'}
                                </span>
                                <button
                                  onClick={() => setSelectedSportMatch(match)}
                                  className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-[11px] font-black rounded-lg flex items-center gap-1 transition-all active:scale-95 shadow-md shadow-amber-500/15 border border-amber-600"
                                >
                                  <Play size={10} className="fill-black" /> Watch Live
                                </button>
                              </div>
                            </div>
                          );
                        })}
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
              <div className="w-full sm:max-w-md h-auto max-h-[70vh] bg-zinc-950 border border-zinc-900 sm:border-l rounded-t-3xl sm:rounded-2xl overflow-y-auto relative flex flex-col p-6 shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-right duration-300">

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

                {/* Match info pill */}
                <div className="flex flex-col items-center gap-1.5 p-4 bg-zinc-900/50 rounded-2xl border border-zinc-900 mb-5 text-center">
                  <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider">{selectedSportMatch.sport}</span>
                  <div className="text-sm font-black text-white mt-1">{selectedSportMatch.event}</div>
                  <span className="text-[10px] text-amber-500 font-black uppercase flex items-center gap-1 mt-1 bg-amber-950/20 px-2 py-0.5 rounded border border-amber-900/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {selectedSportMatch.time || 'Live Now'}
                  </span>
                </div>

                {/* ── CASE A: Direct stream IDs from scraper ── */}
                {selectedSportMatch.channels && selectedSportMatch.channels.length > 0 ? (
                  <div className="flex-1 flex flex-col">
                    <p className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider mb-3">Select Streaming Server</p>
                    <div className="grid grid-cols-1 gap-2.5">
                      {selectedSportMatch.channels.map((srv: any, index: number) => (
                        <button
                          key={index}
                          onClick={() => {
                            setActiveSportsPlayer({
                              channelId: srv.id,
                              title: `${selectedSportMatch.event} · ${srv.name}`
                            });
                            setSelectedSportMatch(null);
                          }}
                          className="w-full flex items-center justify-between p-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/30 rounded-xl text-left transition-all group"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-black text-zinc-100 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Stream {index + 1} · {srv.name}
                            </p>
                          </div>
                          <Play size={12} className="text-zinc-600 group-hover:text-amber-400 group-hover:fill-amber-400 transition-colors shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* ── CASE B: ESPN match — no direct ID, open VIPRow/Strikeout homepage ── */
                  <div className="flex-1 flex flex-col">
                    <p className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider mb-3">Watch On</p>
                    <p className="text-[10px] text-zinc-600 mb-3 leading-relaxed">
                      Find <span className="text-zinc-400 font-bold">{selectedSportMatch.event}</span> on the streaming site and click to watch.
                    </p>
                    <div className="grid grid-cols-1 gap-2.5">
                      {[
                        { label: 'VIPRow', key: 'viprow', id: 'viprow-browse' },
                        { label: 'Strikeout', key: 'strikeout', id: 'strikeout-browse' },
                      ].map(srv => (
                        <button
                          key={srv.key}
                          onClick={() => {
                            setActiveSportsPlayer({
                              channelId: srv.key,
                              title: `${selectedSportMatch.event} — Find on ${srv.label}`
                            });
                            setSelectedSportMatch(null);
                          }}
                          className="w-full flex items-center justify-between p-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/30 rounded-xl text-left transition-all group"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-black text-zinc-100 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              Browse {srv.label}
                            </p>
                            <p className="text-[9px] text-zinc-500 mt-0.5">Find your match on {srv.label}'s schedule</p>
                          </div>
                          <Play size={12} className="text-zinc-600 group-hover:text-amber-400 transition-colors shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Live Sports Access — VIPRow · Strikeout */}
          <div className="mt-8 border-t border-zinc-900 pt-8 mb-6">
            <h3 className="text-sm font-extrabold text-zinc-400 uppercase tracking-widest mb-1 flex items-center gap-2">
              <Tv size={14} />
              Browse Live Sports By Category
            </h3>
            <p className="text-[10px] text-zinc-600 mb-5">All streams use VIPRow and Strikeout — 2 independent CDNs. If one server is blank, switch inside the player.</p>


            {/* ── Football / Soccer ── */}
            <p className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest mb-2.5">⚽ Football</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 mb-6">
              {[
                { id: 'football', name: 'Live Football', theme: 'from-emerald-600/10 to-zinc-900 border-emerald-500/20 text-emerald-400 hover:border-emerald-500/40' },
                { id: 'premier-league', name: 'Premier League', theme: 'from-purple-600/10 to-zinc-900 border-purple-500/20 text-purple-400 hover:border-purple-500/40' },
                { id: 'la-liga', name: 'La Liga', theme: 'from-red-600/10 to-zinc-900 border-red-500/20 text-red-400 hover:border-red-500/40' },
                { id: 'champions-league', name: 'Champions League', theme: 'from-blue-600/10 to-zinc-900 border-blue-500/20 text-blue-400 hover:border-blue-500/40' },
                { id: 'serie-a', name: 'Serie A', theme: 'from-indigo-600/10 to-zinc-900 border-indigo-500/20 text-indigo-400 hover:border-indigo-500/40' },
                { id: 'bundesliga', name: 'Bundesliga', theme: 'from-yellow-600/10 to-zinc-900 border-yellow-500/20 text-yellow-400 hover:border-yellow-500/40' },
                { id: 'ligue-1', name: 'Ligue 1', theme: 'from-sky-600/10 to-zinc-900 border-sky-500/20 text-sky-400 hover:border-sky-500/40' },
                { id: 'afcon', name: 'Africa / AFCON', theme: 'from-amber-600/10 to-zinc-900 border-amber-500/20 text-amber-400 hover:border-amber-500/40' },
              ].map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setActiveSportsPlayer({ channelId: ch.id, title: ch.name })}
                  className={`relative flex flex-col p-3.5 bg-gradient-to-br ${ch.theme} rounded-2xl border text-left hover:scale-[1.02] transition-all hover:shadow-lg hover:shadow-black/40 group`}
                >
                  <span className="text-[8px] uppercase font-extrabold tracking-widest text-zinc-500">Live Stream</span>
                  <span className="text-zinc-200 font-extrabold text-xs mt-1 leading-tight group-hover:text-white transition-colors">{ch.name}</span>
                  <div className="mt-3 flex items-center justify-between w-full">
                    <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-zinc-500 font-bold border border-white/5">VIPRow · Strikeout</span>
                    <Play size={10} className="text-zinc-500 group-hover:text-amber-400 transition-colors shrink-0" />
                  </div>
                </button>
              ))}
            </div>

            {/* ── Basketball & Combat Sports ── */}
            <p className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest mb-2.5">🏀 Basketball · 🥊 Combat</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 mb-6">
              {[
                { id: 'nba', name: 'NBA Basketball', theme: 'from-orange-600/10 to-zinc-900 border-orange-500/20 text-orange-400 hover:border-orange-500/40' },
                { id: 'boxing', name: 'Boxing', theme: 'from-red-600/10 to-zinc-900 border-red-500/20 text-red-400 hover:border-red-500/40' },
                { id: 'ufc', name: 'UFC / MMA', theme: 'from-rose-600/10 to-zinc-900 border-rose-500/20 text-rose-400 hover:border-rose-500/40' },
                { id: 'wrestling', name: 'WWE / Wrestling', theme: 'from-yellow-600/10 to-zinc-900 border-yellow-500/20 text-yellow-400 hover:border-yellow-500/40' },
              ].map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setActiveSportsPlayer({ channelId: ch.id, title: ch.name })}
                  className={`relative flex flex-col p-3.5 bg-gradient-to-br ${ch.theme} rounded-2xl border text-left hover:scale-[1.02] transition-all hover:shadow-lg hover:shadow-black/40 group`}
                >
                  <span className="text-[8px] uppercase font-extrabold tracking-widest text-zinc-500">Live Stream</span>
                  <span className="text-zinc-200 font-extrabold text-xs mt-1 leading-tight group-hover:text-white transition-colors">{ch.name}</span>
                  <div className="mt-3 flex items-center justify-between w-full">
                    <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-zinc-500 font-bold border border-white/5">VIPBox · Strikeout</span>
                    <Play size={10} className="text-zinc-500 group-hover:text-amber-400 transition-colors shrink-0" />
                  </div>
                </button>
              ))}
            </div>

            {/* ── Rugby, Cricket & Motorsport ── */}
            <p className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest mb-2.5">🏉 Rugby · 🏏 Cricket · 🏎️ Motorsport</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {[
                { id: 'rugby', name: 'Rugby Union / League', theme: 'from-green-600/10 to-zinc-900 border-green-500/20 text-green-400 hover:border-green-500/40' },
                { id: 'cricket', name: 'Cricket', theme: 'from-lime-600/10 to-zinc-900 border-lime-500/20 text-lime-400 hover:border-lime-500/40' },
                { id: 'f1', name: 'Formula 1', theme: 'from-red-700/10 to-zinc-900 border-red-600/20 text-red-400 hover:border-red-500/40' },
                { id: 'tennis', name: 'Tennis', theme: 'from-yellow-600/10 to-zinc-900 border-yellow-500/20 text-yellow-400 hover:border-yellow-500/40' },
              ].map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setActiveSportsPlayer({ channelId: ch.id, title: ch.name })}
                  className={`relative flex flex-col p-3.5 bg-gradient-to-br ${ch.theme} rounded-2xl border text-left hover:scale-[1.02] transition-all hover:shadow-lg hover:shadow-black/40 group`}
                >
                  <span className="text-[8px] uppercase font-extrabold tracking-widest text-zinc-500">Live Stream</span>
                  <span className="text-zinc-200 font-extrabold text-xs mt-1 leading-tight group-hover:text-white transition-colors">{ch.name}</span>
                  <div className="mt-3 flex items-center justify-between w-full">
                    <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-zinc-500 font-bold border border-white/5">VIPRow · VIPBox</span>
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
          {/* Interactive Hero Carousel */}
          {!isSearching && featured && (
            <section className="relative w-full h-[56vh] sm:h-[75vh] flex flex-col justify-end overflow-hidden group/hero">
              {/* Slides background with transition */}
              <div className="absolute inset-0 transition-all duration-700 ease-in-out">
                <img src={getBackdrop(featured)} alt="" className="w-full h-full object-cover animate-fade-in" />
                {/* Netflix-style vignette masks */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
              </div>

              {/* Chevrons - Left & Right manual controls */}
              {heroPool.length > 1 && (
                <>
                  <button
                    onClick={handlePrevHero}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 border border-white/10 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover/hero:opacity-100 transition-all duration-300 shadow-xl"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button
                    onClick={handleNextHero}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 border border-white/10 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover/hero:opacity-100 transition-all duration-300 shadow-xl"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </>
              )}

              {/* Main text overlay content */}
              <div className="container mx-auto px-4 pb-8 sm:pb-14 relative z-10 max-w-4xl flex items-end justify-between gap-6">
                <div className="max-w-2xl">
                  <span className="bg-gradient-to-r from-amber-500 to-amber-600 text-black text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full inline-flex items-center gap-1.5 mb-3 shadow-md">
                    <Film size={10} className="fill-current" /> Featured
                  </span>
                  <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight drop-shadow-md">
                    {featured.title || featured.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-2 text-xs text-zinc-300 font-semibold flex-wrap">
                    {(featured.vote_average ?? 0) > 0 && (
                      <span className="text-amber-400 flex items-center gap-0.5 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        <Star size={12} className="fill-current" />{getRating(featured)}
                      </span>
                    )}
                    {getYear(featured) && <><span>·</span><span>{getYear(featured)}</span></>}
                    <span>·</span>
                    <span className="uppercase bg-zinc-800 px-2 py-0.5 rounded text-[9px] font-black border border-white/5">{featured.media_type}</span>
                  </div>
                  <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed max-w-lg mt-3 line-clamp-2 sm:line-clamp-3">{featured.overview}</p>
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

                {/* Indicators - Bottom right pagination dots */}
                {heroPool.length > 1 && (
                  <div className="hidden sm:flex gap-1.5 mb-1.5">
                    {heroPool.slice(0, 6).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setHeroIdx(i);
                          setFeatured(heroPool[i]);
                        }}
                        className={`h-1.5 rounded-full transition-all duration-350 ${
                          i === heroIdx ? 'w-6 bg-amber-500 shadow-md shadow-amber-500/20' : 'w-1.5 bg-zinc-700 hover:bg-zinc-500'
                        }`}
                      />
                    ))}
                  </div>
                )}
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
                  className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-amber-500 text-zinc-200 placeholder-zinc-500 rounded-full pl-6 pr-14 py-3.5 text-sm outline-none transition-all duration-300 backdrop-blur-md shadow-inner shadow-black/40 focus:bg-white/10"
                />
                <button
                  type="submit"
                  className="absolute right-2.5 p-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-full transition-all duration-300 shadow-md shadow-amber-500/10 active:scale-90 flex items-center justify-center"
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
                    {/* Popular Movies Rail */}
                    {movies.length > 0 && (
                      <div className="relative group/rail">
                        <h3 className="text-base sm:text-lg font-black text-white mb-4 flex items-center gap-2 tracking-wide">
                          🔥 Popular Movies
                        </h3>
                        
                        {/* Left scroll button */}
                        <button
                          onClick={() => scrollRail(movieRailRef, 'left')}
                          className="absolute left-2 top-[55%] -translate-y-1/2 z-20 w-10 h-10 bg-black/60 hover:bg-black/90 text-white rounded-full flex items-center justify-center border border-white/10 opacity-0 group-hover/rail:opacity-100 transition-opacity duration-300 shadow-2xl backdrop-blur-md"
                        >
                          &lsaquo;
                        </button>

                        {/* Right scroll button */}
                        <button
                          onClick={() => scrollRail(movieRailRef, 'right')}
                          className="absolute right-2 top-[55%] -translate-y-1/2 z-20 w-10 h-10 bg-black/60 hover:bg-black/90 text-white rounded-full flex items-center justify-center border border-white/10 opacity-0 group-hover/rail:opacity-100 transition-opacity duration-300 shadow-2xl backdrop-blur-md"
                        >
                          &rsaquo;
                        </button>

                        {/* Horizontal track container */}
                        <div
                          ref={movieRailRef}
                          className="flex gap-3.5 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-none pb-4 pt-1 px-1 w-full overscroll-contain touch-pan-x"
                        >
                          {movies.map(item => (
                            <div key={item.id} className="flex-shrink-0 w-[30%] sm:w-[22%] md:w-[16%] lg:w-[12.5%] snap-start">
                              <MediaCard item={item} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trending Series Rail */}
                    {shows.length > 0 && (
                      <div className="relative group/rail mt-8">
                        <h3 className="text-base sm:text-lg font-black text-white mb-4 flex items-center gap-2 tracking-wide">
                          📺 Trending Series
                        </h3>
                        
                        {/* Left scroll button */}
                        <button
                          onClick={() => scrollRail(showRailRef, 'left')}
                          className="absolute left-2 top-[55%] -translate-y-1/2 z-20 w-10 h-10 bg-black/60 hover:bg-black/90 text-white rounded-full flex items-center justify-center border border-white/10 opacity-0 group-hover/rail:opacity-100 transition-opacity duration-300 shadow-2xl backdrop-blur-md"
                        >
                          &lsaquo;
                        </button>

                        {/* Right scroll button */}
                        <button
                          onClick={() => scrollRail(showRailRef, 'right')}
                          className="absolute right-2 top-[55%] -translate-y-1/2 z-20 w-10 h-10 bg-black/60 hover:bg-black/90 text-white rounded-full flex items-center justify-center border border-white/10 opacity-0 group-hover/rail:opacity-100 transition-opacity duration-300 shadow-2xl backdrop-blur-md"
                        >
                          &rsaquo;
                        </button>

                        {/* Horizontal track container */}
                        <div
                          ref={showRailRef}
                          className="flex gap-3.5 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-none pb-4 pt-1 px-1 w-full overscroll-contain touch-pan-x"
                        >
                          {shows.map(item => (
                            <div key={item.id} className="flex-shrink-0 w-[30%] sm:w-[22%] md:w-[16%] lg:w-[12.5%] snap-start">
                              <MediaCard item={item} />
                            </div>
                          ))}
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
                  {catalog.length === 0 && !loading ? (
                    <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-zinc-900/30 border border-white/5 rounded-2xl max-w-md mx-auto my-8 space-y-4 backdrop-blur-sm animate-fade-in w-full">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <Film size={24} />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-bold text-zinc-200">Cinema Catalog Offline</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed">Could not load streaming media list. Please check your network connection and try again.</p>
                      </div>
                      <button
                        onClick={() => fetchPage(1, true)}
                        className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-full transition-all active:scale-95 shadow-lg shadow-amber-500/10 flex items-center gap-1.5"
                      >
                        <span>Retry Connection</span>
                      </button>
                    </div>
                  ) : (
                    !hasMore && !loading && (
                      <p className="text-zinc-700 text-xs">You've seen everything — check back later for new releases.</p>
                    )
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
