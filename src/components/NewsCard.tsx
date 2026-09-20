import { Bookmark, BookmarkCheck, Flame, Heart, Image } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-base";
import { useStreak } from "@/hooks/useStreak";
import { logCategoryPreference } from "@/lib/preferences";
import { decodeHTMLEntities } from "@/lib/utils";

type CategoryType =
  | "afrobeats"
  | "nollywood"
  | "culture"
  | "fashion"
  | "tech"
  | "music"
  | "nigerian-news"
  | "nigerian-gaming"
  | "crypto-nigeria"
  | "nigerian-sports"
  | "nigerian-politics"
  | "nigerian-business"
  | "nigerian-lifestyle"
  | "lagos-fashion"
  | "nigerian-tech"
  | "entertainment"
  | "news"
  | "general"
  | "breaking"
  | "sports"
  | "crypto"
  | "politics"
  | "business";

interface NewsCardProps {
  title: string;
  excerpt: string;
  category: CategoryType;
  image: string;
  readTime: string;
  date: string;
  href?: string;
  id?: string;
  storyHash?: string;
  localVerifiedCount?: number;
  rumorFlagCount?: number;
  externalLink?: string;
  onRead?: (articleId: string) => void;
  onBookmark?: (articleId: string) => void;
  showBookmark?: boolean;
  coverageCount?: number;
  sourceName?: string;
  author?: string;
  reactions?: {
    counts: { fire: number; heart: number; wow: number };
    userReaction?: string | null;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  afrobeats: "Afrobeats",
  nollywood: "Nollywood",
  culture: "Culture",
  fashion: "Fashion",
  tech: "Tech",
  music: "Music",
  breaking: "Breaking News",
  news: "News",
  "nigerian-news": "Nigerian News",
  "nigerian-gaming": "Nigerian Gaming",
  "crypto-nigeria": "Crypto Nigeria",
  "lagos-fashion": "Lagos Fashion",
  "nigerian-tech": "Nigerian Tech",
  "nigerian-sports": "Nigerian Sports",
  "nigerian-politics": "Nigerian Politics",
  "nigerian-business": "Nigerian Business",
  "nigerian-lifestyle": "Nigerian Lifestyle",
  entertainment: "Entertainment",
  general: "General",
};

const CARD_FALLBACK_IMAGE = "/logo.png";

const getSourceLabel = (_sName?: string, _auth?: string, _extLink?: string) => {
  return "RealSSA";
};

const NewsCard = ({
  title,
  excerpt,
  category,
  image,
  readTime,
  date,
  href,
  id,
  storyHash,
  localVerifiedCount = 0,
  rumorFlagCount = 0,
  externalLink,
  onRead,
  onBookmark,
  showBookmark = true,
  coverageCount,
  sourceName,
  author,
  reactions: reactionsProp,
}: NewsCardProps) => {
  const { toast } = useToast();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [reactions, setReactions] = useState(
    reactionsProp?.counts || { fire: 0, heart: 0, wow: 0 }
  );
  const [reacted, setReacted] = useState<string | null>(
    reactionsProp?.userReaction || null
  );
  const [lastTap, setLastTap] = useState(0);
  const [showHeartPopup, setShowHeartPopup] = useState(false);
  const [floatingBubbles, setFloatingBubbles] = useState<{ id: number; emoji: string; left: number }[]>([]);
  const [verifiedCount, setVerifiedCount] = useState(localVerifiedCount);
  const [rumorCount, setRumorCount] = useState(rumorFlagCount);
  const [hasVotedVerify, setHasVotedVerify] = useState(false);
  const { recordRead } = useStreak();

  useEffect(() => {
    if (reactionsProp || !id) return;
    const deviceId = localStorage.getItem('realssa_device_uuid');
    const deviceParam = deviceId ? `?deviceId=${deviceId}` : '';
    const cached = localStorage.getItem(`reactions_${id}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.counts) {
          setReactions(parsed.counts);
          if (parsed.userReaction) setReacted(parsed.userReaction);
        } else {
          setReactions(parsed);
        }
      } catch { }
      return;
    }
    fetch(apiUrl(`/api/reactions/${id}${deviceParam}`))
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.counts) {
          setReactions(data.counts);
          setReacted(data.userReaction);
          localStorage.setItem(`reactions_${id}`, JSON.stringify(data));
        }
      })
      .catch(() => { });
  }, [id, reactionsProp]);

  const handleReaction = useCallback(async (e: React.MouseEvent | null, type: string) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!id) return;
    const deviceId = localStorage.getItem('realssa_device_uuid') || '';
    if (!deviceId) return;
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
    logCategoryPreference(category, 2);
    if (!isToggleOff) {
      const emoji = type === 'fire' ? '🔥' : type === 'heart' ? '❤️' : '😮';
      const idVal = Date.now() + Math.random();
      const leftVal = 20 + Math.random() * 60;
      setFloatingBubbles(prev => [...prev, { id: idVal, emoji, left: leftVal }]);
      setTimeout(() => {
        setFloatingBubbles(prev => prev.filter(b => b.id !== idVal));
      }, 800);
    }
    try {
      const res = await fetch(apiUrl(`/api/reactions/${id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, deviceId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.counts) {
          setReactions(data.counts);
          setReacted(data.userReaction);
          localStorage.setItem(`reactions_${id}`, JSON.stringify(data));
        }
      }
    } catch { /* optimistic */ }
  }, [id, reacted, category]);

