import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, RotateCw, ExternalLink, Share2, BookMarked, 
  BookOpen, Lock, ShieldCheck, Smartphone, Monitor, X, Sparkles, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { shareContent } from '@/lib/share';
import { saveOfflineArticle } from '@/lib/ReadingListStore';

export default function InAppBrowser() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const rawUrl = searchParams.get('url') || '';
  const initialTitle = searchParams.get('title') || 'Web Page';
  
  // Format URL safely
  const formattedUrl = React.useMemo(() => {
    if (!rawUrl) return '';
    let target = rawUrl;
    if (target.startsWith('/read?url=')) {
      target = decodeURIComponent(target.replace('/read?url=', ''));
    }
    if (!/^https?:\/\//i.test(target)) {
      target = `https://${target}`;
    }
    return target;
  }, [rawUrl]);

  const [currentUrl, setCurrentUrl] = useState(formattedUrl);
  const [loading, setLoading] = useState(true);
  const [canFrame, setCanFrame] = useState<boolean | null>(null);
  const [iframeError, setIframeError] = useState(false);
  const [isDesktopMode, setIsDesktopMode] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setCurrentUrl(formattedUrl);
    if (!formattedUrl) return;

    setLoading(true);
    setIframeError(false);
    setCanFrame(null);

    // Call Pre-Flight Frame Inspector Endpoint
    const checkFrame = async () => {
      try {
        const { apiUrl } = await import('@/lib/api-base');
        const res = await fetch(apiUrl(`/api/check-frame?url=${encodeURIComponent(formattedUrl)}`));
        if (res.ok) {
          const data = await res.json();
          setCanFrame(data.canFrame);
          if (!data.canFrame) {
            setIframeError(true);
          }
        } else {
          setCanFrame(true);
        }
      } catch (err) {
        setCanFrame(true);
      } finally {
        setLoading(false);
      }
    };

    checkFrame();
  }, [formattedUrl]);

  if (!rawUrl) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-3 animate-bounce" />
        <h2 className="text-lg font-bold text-foreground mb-1">No URL Specified</h2>
        <p className="text-xs text-muted-foreground mb-4">Please provide a valid web link to browse.</p>
        <Button onClick={() => navigate('/search')} className="bg-amber-500 text-black font-bold">
          Return to RealSSA Search
        </Button>
      </div>
    );
  }

  // Domain extraction for address bar display
  const getDomain = (urlStr: string) => {
    try {
      const u = new URL(urlStr);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return urlStr;
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    setIframeError(false);
    if (iframeRef.current) {
      iframeRef.current.src = currentUrl;
    }
  };

  const handleShare = () => {
    shareContent({
      title: initialTitle || getDomain(currentUrl),
      text: `Check out this web page on RealSSA Web Browser:\n${currentUrl}`,
      url: currentUrl
    });
  };

  const handleBookmark = () => {
    saveOfflineArticle({
      id: `browser-${Date.now()}`,
      title: initialTitle || getDomain(currentUrl),
      excerpt: `Saved from RealSSA Inbuilt Web Browser: ${currentUrl}`,
      category: 'Web Bookmark',
      readTime: 'External Web Link',
      publishedAt: new Date().toLocaleDateString(),
      image: '',
      externalLink: currentUrl,
      savedAt: Date.now()
    });
    setIsSaved(true);
    toast({
      title: "Saved to Wisdom Library",
      description: "Added to your offline reading list."
    });
  };

  const handleOpenReaderMode = () => {
    navigate(`/read?url=${encodeURIComponent(currentUrl)}`);
  };

  const handleOpenExternalDirect = () => {
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-[#0b0f17] text-foreground flex flex-col h-[100dvh] w-screen overflow-hidden">
      
      {/* Top RealSSA Inbuilt Browser Navigation Bar */}
      <header className="bg-[#121824] border-b border-[#1f293d] px-3 py-2 flex items-center justify-between gap-2 shrink-0 z-20 shadow-md">
        
        {/* Navigation Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-amber-500/10 text-amber-400 hover:text-amber-300 rounded-xl transition-all active:scale-95 flex items-center gap-1 text-xs font-bold"
            title="Back to RealSSA Search"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-amber-500/10 text-muted-foreground hover:text-amber-400 rounded-xl transition-all"
            title="Refresh Page"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>

        {/* Address Bar (Domain + SSL Lock) */}
        <div className="flex-1 max-w-xl mx-1 bg-[#0b0e14] border border-amber-500/30 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-inner min-w-0">
          <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div className="flex items-center gap-1 truncate text-xs min-w-0 flex-1">
            <span className="font-semibold text-amber-400 truncate">{getDomain(currentUrl)}</span>
            <span className="text-[10px] text-muted-foreground truncate hidden md:inline">
              — {currentUrl}
            </span>
          </div>
          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0 font-mono hidden sm:inline">
            SECURE
          </span>
        </div>

        {/* Browser Tools */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Reader View Toggle */}
          <button
            onClick={handleOpenReaderMode}
            className="p-2 hover:bg-amber-500/10 text-amber-400 rounded-xl transition-all flex items-center gap-1 text-xs font-bold"
            title="Switch to RealSSA Reader Mode"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden lg:inline">Reader</span>
          </button>

          {/* Bookmark */}
          <button
            onClick={handleBookmark}
            className={`p-2 rounded-xl transition-all ${isSaved ? 'text-amber-500 bg-amber-500/10' : 'text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10'}`}
            title="Save to Wisdom Library"
          >
            <BookMarked className="w-4 h-4" />
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="p-2 hover:bg-amber-500/10 text-muted-foreground hover:text-amber-400 rounded-xl transition-all"
            title="Share Web Link"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Desktop/Mobile Toggle */}
          <button
            onClick={() => setIsDesktopMode(!isDesktopMode)}
            className="p-2 hover:bg-amber-500/10 text-muted-foreground hover:text-amber-400 rounded-xl transition-all hidden sm:block"
            title={isDesktopMode ? "Switch to Mobile View" : "Switch to Desktop View"}
          >
            {isDesktopMode ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
          </button>

          {/* Close Browser */}
          <button
            onClick={() => navigate('/search')}
            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl transition-all active:scale-95 ml-1"
            title="Close Browser Tab"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </header>

      {/* Loading Progress Bar at top */}
      {loading && (
        <div className="w-full h-1 bg-muted overflow-hidden shrink-0">
          <div className="w-full h-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 animate-pulse origin-left" />
        </div>
      )}

      {/* Main Browser Canvas Container */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-black">
        
        {/* Live Web Iframe Container */}
        <iframe
          ref={iframeRef}
          src={currentUrl}
          title={initialTitle}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setIframeError(true);
          }}
          className={`w-full h-full border-none transition-all ${isDesktopMode ? 'w-[1280px] max-w-full mx-auto shadow-2xl' : 'w-full'}`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
        />

        {/* Fallback Banner for websites with strict X-Frame-Options */}
        {iframeError && (
          <div className="absolute inset-0 bg-[#0c1017]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <ShieldCheck className="w-8 h-8" />
            </div>
            
            <div className="max-w-md space-y-2">
              <h3 className="text-lg font-bold text-foreground">Publisher Security Protected</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This site (<span className="text-amber-400 font-semibold">{getDomain(currentUrl)}</span>) requires secure direct rendering. Choose how you would like to view it:
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button
                onClick={handleOpenReaderMode}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" /> Open in RealSSA Reader Mode
              </Button>
              
              <Button
                variant="outline"
                onClick={handleOpenExternalDirect}
                className="w-full sm:w-auto border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs px-5 py-2.5 rounded-xl flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Launch External Web Window
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Mobile Action Bar */}
      <footer className="bg-[#121824] border-t border-[#1f293d] px-4 py-2 flex items-center justify-between text-xs text-muted-foreground shrink-0 z-20 md:hidden">
        <div className="flex items-center gap-1 text-[11px] text-amber-400 font-mono">
          <Sparkles className="w-3.5 h-3.5" /> RealSSA Inbuilt Browser
        </div>
        <button
          onClick={handleOpenReaderMode}
          className="text-amber-400 hover:underline font-semibold text-[11px] flex items-center gap-1"
        >
          <BookOpen className="w-3.5 h-3.5" /> Reader View
        </button>
      </footer>

    </div>
  );
}
