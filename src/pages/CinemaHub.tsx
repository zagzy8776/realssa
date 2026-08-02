import React, { useState, useEffect, useRef, useCallback } from 'react';
import VideoNews from "@/pages/VideoNews";
import { Play, Info, Search, Star, Film, Tv, X, Clock, ShieldCheck, EyeOff, Youtube, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { apiUrl } from "@/lib/api-base";
import CinemaPlayer from "@/components/CinemaPlayer";

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
  vote_average: number;
  media_type: 'movie' | 'tv';
  genre_ids: number[];
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
  const [activeTab, setActiveTab] = useState<'movies' | 'news'>('movies');

  // Catalog
  const [trending, setTrending] = useState<MovieOrShow[]>([]);
  const [featured, setFeatured] = useState<MovieOrShow | null>(null);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [moviesPage, setMoviesPage] = useState(1);
  const [showsPage, setShowsPage] = useState(1);
  const [loadingMoreMovies, setLoadingMoreMovies] = useState(false);
  const [loadingMoreShows, setLoadingMoreShows] = useState(false);

  // Search with autocomplete
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MovieOrShow[]>([]);
  const [suggestions, setSuggestions] = useState<MovieOrShow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const suggestDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [sourcesLoading, setSourcesLoading] = useState(false);

  // Player
  const [activePlayer, setActivePlayer] = useState<{
    tmdbId: number; mediaType: 'movie' | 'tv'; season: number; episode: number; title: string;
  } | null>(null);

  useEffect(() => { fetchTrending(); }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchTrending = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/cinema/trending'));
      const data = await res.json();
      const results = data.results || [];
      setTrending(results);
      const movieWithBackdrop = results.find((item: MovieOrShow) => item.backdrop_path && item.overview);
      setFeatured(movieWithBackdrop || results[0]);
    } catch (err) {
      console.error('Failed to fetch trending:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreMovies = async () => {
    setLoadingMoreMovies(true);
    try {
      const nextPage = moviesPage + 1;
      const res = await fetch(apiUrl(`/api/cinema/trending?page=${nextPage}`));
      const data = await res.json();
      const newItems = (data.results || []).filter((i: MovieOrShow) => i.media_type === 'movie');
      setTrending(prev => [...prev, ...newItems]);
      setMoviesPage(nextPage);
    } catch (err) {
      console.error('Load more movies failed:', err);
    } finally {
      setLoadingMoreMovies(false);
    }
  };

  const fetchMoreShows = async () => {
    setLoadingMoreShows(true);
    try {
      const nextPage = showsPage + 1;
      const res = await fetch(apiUrl(`/api/cinema/trending?page=${nextPage}`));
      const data = await res.json();
      const newItems = (data.results || []).filter((i: MovieOrShow) => i.media_type === 'tv');
      setTrending(prev => [...prev, ...newItems]);
      setShowsPage(nextPage);
    } catch (err) {
      console.error('Load more shows failed:', err);
    } finally {
      setLoadingMoreShows(false);
    }
  };

  // Debounced autocomplete
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    suggestDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/cinema/search?q=${encodeURIComponent(value)}`));
        const data = await res.json();
        setSuggestions((data.results || []).slice(0, 6));
        setShowSuggestions(true);
      } catch (_) {}
    }, 350);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (!searchQuery.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setSearchLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/cinema/search?q=${encodeURIComponent(searchQuery)}`));
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSuggestionClick = (item: MovieOrShow) => {
    setShowSuggestions(false);
    setSearchQuery(item.title || item.name || '');
    handleOpenDetails(item);
  };

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
      console.error('Failed to fetch episodes:', err);
    } finally {
      setEpisodesLoading(false);
    }
  };

  const handleSeasonChange = (seasonNum: number) => {
    setSelectedSeasonNum(seasonNum);
    if (selectedMedia) fetchSeasonEpisodes(selectedMedia.id, seasonNum);
  };

  const handleEpisodeSelect = (ep: Episode) => {
    if (!selectedMedia) return;
    setSelectedEpisode(ep);
    const showName = selectedMedia.title || selectedMedia.name || 'Show';
    setActivePlayer({
      tmdbId: selectedMedia.id,
      mediaType: 'tv',
      season: ep.season_number,
      episode: ep.episode_number,
      title: `${showName} · S${ep.season_number}E${ep.episode_number} · ${ep.name}`
    });
  };

  const handlePlayMedia = (media: MovieOrShow) => {
    setActivePlayer({
      tmdbId: media.id,
      mediaType: (media.media_type || 'movie') as 'movie' | 'tv',
      season: 1,
      episode: 1,
      title: media.title || media.name || 'Movie'
    });
  };

  const getPoster = (item: MovieOrShow) =>
    item.r2_poster_url || (item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : 'https://realssanews.com.ng/logo.png');

  const getBackdrop = (item: MovieOrShow) =>
    item.r2_backdrop_url || (item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : 'https://realssanews.com.ng/logo.png');

  const getYear = (item: MovieOrShow) => {
    const d = item.release_date || item.first_air_date || '';
    return d ? d.substring(0, 4) : 'N/A';
  };

  const formatGenres = (genres: any[]) =>
    genres?.length ? genres.slice(0, 3).map(g => g.name).join(' · ') : 'Cinema';

  const movies = trending.filter(i => i.media_type === 'movie');
  const shows = trending.filter(i => i.media_type === 'tv');

  // Movie card component (reused)
  const MediaCard = ({ item }: { item: MovieOrShow }) => (
    <div
      onClick={() => handleOpenDetails(item)}
      className="flex-shrink-0 w-32 sm:w-40 aspect-[2/3] group relative cursor-pointer rounded-xl overflow-hidden border border-white/5 hover:border-amber-500/40 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-black/50"
    >
      <img
        src={getPoster(item)}
        alt={item.title || item.name}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
      {/* Play overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="w-10 h-10 bg-amber-500/90 rounded-full flex items-center justify-center shadow-lg">
          <Play size={16} className="fill-black text-black ml-0.5" />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        <h4 className="text-white text-[11px] font-bold leading-tight line-clamp-2">
          {item.title || item.name}
        </h4>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="flex items-center gap-0.5 text-amber-400 text-[9px] font-bold">
            <Star size={8} className="fill-current" />{item.vote_average.toFixed(1)}
          </span>
          <span className="text-zinc-500 text-[9px]">{getYear(item)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">

      {/* Tab Bar */}
      <div className="bg-black/80 backdrop-blur-md border-b border-zinc-900 sticky top-14 z-40 px-4 py-2">
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
        </div>
      </div>

      {activeTab === 'news' ? (
        <VideoNews />
      ) : (
        <>
          {/* Hero Banner */}
          {!isSearching && featured && (
            <section className="relative w-full h-[58vh] sm:h-[78vh] bg-zinc-950 flex flex-col justify-end overflow-hidden">
              <div className="absolute inset-0">
                <img src={getBackdrop(featured)} alt={featured.title || featured.name} className="w-full h-full object-cover" />
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
                  <span className="text-amber-400 flex items-center gap-0.5">
                    <Star size={12} className="fill-current" />{featured.vote_average.toFixed(1)}
                  </span>
                  <span>·</span><span>{getYear(featured)}</span>
                  <span>·</span>
                  <span className="uppercase bg-zinc-800 px-2 py-0.5 rounded text-[9px] font-bold">{featured.media_type}</span>
                </div>
                <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed max-w-lg mt-3 line-clamp-3">{featured.overview}</p>
                <div className="flex gap-3 mt-6">
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

          {/* Main Content */}
          <main className="container mx-auto px-4 py-6 flex-1">

            {/* Search Bar with Autocomplete */}
            <div ref={searchRef} className="relative w-full max-w-lg mx-auto mb-8">
              <form onSubmit={handleSearch} className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Search movies, TV shows..."
                  value={searchQuery}
                  onChange={e => handleSearchInput(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 text-zinc-200 placeholder-zinc-500 rounded-full pl-5 pr-12 py-3 text-sm outline-none transition-colors"
                />
                <button
                  type="submit"
                  className="absolute right-2 p-2 bg-amber-500 hover:bg-amber-400 text-black rounded-full transition-colors"
                >
                  {searchLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
              </form>

              {/* Autocomplete Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
                  {suggestions.map(item => (
                    <button
                      key={item.id}
                      onMouseDown={() => handleSuggestionClick(item)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 transition-colors text-left"
                    >
                      <img
                        src={getPoster(item)}
                        alt={item.title || item.name}
                        className="w-8 h-10 object-cover rounded-md shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-zinc-200 truncate">{item.title || item.name}</p>
                        <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                          {item.media_type === 'tv' ? <Tv size={9} /> : <Film size={9} />}
                          {getYear(item)} · ⭐ {item.vote_average.toFixed(1)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clear search */}
            {isSearching && (
              <button
                onClick={() => { setIsSearching(false); setSearchResults([]); setSearchQuery(''); }}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white mb-4 transition-colors"
              >
                <X size={13} /> Clear search
              </button>
            )}

            {/* Loading shimmer */}
            {loading && (
              <div className="flex gap-3 overflow-hidden pb-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-32 aspect-[2/3] bg-zinc-900 rounded-xl animate-pulse" />
                ))}
              </div>
            )}

            {/* Search Results */}
            {!loading && isSearching && (
              searchResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {searchResults.map(item => <MediaCard key={item.id} item={item} />)}
                </div>
              ) : (
                <div className="text-center py-16 text-zinc-500 flex flex-col items-center gap-3">
                  <EyeOff size={32} />
                  <p className="text-sm">No results found for "{searchQuery}"</p>
                </div>
              )
            )}

            {/* Catalog Rows */}
            {!loading && !isSearching && (
              <div className="space-y-10">

                {/* Popular Movies */}
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white mb-4 flex items-center gap-2">
                    🔥 Popular Releases
                  </h3>
                  <div className="flex gap-3 overflow-x-auto pb-3 no-scrollbar">
                    {movies.map(item => <MediaCard key={item.id} item={item} />)}
                    {/* Load more card */}
                    <div className="flex-shrink-0 w-32 sm:w-40 aspect-[2/3] flex items-center justify-center">
                      <button
                        onClick={fetchMoreMovies}
                        disabled={loadingMoreMovies}
                        className="flex flex-col items-center gap-2 text-zinc-500 hover:text-amber-400 transition-colors disabled:opacity-50"
                      >
                        {loadingMoreMovies
                          ? <Loader2 size={22} className="animate-spin" />
                          : <ChevronDown size={22} className="animate-bounce" />
                        }
                        <span className="text-[10px] font-bold">Load More</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Trending Series */}
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white mb-4 flex items-center gap-2">
                    📺 Trending Series
                  </h3>
                  <div className="flex gap-3 overflow-x-auto pb-3 no-scrollbar">
                    {shows.map(item => <MediaCard key={item.id} item={item} />)}
                    {/* Load more card */}
                    <div className="flex-shrink-0 w-32 sm:w-40 aspect-[2/3] flex items-center justify-center">
                      <button
                        onClick={fetchMoreShows}
                        disabled={loadingMoreShows}
                        className="flex flex-col items-center gap-2 text-zinc-500 hover:text-amber-400 transition-colors disabled:opacity-50"
                      >
                        {loadingMoreShows
                          ? <Loader2 size={22} className="animate-spin" />
                          : <ChevronDown size={22} className="animate-bounce" />
                        }
                        <span className="text-[10px] font-bold">Load More</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </main>
        </>
      )}

      {/* Detail Drawer */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="w-full sm:max-w-xl h-[92vh] sm:h-[90vh] bg-zinc-950 border border-zinc-900 sm:border-l rounded-t-3xl sm:rounded-2xl overflow-y-auto relative flex flex-col shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-right duration-300">

            {/* Backdrop */}
            <div className="relative h-52 sm:h-64 w-full shrink-0">
              <img src={getBackdrop(selectedMedia)} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-black/30 to-transparent" />
              <button
                onClick={() => setSelectedMedia(null)}
                className="absolute top-4 right-4 p-2 bg-black/70 hover:bg-zinc-800 rounded-full border border-white/10 text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Details */}
            <div className="p-5 flex-1 flex flex-col gap-5">
              <div>
                <span className="bg-zinc-800 text-zinc-300 text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-full">
                  {selectedMedia.media_type === 'movie' ? '🎬 Movie' : '📺 TV Series'}
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-2 leading-snug">
                  {selectedMedia.title || selectedMedia.name}
                </h2>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-400 font-semibold flex-wrap">
                  <span className="text-amber-400 flex items-center gap-0.5">
                    <Star size={11} className="fill-current" />{selectedMedia.vote_average.toFixed(1)}
                  </span>
                  · <span>{getYear(selectedMedia)}</span>
                  {mediaDetails?.runtime && <> · <span className="flex items-center gap-0.5"><Clock size={11} />{mediaDetails.runtime}m</span></>}
                </div>
                {mediaDetails?.genres && (
                  <p className="text-[10px] text-zinc-600 uppercase font-bold mt-1.5 tracking-wide">
                    {formatGenres(mediaDetails.genres)}
                  </p>
                )}
              </div>

              <div>
                <h4 className="text-[10px] uppercase font-extrabold text-zinc-500 tracking-wider mb-1.5">Synopsis</h4>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">{selectedMedia.overview}</p>
              </div>

              {detailsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="w-7 h-7 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : selectedMedia.media_type === 'movie' ? (
                // MOVIE — instant play button
                <div className="border-t border-zinc-900 pt-4">
                  <button
                    onClick={() => handlePlayMedia(selectedMedia)}
                    className="w-full flex items-center justify-center gap-2.5 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 rounded-2xl font-extrabold text-black text-sm shadow-lg shadow-amber-500/25 transition-all active:scale-95"
                  >
                    <Play size={18} className="fill-black" />
                    Watch Now
                  </button>
                  <p className="text-[10px] text-zinc-600 text-center mt-2">Plays instantly on Server 1 · Switch servers anytime</p>
                </div>
              ) : (
                // TV SERIES — episodes
                <div className="border-t border-zinc-900 pt-4 flex flex-col gap-3">
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
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {episodes.map(ep => {
                        const isSelected = selectedEpisode?.id === ep.id;
                        return (
                          <button
                            key={ep.id}
                            onClick={() => handleEpisodeSelect(ep)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-200 ${
                              isSelected
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
                            <div className="ml-3 shrink-0 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-md shadow-amber-500/30">
                              <Play size={12} className="fill-black ml-0.5" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RealSSA Player */}
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

      <Footer />
    </div>
  );
}
