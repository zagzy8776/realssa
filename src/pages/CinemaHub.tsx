import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import CinemaDialog from '@/components/CinemaDialog';
import './cinema.css';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Info, Search, Star, Film, Tv, X, Clock, EyeOff, Youtube, Loader2, Share2, Activity, Shield, Trophy, Clapperboard, MapPin } from 'lucide-react';
import { HighlightsModal } from '@/components/HighlightsPanel';
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import { apiUrl, API_BASE_URL } from "@/lib/api-base";
import { normalizeFeedMatches, type FeedMatch } from "@/lib/sportsMatchNormalize";
import Header from "@/components/Header";
import ReadProgressBar from "@/components/ReadProgressBar";
import SEO from "@/components/SEO";

const VideoNews = lazy(() => import("@/pages/VideoNews"));
const CinemaPlayer = lazy(() => import("@/components/CinemaPlayer"));
const SportsPlayer = lazy(() => import("@/components/SportsPlayer"));

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

const getPoster = (item: MovieOrShow) =>
  item.r2_poster_url || (item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : null);

const getBackdrop = (item: MovieOrShow) =>
  item.r2_backdrop_url || (item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null);

const getYear = (item: MovieOrShow) => {
  const d = item.release_date || item.first_air_date || '';
  return d ? d.substring(0, 4) : '';
};

const getRating = (item: MovieOrShow) => ((item.vote_average ?? 0)).toFixed(1);

const mediaKey = (item: MovieOrShow) => `${item.media_type}-${item.id}`;

async function cinemaJson(path: string, signal: AbortSignal) {
  const res = await fetch(`${API_BASE_URL}/api/cinema/${path}`, { signal });
  if (!res.ok) throw new Error(`Cinema returned HTTP ${res.status}`);
  return res.json();
}

function MediaCard({ item, onOpen }: { item: MovieOrShow; onOpen: (item: MovieOrShow) => void }) {
  const title = item.title || item.name || 'Untitled';
  const poster = getPoster(item);
  return (
    <button type="button" className="cinema-card" aria-label={`Open ${title}`} onClick={() => onOpen(item)}>
      <span className="cinema-poster">
        <Film aria-hidden size={24} />
        {poster && <img src={poster} alt="" loading="lazy" decoding="async"
          onError={event => { event.currentTarget.hidden = true; }} />}
      </span>
      <strong>{title}</strong>
      <span className="cinema-card-meta">
        {item.media_type === 'tv' ? 'Series' : 'Film'}{getYear(item) && ` · ${getYear(item)}`}
        {(item.vote_average ?? 0) > 0 && <span> ★ {getRating(item)}</span>}
      </span>
    </button>
  );
}

