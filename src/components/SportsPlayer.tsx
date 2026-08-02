import React, { useEffect } from 'react';
import { X, Tv, Shield } from 'lucide-react';

interface SportsPlayerProps {
  channelId: string | number;
  title: string;
  onClose: () => void;
}

export default function SportsPlayer({ channelId, title, onClose }: SportsPlayerProps) {
  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Protect parent page from being redirected by iframe ads
  useEffect(() => {
    const preventRedirect = (e: BeforeUnloadEvent) => {
      const msg = "Stay on RealSSA to continue watching your match?";
      e.returnValue = msg;
      return msg;
    };
    window.addEventListener('beforeunload', preventRedirect);
    return () => {
      window.removeEventListener('beforeunload', preventRedirect);
    };
  }, []);

  const streamUrl = `https://daddylive.sx/embed/stream-${channelId}.php`;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col font-sans select-none">
      
      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-950/98 border-b border-white/5 shrink-0">
        <div className="flex flex-col min-w-0">
          <span className="text-[9px] uppercase font-extrabold tracking-widest text-amber-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 absolute" />
            Live Sports · Server SS1
          </span>
          <h3 className="text-white text-xs sm:text-sm font-extrabold truncate max-w-[240px] sm:max-w-md mt-0.5 flex items-center gap-2">
            <Tv size={14} className="text-zinc-400 shrink-0" />
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* AdBlock Shield Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-[10px] font-bold">
            <Shield size={11} />
            Redirect Protection Active
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors border border-white/5"
            title="Close Player"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── STREAM WINDOW ── */}
      <div className="flex-1 w-full h-full bg-black relative">
        <iframe
          src={streamUrl}
          className="absolute inset-0 w-full h-full border-0 bg-black"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          referrerPolicy="no-referrer"
          title="RealSSA Sports Stream"
        />
      </div>

      {/* ── REDIRECT WARNING TIP (MOBILE) ── */}
      <div className="sm:hidden px-4 py-2 bg-zinc-950 border-t border-white/5 flex items-center gap-2 text-[9px] font-semibold text-zinc-400 shrink-0">
        <Shield size={10} className="text-amber-500" />
        <span>If an ad attempts a redirect, click <b>"Stay"</b> or <b>"Cancel"</b>.</span>
      </div>

    </div>
  );
}
