import React, { useState, useEffect, useRef, useMemo } from 'react';
import Hls from 'hls.js';
import { apiUrl } from '@/lib/api-base';
import { X, Tv, Shield, RefreshCw, Signal, AlertTriangle } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// RealSSA Own Sports Player
// Plays DIRECT HLS (.m3u8) streams natively — no foreign sites,
// no heavy ads, full control. Iframe servers remain as fallback.
// ─────────────────────────────────────────────────────────────

export interface DirectSource {
  url: string;
  quality?: string;
  label?: string;
}

interface SportsPlayerProps {
  channelId: string | number;
  title: string;
  onClose: () => void;
  // Native playback inputs
  directSources?: DirectSource[];
  home?: string | null;
  away?: string | null;
  homeCrest?: string | null;
  awayCrest?: string | null;
  isLive?: boolean;
}

// Iframe fallback servers (used when no direct HLS is available)
const IFRAME_SERVERS = [
  {
    label: 'Server 1',
    key: 'streamed',
    buildUrl: (id: string | number) => `https://streamed.st/embed/${id}`,
    homepage: 'https://streamed.st',
  },
  {
    label: 'Server 2',
    key: 'superabbit',
    buildUrl: () => `https://site04.superabbit77hd.skin/`,
    homepage: 'https://site04.superabbit77hd.skin/',
  },
  {
    label: 'Server 3',
    key: 'strikeout',
    buildUrl: (id: string | number) => `https://strikeout.im/embed/${id}`,
    homepage: 'https://strikeout.im',
  },
];

function parseTeamsFromTitle(title: string): { home: string | null; away: string | null } {
  const delimiters = [' vs ', ' VS ', ' - ', ' @ '];
  for (const d of delimiters) {
    if (title.includes(d)) {
      const parts = title.split(d);
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        return { home: parts[0].trim(), away: parts[1].trim().replace(/\s*\(.*?\)\s*$/, '').trim() };
      }
    }
  }
  return { home: null, away: null };
}

