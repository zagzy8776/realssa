import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ShieldCheck, Server, RefreshCw, Zap, ChevronRight, Globe, Loader2, Tv2, Play } from 'lucide-react';
import { HlsPlayer } from './HlsPlayer';
import { SandboxedIframe } from './SandboxedIframe';
import { apiUrl } from '@/lib/api-base';

export interface StreamSource {
  source_name: string;
  url: string;
  quality: string;
  is_embed: boolean;
  type?: 'hls' | 'iframe';
  region?: string;
}

interface ResolvedStream {
  success: boolean;
  mode: 'direct_hls' | 'iframe_fallback';
  stream_url?: string;
  provider?: string;
  quality?: string;
  is_hls?: boolean;
  subtitles?: { url: string; lang: string }[];
  sources?: StreamSource[];
  from_cache?: boolean;
}

interface CinemaPlayerProps {
  tmdbId: number;
  mediaType?: 'movie' | 'tv';
  season?: number;
  episode?: number;
  title: string;
  onClose: () => void;
}

type PlayerState = 'loading' | 'direct_hls' | 'iframe_fallback' | 'error';

export default function CinemaPlayer({ tmdbId, mediaType = 'movie', season = 1, episode = 1, title, onClose }: CinemaPlayerProps) {
  const [playerState, setPlayerState] = useState<PlayerState>('loading');
  const [resolvedStream, setResolvedStream] = useState<ResolvedStream | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [failedServers, setFailedServers] = useState<Set<number>>(new Set());
  const [isBufferingNotice, setIsBufferingNotice] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const retryCount = useRef(0);

  const resolveStream = useCallback(async () => {
    setPlayerState('loading');
    setLoadProgress(10);
    setIsBufferingNotice(false);

    try {
      setLoadProgress(30);
      const url = apiUrl(`/api/cinema/resolve-stream?id=${tmdbId}&type=${mediaType}&season=${season}&episode=${episode}`);
      const res = await fetch(url);
      setLoadProgress(70);
      const data: ResolvedStream = await res.json();
      setLoadProgress(100);
      setResolvedStream(data);

      if (data.success && data.stream_url) {
        setPlayerState('direct_hls');
      } else {
        setPlayerState('iframe_fallback');
        setActiveIdx(0);
      }
    } catch (err) {
      console.error('[CinemaPlayer] Resolve error:', err);
      setPlayerState('error');
    }
  }, [tmdbId, mediaType, season, episode]);

  useEffect(() => {
    resolveStream();
  }, [resolveStream]);

  // Buffering notice timer
  useEffect(() => {
    setIsBufferingNotice(false);
    const timer = setTimeout(() => setIsBufferingNotice(true), 9000);
    return () => clearTimeout(timer);
  }, [playerState, activeIdx]);

  const tryNextServer = useCallback(() => {
    const sources = resolvedStream?.sources || [];
    setFailedServers(prev => new Set([...prev, activeIdx]));
    const nextIdx = sources.findIndex((_, i) => i > activeIdx && !failedServers.has(i));
    if (nextIdx !== -1) {
      setActiveIdx(nextIdx);
      setIsBufferingNotice(false);
    }
  }, [activeIdx, resolvedStream, failedServers]);

  const iframeSources = resolvedStream?.sources || [];
  const activeIframeSource = iframeSources[activeIdx];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/97 backdrop-blur-xl p-2 sm:p-4">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-amber-500/5 via-transparent to-red-500/5" />

      {/* Main player shell */}
      <div className="relative w-full max-w-5xl flex flex-col bg-zinc-950 rounded-2xl sm:rounded-3xl border border-white/8 overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.9)] transition-all duration-500">

        {/* ── TOP HEADER ── */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/95 to-black/60 border-b border-white/5">
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] uppercase font-extrabold tracking-wider text-amber-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              {playerState === 'loading' && 'Resolving Stream...'}
              {playerState === 'direct_hls' && `Direct HLS · ${resolvedStream?.provider || 'Stream'}`}
              {playerState === 'iframe_fallback' && 'Embed Player Mode'}
              {playerState === 'error' && 'Stream Error'}
            </span>
            <h3 className="text-white text-sm sm:text-base font-extrabold truncate max-w-[260px] sm:max-w-lg">
              {title}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {playerState === 'direct_hls' && (
              <span className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-extrabold px-2.5 py-1 rounded-full">
                <ShieldCheck size={10} /> Native HLS
              </span>
            )}
            {playerState === 'iframe_fallback' && (
              <span className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-extrabold px-2.5 py-1 rounded-full">
                <Tv2 size={10} /> Embed Fallback
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 bg-black/70 hover:bg-red-600 rounded-full text-white backdrop-blur-md transition-all duration-200 border border-white/10"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── VIDEO AREA ── */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center">

          {/* LOADING STATE */}
          {playerState === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
                <Play size={20} className="absolute inset-0 m-auto text-amber-500" />
              </div>
              <div className="flex flex-col items-center gap-2 text-center px-8">
                <p className="text-white font-bold text-sm">Finding the best stream for you...</p>
                <p className="text-zinc-500 text-xs">Checking {3} global stream providers</p>
                {/* Progress bar */}
                <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${loadProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* DIRECT HLS PLAYER — native, our UI, no foreign junk */}
          {playerState === 'direct_hls' && resolvedStream?.stream_url && (
            <HlsPlayer
              src={resolvedStream.stream_url}
              className="w-full h-full"
            />
          )}

          {/* IFRAME FALLBACK */}
          {playerState === 'iframe_fallback' && activeIframeSource && (
            <SandboxedIframe
              src={activeIframeSource.url}
              className="w-full h-full"
            />
          )}

          {/* ERROR STATE */}
          {playerState === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950 text-center px-8">
              <X size={40} className="text-red-500" />
              <p className="text-white font-bold">Could not load stream</p>
              <p className="text-zinc-500 text-xs">Check your connection and try again</p>
              <button
                onClick={() => { retryCount.current++; resolveStream(); }}
                className="px-4 py-2 bg-amber-500 text-black font-bold rounded-full text-sm flex items-center gap-2"
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          )}

          {/* Slow buffering notice — only for fallback mode */}
          {isBufferingNotice && playerState === 'iframe_fallback' && (
            <div className="absolute top-3 left-3 right-3 z-40 bg-amber-950/95 backdrop-blur-md p-3 rounded-xl border border-amber-500/40 flex items-center justify-between gap-3 shadow-xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-amber-400 shrink-0 animate-bounce" />
                <p className="text-[11px] font-bold text-amber-200">
                  This server is blocked or slow. Try the next one!
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={tryNextServer} className="text-[10px] font-extrabold bg-amber-500 text-black px-2.5 py-1 rounded-full flex items-center gap-1">
                  Next <ChevronRight size={10} />
                </button>
                <button onClick={() => setIsBufferingNotice(false)} className="text-amber-400 hover:text-white p-1">
                  <X size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER CONTROLS ── */}
        <div className="px-4 py-3 bg-gradient-to-t from-black/95 to-zinc-950/90 border-t border-white/5 flex flex-col gap-2">

          {/* Direct HLS info bar */}
          {playerState === 'direct_hls' && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck size={12} /> Playing via {resolvedStream?.provider}
                </span>
                {resolvedStream?.from_cache && (
                  <span className="text-[9px] text-zinc-600">· cached</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 text-[10px]">Quality: {resolvedStream?.quality || '1080p'}</span>
                <button
                  onClick={resolveStream}
                  title="Re-resolve stream"
                  className="p-1 text-zinc-600 hover:text-amber-400 transition-colors"
                >
                  <RefreshCw size={11} />
                </button>
              </div>
            </div>
          )}

          {/* Iframe fallback server list */}
          {playerState === 'iframe_fallback' && iframeSources.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-extrabold text-zinc-500 flex items-center gap-1 shrink-0">
                  <Server size={11} /> {iframeSources.length} Backup Servers:
                </span>
                <span className="text-[9px] text-zinc-700">← scroll →</span>
                <button
                  onClick={resolveStream}
                  className="ml-auto text-[9px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <RefreshCw size={9} /> Retry Direct
                </button>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {iframeSources.map((src, index) => (
                  <button
                    key={index}
                    onClick={() => { setActiveIdx(index); setIsBufferingNotice(false); }}
                    title={src.source_name}
                    className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-all shrink-0 flex items-center gap-1 ${
                      activeIdx === index
                        ? 'bg-amber-500 text-black shadow scale-105'
                        : failedServers.has(index)
                          ? 'bg-red-900/40 text-red-400 border border-red-800/30 line-through'
                          : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 border border-white/5'
                    }`}
                  >
                    {index === 0 && <Zap size={8} className="fill-current shrink-0" />}
                    <span className="truncate max-w-[100px]">{src.source_name}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                {activeIframeSource?.region && (
                  <span className="text-[9px] text-zinc-600 flex items-center gap-1">
                    <Globe size={9} /> {activeIframeSource.region}
                  </span>
                )}
                <span className="text-zinc-500 text-[9px] ml-auto">
                  Quality: {activeIframeSource?.quality || '1080p'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
