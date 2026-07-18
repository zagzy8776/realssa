import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Bookmark, ShieldCheck, ChevronUp, ChevronDown, Loader2, Heart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { apiUrl } from '@/lib/api-base';
import { shareContent } from '@/lib/share';
import { saveOfflineArticle, deleteOfflineArticle, getOfflineArticle } from '@/lib/ReadingListStore';
import { decodeHTMLEntities } from '@/lib/utils';
import DOMPurify from 'dompurify';

interface ReelsCardProps {
  article: any;
  isActive: boolean;
}

const ReelsCard = ({ article, isActive }: ReelsCardProps) => {
  const { toast } = useToast();
  const [isSaved, setIsSaved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [readerContent, setReaderContent] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [displayImage, setDisplayImage] = useState<string | null>(article.image || null);
  const [imgFailed, setImgFailed] = useState(false);
  const [hasTrackedView, setHasTrackedView] = useState(false);

  // Track dwell time (3 seconds) to count as a view
  useEffect(() => {
    if (!isActive || hasTrackedView || !article?.id) return;
    
    const timer = setTimeout(() => {
      fetch(apiUrl(`/api/articles/${article.id}/view`), { method: 'POST' })
        .catch(() => {}); // silent fail is fine
      setHasTrackedView(true);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [isActive, hasTrackedView, article?.id]);

  // When the img tag errors (broken link, logo redirect, etc.) silently
  // try to pull the real OG image from the article page itself.
  const handleImageError = useCallback(async () => {
    if (imgFailed) return; // don't retry
    setImgFailed(true);
    setDisplayImage(null); // hide broken image immediately
    if (!article.externalLink || article.externalLink === '#') return;
    try {
      const res = await fetch(apiUrl('/api/extract'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: article.externalLink }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.image && !/(logo|icon|brand|placeholder|avatar|favicon|punchng)/i.test(data.image)) {
          setDisplayImage(data.image);
        }
      }
    } catch { /* silently ignore — no fallback shown */ }
  }, [article.externalLink, imgFailed]);

  // Reset image state when article changes
  useEffect(() => {
    const imgUrl = article.image || null;
    const isLogoUrl = imgUrl && /(logo|icon|brand|placeholder|avatar|favicon|punchng)/i.test(imgUrl);

    if (!imgUrl) {
      // Empty or null image: attempt recovery immediately
      setDisplayImage(null);
      setImgFailed(true);
      if (article.externalLink && article.externalLink !== '#') {
        fetch(apiUrl('/api/extract'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: article.externalLink }),
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.image && !/(logo|icon|brand|placeholder|avatar|favicon|punchng)/i.test(data.image)) {
              setDisplayImage(data.image);
            }
          })
          .catch(() => {});
      }
    } else if (isLogoUrl) {
      setDisplayImage(null);
      setImgFailed(true); // Prevent further retries on error
      
      // Attempt recovery immediately
      if (article.externalLink && article.externalLink !== '#') {
        fetch(apiUrl('/api/extract'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: article.externalLink }),
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.image && !/(logo|icon|brand|placeholder|avatar|favicon|punchng)/i.test(data.image)) {
              setDisplayImage(data.image);
            }
          })
          .catch(() => {});
      }
    } else {
      setDisplayImage(imgUrl);
      setImgFailed(false);
    }
  }, [article.id, article.image, article.externalLink]);

  const [reactions, setReactions] = useState(
    article?.reactions?.counts || { fire: 0, heart: 0, wow: 0 }
  );
  const [reacted, setReacted] = useState<string | null>(
    article?.reactions?.userReaction || null
  );
  const [lastTap, setLastTap] = useState(0);
  const [showHeartPopup, setShowHeartPopup] = useState(false);

  useEffect(() => {
    if (article?.reactions) return;
    
    if (article?.id) {
      const deviceId = localStorage.getItem('realssa_device_uuid');
      const deviceParam = deviceId ? `?deviceId=${deviceId}` : '';
      
      const cached = localStorage.getItem(`reactions_${article.id}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.counts) {
            setReactions(parsed.counts);
            if (parsed.userReaction) setReacted(parsed.userReaction);
          } else {
            setReactions(parsed);
          }
        } catch {
          try {
            setReactions(JSON.parse(cached));
          } catch {}
        }
      }
      
      fetch(apiUrl(`/api/reactions/${article.id}${deviceParam}`))
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.counts) {
            setReactions(data.counts);
            setReacted(data.userReaction);
            localStorage.setItem(`reactions_${article.id}`, JSON.stringify(data));
          }
        })
        .catch(() => {});
    }
  }, [article?.id, article?.reactions]);

  useEffect(() => {
    const checkSavedStatus = async () => {
      if (article?.id) {
        try {
          const saved = await getOfflineArticle(article.id);
          setIsSaved(!!saved);
        } catch (err) {
          console.warn('Failed to load saved status', err);
        }
      }
    };
    checkSavedStatus();
  }, [article?.id]);

  const handleReaction = useCallback(async (type: string) => {
    if (!article?.id) return;
    const deviceId = localStorage.getItem('realssa_device_uuid') || '';
    if (!deviceId) return;

    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light });
    
    const isToggleOff = reacted === type;
    const newReacted = isToggleOff ? null : type;
    
    setReacted(newReacted);
    setReactions(prev => {
      const copy = { ...prev };
      if (reacted) {
        copy[reacted as keyof typeof copy] = Math.max(0, copy[reacted as keyof typeof copy] - 1);
      }
      if (!isToggleOff) {
        copy[type as keyof typeof copy] = (copy[type as keyof typeof copy] || 0) + 1;
      }
      return copy;
    });

    try {
      const res = await fetch(apiUrl(`/api/reactions/${article.id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, deviceId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.counts) {
          setReactions(data.counts);
          setReacted(data.userReaction);
          localStorage.setItem(`reactions_${article.id}`, JSON.stringify(data));
        }
      }
    } catch { /* optimistic state is fine */ }
  }, [article?.id, reacted]);

  const handleImageClick = (e: React.MouseEvent) => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTap < DOUBLE_PRESS_DELAY) {
      e.preventDefault();
      e.stopPropagation();
      if (reacted !== 'heart') {
        handleReaction('heart');
      }
      setShowHeartPopup(true);
      setTimeout(() => setShowHeartPopup(false), 800);
    } else {
      handleExpand();
    }
    setLastTap(now);
  };

  const fetchFullContent = async () => {
    if (readerContent || isParsing) return;
    if (!article.externalLink || article.externalLink === '#') return;
    const hasContent = (article.content || '').length > 300;
    if (hasContent) return;

    setIsParsing(true);
    try {
      const res = await fetch(apiUrl('/api/extract'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: article.externalLink }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.content) setReaderContent(data.content);
      }
    } catch (e) {
      console.error('Extract failed', e);
    } finally {
      setIsParsing(false);
    }
  };

  const handleExpand = () => {
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Light });
    }
    const next = !isExpanded;
    setIsExpanded(next);
    if (next) fetchFullContent();
  };
  const handleSave = async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
    const nextSavedState = !isSaved;
    setIsSaved(nextSavedState);

    try {
      if (nextSavedState) {
        await saveOfflineArticle({
          id: article.id,
          title: article.title,
          excerpt: article.excerpt || '',
          content: readerContent || article.content || '',
          image: article.image || '',
          category: article.category || 'News',
          author: 'RealSSA News',
          date: article.date || new Date().toISOString(),
          externalLink: article.externalLink || '',
          readTime: article.readTime || '3 min read',
        });
        toast({
          title: 'Saved to Wisdom Library ✨',
          description: 'Your insight has been preserved.',
        });
      } else {
        await deleteOfflineArticle(article.id);
        toast({
          title: 'Removed from Library',
        });
      }
    } catch (err) {
      console.error('Failed to update saved state', err);
    }
  };

  const handleShare = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Light });
      }
      const safeId = encodeURIComponent(article.id);
      const url = window.location.origin + '/article/' + safeId;
      const viralText = 'Using this news app now, design is insane 🔥\n\n' + article.title;
      
      const sharedNatively = await shareContent({
        title: 'RealSSA News',
        text: viralText,
        url: url
      });

      if (!sharedNatively) {
        toast({ title: 'Link copied!' });
      }
    } catch (e) {
      console.warn('Share failed', e);
    }
  };

  const articleBody = readerContent || article.content || '';

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0a0a0a]">
      {/* 65% HERO IMAGE ZONE (Clear View) */}
      <div 
        onClick={handleImageClick}
        className={`absolute top-0 w-full transition-all duration-500 ease-in-out cursor-pointer ${isExpanded ? 'h-[30%]' : 'h-[65%]'}`}
      >
        {/* Blurred background — only shown when we have a real image */}
        {displayImage && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 blur-xl"
            style={{ backgroundImage: `url(${displayImage})` }}
          />
        )}
        {displayImage ? (
          <img
            src={displayImage}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-contain text-transparent"
            loading="lazy"
            decoding="async"
            onError={handleImageError}
          />
        ) : (
          // No image available — show a rich dark gradient so it still looks premium
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-neutral-900 to-black" />
        )}
        {/* Top gradient only for safe area visibility */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

        {/* Badges */}
        <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
           <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/90 backdrop-blur-md rounded-full text-[10px] font-bold text-white shadow-sm">
             <ShieldCheck size={10} /> Verified
           </div>
        </div>

        {/* Double-tap heart popup */}
        {showHeartPopup && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-30">
            <Heart className="w-24 h-24 text-red-500 fill-red-500 animate-bounce" style={{ animationDuration: '0.6s' }} />
          </div>
        )}
      </div>

      {/* 35% CONTENT ZONE (Glassmorphic Card) */}
      <div 
        className={`absolute bottom-0 w-full flex flex-col z-20 transition-all duration-500 ease-in-out border-t border-white/10`}
        style={{ 
          height: isExpanded ? '70%' : '35%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.98) 0%, rgba(10,10,10,0.85) 100%)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTopLeftRadius: isExpanded ? '0' : '24px',
          borderTopRightRadius: isExpanded ? '0' : '24px',
        }}
      >
        <div className="flex-1 flex flex-col h-full relative px-5 pt-5 pb-4 overflow-hidden">
          {/* Scrollable text content area */}
          <div className={`flex-1 overflow-y-auto hide-scrollbar ${isExpanded ? 'swiper-no-swiping' : ''} pb-2`}>
            <div className="pr-16">
              <span className="inline-block px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-sm uppercase tracking-wider mb-2">
                {(() => {
                  const c = (article.category || '').toLowerCase();
                  if (c.includes('nigeria') || c.includes('nigerian')) return '🇳🇬 Nigeria';
                  if (c.includes('ghana')) return '🇬🇭 Ghana';
                  if (c.includes('kenya')) return '🇰🇪 Kenya';
                  if (c.includes('south-africa')) return '🇿🇦 South Africa';
                  if (c === 'uk') return '🇬🇧 United Kingdom';
                  if (c === 'usa') return '🇺🇸 United States';
                  if (c === 'world') return '🌍 World';
                  if (c === 'sports' || c.includes('sports')) return '⚽ Sports';
                  if (c === 'crypto' || c.includes('crypto')) return '₿ Crypto';
                  if (c === 'entertainment') return '🎬 Entertainment';
                  if (c === 'breaking') return '🚨 Breaking';
                  return article.category || 'News';
                })()}
              </span>
              <h2 className="text-white font-display font-extrabold text-xl leading-tight mb-2">
                {decodeHTMLEntities(article.title)}
              </h2>
              
              {!isExpanded && (
                <p className="text-gray-300 text-sm leading-relaxed line-clamp-2 mt-1">
                  {decodeHTMLEntities(article.excerpt)}
                </p>
              )}
            </div>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  className="mt-4 pb-12"
                >
                  {isParsing ? (
                    <div className="py-10 flex flex-col items-center text-center">
                      <Loader2 className="animate-spin text-amber-400 w-6 h-6 mb-3" />
                      <p className="text-gray-400 text-xs tracking-wide">Loading story...</p>
                    </div>
                  ) : articleBody ? (
                    <div
                      className="prose prose-sm prose-invert max-w-none prose-headings:text-white prose-p:text-gray-300 prose-p:leading-relaxed prose-a:text-amber-400"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(articleBody) }}
                    />
                  ) : (
                    <p className="text-gray-500 text-sm text-center italic">
                      Full content unavailable.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Fixed bottom controls bar (Always visible, safe area aware) */}
          <div 
            className="flex-shrink-0 flex items-center justify-between border-t border-white/5 pt-3 mt-1 pointer-events-auto z-40 relative"
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 16px))' }}
          >
            <button
              onClick={handleExpand}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 active:scale-95 text-white text-sm font-semibold rounded-full transition-all shadow-md border border-white/10 pointer-events-auto"
            >
              {isExpanded ? (
                <><ChevronUp size={15} /> Show less</>
              ) : (
                <><ChevronDown size={15} /> Read full story</>
              )}
            </button>
            <span className="text-white/40 text-[11px] font-medium">{article.readTime || '3 min read'}</span>
          </div>
        </div>
      </div>

      {/* RIGHT ACTION SIDEBAR (Floating above content) */}
      <div className="absolute right-4 top-[50%] -translate-y-1/2 flex flex-col gap-5 items-center z-30 pointer-events-none">
        <button onClick={handleSave} className="flex flex-col items-center gap-1 group pointer-events-auto">
          <div className={`p-3 rounded-full backdrop-blur-md transition-all shadow-lg ${isSaved ? 'bg-amber-400' : 'bg-black/40 border border-white/10'}`}>
            <Bookmark size={20} className={isSaved ? 'fill-black text-black' : 'text-white'} />
          </div>
          <span className="text-white/70 text-[9px] tracking-wide font-medium shadow-black drop-shadow-md">Save</span>
        </button>

        <button onClick={handleShare} className="flex flex-col items-center gap-1 group pointer-events-auto">
          <div className="p-3 bg-black/40 border border-white/10 rounded-full backdrop-blur-md shadow-lg">
            <Share2 size={20} className="text-white" />
          </div>
          <span className="text-white/70 text-[9px] tracking-wide font-medium shadow-black drop-shadow-md">Share</span>
        </button>

        {/* Reactions Sidebar */}
        <div className="flex flex-col gap-4 mt-2 pointer-events-auto">
          {([['fire','🔥'],['heart','❤️'],['wow','😮']] as const).map(([type, emoji]) => (
            <button
              key={type}
              onClick={() => handleReaction(type)}
              className="flex flex-col items-center gap-1 group transition-transform active:scale-90"
            >
              <div className={`p-2.5 rounded-full backdrop-blur-md transition-all shadow-lg border border-white/10 ${
                reacted === type ? 'bg-amber-500/20 scale-110' : 'bg-black/40 hover:bg-black/60'
              }`}>
                <span className="text-lg">{emoji}</span>
              </div>
              {reactions[type as keyof typeof reactions] > 0 && (
                <span className="text-white font-bold text-[10px] shadow-black drop-shadow-md">
                  {reactions[type as keyof typeof reactions]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Swipe hint */}
      {isActive && !isExpanded && (
        <div className="absolute bottom-[40%] left-0 right-0 flex justify-center pointer-events-none z-40">
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-1 opacity-80 bg-black/50 px-4 py-2 rounded-full backdrop-blur-md border border-white/10"
          >
            <ChevronUp size={16} className="text-amber-400" />
            <span className="text-white text-[11px] tracking-widest uppercase font-bold">Swipe up</span>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ReelsCard;
