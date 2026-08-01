import React, { useState, useEffect } from 'react';
import { Play, Info, Search, Heart, Star, Film, Tv, ChevronRight, X, Clock, Calendar, ShieldCheck, Activity, EyeOff } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface StreamSource {
  source_name: string;
  url: string;
  quality: string;
  is_embed: boolean;
}

export default function CinemaHub() {
  const [trending, setTrending] = useState<MovieOrShow[]>([]);
  const [featured, setFeatured] = useState<MovieOrShow | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MovieOrShow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  // Detail Modal State
  const [selectedMedia, setSelectedMedia] = useState<MovieOrShow | null>(null);
  const [mediaDetails, setMediaDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  
  // Stream Playback State
  const [activePlayerSource, setActivePlayerSource] = useState<StreamSource | null>(null);
  const [playerTitle, setPlayerTitle] = useState('');
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [availableSources, setAvailableSources] = useState<StreamSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/cinema/trending'));
      const data = await res.json();
      const results = data.results || [];
      setTrending(results);
      if (results.length > 0) {
        // Find a featured movie with backdrop
        const movieWithBackdrop = results.find((item: MovieOrShow) => item.backdrop_path && item.overview);
        setFeatured(movieWithBackdrop || results[0]);
      }
    } catch (err) {
      console.error('Failed to fetch trending cinema catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/cinema/search?q=${encodeURIComponent(searchQuery)}`));
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Open detail modal and fetch full info
  const handleOpenDetails = async (media: MovieOrShow) => {
    setSelectedMedia(media);
    setMediaDetails(null);
    setSeasons([]);
    setEpisodes([]);
    setSelectedEpisode(null);
    setAvailableSources([]);
    setDetailsLoading(true);

    try {
      const pathType = media.media_type === 'tv' ? 'shows' : 'movies';
      const res = await fetch(apiUrl(`/api/cinema/${pathType}/${media.id}`));
      const details = await res.json();
      setMediaDetails(details);

      if (media.media_type === 'movie') {
        setAvailableSources(details.sources || []);
      } else if (media.media_type === 'tv') {
        setSeasons(details.seasons || []);
        // Trigger loading of season 1 episodes
        if (details.seasons && details.seasons.length > 0) {
          const s1 = details.seasons[0].season_number;
          setSelectedSeasonNum(s1);
          fetchSeasonEpisodes(media.id, s1);
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
      console.error('Failed to fetch season episodes:', err);
    } finally {
      setEpisodesLoading(false);
    }
  };

  const handleSeasonChange = (seasonNum: number) => {
    setSelectedSeasonNum(seasonNum);
    if (selectedMedia) {
      fetchSeasonEpisodes(selectedMedia.id, seasonNum);
    }
  };

  const handleEpisodeSelect = async (episode: Episode) => {
    setSelectedEpisode(episode);
    setAvailableSources([]);
    setSourcesLoading(true);
    if (!selectedMedia) return;
    
    try {
      const res = await fetch(apiUrl(`/api/cinema/episodes/${selectedMedia.id}/${episode.season_number}/${episode.episode_number}/sources`));
      const data = await res.json();
      setAvailableSources(data.sources || []);
    } catch (err) {
      console.error('Failed to load episode sources:', err);
    } finally {
      setSourcesLoading(false);
    }
  };

  const getPoster = (item: MovieOrShow) => {
    return item.r2_poster_url || (item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : 'https://realssanews.com.ng/logo.png');
  };

  const getBackdrop = (item: MovieOrShow) => {
    return item.r2_backdrop_url || (item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : 'https://realssanews.com.ng/logo.png');
  };

  const getYear = (item: MovieOrShow) => {
    const dateStr = item.release_date || item.first_air_date || '';
    return dateStr ? dateStr.substring(0, 4) : 'N/A';
  };

  const formatGenres = (genres: any[]) => {
    if (!genres || genres.length === 0) return 'Cinema';
    return genres.slice(0, 3).map(g => g.name).join(' • ');
  };

  const startPlayingMedia = (source: StreamSource, title: string) => {
    setActivePlayerSource(source);
    setPlayerTitle(title);
  };

  const getFeaturedTitle = () => {
    if (!featured) return '';
    return featured.title || featured.name || '';
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans select-none">
      <Header />

      {/* Hero Banner Section */}
      {!isSearching && featured && (
        <section className="relative w-full h-[60vh] sm:h-[80vh] bg-zinc-950 flex flex-col justify-end overflow-hidden border-b border-zinc-900">
          <div className="absolute inset-0">
            <img 
              src={getBackdrop(featured)} 
              alt={getFeaturedTitle()} 
              className="w-full h-full object-cover scale-105"
            />
            {/* Dark Gradient Mask */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/10 to-transparent" />
          </div>

          <div className="container mx-auto px-4 py-8 sm:py-16 relative z-10 max-w-4xl text-left">
            <span className="bg-amber-500 text-black text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5 w-max mb-3">
              <Film size={12} className="fill-current" />
              Featured Release
            </span>
            
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-extrabold text-white leading-tight drop-shadow-md">
              {getFeaturedTitle()}
            </h1>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 text-xs sm:text-sm font-semibold text-zinc-300">
              <span className="flex items-center gap-1 text-amber-400">
                <Star size={14} className="fill-current" />
                {featured.vote_average.toFixed(1)} Rating
              </span>
              <span>•</span>
              <span>{getYear(featured)}</span>
              <span>•</span>
              <span className="uppercase bg-zinc-800 text-zinc-200 px-2 py-0.5 rounded text-[10px] font-bold">
                {featured.media_type}
              </span>
            </div>

            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed max-w-xl mt-4 line-clamp-3 sm:line-clamp-4 drop-shadow">
              {featured.overview}
            </p>

            <div className="flex flex-wrap gap-3 mt-6 sm:mt-8">
              <Button 
                onClick={() => handleOpenDetails(featured)}
                className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold px-6 py-2.5 sm:py-3 text-xs sm:text-sm rounded-full flex items-center gap-2 transition-transform duration-300 hover:scale-105 active:scale-95 shadow-lg"
              >
                <Play size={16} className="fill-current" />
                Watch Trailer / Streams
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleOpenDetails(featured)}
                className="bg-white/10 hover:bg-white/20 border-white/10 text-white font-bold px-6 py-2.5 sm:py-3 text-xs sm:text-sm rounded-full flex items-center gap-2 backdrop-blur-md transition-all duration-300"
              >
                <Info size={16} />
                More Info
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Main Catalog / Search Results */}
      <main className="container mx-auto px-4 py-8 flex-1">
        {/* Search Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-zinc-900 pb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-display font-extrabold flex items-center gap-2 text-white">
              <Film className="text-amber-500" size={24} /> 
              {isSearching ? 'Search Results' : 'Cinema & Movie Box'}
            </h2>
            <p className="text-xs text-zinc-400 mt-1">Discover, stream, and enjoy blockbusters directly in-app.</p>
          </div>

          <form onSubmit={handleSearch} className="relative w-full max-w-sm flex items-center">
            <Input 
              type="text"
              placeholder="Search movies, tv shows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-900/60 border-zinc-800 text-zinc-200 placeholder-zinc-500 rounded-full pl-5 pr-12 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 backdrop-blur-sm"
            />
            <button 
              type="submit" 
              className="absolute right-2 p-2 bg-amber-500 hover:bg-amber-600 text-black rounded-full transition-colors"
            >
              <Search size={14} />
            </button>
          </form>
        </div>

        {/* Shimmer Loader */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-zinc-900 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Content display */}
        {!loading && (
          isSearching ? (
            searchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleOpenDetails(item)}
                    className="group relative cursor-pointer aspect-[2/3] bg-zinc-900 rounded-2xl border border-zinc-850 overflow-hidden hover:border-zinc-700 transition-all duration-300"
                  >
                    <img 
                      src={getPoster(item)} 
                      alt={item.title || item.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                      <h3 className="text-white text-xs font-bold leading-tight line-clamp-2">
                        {item.title || item.name}
                      </h3>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1">
                        <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                          <Star size={10} className="fill-current" />
                          {item.vote_average.toFixed(1)}
                        </span>
                        <span>{getYear(item)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-zinc-500 flex flex-col items-center gap-3">
                <EyeOff size={32} />
                <p className="text-sm">No movies or TV shows found matching your search.</p>
              </div>
            )
          ) : (
            // Default Catalog
            <div className="space-y-10">
              {/* Row 1: Popular Movies */}
              <div>
                <h3 className="text-md sm:text-lg font-bold text-white mb-4 flex items-center justify-between">
                  🔥 Popular Releases
                  <ChevronRight size={18} className="text-zinc-500" />
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
                  {trending.filter(item => item.media_type === 'movie').map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleOpenDetails(item)}
                      className="flex-shrink-0 w-36 sm:w-44 aspect-[2/3] group relative cursor-pointer bg-zinc-900 rounded-2xl border border-zinc-850 overflow-hidden hover:border-zinc-700 transition-all duration-300 snap-start"
                    >
                      <img 
                        src={getPoster(item)} 
                        alt={item.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent p-3 flex flex-col justify-end">
                        <h4 className="text-white text-[11px] font-bold leading-tight line-clamp-1 group-hover:line-clamp-2 transition-all duration-300">
                          {item.title}
                        </h4>
                        <div className="flex items-center justify-between text-[9px] text-zinc-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <span className="flex items-center gap-0.5 text-amber-500">
                            <Star size={8} className="fill-current" />
                            {item.vote_average.toFixed(1)}
                          </span>
                          <span>{getYear(item)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 2: Popular TV Shows */}
              <div>
                <h3 className="text-md sm:text-lg font-bold text-white mb-4 flex items-center justify-between">
                  📺 Trending Series
                  <ChevronRight size={18} className="text-zinc-500" />
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
                  {trending.filter(item => item.media_type === 'tv').map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleOpenDetails(item)}
                      className="flex-shrink-0 w-36 sm:w-44 aspect-[2/3] group relative cursor-pointer bg-zinc-900 rounded-2xl border border-zinc-850 overflow-hidden hover:border-zinc-700 transition-all duration-300 snap-start"
                    >
                      <img 
                        src={getPoster(item)} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent p-3 flex flex-col justify-end">
                        <h4 className="text-white text-[11px] font-bold leading-tight line-clamp-1 group-hover:line-clamp-2 transition-all duration-300">
                          {item.name}
                        </h4>
                        <div className="flex items-center justify-between text-[9px] text-zinc-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <span className="flex items-center gap-0.5 text-amber-500">
                            <Star size={8} className="fill-current" />
                            {item.vote_average.toFixed(1)}
                          </span>
                          <span>{getYear(item)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}
      </main>

      {/* Cinematic Detail Drawer (Slides from right/centered modal) */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/85 backdrop-blur-sm p-0 sm:p-4 transition-all duration-300 animate-in fade-in">
          <div className="w-full sm:max-w-2xl h-full sm:h-[90vh] bg-zinc-950 border-l border-zinc-900 sm:rounded-2xl overflow-y-auto relative flex flex-col shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-right duration-300">
            
            {/* Header backdrop */}
            <div className="relative h-56 sm:h-72 w-full shrink-0">
              <img 
                src={getBackdrop(selectedMedia)} 
                alt={selectedMedia.title || selectedMedia.name} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
              
              {/* Close Button */}
              <button 
                onClick={() => setSelectedMedia(null)}
                className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-zinc-800 rounded-full text-white backdrop-blur-md transition-colors border border-white/10"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Details */}
            <div className="p-5 sm:p-6 flex-1 flex flex-col gap-6 text-left">
              <div>
                <span className="bg-zinc-800 text-zinc-300 text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-full border border-white/5 inline-block">
                  {selectedMedia.media_type === 'movie' ? '🎬 MOVIE' : '📺 TV SERIES'}
                </span>
                
                <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white leading-snug mt-2">
                  {selectedMedia.title || selectedMedia.name}
                </h2>

                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-semibold text-zinc-400">
                  <span className="flex items-center gap-0.5 text-amber-500">
                    <Star size={12} className="fill-current" />
                    {selectedMedia.vote_average.toFixed(1)}
                  </span>
                  <span>•</span>
                  <span>{getYear(selectedMedia)}</span>
                  {mediaDetails && mediaDetails.runtime && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {mediaDetails.runtime} min
                      </span>
                    </>
                  )}
                </div>

                {mediaDetails && mediaDetails.genres && (
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mt-2.5">
                    Genres: {formatGenres(mediaDetails.genres)}
                  </p>
                )}
              </div>

              {/* Overview */}
              <div>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Synopsis</h4>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {selectedMedia.overview}
                </p>
              </div>

              {/* SECTIONS FOR MOVIE VS TV SERIES */}
              {detailsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                selectedMedia.media_type === 'movie' ? (
                  // MOVIE PLAYBACK SERVERS
                  <div className="border-t border-zinc-900 pt-5">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <ShieldCheck className="text-emerald-400" size={14} />
                      Select Streaming Server
                    </h4>
                    
                    {availableSources.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {availableSources.map((src, index) => (
                          <button
                            key={index}
                            onClick={() => startPlayingMedia(src, `${selectedMedia.title || selectedMedia.name} - ${src.source_name}`)}
                            className="flex items-center justify-between p-3 bg-zinc-900 hover:bg-zinc-850 rounded-xl border border-zinc-850 hover:border-amber-500/40 text-left transition-all duration-300 group"
                          >
                            <div>
                              <p className="text-xs font-bold text-zinc-200 group-hover:text-amber-500 transition-colors">
                                {src.source_name}
                              </p>
                              <p className="text-[10px] text-zinc-500 mt-0.5">Secure Sandboxed Player</p>
                            </div>
                            <span className="text-[10px] bg-zinc-950 px-2 py-0.5 rounded font-bold text-zinc-400 group-hover:text-amber-500">
                              {src.quality}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">No servers resolved yet. Check back in a bit.</p>
                    )}
                  </div>
                ) : (
                  // TV SERIES SEASON & EPISODE SELECTION
                  <div className="border-t border-zinc-900 pt-5 flex flex-col gap-4">
                    {/* Season Dropdown */}
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Episodes</h4>
                      {seasons.length > 1 && (
                        <select
                          value={selectedSeasonNum}
                          onChange={(e) => handleSeasonChange(parseInt(e.target.value))}
                          className="bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-200 rounded px-2.5 py-1.5 outline-none focus:border-amber-500"
                        >
                          {seasons.map((s) => (
                            <option key={s.id} value={s.season_number}>
                              {s.name || `Season ${s.season_number}`}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Episodes List */}
                    {episodesLoading ? (
                      <div className="flex items-center justify-center p-8">
                        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                        {episodes.map((ep) => {
                          const isSelected = selectedEpisode?.id === ep.id;
                          return (
                            <div 
                              key={ep.id}
                              className={`p-3 rounded-xl border transition-all duration-300 text-left ${
                                isSelected 
                                  ? 'bg-amber-500/5 border-amber-500/30' 
                                  : 'bg-zinc-900/60 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-zinc-200">
                                    Ep {ep.episode_number}: {ep.name}
                                  </p>
                                  <p className="text-[10px] text-zinc-400 mt-1 line-clamp-2">
                                    {ep.overview || "No overview available for this episode."}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleEpisodeSelect(ep)}
                                  className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold transition-all duration-300 shrink-0 ${
                                    isSelected 
                                      ? 'bg-amber-500 text-black' 
                                      : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                                  }`}
                                >
                                  Select Servers
                                </button>
                              </div>

                              {/* Nested Episode Server Selectors */}
                              {isSelected && (
                                <div className="mt-4 pt-3 border-t border-zinc-850 animate-in slide-in-from-top duration-300">
                                  {sourcesLoading ? (
                                    <div className="flex items-center justify-center p-2">
                                      <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                  ) : (
                                    availableSources.length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {availableSources.map((src, index) => (
                                          <button
                                            key={index}
                                            onClick={() => startPlayingMedia(
                                              src, 
                                              `${selectedMedia.name} - S${ep.season_number}E${ep.episode_number} - ${src.source_name}`
                                            )}
                                            className="flex items-center justify-between p-2 bg-zinc-950 hover:bg-zinc-900 rounded-lg border border-zinc-850 hover:border-amber-500/40 text-left transition-all duration-300 group"
                                          >
                                            <span className="text-[10px] font-bold text-zinc-300 group-hover:text-amber-500 transition-colors">
                                              {src.source_name}
                                            </span>
                                            <span className="text-[9px] bg-zinc-900 px-1.5 py-0.5 rounded font-bold text-zinc-500">
                                              {src.quality}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-[10px] text-zinc-500 text-center">No stream servers online for this episode.</p>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Streaming Player overlay */}
      {activePlayerSource && (
        <CinemaPlayer 
          url={activePlayerSource.url}
          title={playerTitle}
          isEmbed={activePlayerSource.is_embed}
          onClose={() => setActivePlayerSource(null)}
        />
      )}

      <Footer />
    </div>
  );
}