export default function SportsPlayer({
  channelId,
  title,
  onClose,
  directSources,
  home,
  away,
  homeCrest,
  awayCrest,
  isLive,
}: SportsPlayerProps) {
  // Category browsing (non-numeric channel id) → iframe homepage mode
  const isCategory = typeof channelId === 'string' && (
    isNaN(Number(channelId)) ||
    ['superabbit', 'strikeout', 'streamed'].includes(channelId)
  );

  // Resolve teams for on-demand source lookup
  const parsed = useMemo(() => parseTeamsFromTitle(title), [title]);
  const teamHome = home || parsed.home;
  const teamAway = away || parsed.away;

  // Playback mode: native if we have direct sources, otherwise iframe
  const [sources, setSources] = useState<DirectSource[]>(directSources || []);
  const [mode, setMode] = useState<'native' | 'iframe'>(directSources?.length ? 'native' : 'iframe');
  const [srcIdx, setSrcIdx] = useState(0);
  const [serverIdx, setServerIdx] = useState(0);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [autoSwitched, setAutoSwitched] = useState(0);
  const [sourcesNote, setSourcesNote] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSource = sources[srcIdx] || null;
  const iframeServer = IFRAME_SERVERS[serverIdx];

  // On-demand source fetch when we don't have direct sources for a real fixture
  useEffect(() => {
    if (directSources?.length) { setSources(directSources); setMode('native'); return; }
    if (isCategory) { setMode('iframe'); return; }
    if (!teamHome || !teamAway) { setMode('iframe'); return; }

    let cancelled = false;
    const params = new URLSearchParams({
      home: teamHome, away: teamAway,
      ...(homeCrest ? { homeCrest } : {}),
      ...(awayCrest ? { awayCrest } : {}),
    });
    fetch(apiUrl(`/api/sports/match-sources?${params.toString()}`))
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        const list: DirectSource[] = Array.isArray(data?.directSources) ? data.directSources : [];
        if (list.length) {
          setSources(list);
          setMode('native');
        } else {
          setSources([]);
          setMode('iframe');
          setSourcesNote('No direct stream found for this match yet — using fallback servers.');
        }
      })
      .catch(() => { if (!cancelled) setMode('iframe'); });
    return () => { cancelled = true; };
  }, [directSources, isCategory, teamHome, teamAway, homeCrest, awayCrest]);

  // ── Native HLS engine with watchdog + auto source-fallback ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || mode !== 'native' || !activeSource?.url) return;

    setStatus('loading');
    let hls: Hls | null = null;
    let recoveredOnce = false;

    const clearWatchdog = () => {
      if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
    };
    const failover = () => {
      clearWatchdog();
      if (hls) { hls.destroy(); hls = null; hlsRef.current = null; }
      setSrcIdx(prev => {
        if (prev + 1 < sources.length) {
          setAutoSwitched(p => p + 1);
          return prev + 1;
        }
        // All direct sources exhausted → iframe fallback servers
        setMode('iframe');
        setSourcesNote('Direct streams are down — switched to fallback servers.');
        return prev;
      });
    };
    watchdogRef.current = setTimeout(failover, 20000);

    const isHlsUrl = /\.m3u8(?:$|[?#])/i.test(activeSource.url);
    if (!isHlsUrl) {
      video.src = activeSource.url;
      const onCan = () => { setStatus('playing'); clearWatchdog(); };
      const onErr = () => failover();
      video.addEventListener('loadeddata', onCan);
      video.addEventListener('error', onErr);
      video.play().catch(() => {});
      return () => {
        clearWatchdog();
        video.removeEventListener('loadeddata', onCan);
        video.removeEventListener('error', onErr);
        video.removeAttribute('src'); video.load();
      };
    }

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        capLevelToPlayerSize: true,
        maxBufferLength: 30,
        manifestLoadingTimeOut: 12000,
        manifestLoadingMaxRetry: 1,
      });
      hlsRef.current = hls;
      hls.loadSource(activeSource.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus('playing');
        clearWatchdog();
        video.play().catch(() => {});
      });
      const onPlaying = () => clearWatchdog();
      video.addEventListener('playing', onPlaying);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data?.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !recoveredOnce) {
          recoveredOnce = true;
          hls?.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recoveredOnce) {
          recoveredOnce = true;
          hls?.recoverMediaError();
          return;
        }
        failover();
      });

      return () => {
        clearWatchdog();
        video.removeEventListener('playing', onPlaying);
        if (hls) { hls.destroy(); hlsRef.current = null; }
        video.removeAttribute('src');
        video.load();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = activeSource.url;
      const onCan = () => { setStatus('playing'); clearWatchdog(); };
      const onErr = () => failover();
      video.addEventListener('loadeddata', onCan);
      video.addEventListener('error', onErr);
      video.play().catch(() => {});
      return () => {
        clearWatchdog();
        video.removeEventListener('loadeddata', onCan);
        video.removeEventListener('error', onErr);
        video.removeAttribute('src'); video.load();
      };
    } else {
      setMode('iframe');
      setSourcesNote('This browser cannot play direct streams — using fallback servers.');
      clearWatchdog();
      return () => clearWatchdog();
    }
  }, [mode, activeSource?.url, sources.length]);

  // Iframe mode watchdog (blank embeds are common)
  useEffect(() => {
    if (mode !== 'iframe') return;
    setStatus('loading');
    const t = setTimeout(() => setStatus(s => (s === 'loading' ? 'playing' : s)), 12000);
    return () => clearTimeout(t);
  }, [mode, serverIdx, channelId]);

  // Auto-switch to corresponding server if channelId matches a provider key
  useEffect(() => {
    if (channelId === 'superabbit') setServerIdx(1);
    else if (channelId === 'strikeout') setServerIdx(2);
    else if (channelId === 'streamed') setServerIdx(0);
  }, [channelId]);

  const streamUrl = isCategory
    ? iframeServer.homepage
    : iframeServer.buildUrl(channelId);

  const handleSwitchServer = (idx: number) => {
    setServerIdx(idx);
    localStorage.setItem('realssa_sports_server', IFRAME_SERVERS[idx].key);
  };

  // Restore saved iframe server preference
  useEffect(() => {
    const saved = localStorage.getItem('realssa_sports_server');
    const found = IFRAME_SERVERS.findIndex(s => s.key === saved);
    if (found >= 0 && !isCategory) setServerIdx(found);
  }, [isCategory]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Redirect-hijack protection
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      const msg = 'Stay on RealSSA to continue watching?';
      e.returnValue = msg;
      return msg;
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);

  const manualNextSource = () => {
    if (mode === 'native' && sources.length > 1) {
      setSrcIdx(p => (p + 1) % sources.length);
      setAutoSwitched(p => p + 1);
    } else if (mode === 'iframe') {
      setServerIdx(p => (p + 1) % IFRAME_SERVERS.length);
    }
  };

  const activeLabel = mode === 'native'
    ? (activeSource?.label || `Direct Stream ${srcIdx + 1}`)
    : iframeServer.label;

  return (
    <div className="fixed inset-0 h-[100dvh] z-[9999] bg-gradient-to-b from-zinc-950 via-black to-zinc-950 flex flex-col font-sans select-none animate-in fade-in duration-300">

      {/* ── TOP BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-zinc-950/85 backdrop-blur-md border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {(homeCrest || awayCrest) && mode === 'native' && (
            <div className="flex -space-x-1.5 shrink-0">
              {homeCrest && <img src={homeCrest} alt="" className="w-6 h-6 rounded-full bg-white/10 border border-white/20 object-contain p-0.5" />}
              {awayCrest && <img src={awayCrest} alt="" className="w-6 h-6 rounded-full bg-white/10 border border-white/20 object-contain p-0.5" />}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] uppercase font-black tracking-widest text-amber-500 flex items-center gap-1.5">
              {isLive || mode === 'native' ? (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
              ) : (
                <Signal size={10} />
              )}
              {mode === 'native' ? 'RealSSA Direct Stream' : 'Live Sports Stream'}
            </span>
            <h3 className="text-white text-xs sm:text-sm font-black truncate max-w-[280px] sm:max-w-md mt-0.5 flex items-center gap-2">
              <Tv size={14} className="text-zinc-400 shrink-0" />
              {title}
            </h3>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          {mode === 'native' && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-[10px] font-black uppercase tracking-wider">
              <Shield size={11} />
              Ad-Light Direct Feed
            </div>
          )}

          <button
            onClick={manualNextSource}
            title={mode === 'native' ? 'Try next direct source' : 'Try next server'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/60 hover:bg-zinc-800 rounded-full text-zinc-300 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all border border-white/5 active:scale-90"
          >
            <RefreshCw size={11} />
            {mode === 'native' ? `Source ${srcIdx + 1}/${sources.length}` : 'Switch Server'}
          </button>

          {!isCategory && (
            <button
              onClick={() => setMode(m => (m === 'native' && sources.length ? 'iframe' : (sources.length ? 'native' : 'iframe')))}
              title={mode === 'native' ? 'Switch to fallback servers' : 'Switch back to direct stream'}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border active:scale-90 ${
                mode === 'iframe' && sources.length
                  ? 'bg-amber-500 text-black border-amber-600'
                  : 'bg-zinc-900/60 text-zinc-400 hover:text-white border-white/5'
              }`}
            >
              {mode === 'native' ? 'Servers' : 'Direct'}
            </button>
          )}

          <button
            onClick={onClose}
            className="p-2 bg-zinc-900/60 hover:bg-red-600 rounded-full text-zinc-400 hover:text-white transition-all border border-white/5 ml-1 active:scale-90"
            title="Close Player"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Source / Server tab bar ── */}
      {mode === 'native' && sources.length > 0 ? (
        <div className="flex gap-2 px-4 py-2.5 bg-zinc-950 border-b border-white/10 shrink-0 overflow-x-auto no-scrollbar">
          {sources.map((s, i) => (
            <button
              key={`${s.url}-${i}`}
              onClick={() => setSrcIdx(i)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                i === srcIdx
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-black shadow-md shadow-emerald-500/25 scale-105'
                  : 'bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-white/5'
              }`}
            >
              {s.label || `Source ${i + 1}`}
            </button>
          ))}
        </div>
      ) : !isCategory ? (
        <div className="flex gap-2 px-4 py-2.5 bg-zinc-950 border-b border-white/10 shrink-0 overflow-x-auto no-scrollbar">
          {IFRAME_SERVERS.map((srv, i) => (
            <button
              key={srv.key}
              onClick={() => handleSwitchServer(i)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                i === serverIdx
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md shadow-amber-500/25 scale-105'
                  : 'bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-white/5'
              }`}
            >
              {srv.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* ── STREAM WINDOW — full-bleed, fills all free height ── */}
      <div className="flex-1 min-h-0 w-full h-full bg-black relative overflow-hidden">
        {mode === 'native' && activeSource ? (
          <div className="absolute inset-0 bg-black">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full bg-black"
              controls
              playsInline
              autoPlay
              muted
              crossOrigin="anonymous"
            />
            {status === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 pointer-events-none">
                <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400">
                  Connecting to {activeLabel}…
                </p>
                {autoSwitched > 0 && (
                  <p className="text-[10px] text-amber-400 font-bold">Auto-switched {autoSwitched}×</p>
                )}
              </div>
            )}
            {status === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85">
                <AlertTriangle size={22} className="text-amber-500" />
                <p className="text-xs font-black text-zinc-200">This source went down</p>
                <button onClick={manualNextSource} className="mt-1 px-4 py-1.5 bg-amber-500 text-black text-[10px] font-black uppercase rounded-full">
                  Try Next Source
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 bg-zinc-950">
            <iframe
              key={`iframe-${serverIdx}-${channelId}`}
              src={streamUrl}
              className="absolute inset-0 block w-full h-full min-h-full border-0 bg-black"
              style={{ height: '100%', minHeight: '100%' }}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              referrerPolicy="no-referrer"
              title="RealSSA Sports Stream"
              onLoad={() => setStatus('playing')}
            />
          </div>
        )}
      </div>

      {/* ── BOTTOM HINT ── */}
      <div className="px-4 py-2.5 bg-zinc-950 border-t border-white/10 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-zinc-500 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {mode === 'native' ? (
            <>
              <Shield size={10} className="text-emerald-500 shrink-0" />
              <span className="truncate">Native RealSSA player — direct feed, no pop-ups.</span>
            </>
          ) : (
            <>
              <Shield size={10} className="text-amber-500 shrink-0" />
              <span className="truncate">
                {sourcesNote || 'If an ad redirects you, press Back or Stay.'}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-zinc-500 shrink-0">
          <span>{mode === 'native' ? 'Blank? Try Next Source' : 'Blank? Switch server above'}</span>
        </div>
      </div>

    </div>
  );
}
