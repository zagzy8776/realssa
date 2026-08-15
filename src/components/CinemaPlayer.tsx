import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Server, ChevronLeft, ChevronRight } from 'lucide-react';
import { SandboxedIframe } from './SandboxedIframe';


// All active servers — ordered by reliability (least ads first)
function buildServerList(tmdbId: number, mediaType: 'movie' | 'tv', season: number, episode: number) {
  const isTV = mediaType === 'tv';
  return [
    {
      name: 'Server 1 · AutoEmbed',
      url: isTV
        ? `https://autoembed.co/tv/tmdb/${tmdbId}-${season}-${episode}`
        : `https://autoembed.co/movie/tmdb/${tmdbId}`
    },
    {
      name: 'Server 2 · MultiEmbed',
      url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1${isTV ? `&s=${season}&e=${episode}` : ''}`
    },
    {
      name: 'Server 3 · VidSrc',
      url: isTV
        ? `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`
        : `https://vidsrc.to/embed/movie/${tmdbId}`
    },
    {
      name: 'Server 4 · VidSrc.su',
      url: isTV
        ? `https://vidsrc.su/embed/tv/${tmdbId}/${season}/${episode}`
        : `https://vidsrc.su/embed/movie/${tmdbId}`
    },
  ];
}


interface CinemaPlayerProps {
  tmdbId: number;
  mediaType?: 'movie' | 'tv';
  season?: number;
  episode?: number;
  title: string;
  onClose: () => void;
}

export default function CinemaPlayer({
  tmdbId,
  mediaType = 'movie',
  season = 1,
  episode = 1,
  title,
  onClose,
}: CinemaPlayerProps) {
  const servers = buildServerList(tmdbId, mediaType, season, episode);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showServers, setShowServers] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Protect parent page from being redirected by iframe ads
  useEffect(() => {
    const preventRedirect = (e: BeforeUnloadEvent) => {
      const msg = "Stay on RealSSA to continue watching your movie?";
      e.returnValue = msg;
      return msg;
    };
    window.addEventListener('beforeunload', preventRedirect);
    return () => {
      window.removeEventListener('beforeunload', preventRedirect);
    };
  }, []);

  const goNext = useCallback(() => {
    setActiveIdx(prev => (prev + 1) % servers.length);
  }, [servers.length]);

  const goPrev = useCallback(() => {
    setActiveIdx(prev => (prev - 1 + servers.length) % servers.length);
  }, [servers.length]);

  const activeServer = servers[activeIdx];

  return (
    // TRUE FULLSCREEN — covers entire phone/screen, bg gradient for spatial feel
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-zinc-950 via-black to-zinc-950 flex flex-col">

      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-950/80 backdrop-blur-md border-b border-white/10 shrink-0">
        <div className="flex flex-col min-w-0">
          {/* Brand */}
          <span className="text-[9px] uppercase font-black tracking-widest text-amber-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            RealSSA Player · {activeServer.name}
          </span>
          <h3 className="text-white text-xs sm:text-sm font-black truncate max-w-[200px] sm:max-w-md leading-tight mt-0.5 drop-shadow">
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Prev server */}
          <button
            onClick={goPrev}
            title="Previous server"
            className="p-2 bg-zinc-900/60 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-all border border-white/5 active:scale-90"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Server toggle */}
          <button
            onClick={() => setShowServers(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${
              showServers
                ? 'bg-amber-500 text-black border-amber-600 font-bold shadow-md shadow-amber-500/20'
                : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 border-white/5'
            }`}
          >
            <Server size={11} />
            <span>Servers</span>
          </button>

          {/* Next server */}
          <button
            onClick={goNext}
            title="Next server"
            className="p-2 bg-zinc-900/60 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-all border border-white/5 active:scale-90"
          >
            <ChevronRight size={14} />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 bg-zinc-900/60 hover:bg-red-600 rounded-full text-zinc-400 hover:text-white transition-all border border-white/5 ml-1 active:scale-90"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── SERVER PICKER DRAWER (hidden by default) ── */}
      {showServers && (
        <div className="shrink-0 bg-zinc-950/90 backdrop-blur-xl border-b border-white/10 px-4 py-3 animate-in slide-in-from-top duration-300">
          <div
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto no-scrollbar pb-1"
          >
            {servers.map((srv, i) => (
              <button
                key={i}
                onClick={() => { setActiveIdx(i); setShowServers(false); }}
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all shrink-0 active:scale-95 ${
                  i === activeIdx
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md shadow-amber-500/25 scale-105 font-black'
                    : 'bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 border border-white/5'
                }`}
              >
                {srv.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── VIDEO — fills all remaining screen space with ambient backlight glow ── */}
      <div className="flex-1 relative bg-black flex items-center justify-center p-2 sm:p-6 md:p-10">
        <div className="w-full h-full max-w-6xl max-h-[85vh] relative rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(245,158,11,0.15),0_20px_50px_rgba(0,0,0,0.9)] bg-zinc-950">
          <SandboxedIframe
            key={`${tmdbId}-${mediaType}-${season}-${episode}-${activeIdx}`}
            src={activeServer.url}
            className="absolute inset-0 w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}