export default function CinemaHub() {
  const queryClient = useQueryClient();
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
  const seenIds = useRef(new Set<string>());
  const catalogPending = useRef(false);
  const [catalogError, setCatalogError] = useState(false);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [filter, setFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const term = searchQuery.trim().toLowerCase();
  const isSearching = term.length > 0;
  useEffect(() => {
    if (!term) return;
    const timer = window.setTimeout(() => setSubmitted(term), 220);
    return () => window.clearTimeout(timer);
  }, [term]);
  const search = useQuery({
    queryKey: ['cinema', 'search', term],
    enabled: !!term && submitted === term && activeTab === 'movies',
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async ({ signal }): Promise<MovieOrShow[]> => {
      const data = await cinemaJson(`search?q=${encodeURIComponent(term)}&catalog=tmdb`, signal);
      if (!Array.isArray(data.results)) throw new Error('Invalid search results');
      return data.results.filter((item: MovieOrShow) => item.media_type === 'movie' || item.media_type === 'tv');
    },
  });
  const localMatches = catalog.filter(item => (item.title || item.name || '').toLowerCase().includes(term));
  const remoteKeys = new Set(search.data?.map(mediaKey));
  const searchResults = [...(search.data || []), ...localMatches.filter(item => !remoteKeys.has(mediaKey(item)))];

  const [selectedMedia, setSelectedMedia] = useState<MovieOrShow | null>(null);
  const [seasonChoice, setSeasonChoice] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const details = useQuery({
    queryKey: ['cinema', 'details', selectedMedia?.media_type, selectedMedia?.id],
    enabled: !!selectedMedia,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: ({ signal }) => cinemaJson(`${selectedMedia!.media_type === 'tv' ? 'shows' : 'movies'}/${selectedMedia!.id}`, signal),
  });
  const mediaDetails = details.data;
  const allSeasons: { id: number; season_number: number; name: string }[] = mediaDetails?.seasons || [];
  const regularSeasons = allSeasons.filter(season => season.season_number > 0);
  const seasons = regularSeasons.length ? regularSeasons : allSeasons;
  const selectedSeasonNum = seasonChoice ?? seasons[0]?.season_number;
  const season = useQuery({
    queryKey: ['cinema', 'episodes', selectedMedia?.id, selectedSeasonNum],
    enabled: selectedMedia?.media_type === 'tv' && selectedSeasonNum != null,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: ({ signal }) => cinemaJson(`shows/${selectedMedia!.id}/season/${selectedSeasonNum}`, signal),
  });
  const episodes: Episode[] = season.data?.episodes || [];
  const episodesLoading = details.isFetching || season.isFetching;

  // Player
  const [activePlayer, setActivePlayer] = useState<{
    tmdbId: number; mediaType: 'movie' | 'tv'; season: number; episode: number; title: string;
  } | null>(null);

  // Sports Stream Player & Matches State
  const [activeSportsPlayer, setActiveSportsPlayer] = useState<{
    channelId: string | number; title: string;
    directSources?: any[]; home?: string | null; away?: string | null;
    homeCrest?: string | null; awayCrest?: string | null; isLive?: boolean;
    sport?: string | null; league?: string | null;
    liveConfidence?: { level: 'match' | 'channel' | 'generic' | 'none'; exact?: boolean; label?: string | null } | null;
    kickoff?: string | number | null;
    streamId?: string | number | null;
    exactEmbedUrl?: string | null;
    venue?: string | null;
  } | null>(null);
  const [sportsMatches, setSportsMatches] = useState<FeedMatch[]>([]);
  const [sportsSearchQuery, setSportsSearchQuery] = useState('');
  const [sportsTimeFilter, setSportsTimeFilter] = useState<'All' | 'Live' | 'Upcoming' | 'Results'>('All');
  const [highlightsMatch, setHighlightsMatch] = useState<{ id?: string; home: string; away: string; kickoff?: string | null; competition?: string | null; matchUrl?: string | null } | null>(null);
  const [sportsMatchesLoading, setSportsMatchesLoading] = useState(false);
  const [selectedSportMatch, setSelectedSportMatch] = useState<any | null>(null);
  const [selectedSportFilter, setSelectedSportFilter] = useState('All');

  // ── Deep-link handoff: the Sports page and the LiveScores widget "Watch"
  // buttons hand a fixture over via router state; once the feed (with
  // directSources + exact embed ids) has loaded, open it in OUR player so the
  // user watches that exact match instead of hunting through external sites.
  const handoffDone = useRef(false);
  const location = useLocation();
  useEffect(() => {
    if (handoffDone.current || activeSportsPlayer) return;
    const handoff = (location.state as { sportsMatch?: Record<string, unknown> } | null)?.sportsMatch;
    if (!handoff) return;
    const list = sportsMatches || [];
    if (!list.length) return;   // feed still loading — retry when it lands
    const norm = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const hh = norm(handoff.home), aa = norm(handoff.away);
    if (!hh || !aa) return;
    const overlap = (x: string, y: string) => !!x && !!y && (x === y || x.includes(y) || y.includes(x));
    const target = list.find((m: any) => {
      const h = norm(m.home), a = norm(m.away);
      return (overlap(h, hh) || overlap(h, aa)) && (overlap(a, aa) || overlap(a, hh));
    });
    if (!target) return;
    handoffDone.current = true;
    setActiveSportsPlayer({
      channelId: target.streamId || target.id || 'superabbit',
      title: target.event || `${handoff.home} vs ${handoff.away}`,
      directSources: target.directSources,
      home: target.home || (handoff.home as string) || null,
      away: target.away || (handoff.away as string) || null,
      homeCrest: target.homeCrest || null,
      awayCrest: target.awayCrest || null,
      isLive: !!target.isLive,
      sport: target.sport || (handoff.sport as string) || null,
      league: target.league || (handoff.league as string) || null,
      liveConfidence: target.liveConfidence || null,
      kickoff: target.kickoff ?? (handoff.kickoff as string) ?? null,
      streamId: target.streamId || null,
      exactEmbedUrl: target.exactEmbedUrl || null,
      venue: target.venue || null,
    });
    // Clear the state so a refresh does not re-open the player.
    window.history.replaceState({}, '');
  }, [location.state, sportsMatches, activeSportsPlayer]);

  // ── Continue Watching (localStorage persistence) ──
  const [continueWatching, setContinueWatching] = useState<Array<{
    tmdbId: number; title: string; poster: string | null;
    mediaType: 'movie' | 'tv'; season: number; episode: number; timestamp: number; position?: number; duration?: number;
  }>>([]);

  // ── Data Saver Mode (auto-detects Nigerian low-bandwidth connections) ──
  const [dataSaver, setDataSaver] = useState(false);

  // ── Time-aware content (night = thrillers, morning = news first) ──
  const [timeOfDay, setTimeOfDay] = useState<'night' | 'morning' | 'day'>('day');

  // ── Trailer preview on hero banner ──
  const [heroTrailerKey, setHeroTrailerKey] = useState<string | null>(null);

  // ── Initial Load ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedPage = Math.min(20, Math.max(1, parseInt(params.get('page') || '1', 10) || 1));
    fetchPage(requestedPage, true);
  }, []);

  // ── Load Sports Matches when activeTab === 'sports' (own native feed) ──
  //
  // The feed is a LIVE surface: a match that ends must leave the grid and the
  // next day's fixtures must arrive on their own. That needs a periodic
  // refresh, not a one-shot fetch on tab open — otherwise the page keeps
  // showing yesterday's card list until the user reloads.
  //
  // The backend already drops finished fixtures (FINISHED_KEEP_MS) and caches
  // the feed for 2 min, so a 90s poll is cheap and never hammers the upstream.
  const SPORTS_FEED_REFRESH_MS = 90_000;
  useEffect(() => {
    if (activeTab !== 'sports') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = (first: boolean) => {
      if (first) setSportsMatchesLoading(true);
      fetch(apiUrl('/api/sports/matches'))
        .then(r => {
          if (!cancelled) console.log('[Sports] API response status:', r.status, r.ok);
          return r.ok ? r.json() : null;
        })
        .then(data => {
          if (cancelled) return;
          // The endpoint answers with the rich camelCase feed, but the DB
          // fallback sends legacy snake_case rows. Normalise BOTH into the
          // camelCase view the cards render, so teams/crests/kickoff and the
          // direct HLS sources never disappear when the fallback answers.
          const list = normalizeFeedMatches(data);
          console.log('[Sports] Parsed matches count:', list.length,
            '| live:', list.filter(m => m.isLive).length);
          // A failed/empty payload must NOT wipe a good list we already have.
          if (list.length || first) setSportsMatches(list);
          setSportsMatchesLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('[Sports] Primary API failed:', err);
          if (first) {
            // Legacy endpoint fallback keeps the hub alive
            fetch(apiUrl('/api/sports/stream-schedule'))
              .then(r => r.ok ? r.json() : [])
              .then(legacy => {
                if (cancelled) return;
                const list = normalizeFeedMatches(legacy);
                console.log('[Sports] Legacy API returned:', list.length, 'matches');
                setSportsMatches(list);
                setSportsMatchesLoading(false);
              })
              .catch((err2) => {
                console.error('[Sports] Legacy API also failed:', err2);
                setSportsMatches([]);
                setSportsMatchesLoading(false);
              });
          }
        });
    };

    load(true);
    // Chain the next poll off the previous one (not setInterval) so a slow
    // response can never stack up overlapping requests.
    const schedule = () => {
      timer = setTimeout(() => { load(false); schedule(); }, SPORTS_FEED_REFRESH_MS);
    };
    schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
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

        if (params.has('play')) handlePlayMedia(dummy);
      }
    }
  }, []);

  const fetchPage = async (pageNum: number, isFirst = false) => {
    if (catalogPending.current) return;
    catalogPending.current = true;
    setCatalogError(false);
    if (isFirst) setLoading(true);
    else setLoadingMore(true);

    try {
      const result = await queryClient.fetchQuery({
        queryKey: ['cinema', 'catalog', 'week', pageNum],
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        queryFn: async ({ signal }) => {
          const res = await fetch(`${API_BASE_URL}/api/cinema/trending?page=${pageNum}&time_window=week`, { signal });
          if (!res.ok) throw new Error(`Cinema API returned HTTP ${res.status}`);
          const data = await res.json();
          if (!Array.isArray(data?.results)) throw new Error('Invalid cinema catalog');
          return { items: data.results as MovieOrShow[], pages: Number(data.total_pages) || 20 };
        },
      });
      if (isFirst) seenIds.current.clear();

      // Deduplicate by id — never show same card twice
      const fresh = result.items.filter(item => {
        const key = mediaKey(item);
        if (!['tv', 'movie'].includes(item.media_type) || seenIds.current.has(key)) return false;
        seenIds.current.add(key);
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

      setHasMore(result.items.length > 0 && pageNum < Math.min(20, result.pages));
      setPage(pageNum);

    } catch (err) {
      setCatalogError(true);
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
      catalogPending.current = false;
      if (isFirst) setLoading(false);
      else setLoadingMore(false);
    }
  };

  const loadNextPage = useCallback(() => {
    if (loadingMore || !hasMore) return;
    fetchPage(page + 1);
  }, [page, loadingMore, hasMore]);

  // ── IntersectionObserver for true automatic infinite scroll ──
  useEffect(() => {
    if (activeTab !== 'movies' || isSearching || loading || catalogError || selectedMedia || activePlayer) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore && hasMore && !isSearching) {
          loadNextPage();
        }
      },
      { rootMargin: '600px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, loading, loadingMore, hasMore, isSearching, loadNextPage, catalogError, selectedMedia, activePlayer]);

  // ── Hero auto-rotation every 6 seconds ──
  useEffect(() => {
    if (heroPool.length < 2 || activeTab !== 'movies' || activePlayer || selectedMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      setHeroIdx(prev => {
        const next = (prev + 1) % heroPool.length;
        setFeatured(heroPool[next]);
        return next;
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [heroPool, activeTab, activePlayer, selectedMedia]);

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

  const handleOpenDetails = (item: MovieOrShow) => {
    setSeasonChoice(null);
    setSelectedEpisode(null);
    setSelectedMedia(item);
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
      const previous = prev.find(i => i.tmdbId === media.id && i.mediaType === entry.mediaType && i.season === season && i.episode === episode);
      const filtered = prev.filter(i => i.tmdbId !== media.id || i.mediaType !== entry.mediaType);
      const updated = [{ ...previous, ...entry }, ...filtered].slice(0, 10);
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

  const formatGenres = (genres: any[]) =>
    genres?.length ? genres.slice(0, 3).map(g => g.name).join(' · ') : '';

  const visibleCatalog = filter === 'all' ? catalog : catalog.filter(item => item.media_type === filter);

  return (
    <>
      <SEO
        title={page > 1 ? `Cinema — Page ${page}` : 'Cinema'}
        description="Browse movies, series and entertainment video content on RealSSA News."
        url={page > 1 ? `/videos?page=${page}` : '/videos'}
        section="Cinema"
      />
    <div className="cinema-hub-shell min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <ReadProgressBar />
      <Header />

      {/* ── Tab Bar — Floating Glassmorphic Pill ── */}
      <div className="cinema-primary-nav sticky top-16 z-40 px-4 py-3 flex justify-center pointer-events-none">
        <div className="cinema-primary-nav__inner pointer-events-auto bg-zinc-950/65 backdrop-blur-2xl border border-white/10 p-1.5 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)] flex items-center gap-1 max-w-full overflow-x-auto scrollbar-none">
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
          <Suspense fallback={<p role="status" className="p-6 text-center text-zinc-300">Loading live news…</p>}>
            <VideoNews isEmbedded />
          </Suspense>
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
            <p className="text-xs text-zinc-400 font-semibold mt-1">
              Watch live sports in our native player with direct streams when available. Some matches use external sources — you may need to browse to find your match.
            </p>
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

          {/* Live / Upcoming / Results Toggle */}
          <div className="sports-filter-panel mb-4">
            <span className="sports-filter-panel__label">Match status</span>
            <div className="sports-status-tabs">
            {([['All', 'All Fixtures'], ['Live', '● Live Now'], ['Upcoming', 'Upcoming'], ['Results', '✓ Finished']] as const).map(([key, label]) => {
              const isLiveKey = key === 'Live';
              const isResultsKey = key === 'Results';
              return (
                <button
                  key={key}
                  onClick={() => setSportsTimeFilter(key)}
                  className={`sports-status-tab px-3.5 py-1.5 rounded-full text-[11px] font-black transition-all active:scale-95 border ${
                    sportsTimeFilter === key
                      ? (isLiveKey ? 'bg-red-600 text-white border-red-500' : isResultsKey ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white text-black border-white')
                      : 'bg-zinc-900/70 text-zinc-400 hover:text-white border-zinc-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
            </div>
          </div>

          {/* Sport Filter Tabs (Pills) */}
          <div className="sports-type-rail flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none shrink-0">
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
                // Safe string operations - handle undefined/null values
                const eventStr = String(m.event || '').toLowerCase();
                const sportStr = String(m.sport || '').toLowerCase();
                
                const matchesQuery = !query ||
                  eventStr.includes(query) ||
                  sportStr.includes(query);

                if (!matchesQuery) return false;

                // Live / Upcoming / Results time filter. `status` is canonical
                // from the feed ('live'|'finished'|'cancelled'|'scheduled');
                // fall back to isLive for legacy rows without a status.
                const st = String(m.status || (m.isLive ? 'live' : 'scheduled')).toLowerCase();
                if (sportsTimeFilter === 'Live' && st !== 'live') return false;
                if (sportsTimeFilter === 'Upcoming' && st !== 'scheduled') return false;
                if (sportsTimeFilter === 'Results' && st !== 'finished') return false;

                if (selectedSportFilter === 'All') return true;

                // Use sportStr which is guaranteed to be a string
                if (selectedSportFilter === 'Football') {
                  return sportStr.includes('football') || sportStr.includes('soccer') || sportStr.includes('league') || sportStr.includes('champions');
                }
                if (selectedSportFilter === 'Basketball') {
                  return sportStr.includes('basketball') || sportStr.includes('nba');
                }
                if (selectedSportFilter === 'F1 / Motor') {
                  return sportStr.includes('f1') || sportStr.includes('formula') || sportStr.includes('racing') || sportStr.includes('motor');
                }
                if (selectedSportFilter === 'Combat') {
                  return sportStr.includes('ufc') || sportStr.includes('mma') || sportStr.includes('boxing') || sportStr.includes('wrestling') || sportStr.includes('fight') || sportStr.includes('combat');
                }
                if (selectedSportFilter === 'Tennis') {
                  return sportStr.includes('tennis');
                }
                // Other
                const known = ['football', 'soccer', 'league', 'champions', 'basketball', 'nba', 'f1', 'formula', 'racing', 'motor', 'ufc', 'mma', 'boxing', 'wrestling', 'fight', 'combat', 'tennis'];
                const isKnown = known.some(k => sportStr.includes(k));
                return !isKnown;
              });

              // Sort: live → upcoming (kickoff asc) → finished (newest first)
              const statusRank = (mm: any) => {
                const s = String(mm.status || (mm.isLive ? 'live' : 'scheduled')).toLowerCase();
                return s === 'live' ? 0 : s === 'finished' ? 2 : 1;
              };
              const sorted = [...filtered].sort((a, b) => {
                const ra = statusRank(a), rb = statusRank(b);
                if (ra !== rb) return ra - rb;
                const ta = new Date(a.kickoff || 0).getTime() || 0;
                const tb = new Date(b.kickoff || 0).getTime() || 0;
                return ra === 2 ? tb - ta : ta - tb;
              });

              const liveTotal = sportsMatches.filter(m => statusRank(m) === 0).length;
              const resultsTotal = sportsMatches.filter(m => statusRank(m) === 2).length;
              const upcomingTotal = sportsMatches.length - liveTotal - resultsTotal;

              if (sorted.length === 0) {
                const onlyLiveBlocked = sportsTimeFilter === 'Live' && upcomingTotal > 0;
                return (
                  <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-8 text-center text-zinc-500 text-xs space-y-3">
                    <p className="font-bold text-zinc-400">
                      {onlyLiveBlocked
                        ? `No match is live right now — ${upcomingTotal} fixture${upcomingTotal === 1 ? '' : 's'} coming up`
                        : 'No matches found matching your filters.'}
                    </p>
                    {onlyLiveBlocked && (
                      <button
                        onClick={() => setSportsTimeFilter('Upcoming')}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-black rounded-full transition-colors active:scale-95"
                      >
                        Show {upcomingTotal} upcoming fixture{upcomingTotal === 1 ? '' : 's'}
                      </button>
                    )}
                    <p className="text-[10px] text-zinc-600">
                      Every fixture below opens in our own player — no pop-ups, no leaving the site.
                    </p>
                  </div>
                );
              }

              // Group by sport category
              const groups: { [key: string]: typeof sportsMatches } = {};
              sorted.forEach(m => {
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
                          const parseTeams = (event: string = '') => {
                            if (!event) return { home: '', away: null };
                            const delimiters = [' vs ', ' VS ', ' - ', ' @ '];
                            for (const d of delimiters) {
                              if (event.includes(d)) {
                                const parts = event.split(d);
                                return { home: parts[0].trim(), away: parts[1].trim() };
                              }
                            }
                            return { home: event, away: null };
                          };
                          const { home, away } = parseTeams(match.event || '');

                          return (
                            <div
                              key={idx}
                              className="bg-zinc-950/60 backdrop-blur-md border border-white/10 hover:border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between gap-3.5 transition-all hover:bg-zinc-900/45 group relative overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
                            >
                              {/* Upper banner row — status-aware pill */}
                              <div className="flex items-center justify-between text-[9px] text-zinc-500 font-extrabold uppercase tracking-wider">
                                {(() => {
                                  const st = String(match.status || (match.isLive ? 'live' : 'scheduled')).toLowerCase();
                                  const kt = match.kickoff ? new Date(match.kickoff) : null;
                                  const timeStr = kt && !isNaN(kt.getTime())
                                    ? kt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : (match.time || '');
                                  if (st === 'finished') return (
                                    <span className="flex items-center gap-1 bg-zinc-800/60 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-700/40">
                                      FT{match.score ? ` · ${match.score}` : ''}
                                    </span>
                                  );
                                  if (st === 'live') return (
                                    <span className="flex items-center gap-1 bg-red-950/40 text-red-400 px-2 py-0.5 rounded-full border border-red-900/20">
                                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                      {match.liveDetail || timeStr || 'LIVE'}
                                    </span>
                                  );
                                  return (
                                    <span className="flex items-center gap-1 bg-sky-950/40 text-sky-400 px-2 py-0.5 rounded-full border border-sky-900/20">
                                      <Clock size={9} />
                                      {timeStr || 'Upcoming'}
                                    </span>
                                  );
                                })()}
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
                                    {/* Fixture-style metadata: stadium/arena */}
                                    {match.venue ? (
                                      <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 font-bold -mt-0.5">
                                        <MapPin size={9} className="text-zinc-600 shrink-0" />
                                        <span className="truncate">{match.venue}</span>
                                      </div>
                                    ) : null}
                                  </>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-[11px] font-bold text-amber-500">
                                      ⚽
                                    </div>
                                    <span className="text-zinc-200 font-bold text-xs sm:text-[13px] group-hover:text-white transition-colors line-clamp-2 leading-snug">{match.event || 'Sports Match'}</span>
                                  </div>
                                )}
                              </div>

                              {/* Button action row */}
                              <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1.5">
                                <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                                  {(() => {
                                    const st = String(match.status || (match.isLive ? 'live' : 'scheduled')).toLowerCase();
                                    if (st === 'finished') return <span className="text-zinc-500">● Match ended</span>;
                                    if (match.directSources?.length) {
                                      return match.liveConfidence?.exact
                                        ? <span className="text-emerald-400">● ✓ Exact match feed</span>
                                        : <span className="text-emerald-500">● Direct stream available</span>;
                                    }
                                    return (match.streamId || match.id ? 'External source' : 'Find stream');
                                  })()}
                                </span>
                                {String(match.status || (match.isLive ? 'live' : 'scheduled')).toLowerCase() === 'finished' ? (
                                  <button
                                    onClick={() => {
                                      const d = [' vs ', ' VS ', ' - ', ' @ '];
                                      let th = match.home || null, ta = match.away || null;
                                      for (const x of d) {
                                        if (!th && (match.event || '').includes(x)) {
                                          const p = match.event.split(x);
                                          th = p[0].trim(); ta = p[1].trim().replace(/\s*\(.*?\)\s*$/, '').trim();
                                        }
                                      }
                                      setHighlightsMatch({
                                        id: String(match.id || ''),
                                        home: th || match.event || 'Home',
                                        away: ta || '',
                                        kickoff: match.kickoff ?? null,
                                        competition: match.league || null,
                                      });
                                    }}
                                    className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black text-[11px] font-black rounded-lg flex items-center gap-1 transition-all active:scale-95 shadow-md shadow-emerald-500/15 border border-emerald-600"
                                  >
                                    <Clapperboard size={11} /> Highlights
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      const d = [' vs ', ' VS ', ' - ', ' @ '];
                                      let th = match.home || null, ta = match.away || null;
                                      for (const x of d) {
                                        if (!th && (match.event || '').includes(x)) {
                                          const p = match.event.split(x);
                                          th = p[0].trim(); ta = p[1].trim().replace(/\s*\(.*?\)\s*$/, '').trim();
                                        }
                                      }
                                      setActiveSportsPlayer({
                                        channelId: match.streamId || match.id || 'superabbit',
                                        title: match.event || 'Sports Match',
                                        directSources: match.directSources,
                                        home: th,
                                        away: ta,
                                        homeCrest: match.homeCrest,
                                        awayCrest: match.awayCrest,
                                        isLive: !!match.isLive,
                                        sport: match.sport || null,
                                        league: match.league || null,
                                        liveConfidence: match.liveConfidence || null,
                                        kickoff: match.kickoff ?? null,
                                        streamId: match.streamId || null,
                                        exactEmbedUrl: match.exactEmbedUrl || null,
                                        venue: match.venue || null,
                                      });
                                    }}
                                    className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-[11px] font-black rounded-lg flex items-center gap-1 transition-all active:scale-95 shadow-md shadow-amber-500/15 border border-amber-600"
                                  >
                                    <Play size={10} className="fill-black" /> {match.directSources?.length ? 'Watch Now' : 'Find Stream'}
                                  </button>
                                )}
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
                  /* ── CASE B: no channel list — native direct feed + browse servers ── */
                  <div className="flex-1 flex flex-col">
                    <p className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider mb-3">Watch On</p>
                    <div className="grid grid-cols-1 gap-2.5">
                      <button
                        onClick={() => {
                          const d = [' vs ', ' VS ', ' - ', ' @ '];
                          let th = selectedSportMatch.home || null, ta = selectedSportMatch.away || null;
                          for (const x of d) {
                            if (!th && (selectedSportMatch.event || '').includes(x)) {
                              const p = selectedSportMatch.event.split(x);
                              th = p[0].trim(); ta = p[1].trim().replace(/\s*\(.*?\)\s*$/, '').trim();
                            }
                          }
                          setActiveSportsPlayer({
                            channelId: selectedSportMatch.streamId || selectedSportMatch.id || 'superabbit',
                            title: selectedSportMatch.event || 'Sports Match',
                            directSources: selectedSportMatch.directSources,
                            home: th, away: ta,
                            homeCrest: selectedSportMatch.homeCrest,
                            awayCrest: selectedSportMatch.awayCrest,
                            isLive: !!selectedSportMatch.isLive,
                            sport: selectedSportMatch.sport || null,
                            league: selectedSportMatch.league || null,
                            liveConfidence: selectedSportMatch.liveConfidence || null,
                            kickoff: selectedSportMatch.kickoff ?? null,
                            streamId: selectedSportMatch.streamId || null,
                            venue: selectedSportMatch.venue || null,
                          });
                          setSelectedSportMatch(null);
                        }}
                        className="w-full flex items-center justify-between p-3.5 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-700/40 hover:border-emerald-500/60 rounded-xl text-left transition-all group"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            RealSSA Direct Feed
                          </p>
                          <p className="text-[9px] text-zinc-500 mt-0.5">Native player — no pop-ups, ad-light</p>
                        </div>
                        <Play size={12} className="text-emerald-500 group-hover:text-emerald-300 transition-colors shrink-0" />
                      </button>
                      {[
                        { label: 'Server 2', key: 'superabbit', id: 'superabbit-browse' },
                        { label: 'Server 3', key: 'strikeout', id: 'strikeout-browse' },
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

          {/* Live Sports Access — Server 1 · Server 2 · Server 3 */}
          <div className="mt-8 border-t border-zinc-900 pt-8 mb-6">
            <h3 className="text-sm font-extrabold text-zinc-400 uppercase tracking-widest mb-1 flex items-center gap-2">
              <Tv size={14} />
              Browse Live Sports By Category
            </h3>
            <p className="text-[10px] text-zinc-600 mb-5">
              <strong className="text-zinc-500">How it works:</strong> When you click a match, we try to play it directly in our player. 
              If no direct stream is found, you'll be shown external sports sites where you can browse to find your match. 
              Multiple servers are available — switch between them if one doesn't work.
            </p>


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
                    <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-zinc-500 font-bold border border-white/5">Server 1 · Server 2 · Server 3</span>
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
                    <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-zinc-500 font-bold border border-white/5">Server 1 · Server 2 · Server 3</span>
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
                    <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-zinc-500 font-bold border border-white/5">Server 1 · Server 2 · Server 3</span>
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
          <form className="cinema-search" role="search" onSubmit={event => {
            event.preventDefault();
            setSubmitted(term);
            event.currentTarget.querySelector('input')?.blur();
          }}>
            <Search size={18} aria-hidden />
            <input type="search" aria-label="Search movies and series" placeholder="Search movies and series"
              enterKeyHint="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} />
            {isSearching && <button type="button" aria-label="Clear search" onClick={() => { setSearchQuery(''); setSubmitted(''); }}><X size={18} /></button>}
          </form>
          {/* Interactive Hero Carousel */}
          {!isSearching && featured && (
            <section className="cinema-feature relative flex flex-col justify-end overflow-hidden group/hero">
              {/* Slides background with transition */}
              <div className="absolute inset-0 transition-all duration-700 ease-in-out">
                <img src={getBackdrop(featured)} alt=""
                  srcSet={featured.backdrop_path && (!featured.r2_backdrop_url || featured.r2_backdrop_url.startsWith('https://image.tmdb.org/'))
                    ? `https://image.tmdb.org/t/p/w780${featured.backdrop_path} 780w, https://image.tmdb.org/t/p/w1280${featured.backdrop_path} 1280w` : undefined}
                  sizes="100vw" fetchPriority="high" className="w-full h-full object-cover animate-fade-in" />
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
                        {item.duration > 0 && item.position > 0 && <progress className="cinema-progress" aria-label="Watched" value={item.position} max={item.duration} />}
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

            {isSearching ? (
              <section aria-label="Search results">
                <h2 className="cinema-section-title">Search results</h2>
                <p role="status" className="cinema-status">
                  {search.isError ? 'Online search is unavailable.' : search.isPending || search.isFetching
                    ? 'Searching the catalog…' : searchResults.length ? '' : `No titles found for “${searchQuery.trim()}”.`}
                  {search.isError && <button onClick={() => search.refetch()}>Retry search</button>}
                </p>
                <div className="cinema-grid">{searchResults.map(item =>
                  <MediaCard key={mediaKey(item)} item={item} onOpen={handleOpenDetails} />)}</div>
              </section>
            ) : (
              <section aria-label="Browse cinema">
                <h2 className="cinema-section-title">Browse cinema</h2>
                <div className="cinema-filters" aria-label="Filter catalog">
                  {(['all', 'movie', 'tv'] as const).map(type => (
                    <button key={type} aria-pressed={filter === type} onClick={() => setFilter(type)}>
                      {type === 'all' ? 'All titles' : type === 'movie' ? 'Movies' : 'Series'}
                    </button>
                  ))}
                </div>
                <div className="cinema-grid">
                  {visibleCatalog.map(item => <MediaCard key={mediaKey(item)} item={item} onOpen={handleOpenDetails} />)}
                  {loading && !catalog.length && Array.from({ length: 6 }, (_, i) => <span key={i} className="cinema-poster animate-pulse" />)}
                </div>
                <div ref={sentinelRef} className="cinema-pagination">
                  <span role="status">{loading || loadingMore ? 'Loading titles…' : catalogError ? 'The catalog could not refresh.' : !hasMore && !visibleCatalog.length ? 'No titles available.' : ''}</span>
                  {(catalogError || hasMore) && !loading && !loadingMore && (
                    <button onClick={() => hasMore ? loadNextPage() : fetchPage(1, true)}>
                      {catalogError ? 'Retry catalog' : 'Load more titles'}
                    </button>
                  )}
                  {hasMore && <a className="sr-only" href={`/videos?page=${page + 1}`}>Next cinema page</a>}
                </div>
              </section>
            )}
          </main>
        </>
      )}

      {/* ── Detail Drawer ── */}
      {selectedMedia && (
        <CinemaDialog label={selectedMedia.title || selectedMedia.name || 'Title details'} onDismiss={() => setSelectedMedia(null)}>
          <div className="cinema-detail">

            {/* Backdrop */}
            <div className="cinema-detail-art relative shrink-0 bg-zinc-900">
              {getBackdrop(selectedMedia) ? (
                <img src={getBackdrop(selectedMedia)!} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-black/30 to-transparent" />
              <button
                aria-label="Close details" onClick={() => setSelectedMedia(null)}
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
                  {selectedMedia.title || selectedMedia.name || mediaDetails?.title || mediaDetails?.name}
                </h2>
                {selectedMedia.media_type === 'movie' && (
                  <button className="cinema-watch" onClick={() => handlePlayMedia(selectedMedia)}>
                    <Play size={17} fill="currentColor" /> Watch Now
                  </button>
                )}
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
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">{selectedMedia.overview || mediaDetails?.overview}</p>
              </div>


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

                  {selectedMedia.media_type === 'tv' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">Episodes</h4>
                        {seasons.length > 1 && (
                          <select
                            value={selectedSeasonNum}
                            onChange={e => setSeasonChoice(Number(e.target.value))}
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
                      {!episodesLoading && !episodes.length && <p role="status" className="cinema-status">Episodes unavailable.
                        <button onClick={() => selectedSeasonNum == null ? details.refetch() : season.refetch()}>Retry</button></p>}
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
            </div>
          </div>
        </CinemaDialog>
      )}

      {/* ── RealSSA Player ── */}
      {activePlayer && (
        <CinemaDialog player label={activePlayer.title} onDismiss={() => setActivePlayer(null)}>
          <Suspense fallback={<div role="status" className="p-5">Opening player…</div>}>
            <CinemaPlayer key={`${activePlayer.tmdbId}-${activePlayer.mediaType}-${activePlayer.season}-${activePlayer.episode}`}
              {...activePlayer}
              resumeAt={continueWatching.find(i => i.tmdbId === activePlayer.tmdbId && i.mediaType === activePlayer.mediaType && i.season === activePlayer.season && i.episode === activePlayer.episode)?.position}
              onProgress={(position, duration) => setContinueWatching(previous => {
                const updated = previous.map(i => i.tmdbId === activePlayer.tmdbId && i.mediaType === activePlayer.mediaType && i.season === activePlayer.season && i.episode === activePlayer.episode ? { ...i, position, duration } : i);
                try { localStorage.setItem('realssa:continue_watching', JSON.stringify(updated)); } catch {}
                return updated;
              })}
              onClose={() => setActivePlayer(null)} />
          </Suspense>
        </CinemaDialog>
      )}
      <Suspense fallback={<div role="status">Opening player…</div>}>
        {/* ── Highlights modal (finished matches) ── */}
        <HighlightsModal source={highlightsMatch} onClose={() => setHighlightsMatch(null)} />

        {/* ── RealSSA Sports Player ── */}
        {/* ── RealSSA Sports Player (native direct HLS + fallback servers) ── */}
        {activeSportsPlayer && (
          <SportsPlayer
            // Remount per fixture. Without this, switching from Parma to Getafe
            // reused the same <video>/hls instance and kept playing the PREVIOUS
            // match's channel under the new title — the "wrong match" bleed.
            key={`${activeSportsPlayer.channelId}|${activeSportsPlayer.streamId || ''}|${activeSportsPlayer.title}`}
            channelId={activeSportsPlayer.channelId}
            title={activeSportsPlayer.title}
            directSources={activeSportsPlayer.directSources}
            home={activeSportsPlayer.home}
            away={activeSportsPlayer.away}
            homeCrest={activeSportsPlayer.homeCrest}
            awayCrest={activeSportsPlayer.awayCrest}
            isLive={activeSportsPlayer.isLive}
            sport={activeSportsPlayer.sport}
            league={activeSportsPlayer.league}
            liveConfidence={activeSportsPlayer.liveConfidence}
            kickoff={activeSportsPlayer.kickoff}
            streamId={activeSportsPlayer.streamId}
            exactEmbedUrl={activeSportsPlayer.exactEmbedUrl}
            venue={activeSportsPlayer.venue}
            onSwitchMatch={m => setActiveSportsPlayer({
              channelId: m.streamId || 'superabbit',
              title: m.event || 'Live Match',
              directSources: m.directSources,
              home: m.home || null,
              away: m.away || null,
              homeCrest: m.homeCrest || null,
              awayCrest: m.awayCrest || null,
              isLive: true,
              sport: m.sport || null,
              league: m.league || null,
              liveConfidence: m.liveConfidence || null,
              kickoff: m.kickoff ?? null,
              streamId: m.streamId || null,
              exactEmbedUrl: m.exactEmbedUrl || null,
              venue: m.venue || null,
            })}
            onClose={() => setActiveSportsPlayer(null)}
          />
        )}
      </Suspense>
      <Footer />
    </div>
    </>
  );
}
