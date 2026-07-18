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

const getSourceFromUrl = (urlStr?: string) => {
  if (!urlStr) return "RealSSA";
  try {
    const url = new URL(urlStr);
    const host = url.hostname.replace('www.', '');
    const domainPart = host.split('.')[0];
    if (domainPart.includes('punchng')) return 'Punch';
    if (domainPart.includes('vanguardngr')) return 'Vanguard';
    if (domainPart.includes('premiumtimesng')) return 'Premium Times';
    if (domainPart.includes('thecable')) return 'TheCable';
    if (domainPart.includes('bbc')) return 'BBC';
    if (domainPart.includes('guardian')) return 'Guardian';
    if (domainPart.includes('dailytrust')) return 'Daily Trust';
    if (domainPart.includes('saharareporters')) return 'Sahara Reporters';
    if (domainPart.includes('pulse')) return 'Pulse';
    if (domainPart.includes('aljazeera')) return 'Al Jazeera';
    if (domainPart.includes('cnn')) return 'CNN';
    if (domainPart.includes('reuters')) return 'Reuters';
    return domainPart.charAt(0).toUpperCase() + domainPart.slice(1);
  } catch (e) {
    return "RealSSA";
  }
};

const getSourceLabel = (sName?: string, auth?: string, extLink?: string) => {
  return "RealSSA News Desk";
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
}: NewsCardProps) => {
  const { toast } = useToast();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [reactions, setReactions] = useState({ fire: 0, heart: 0, wow: 0 });
  const [reacted, setReacted] = useState<string | null>(null);
  const [lastTap, setLastTap] = useState(0);
  const [showHeartPopup, setShowHeartPopup] = useState(false);

  // RealSSA Hubs & Engagement states
  const [floatingBubbles, setFloatingBubbles] = useState<{ id: number; emoji: string; left: number }[]>([]);
  const [verifiedCount, setVerifiedCount] = useState(localVerifiedCount);
  const [rumorCount, setRumorCount] = useState(rumorFlagCount);
  const [hasVotedVerify, setHasVotedVerify] = useState(false);
  const { recordRead } = useStreak();

  useEffect(() => {
    if (id) {
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
        } catch {
          try {
            setReactions(JSON.parse(cached));
          } catch {}
        }
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
        .catch(() => {});
    }
  }, [id]);

  const handleReaction = useCallback(async (e: React.MouseEvent | null, type: string) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
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

    // Trigger floating emoji bubble
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
    } catch { /* optimistic state is fine */ }
  }, [id, reacted, category]);

  const handleImageClick = (e: React.MouseEvent) => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTap < DOUBLE_PRESS_DELAY) {
      e.preventDefault();
      e.stopPropagation();
      if (reacted !== 'heart') {
        handleReaction(null, 'heart');
      }
      setShowHeartPopup(true);
      setTimeout(() => setShowHeartPopup(false), 800);
    } else {
      logCategoryPreference(category, 1);
      if (!externalLink && onRead && id) {
        onRead(id);
      }
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

  const [currentImage, setCurrentImage] = useState(image);

  useEffect(() => {
    const isLogo = isLogoPattern(image);
    if (isLogo && externalLink) {
      fetch(apiUrl('/api/extract'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: externalLink })
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.image && !isLogoPattern(data.image)) {
            setCurrentImage(data.image);
          } else {
            setImgError(true);
          }
        })
        .catch(() => {
          setImgError(true);
        });
    } else {
      setCurrentImage(image);
      setImgError(false);
    }
  }, [image, externalLink]);

  const hasImage = !!currentImage && !isLogoPattern(currentImage) && !imgError;
  const imgSrc = imgError ? '' : currentImage;

  const linkTo = externalLink
    ? `/read?url=${encodeURIComponent(externalLink)}&image=${encodeURIComponent(imgSrc || '')}&category=${encodeURIComponent(category)}&id=${encodeURIComponent(id || '')}`
    : (href || (id ? `/article/${id}` : "#"));

  const whatsappShareUrl = externalLink
    ? `https://realssanews.com.ng/read?url=${encodeURIComponent(externalLink)}&category=${encodeURIComponent(category)}&id=${encodeURIComponent(id || '')}`
    : `https://realssanews.com.ng${href || ''}`;
  const whatsappText = encodeURIComponent(`${title} — Read on RealSSA: ${whatsappShareUrl}`);

  const handleClick = (e: React.MouseEvent) => {
    logCategoryPreference(category, 1);
    recordRead();
    if (!externalLink && onRead && id) {
      onRead(id);
    }
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!id) return;
    if (!isBookmarked) {
      logCategoryPreference(category, 3);
    }
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
    toast({
      title: "Verified!",
      description: "Thanks for verifying this local update.",
    });
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
    toast({
      title: "Flagged!",
      description: "Article flagged as a potential rumor.",
    });
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
      className="group overflow-hidden transition-all duration-300 hover:shadow-xl active:scale-[0.99] w-full"
      style={{
        backgroundColor: '#211D26',
        borderRadius: '12px',
        border: '1px solid #362F3D',
        boxShadow: 'none'
      }}
    >
      <div className="flex flex-col w-full">
        {/* Image */}
        <div className="w-full">
          <Link to={linkTo} onClick={handleImageClick} className="block w-full">
            <div
              className="relative w-full aspect-video overflow-hidden flex items-center justify-center"
              style={{ backgroundColor: '#2C2732', borderRadius: '12px 12px 0 0' }}
            >
              {hasImage ? (
                <img
                  src={imgSrc}
                  alt={title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full" style={{ color: '#8C8494' }}>
                  <Image className="w-9 h-9" />
                </div>
              )}
              {/* Double-tap heart popup */}
              {showHeartPopup && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none z-10">
                  <Heart className="w-16 h-16 text-red-500 fill-red-500 animate-bounce" style={{ animationDuration: '0.6s' }} />
                </div>
              )}
              {/* Category badge overlaid on image */}
              <div className="absolute top-3 left-3">
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#fff',
                    backgroundColor: isLive ? '#4FBFA8' : '#E8874A',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {isLive && <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#fff', display: 'inline-block', animation: 'pulse 1s infinite' }} />}
                  {categoryLabel}
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Text content */}
        <div className="px-4 pt-3 pb-1">
          <h3
            style={{
              fontFamily: "'Fraunces', 'Source Serif 4', Georgia, serif",
              fontWeight: 700,
              fontSize: '17px',
              lineHeight: 1.3,
              margin: 0,
              color: '#FFFFFF',
            }}
          >
            <Link
              to={linkTo}
              onClick={handleClick}
              style={{ color: '#FFFFFF', textDecoration: 'none', display: 'block' }}
            >
              {decodeHTMLEntities(title)}
            </Link>
          </h3>
        </div>

        {excerpt && (
          <div className="px-4 pt-1 pb-3">
            <p
              style={{
                fontFamily: "inherit",
                fontWeight: 400,
                fontSize: '13px',
                lineHeight: 1.5,
                color: '#B3ABBA',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                margin: 0,
              }}
            >
              {decodeHTMLEntities(excerpt)}
            </p>
          </div>
        )}

        {storyHash && (
          <div className="px-4 pb-3 flex gap-2 text-xs">
            <button
              disabled={hasVotedVerify}
              onClick={handleVerifyClick}
              className={`px-3 py-1 rounded-full flex items-center gap-1 border transition-all duration-200 cursor-pointer text-[11px] font-bold ${
                hasVotedVerify 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                  : 'bg-muted/30 text-muted-foreground border-border hover:bg-emerald-500/10 hover:text-emerald-400'
              }`}
            >
              ✓ {verifiedCount} Verified
            </button>
            <button
              disabled={hasVotedVerify}
              onClick={handleFlagClick}
              className={`px-3 py-1 rounded-full flex items-center gap-1 border transition-all duration-200 cursor-pointer text-[11px] font-bold ${
                hasVotedVerify 
                  ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                  : 'bg-muted/30 text-muted-foreground border-border hover:bg-red-500/10 hover:text-red-400'
              }`}
            >
              ⚠ {rumorCount} Rumor
            </button>
          </div>
        )}

        <div style={{ borderTop: '1px solid #362F3D', margin: '0 16px' }} />

        {/* Metadata row */}
        <div className="px-4 pt-2 pb-3 flex items-center justify-between gap-4">
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.03em',
              color: '#8C8494',
              textTransform: 'uppercase',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '60%',
            }}
          >
            {source} · {formatDate(date)}
          </div>

          <div className="flex items-center gap-3 relative" style={{ color: '#8C8494', flexShrink: 0 }}>
            {floatingBubbles.map(bubble => (
              <div 
                key={bubble.id} 
                className="floating-bubble" 
                style={{ left: `${bubble.left}%` }}
              >
                {bubble.emoji}
              </div>
            ))}
            <button
              onClick={(e) => handleReaction(e, 'fire')}
              className={`flex items-center gap-0.5 transition-colors ${reacted === 'fire' ? 'text-amber-500' : 'hover:text-amber-500'}`}
              aria-label={`React with fire. ${reactions.fire} reactions`}
            >
              <Flame className="w-4 h-4" />
              {reactions.fire > 0 && <span style={{ fontSize: '10px' }}>{reactions.fire}</span>}
            </button>

            <button
              onClick={(e) => handleReaction(e, 'heart')}
              className={`flex items-center gap-0.5 transition-colors ${reacted === 'heart' ? 'text-red-500' : 'hover:text-red-500'}`}
              aria-label={`React with heart. ${reactions.heart} reactions`}
            >
              <Heart className="w-4 h-4" />
              {reactions.heart > 0 && <span style={{ fontSize: '10px' }}>{reactions.heart}</span>}
            </button>

            {showBookmark && (
              <button
                onClick={handleBookmark}
                className="hover:text-amber-500 transition-colors"
                aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
              >
                {isBookmarked ? (
                  <BookmarkCheck className="w-4 h-4 text-amber-500" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </button>
            )}

            <a
              href={`https://wa.me/?text=${whatsappText}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ color: 'inherit' }}
              className="hover:text-green-500 transition-colors flex items-center"
              aria-label="Share on WhatsApp"
              title="Share on WhatsApp"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </article>
  );
};

export default NewsCard;
