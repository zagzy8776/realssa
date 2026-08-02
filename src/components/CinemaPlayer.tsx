import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Server, ChevronLeft, ChevronRight } from 'lucide-react';
import { SandboxedIframe } from './SandboxedIframe';


// All active servers — ordered by reliability (least ads first)
function buildServerList(tmdbId: number, mediaType: 'movie' | 'tv', season: number, episode: number) {
  const isTV = mediaType === 'tv';
  return [
    {
      name: 'Server 1 · MultiEmbed',
      url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1${isTV ? `&s=${season}&e=${episode}` : ''}`
    },
    {
      name: 'Server 2 · AutoEmbed',
      url: isTV
        ? `https://autoembed.co/tv/tmdb/${tmdbId}-${season}-${episode}`
        : `https://autoembed.co/movie/tmdb/${tmdbId}`
    },
    {
      name: 'Server 3 · VidSrc',
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
    // TRUE FULLSCREEN — covers entire phone/screen, no border-radius on mobile
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">

      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/95 border-b border-white/5 shrink-0">
        <div className="flex flex-col min-w-0">
          {/* Brand */}
          <span className="text-[9px] uppercase font-extrabold tracking-widest text-amber-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            RealSSA Player · {activeServer.name}
          </span>
          <h3 className="text-white text-xs sm:text-sm font-extrabold truncate max-w-[220px] sm:max-w-md leading-tight mt-0.5">
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Prev server */}
          <button
            onClick={goPrev}
            title="Previous server"
            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors border border-white/5"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Server toggle */}
          <button
            onClick={() => setShowServers(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-300 text-[10px] font-bold transition-colors border border-white/5"
          >
            <Server size={11} />
            Servers
          </button>

          {/* Next server */}
          <button
            onClick={goNext}
            title="Next server"
            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors border border-white/5"
          >
            <ChevronRight size={14} />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 bg-zinc-900 hover:bg-red-600 rounded-lg text-zinc-400 hover:text-white transition-colors border border-white/5 ml-1"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── SERVER PICKER DRAWER (hidden by default) ── */}
      {showServers && (
        <div className="shrink-0 bg-zinc-950/98 border-b border-white/5 px-3 py-2.5 animate-in slide-in-from-top duration-200">
          <div
            ref={scrollRef}
            className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1"
          >
            {servers.map((srv, i) => (
              <button
                key={i}
                onClick={() => { setActiveIdx(i); setShowServers(false); }}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all shrink-0 ${
                  i === activeIdx
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30 scale-105'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-white/5'
                }`}
              >
                {srv.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── VIDEO — fills all remaining screen space ── */}
      <div className="flex-1 relative bg-black">
        <SandboxedIframe
          key={`${tmdbId}-${mediaType}-${season}-${episode}-${activeIdx}`}
          src={activeServer.url}
          className="absolute inset-0 w-full h-full"
        />
      </div>
    </div>
  );
}
