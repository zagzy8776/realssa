import React, { useState, useEffect } from 'react';
import { X, Tv, Shield, RefreshCw, ExternalLink } from 'lucide-react';

interface SportsPlayerProps {
  channelId: string | number;
  title: string;
  onClose: () => void;
}

// ── Working sports streaming servers ──
const SERVERS = [
  {
    label: 'Server 1 · Streamed.st',
    key: 'streamed',
    buildUrl: (id: string | number) => `https://streamed.st/embed/${id}`,
    homepage: 'https://streamed.st',
  },
  {
    label: 'Server 2 · VIPRow',
    key: 'viprow',
    buildUrl: (id: string | number) => `https://viprow.me/embed/${id}`,
    homepage: 'https://viprow.me',
  },
  {
    label: 'Server 3 · Strikeout',
    key: 'strikeout',
    buildUrl: (id: string | number) => `https://strikeout.im/embed/${id}`,
    homepage: 'https://strikeout.im',
  },
];

export default function SportsPlayer({ channelId, title, onClose }: SportsPlayerProps) {
  const [activeIdx, setActiveIdx] = useState(() => {
    const saved = localStorage.getItem('realssa_sports_server');
    const found = SERVERS.findIndex(s => s.key === saved);
    return found >= 0 ? found : 0;
  });

  // Auto-switch to corresponding server if channelId matches a provider key
  useEffect(() => {
    if (channelId === 'viprow') {
      setActiveIdx(1);
    } else if (channelId === 'strikeout') {
      setActiveIdx(2);
    } else if (channelId === 'streamed') {
      setActiveIdx(0);
    }
  }, [channelId]);

  const activeServer = SERVERS[activeIdx];

  // If no specific channelId or if category browsing, show the homepage of the active server
  const isCategory = typeof channelId === 'string' && (
    isNaN(Number(channelId)) || 
    channelId === 'viprow' || 
    channelId === 'strikeout' || 
    channelId === 'streamed'
  );
  
  const streamUrl = isCategory
    ? activeServer.homepage
    : activeServer.buildUrl(channelId);

  const handleSwitch = (idx: number) => {
    setActiveIdx(idx);
    localStorage.setItem('realssa_sports_server', SERVERS[idx].key);
  };

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

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col font-sans select-none animate-in fade-in duration-200">

      {/* ── TOP BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-zinc-950/98 border-b border-white/5 shrink-0">
        <div className="flex flex-col min-w-0">
          <span className="text-[9px] uppercase font-extrabold tracking-widest text-amber-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            Live Sports Stream
          </span>
          <h3 className="text-white text-xs sm:text-sm font-extrabold truncate max-w-[300px] sm:max-w-md mt-0.5 flex items-center gap-2">
            <Tv size={14} className="text-zinc-400 shrink-0" />
            {title}
          </h3>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          {/* Redirect shield */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-[10px] font-bold">
            <Shield size={11} />
            Redirect Protection
          </div>

          {/* Open in new tab */}
          <a
            href={activeServer.homepage}
            target="_blank"
            rel="noopener noreferrer"
            title="Open stream site in new tab"
            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-amber-400 transition-colors border border-white/5"
          >
            <ExternalLink size={14} />
          </a>

          <button
            onClick={onClose}
            className="p-1.5 bg-zinc-900 hover:bg-red-600 rounded-lg text-zinc-400 hover:text-white transition-colors border border-white/5"
            title="Close Player"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Server tab bar ── */}
      <div className="flex gap-1.5 px-4 py-2 bg-zinc-950 border-b border-white/5 shrink-0 overflow-x-auto no-scrollbar">
        {SERVERS.map((srv, i) => (
          <button
            key={srv.key}
            onClick={() => handleSwitch(i)}
            className={`px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap shrink-0 transition-all ${
              i === activeIdx
                ? 'bg-amber-500 text-black shadow-sm shadow-amber-500/40'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-white/5'
            }`}
          >
            {srv.label}
          </button>
        ))}
      </div>

      {/* ── STREAM WINDOW ── */}
      <div className="flex-1 w-full h-full bg-black relative">
        <iframe
          key={`${activeIdx}-${channelId}`}
          src={streamUrl}
          className="absolute inset-0 w-full h-full border-0 bg-black"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          referrerPolicy="no-referrer"
          title="RealSSA Sports Stream"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-pointer-lock"
        />
      </div>

      {/* ── BOTTOM HINT ── */}
      <div className="px-4 py-2 bg-zinc-950 border-t border-white/5 flex items-center justify-between text-[9px] font-semibold text-zinc-500 shrink-0">
        <div className="flex items-center gap-2">
          <Shield size={10} className="text-amber-500 shrink-0" />
          <span>If an ad redirects you, press <b className="text-zinc-400">Back</b> or <b className="text-zinc-400">Stay</b>.</span>
        </div>
        <div className="flex items-center gap-1 text-zinc-600">
          <RefreshCw size={9} />
          <span>Blank? Switch server above</span>
        </div>
      </div>

    </div>
  );
}
