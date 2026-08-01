import React, { useState, useEffect } from 'react';
import { Play, X, ShieldAlert, Monitor, Volume2, Maximize, EyeOff, ShieldCheck, Server, RefreshCw, Zap } from 'lucide-react';
import { HlsPlayer } from './HlsPlayer';
import { SandboxedIframe } from './SandboxedIframe';
import { apiUrl } from '@/lib/api-base';

export interface StreamSource {
  source_name: string;
  url: string;
  quality: string;
  is_embed: boolean;
  type?: 'hls' | 'iframe';
}

interface CinemaPlayerProps {
  sources: StreamSource[];
  title: string;
  onClose: () => void;
}

export default function CinemaPlayer({ sources, title, onClose }: CinemaPlayerProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isBufferingNotice, setIsBufferingNotice] = useState(false);

  const activeSource = sources && sources.length > 0 ? sources[activeIdx] || sources[0] : null;

  useEffect(() => {
    // Show a helpful tip after 6 seconds if video is taking long
    const timer = setTimeout(() => {
      setIsBufferingNotice(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, [activeIdx]);

  if (!activeSource) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 p-4 text-white">
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 text-center max-w-md">
          <p className="text-amber-500 font-bold mb-2">No active video servers found</p>
          <p className="text-xs text-zinc-400 mb-4">Please check back shortly or try selecting a different episode.</p>
          <button onClick={onClose} className="px-4 py-2 bg-amber-500 text-black font-bold rounded-full text-xs">
            Close Player
          </button>
        </div>
      </div>
    );
  }

  const isHls = activeSource.type === 'hls' || activeSource.url.includes('.m3u8');
  const hlsProxyUrl = isHls ? apiUrl(`/api/cinema/proxy-stream?url=${encodeURIComponent(activeSource.url)}`) : activeSource.url;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md p-2 sm:p-4">
      {/* Dynamic ambient background glow */}
      <div className="absolute inset-0 bg-radial-glow opacity-30 pointer-events-none transition-all duration-1000 bg-gradient-to-tr from-amber-500/10 via-zinc-950 to-red-500/10" />

      {/* Main player shell */}
      <div className="relative w-full max-w-5xl aspect-video bg-zinc-950 rounded-2xl sm:rounded-3xl border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col transition-all duration-500">
        
        {/* Top Header controls */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/95 via-black/60 to-transparent">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-amber-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              {isHls ? 'Direct HLS Stream' : 'Live Stream Mirror'}
            </span>
            <h3 className="text-white text-sm sm:text-base font-extrabold truncate drop-shadow max-w-[250px] sm:max-w-md">
              {title}
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold px-2.5 py-1 rounded-full backdrop-blur-md">
              <ShieldCheck size={12} />
              {activeSource.source_name}
            </div>
            
            <button
              onClick={onClose}
              className="p-2 sm:p-2.5 bg-black/70 hover:bg-red-600 rounded-full text-white backdrop-blur-md transition-all duration-300 border border-white/10 shadow-lg"
              title="Close Player"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Video Player Main Area */}
        <div className="flex-1 w-full h-full relative bg-black flex items-center justify-center">
          {isHls ? (
            <HlsPlayer src={hlsProxyUrl} className="w-full h-full" />
          ) : (
            <SandboxedIframe src={activeSource.url} className="w-full h-full" />
          )}

          {/* Buffering or Mirror switch helper overlay banner */}
          {isBufferingNotice && !isHls && (
            <div className="absolute top-16 left-4 right-4 z-40 bg-amber-950/90 backdrop-blur-md p-3 rounded-xl border border-amber-500/40 max-w-md flex items-center justify-between gap-3 shadow-xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-left">
                <Zap size={16} className="text-amber-400 shrink-0 animate-bounce" />
                <p className="text-[11px] font-bold text-amber-200">
                  Slow buffer? Switch to another server below!
                </p>
              </div>
              <button 
                onClick={() => setIsBufferingNotice(false)} 
                className="text-amber-400 hover:text-white p-1"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Footer Info & Multi-Server Selector Bar */}
        <div className="p-3 sm:p-4 bg-gradient-to-t from-black/95 to-zinc-950/90 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 z-40">
          
          {/* Server Switcher Pill Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0 no-scrollbar">
            <span className="text-[10px] uppercase font-extrabold text-zinc-500 flex items-center gap-1 shrink-0">
              <Server size={12} /> Server:
            </span>
            {sources.map((src, index) => (
              <button
                key={index}
                onClick={() => {
                  setActiveIdx(index);
                  setIsBufferingNotice(false);
                }}
                className={`px-3 py-1 rounded-full text-[10px] font-extrabold transition-all duration-200 shrink-0 flex items-center gap-1.5 ${
                  activeIdx === index
                    ? 'bg-amber-500 text-black shadow-md scale-105'
                    : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 border border-white/5'
                }`}
              >
                {index === 0 && <Zap size={10} className="fill-current" />}
                {src.source_name.split(' ')[0]} {index + 1}
              </button>
            ))}
          </div>
          
          <div className="flex items-center justify-between w-full sm:w-auto gap-4 shrink-0">
            <span className="text-zinc-400 text-[10px] font-semibold">
              Quality: {activeSource.quality || '1080p'}
            </span>
            <span className="text-zinc-500 text-[10px] hidden sm:inline">
              Multi-Server Fallback Engine Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
