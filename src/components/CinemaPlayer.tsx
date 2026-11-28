import React, { useState, useCallback, useRef, useEffect } from 'react';
import type Hls from 'hls.js';
import { apiUrl } from '@/lib/api-base';
import { X, Server, ChevronLeft, ChevronRight } from 'lucide-react';
import { SandboxedIframe } from './SandboxedIframe';


// Active embed providers — ordered by current reliability + framing allowance (Oct 2026)
// Probed live. Providers that set X-Frame-Options: SAMEORIGIN or return 403/CF challenges are excluded.
// Goal: give ~800k users multiple working paths so one dead server doesn't kill the experience.
function buildServerList(tmdbId: number, mediaType: 'movie' | 'tv', season: number, episode: number) {
  const isTV = mediaType === 'tv';
  return [
    {
      name: 'Server 1 · MoviesAPI',
      url: isTV
        ? `https://moviesapi.to/tv/${tmdbId}/${season}/${episode}`
        : `https://moviesapi.to/movie/${tmdbId}`
    },
    {
      name: 'Server 2 · 2Embed',
      url: isTV
        ? `https://www.2embed.skin/embedtv/${tmdbId}&s=${season}&e=${episode}`
        : `https://www.2embed.skin/embed/${tmdbId}`
    },
    {
      name: 'Server 3 · VidSrc.pm',
      url: isTV
        ? `https://vidsrc.pm/embed/tv/${tmdbId}/${season}/${episode}`
        : `https://vidsrc.pm/embed/movie/${tmdbId}`
    },
    {
      name: 'Server 4 · VidLink',
      url: isTV
        ? `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`
        : `https://vidlink.pro/movie/${tmdbId}`
    },
    {
      name: 'Server 5 · VidSrc.me',
      url: isTV
        ? `https://vidsrc.me/embed/tv/${tmdbId}/${season}/${episode}`
        : `https://vidsrc.me/embed/movie/${tmdbId}`
    },
    {
      name: 'Server 6 · VidSrc.su',
      url: isTV
        ? `https://vidsrc.su/embed/tv/${tmdbId}/${season}/${episode}`
        : `https://vidsrc.su/embed/movie/${tmdbId}`
    }
  ];
}


interface CinemaPlayerProps {
  tmdbId: number;
  mediaType?: 'movie' | 'tv';
  season?: number;
  episode?: number;
  title: string;
  resumeAt?: number;
  onProgress?: (position: number, duration: number) => void;
  onClose: () => void;
}

