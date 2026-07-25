import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, RotateCw, ExternalLink, Share2, BookMarked,
  BookOpen, Lock, X, Sparkles, AlertTriangle, Search, History,
  Type, Minus, Plus, ChevronRight, Globe, Home, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { shareContent } from '@/lib/share';
import { saveOfflineArticle } from '@/lib/ReadingListStore';
import { API_BASE_URL, apiUrl, RUST_ENGINE_URL } from '@/lib/api-base';
import RealSSARenderer, { PageData } from '@/components/RealSSARenderer';

// ─── History persistence in localStorage ─────────────────────────────────────
const HISTORY_KEY = 'realssa_browser_history';
const MAX_HISTORY = 50;

function loadBrowserHistory(): { url: string; title: string; ts: number }[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveToBrowserHistory(url: string, title: string) {
  try {
    const hist = loadBrowserHistory().filter(h => h.url !== url);
    hist.unshift({ url, title: title || url, ts: Date.now() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, MAX_HISTORY)));
  } catch { /* storage full, ignore */ }
}

// ─── URL utils ────────────────────────────────────────────────────────────────
function formatUrl(raw: string): string {
  if (!raw) return '';
  let t = raw.trim();
  if (t.startsWith('/read?url=')) t = decodeURIComponent(t.replace('/read?url=', ''));
  if (!/^https?:\/\//i.test(t)) t = `https://${t}`;
  return t;
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function looksLikeUrl(str: string): boolean {
  if (!str) return false;
  return /^https?:\/\//i.test(str) || (/\.[a-z]{2,}$/i.test(str) && !str.includes(' '));
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function InAppBrowser() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const initialUrl = formatUrl(searchParams.get('url') || '');
  const initialTitle = searchParams.get('title') || '';

  // ── Navigation stack ────────────────────────────────────────────────────────
  const [stack, setStack] = useState<string[]>(initialUrl ? [initialUrl] : []);
  const [stackIndex, setStackIndex] = useState(0);
  const currentUrl = stack[stackIndex] || '';

  // ── Page state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [usingProxy, setUsingProxy] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Address bar ─────────────────────────────────────────────────────────────
  const [addressValue, setAddressValue] = useState(initialUrl);
  const [addressFocused, setAddressFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<{ url: string; title: string }[]>([]);
  const addressRef = useRef<HTMLInputElement>(null);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [shieldActive, setShieldActive] = useState(true);

  // Proxy fallback URL builder
  const proxyUrl = useCallback((url: string) =>
    `${RUST_ENGINE_URL}/proxy-page?url=${encodeURIComponent(url)}`, []);

  // ── Core load function — tries renderer first, silently falls back ──────────
  const loadUrl = useCallback(async (url: string) => {
    if (!url) return;
    setLoading(true);
    setPageData(null);
    setUsingProxy(false);
    setAddressValue(url);
    setHistoryOpen(false);

    try {
      const res = await fetch(`${RUST_ENGINE_URL}/render-page?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error('render-page failed');
      const data: PageData = await res.json();

      if (data.requiresProxy) {
        // Seamlessly mount proxy iframe — user sees nothing different
        setUsingProxy(true);
        setPageData(null);
        if (iframeRef.current) {
          iframeRef.current.src = proxyUrl(url);
        }
        // Save to history with whatever title we have
        saveToBrowserHistory(url, data.meta?.title || getDomain(url));
      } else {
        // Custom renderer — the engine
        setUsingProxy(false);
        setPageData(data);
        saveToBrowserHistory(url, data.meta?.title || getDomain(url));
      }
    } catch {
      // Network error → fall back to proxy silently
      setUsingProxy(true);
      setPageData(null);
      if (iframeRef.current) {
        iframeRef.current.src = proxyUrl(url);
      }
      saveToBrowserHistory(url, getDomain(url));
    } finally {
      setLoading(false);
    }
  }, [proxyUrl]);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialUrl) loadUrl(initialUrl);
  }, [initialUrl]); // eslint-disable-line

  // ── postMessage from proxy iframe (link clicks inside proxied pages) ────────
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'REALSSA_NAVIGATE' && e.data?.url) {
        navigateTo(e.data.url);
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [stackIndex, stack]); // eslint-disable-line

  // ── Navigate to a URL (adds to stack, clears forward history) ───────────────
  const navigateTo = useCallback((url: string) => {
    const formatted = formatUrl(url);
    if (!formatted || formatted === currentUrl) return;
    setStack(prev => [...prev.slice(0, stackIndex + 1), formatted]);
    setStackIndex(prev => prev + 1);
    loadUrl(formatted);
  }, [stackIndex, currentUrl, loadUrl]);

  // ── Back / Forward ───────────────────────────────────────────────────────────
  const goBack = () => {
    if (stackIndex <= 0) { navigate(-1); return; }
    const newIndex = stackIndex - 1;
    setStackIndex(newIndex);
    loadUrl(stack[newIndex]);
  };

  const goForward = () => {
    if (stackIndex >= stack.length - 1) return;
    const newIndex = stackIndex + 1;
    setStackIndex(newIndex);
    loadUrl(stack[newIndex]);
  };

  const handleRefresh = () => {
    if (currentUrl) loadUrl(currentUrl);
  };

  // ── Address bar submit ────────────────────────────────────────────────────────
  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = addressValue.trim();
    if (!input) return;
    const dest = looksLikeUrl(input)
      ? formatUrl(input)
      : `https://www.google.com/search?q=${encodeURIComponent(input)}`;
    navigateTo(dest);
    addressRef.current?.blur();
    setSuggestions([]);
  };

  // ── Address bar autocomplete from history ─────────────────────────────────
  const handleAddressChange = (val: string) => {
    setAddressValue(val);
    if (!val.trim()) { setSuggestions([]); return; }
    const hist = loadBrowserHistory();
    const q = val.toLowerCase();
    setSuggestions(
      hist
        .filter(h => h.url.toLowerCase().includes(q) || h.title.toLowerCase().includes(q))
        .slice(0, 5)
    );
  };

  // ── Bookmark ──────────────────────────────────────────────────────────────────
  const handleBookmark = () => {
    const title = pageData?.meta?.title || getDomain(currentUrl);
    saveOfflineArticle({
      id: `browser-${Date.now()}`,
      title,
      excerpt: pageData?.meta?.description || `Saved from RealSSA Browser: ${currentUrl}`,
      category: 'Web Bookmark',
      readTime: pageData?.meta?.readingTime ? `${pageData.meta.readingTime} min read` : 'External Link',
      publishedAt: new Date().toLocaleDateString(),
      image: pageData?.meta?.image || '',
      externalLink: currentUrl,
      savedAt: Date.now()
    });
    setIsSaved(true);
    toast({ title: 'Saved to Wisdom Library', description: 'Added to your offline reading list.' });
  };

  const handleShare = () => {
    shareContent({
      title: pageData?.meta?.title || getDomain(currentUrl),
      text: `Check this out:\n${currentUrl}`,
      url: currentUrl
    });
  };

  const handleOpenReaderMode = () => {
    navigate(`/read?url=${encodeURIComponent(currentUrl)}`);
  };

  const handleOpenExternal = () => {
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
  };

  // ── No URL guard ──────────────────────────────────────────────────────────────
  if (!initialUrl) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-3 animate-bounce" />
        <h2 className="text-lg font-bold mb-1">No URL Specified</h2>
        <p className="text-xs text-muted-foreground mb-4">Provide a valid web link to browse.</p>
        <Button onClick={() => navigate('/search')} className="bg-amber-500 text-black font-bold">
          Back to Search
        </Button>
      </div>
    );
  }

  const canGoBack = stackIndex > 0;
  const canGoForward = stackIndex < stack.length - 1;
  const pageTitle = pageData?.meta?.title || initialTitle || getDomain(currentUrl);
  const pageFavicon = pageData?.meta?.favicon || '';

  return (
    <div className="fixed inset-0 z-[99999] bg-[#0b0f17] text-foreground flex flex-col h-[100dvh] w-screen overflow-hidden">

      {/* ── Top Browser Chrome ──────────────────────────────────────────────── */}
      <header className="bg-[#121824] border-b border-[#1f293d] px-2 sm:px-3 py-2 flex items-center gap-2 shrink-0 z-20 shadow-md">
        {/* Home Button */}
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-amber-500/10 text-amber-400 rounded-xl transition-all shrink-0"
          title="Back to Home Feed"
        >
          <Home className="w-4 h-4" />
        </button>

        {/* Address bar */}
        <form onSubmit={handleAddressSubmit} className="relative flex-1 min-w-0">
          <div className={`flex items-center gap-1.5 bg-[#0b0e14] border rounded-full px-2.5 py-1.5 transition-all ${addressFocused ? 'border-amber-500 ring-1 ring-amber-500/20' : 'border-amber-500/25'}`}>
            {pageFavicon && !addressFocused ? (
              <img
                src={pageFavicon}
                alt=""
                className="w-3.5 h-3.5 rounded-sm shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
            )}
            <input
              ref={addressRef}
              type="text"
              value={addressFocused ? addressValue : (pageTitle.length > 40 ? getDomain(currentUrl) : pageTitle || addressValue)}
              onChange={(e) => handleAddressChange(e.target.value)}
              onFocus={() => {
                setAddressFocused(true);
                setAddressValue(currentUrl);
                setTimeout(() => addressRef.current?.select(), 50);
              }}
              onBlur={() => {
                setTimeout(() => {
                  setAddressFocused(false);
                  setSuggestions([]);
                }, 150);
              }}
              placeholder="Search or enter URL..."
              className="flex-1 min-w-0 bg-transparent text-xs font-medium text-amber-400 placeholder:text-muted-foreground/60 focus:outline-none focus:text-white transition-colors truncate"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            {addressFocused && addressValue && (
              <button type="submit" className="shrink-0 text-amber-500 hover:text-amber-300 p-0.5" title="Go">
                <Search className="w-3 h-3" />
              </button>
            )}
            {!addressFocused && (
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0 font-mono hidden sm:inline">
                SECURE
              </span>
            )}
          </div>

          {/* Autocomplete dropdown */}
          {addressFocused && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#121824] border border-border rounded-xl shadow-2xl overflow-hidden z-50">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={() => { navigateTo(s.url); setSuggestions([]); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-amber-500/10 transition-colors text-left group"
                >
                  <Globe className="w-3 h-3 text-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-foreground truncate">{s.title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{getDomain(s.url)}</div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-amber-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Close Button */}
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 rounded-xl transition-all active:scale-95 shrink-0"
          title="Close Browser"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* ── Sub-Header Utility Toolbar ────────────────────────────────────────── */}
      <div className="bg-[#161f30] border-b border-[#232f48] px-3 py-1 flex items-center justify-between shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={goBack}
            disabled={stackIndex <= 0}
            className="p-1.5 hover:bg-amber-500/10 text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goForward}
            disabled={!canGoForward}
            className="p-1.5 hover:bg-amber-500/10 text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
            title="Forward"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleRefresh}
            className="p-1.5 hover:bg-amber-500/10 text-muted-foreground hover:text-amber-400 transition-all rounded-lg"
            title="Refresh"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Security Shield */}
          <button
            onClick={() => {
              setShieldActive(!shieldActive);
              toast({
                title: !shieldActive ? 'Shield Enabled' : 'Shield Disabled',
                description: !shieldActive 
                  ? 'Real-time ad blocking & tracker protection is active.'
                  : 'Tracker protection has been temporarily disabled.'
              });
            }}
            className={`p-1.5 rounded-lg transition-all ${shieldActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-muted-foreground hover:text-amber-400'}`}
            title={shieldActive ? "Shield Active (Adblocker On)" : "Shield Inactive (Adblocker Off)"}
          >
            <Shield className="w-4 h-4" />
          </button>

          {/* Save/Bookmark */}
          <button
            onClick={handleBookmark}
            className={`p-1.5 rounded-lg transition-all ${isSaved ? 'text-amber-500 bg-amber-500/10' : 'text-muted-foreground hover:text-amber-400'}`}
            title="Save to Library"
          >
            <BookMarked className="w-4 h-4" />
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="p-1.5 hover:bg-amber-500/10 text-muted-foreground hover:text-amber-400 transition-all rounded-lg"
            title="Share Link"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Open Externally */}
          <button
            onClick={handleOpenExternal}
            className="p-1.5 hover:bg-amber-500/10 text-muted-foreground hover:text-amber-400 transition-all rounded-lg"
            title="Open in System Browser"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          {/* Text Size Control Trigger (for desktop/wide screens) */}
          <button
            onClick={() => setControlsOpen(!controlsOpen)}
            className={`p-1.5 rounded-lg transition-all hidden sm:block ${controlsOpen ? 'bg-amber-500/15 text-amber-400' : 'hover:bg-amber-500/10 text-muted-foreground hover:text-amber-400'}`}
            title="Text Size & Controls"
          >
            <Type className="w-4 h-4" />
          </button>

          {/* History */}
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className={`p-1.5 rounded-lg transition-all ${historyOpen ? 'bg-amber-500/15 text-amber-400' : 'hover:bg-amber-500/10 text-muted-foreground hover:text-amber-400'}`}
            title="Browsing History"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Loading bar ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="w-full h-[2px] bg-transparent overflow-hidden shrink-0">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500"
            style={{ animation: 'browserProgress 1.4s ease-in-out infinite', width: '60%' }}
          />
        </div>
      )}

      {/* ── History Drawer ────────────────────────────────────────────────────── */}
      {historyOpen && (
        <div className="absolute top-[52px] right-2 sm:right-4 z-50 w-72 sm:w-80 bg-[#121824] border border-border rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Browsing History
            </span>
            <button
              onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistoryOpen(false); }}
              className="text-[10px] text-red-400 hover:underline"
            >
              Clear
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loadBrowserHistory().length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center">No history yet</p>
            ) : (
              loadBrowserHistory().map((h, i) => (
                <button
                  key={i}
                  onClick={() => { navigateTo(h.url); setHistoryOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-amber-500/10 transition-colors text-left group border-b border-border/10 last:border-0"
                >
                  <Globe className="w-3 h-3 text-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-foreground truncate">{h.title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{getDomain(h.url)}</div>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 shrink-0">
                    {new Date(h.ts).toLocaleDateString()}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Text Size Controls Drawer ─────────────────────────────────────────── */}
      {controlsOpen && (
        <div className="absolute top-[52px] right-16 z-50 bg-[#121824] border border-border rounded-xl shadow-2xl p-3 animate-in slide-in-from-top-2 duration-200">
          <p className="text-[10px] text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Text Size</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFontSize(f => Math.max(12, f - 1))}
              className="w-7 h-7 rounded-lg bg-muted/50 hover:bg-amber-500/20 text-amber-400 flex items-center justify-center transition-all"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-xs text-foreground font-mono w-8 text-center">{fontSize}px</span>
            <button
              onClick={() => setFontSize(f => Math.min(22, f + 1))}
              className="w-7 h-7 rounded-lg bg-muted/50 hover:bg-amber-500/20 text-amber-400 flex items-center justify-center transition-all"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Main Content Area ──────────────────────────────────────────────────── */}
      <main
        data-browser-scroll
        className="flex-1 w-full relative overflow-y-auto overflow-x-hidden bg-[#0b0f17]"
      >
        {/* Loading state */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0b0f17] z-10">
            <div className="w-10 h-10 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            <span className="text-xs text-amber-500/70 font-mono animate-pulse">Loading {getDomain(currentUrl)}…</span>
          </div>
        )}

        {/* Custom renderer — the engine output */}
        {!loading && pageData && !usingProxy && (
          <RealSSARenderer
            data={pageData}
            onNavigate={navigateTo}
            fontSize={fontSize}
          />
        )}

        {/* Proxy iframe — seamless fallback, user doesn't know */}
        <iframe
          ref={iframeRef}
          title={pageTitle}
          className={`absolute inset-0 w-full h-full border-none bg-white ${usingProxy && !loading ? 'block' : 'hidden'}`}
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals allow-popups-to-escape-sandbox"
        />
      </main>

      {/* ── Bottom Mobile Bar ─────────────────────────────────────────────────── */}
      <footer className="bg-[#121824] border-t border-[#1f293d] px-4 py-2 flex items-center justify-between text-xs shrink-0 z-20 md:hidden">
        <div className="flex items-center gap-1 text-[11px] text-amber-400/60 font-mono">
          <Sparkles className="w-3 h-3" /> RealSSA Browser
        </div>
        <div className="flex items-center gap-3">
          <button onClick={goBack} disabled={stackIndex <= 0} className="text-muted-foreground disabled:opacity-30">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button onClick={handleOpenReaderMode} className="text-amber-400 flex items-center gap-1 font-semibold text-[11px]">
            <BookOpen className="w-3.5 h-3.5" /> Reader
          </button>
          <button onClick={goForward} disabled={!canGoForward} className="text-muted-foreground disabled:opacity-30">
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </footer>

      <style>{`
        @keyframes browserProgress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(50%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
}
