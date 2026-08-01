import React, { useState } from 'react';
import { Play, X, ShieldAlert, Monitor, Volume2, Maximize, EyeOff, ShieldCheck } from 'lucide-react';
import { HlsPlayer } from './HlsPlayer';
import { SandboxedIframe } from './SandboxedIframe';

interface CinemaPlayerProps {
  url: string;
  title: string;
  isEmbed: boolean;
  onClose: () => void;
}

export default function CinemaPlayer({ url, title, isEmbed, onClose }: CinemaPlayerProps) {
  const [cinemaMode, setCinemaMode] = useState(true);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md p-2 sm:p-4">
      {/* Dynamic ambient background glow */}
      <div className="absolute inset-0 bg-radial-glow opacity-30 pointer-events-none transition-all duration-1000 bg-gradient-to-tr from-amber-500/10 via-zinc-950 to-red-500/10" />

      {/* Main player shell */}
      <div className="relative w-full max-w-5xl aspect-video bg-zinc-950 rounded-2xl sm:rounded-3xl border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col transition-all duration-500">
        
        {/* Top Header controls */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/90 to-transparent">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Now Playing
            </span>
            <h3 className="text-white text-sm sm:text-base font-bold truncate drop-shadow max-w-[250px] sm:max-w-md">
              {title}
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Safe Shield Indicator */}
            {isEmbed && (
              <div className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md">
                <ShieldCheck size={12} />
                Sandboxed Secure
              </div>
            )}
            
            <button
              onClick={onClose}
              className="p-2 sm:p-2.5 bg-black/60 hover:bg-red-600 rounded-full text-white backdrop-blur-md transition-all duration-300 border border-white/10 shadow-lg"
              title="Close Player"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Video Player Main Area */}
        <div className="flex-1 w-full h-full relative bg-black flex items-center justify-center">
          {isEmbed ? (
            <SandboxedIframe src={url} className="w-full h-full" />
          ) : (
            <HlsPlayer src={url} className="w-full h-full" />
          )}

          {/* Iframe Shield Safety Overlay Banner */}
          {isEmbed && (
            <div className="absolute bottom-4 left-4 right-4 pointer-events-none z-40 bg-zinc-950/80 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-amber-500/20 max-w-lg hidden sm:flex items-start gap-2.5 shadow-lg select-none">
              <ShieldAlert className="text-amber-500 shrink-0 mt-0.5" size={16} />
              <div className="text-left">
                <p className="text-xs font-bold text-zinc-100">Anti-Redirect Shield Active</p>
                <p className="text-[10px] text-zinc-400 leading-relaxed mt-0.5">
                  RealSSA News runs this stream in a strict sandbox. Any automatic popups, ads, or site redirects from the provider have been successfully blocked.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer info/controls bar */}
        <div className="p-3 sm:p-4 bg-gradient-to-t from-black/95 to-zinc-950/90 border-t border-white/5 flex items-center justify-between z-40 text-xs text-white/60">
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-white/10 text-white text-[10px] font-bold">
              {isEmbed ? 'EMBED FEED' : 'DIRECT HLS'}
            </span>
            <span className="text-[10px] tracking-wide text-zinc-400">
              Provider: {isEmbed ? 'Third-Party Mirror' : 'RealSSA CDN'}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {isEmbed && (
              <div className="flex sm:hidden items-center gap-1 text-emerald-400 text-[10px] font-bold">
                <ShieldCheck size={12} /> Secure
              </div>
            )}
            <span className="text-zinc-500 text-[10px] hidden sm:inline">
              Adjust mirror if playback buffers
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