export default function CinemaPlayer({
  tmdbId,
  mediaType = 'movie',
  season = 1,
  episode = 1,
  title,
  resumeAt, onProgress, onClose,
}: CinemaPlayerProps) {
  const servers = buildServerList(tmdbId, mediaType, season, episode);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showServers, setShowServers] = useState(false);
  const [directStream, setDirectStream] = useState<string | null>(null);
  const [streamLoading, setStreamLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [fallbackSources, setFallbackSources] = useState<Array<{ name: string; url: string }>>([]);
  const manualServer = useRef(false);
  const lastSave = useRef(0);
  const save = (video: HTMLVideoElement) => {
    if (Number.isFinite(video.duration) && video.currentTime > 0) onProgress?.(video.currentTime, video.duration);
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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
    manualServer.current = true;
    setDirectStream(null);
    setActiveIdx(prev => (prev + 1) % (servers.length + fallbackSources.filter(source => !servers.some(server => server.url === source.url)).length));
  }, [servers, fallbackSources]);

  const availableServers = [...servers, ...fallbackSources.filter(source => !servers.some(server => server.url === source.url))];
  const activeServer = availableServers[activeIdx % availableServers.length];

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setDirectStream(null); setFallbackSources([]); setActiveIdx(0); setStreamLoading(true); setStreamError(null);
    const params = new URLSearchParams({ id: String(tmdbId), type: mediaType, season: String(season), episode: String(episode) });
    fetch(apiUrl('/api/cinema/resolve-stream?' + params.toString()), { headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Stream resolver failed');
        if (data?.success && typeof data?.stream_url === 'string' && /^https:\/\//i.test(data.stream_url)) return data.stream_url as string;
        if (Array.isArray(data?.sources)) {
          const valid = data.sources.filter((source: any) => source?.is_embed && /^https:\/\//i.test(source.url || '')).map((source: any) => ({ name: source.source_name || 'Backup server', url: source.url }));
          if (!cancelled && valid.length) setFallbackSources(valid);
        }
        throw new Error('No playable direct stream was found');
      })
      .then((url) => { if (!cancelled && !manualServer.current) setDirectStream(url); })
      .catch((err) => { if (!cancelled && err?.name !== 'AbortError') setStreamError(err?.message || 'Direct stream unavailable'); })
      .finally(() => { if (!cancelled) setStreamLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [tmdbId, mediaType, season, episode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !directStream) return;
    let hls: Hls | null = null;
    const isHls = /\.m3u8(?:$|[?#])/i.test(directStream);
    if (!isHls) { video.src = directStream; return () => { video.removeAttribute('src'); video.load(); }; }
    let cancelled = false;
    const fail = () => {
      if (cancelled) return;
      setStreamError('The direct stream could not be played.');
      setDirectStream(null);
    };
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = directStream;
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) return fail();
        hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) fail(); });
        hls.loadSource(directStream);
        hls.attachMedia(video);
      }).catch(fail);
    }
    return () => {
      cancelled = true;
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [directStream]);

  return (
    // TRUE FULLSCREEN — covers entire phone/screen, bg gradient for spatial feel
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-zinc-950 via-black to-zinc-950 flex flex-col">

      <div className="cinema-player-bar">
        <button aria-label="Close player" onClick={onClose}><ChevronLeft size={20}/> Back</button>
        <div><small>{directStream ? 'Direct playback' : activeServer.name}</small><strong>{title}</strong></div>
        <button aria-expanded={showServers} onClick={() => setShowServers(v => !v)}><Server size={16}/> Servers</button>
      </div>
      {/* ── SERVER PICKER DRAWER (hidden by default) ── */}
      {showServers && (
        <div className="shrink-0 bg-zinc-950/90 backdrop-blur-xl border-b border-white/10 px-4 py-3 animate-in slide-in-from-top duration-300">
          <div
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto no-scrollbar pb-1"
          >
            {availableServers.map((srv, i) => (
              <button
                key={i}
                onClick={() => { manualServer.current = true; setDirectStream(null); setActiveIdx(i); setShowServers(false); }}
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

      {/* ── VIDEO — direct HLS/MP4 first, provider iframe only if direct fails ── */}
      <div className="flex-1 min-h-0 relative bg-black overflow-hidden">
        <div className="cinema-frame absolute inset-0 bg-black">
          {/* Prefer native HLS when the backend successfully resolves a direct stream */}
          {directStream ? (
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full"
              onLoadedMetadata={e => {
                if (resumeAt > 0 && resumeAt < e.currentTarget.duration - 2) e.currentTarget.currentTime = resumeAt;
              }}
              onTimeUpdate={e => {
                if (Date.now() - lastSave.current >= 5000) { lastSave.current = Date.now(); save(e.currentTarget); }
              }}
              onPause={e => save(e.currentTarget)}
              controls
              autoPlay
              onError={() => { setStreamError('The direct stream could not be played.'); setDirectStream(null); }}
              playsInline
              poster=""
            />
          ) : (
            <SandboxedIframe
              key={String(tmdbId) + '-' + mediaType + '-' + season + '-' + episode + '-' + activeIdx}
              src={activeServer.url}
              className="absolute inset-0 w-full h-full"
            />
          )}


        </div>
      </div>
      {!directStream && <div className="cinema-player-status">
        <span role="status">{streamLoading ? `Connecting to ${activeServer.name}…` : activeServer.name}</span>
        <button onClick={goNext}>Try another server</button>
      </div>}
    </div>
  );
}