  const handleImageClick = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTap < 300) {
      e.preventDefault();
      e.stopPropagation();
      if (reacted !== 'heart') handleReaction(null, 'heart');
      setShowHeartPopup(true);
      setTimeout(() => setShowHeartPopup(false), 800);
    } else {
      logCategoryPreference(category, 1);
      if (!externalLink && onRead && id) onRead(id);
    }
    setLastTap(now);
  };

  useEffect(() => {
    if (id) {
      const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
      setIsBookmarked(bookmarks.includes(id));
    }
  }, [id]);

  const isLogoPattern = (url?: string) => {
    if (!url) return true;
    return /(logo|icon|brand|placeholder|avatar|favicon|punchng)/i.test(url);
  };

  const resolveCardImage = (url?: string) => (!url || isLogoPattern(url) ? CARD_FALLBACK_IMAGE : url);
  const [currentImage, setCurrentImage] = useState(() => resolveCardImage(image));

  useEffect(() => {
    setCurrentImage(resolveCardImage(image));
    setImgError(false);
  }, [image]);

  const hasImage = !!currentImage && !imgError;
  const imgSrc = imgError ? '' : currentImage;

  const linkTo = externalLink
    ? `/read?url=${encodeURIComponent(externalLink)}&image=${encodeURIComponent(imgSrc || '')}&category=${encodeURIComponent(category)}&id=${encodeURIComponent(id || '')}&title=${encodeURIComponent(title || '')}&excerpt=${encodeURIComponent((excerpt || '').slice(0, 500))}`
    : (href || (id ? `/article/${id}` : "#"));

  const whatsappShareUrl = externalLink
    ? `https://realssanews.com.ng/read?url=${encodeURIComponent(externalLink)}&category=${encodeURIComponent(category)}&id=${encodeURIComponent(id || '')}`
    : `https://realssanews.com.ng${href || ''}`;
  const whatsappText = encodeURIComponent(`${title} — Read on RealSSA: ${whatsappShareUrl}`);

  const handleClick = () => {
    logCategoryPreference(category, 1);
    recordRead();
    if (!externalLink && onRead && id) onRead(id);
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!id) return;
    if (!isBookmarked) logCategoryPreference(category, 3);
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    const newBookmarks = isBookmarked
      ? bookmarks.filter((b: string) => b !== id)
      : [...bookmarks, id];
    localStorage.setItem('bookmarks', JSON.stringify(newBookmarks));
    setIsBookmarked(!isBookmarked);
    toast({
      title: isBookmarked ? "Bookmark removed" : "Saved!",
      description: isBookmarked ? "Removed from bookmarks" : "Article saved to bookmarks"
    });
    if (onBookmark && id) onBookmark(id);
  };

  const handleVerifyClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasVotedVerify || !storyHash) return;
    setVerifiedCount(prev => prev + 1);
    setHasVotedVerify(true);
    toast({ title: "Verified!", description: "Thanks for verifying this local update." });
    try {
      await fetch(apiUrl(`/api/articles/${storyHash}/verify`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'verify' })
      });
    } catch (err) {
      console.error('Verify failed:', err);
    }
  };

  const handleFlagClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasVotedVerify || !storyHash) return;
    setRumorCount(prev => prev + 1);
    setHasVotedVerify(true);
    toast({ title: "Flagged!", description: "Article flagged as a potential rumor." });
    try {
      await fetch(apiUrl(`/api/articles/${storyHash}/verify`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'flag' })
      });
    } catch (err) {
      console.error('Flag failed:', err);
    }
  };

  const formatDate = (d: string) => {
    try {
      const dateVal = new Date(d);
      if (isNaN(dateVal.getTime())) return d;
      const now = new Date();
      const diff = Math.floor(Math.abs(now.getTime() - dateVal.getTime()) / 1000 / 60);
      if (diff < 1) return 'just now';
      if (diff < 60) return `${diff}m ago`;
      if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
      return dateVal.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch { return d; }
  };

  const isLive = date && (Date.now() - new Date(date).getTime() < 30 * 60 * 1000);
  const categoryLabel = CATEGORY_LABELS[category.toLowerCase()] || category.replace('-', ' ');
  const source = getSourceLabel(sourceName, author, externalLink).toUpperCase();

  return (
    <article
      className="group nr-card overflow-hidden w-full relative"
      style={{ borderRadius: 'var(--nr-radius-card)', touchAction: 'manipulation', contentVisibility: 'auto', containIntrinsicSize: '420px' }}
    >
      <div className="flex flex-col w-full">
        <div className="w-full">
          <Link to={linkTo} onClick={handleImageClick} className="block w-full">
            <div
              className="relative w-full aspect-[2/1] overflow-hidden flex items-center justify-center"
              style={{ background: 'var(--nr-surface)', borderRadius: 'var(--nr-radius-card) var(--nr-radius-card) 0 0' }}
            >
              {hasImage ? (
                <img
                  src={imgSrc}
                  alt={title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                  onError={() => {
                    if (imgSrc !== CARD_FALLBACK_IMAGE) setCurrentImage(CARD_FALLBACK_IMAGE);
                    else setImgError(true);
                  }}
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full" style={{ color: 'var(--nr-text-muted)' }}>
                  <Image className="w-8 h-8" />
                </div>
              )}
              {showHeartPopup && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none z-10 animate-fade-in">
                  <Heart className="w-12 h-12 text-red-500 fill-red-500 animate-bounce" style={{ animationDuration: '0.5s' }} />
                </div>
              )}
              <div className="absolute top-2.5 left-2.5">
                <span className={`nr-pill nr-pill-active text-[9px] py-1 px-2.5 flex items-center gap-1 shadow-md`}>
                  {isLive && <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />}
                  {categoryLabel}
                </span>
              </div>
            </div>
          </Link>
        </div>

        <div className="px-4 pt-3.5 pb-1">
          <h3 className="nr-headline text-base leading-snug m-0">
            <Link to={linkTo} onClick={handleClick} className="text-[#F1F1F3] hover:text-amber-500 transition-colors block decoration-none">
              {decodeHTMLEntities(title)}
            </Link>
          </h3>
        </div>

        {excerpt && (
          <div className="px-4 pt-1 pb-3">
            <p className="text-xs leading-relaxed line-clamp-2 m-0" style={{ color: 'var(--nr-text-secondary)', fontFamily: 'var(--nr-font-body)' }}>
              {decodeHTMLEntities(excerpt)}
            </p>
          </div>
        )}

        {storyHash && (
          <div className="px-4 pb-3 flex gap-2 text-xs">
            <button disabled={hasVotedVerify} onClick={handleVerifyClick} className={`px-3 py-1 rounded-full flex items-center gap-1 border transition-all duration-200 cursor-pointer text-[10px] font-bold ${hasVotedVerify ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' : 'bg-white/5 text-slate-300 border-white/5 hover:bg-emerald-500/10 hover:text-emerald-400'}`}>
              ✓ {verifiedCount} Verified
            </button>
            <button disabled={hasVotedVerify} onClick={handleFlagClick} className={`px-3 py-1 rounded-full flex items-center gap-1 border transition-all duration-200 cursor-pointer text-[10px] font-bold ${hasVotedVerify ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-white/5 text-slate-300 border-white/5 hover:bg-red-500/10 hover:text-red-400'}`}>
              ⚠ {rumorCount} Rumor
            </button>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--nr-border)', margin: '0 16px' }} />

        <div className="px-4 pt-2.5 pb-3 flex items-center justify-between gap-4">
          <div className="nr-meta truncate max-w-[65%]">
            <span style={{ color: 'var(--nr-amber)', fontWeight: 700 }}>{source}</span>
            <span>·</span>
            <span>{formatDate(date)}</span>
          </div>

          <div className="flex items-center gap-3 relative shrink-0" style={{ color: 'var(--nr-text-secondary)' }}>
            {floatingBubbles.map(bubble => (
              <div key={bubble.id} className="floating-bubble" style={{ left: `${bubble.left}%` }}>
                {bubble.emoji}
              </div>
            ))}
            <button onClick={(e) => handleReaction(e, 'fire')} className={`flex items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] transition-colors ${reacted === 'fire' ? 'text-amber-500' : 'hover:text-amber-500'}`} aria-label={`React with fire. ${reactions.fire} reactions`}>
              <Flame className="w-3.5 h-3.5" />
              {reactions.fire > 0 && <span style={{ fontSize: '9px' }}>{reactions.fire}</span>}
            </button>
            <button onClick={(e) => handleReaction(e, 'heart')} className={`flex items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] transition-colors ${reacted === 'heart' ? 'text-red-500' : 'hover:text-red-500'}`} aria-label={`React with heart. ${reactions.heart} reactions`}>
              <Heart className="w-3.5 h-3.5" />
              {reactions.heart > 0 && <span style={{ fontSize: '9px' }}>{reactions.heart}</span>}
            </button>
            {showBookmark && (
              <button onClick={handleBookmark} className="flex items-center justify-center min-w-[44px] min-h-[44px] hover:text-amber-500 transition-colors" aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}>
                {isBookmarked ? <BookmarkCheck className="w-3.5 h-3.5 text-amber-500" /> : <Bookmark className="w-3.5 h-3.5" />}
              </button>
            )}
            <a href={`https://wa.me/?text=${whatsappText}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center min-w-[44px] min-h-[44px] hover:text-green-500" aria-label="Share on WhatsApp" onClick={(e) => e.stopPropagation()}>
              <span style={{ fontSize: '14px' }}>↗</span>
            </a>
          </div>
        </div>
      </div>
    </article>
  );
};

export default NewsCard;
