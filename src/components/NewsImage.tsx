import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Image as LucideImage, Loader2, RefreshCw } from 'lucide-react';
import { imageCandidates, type ImageSize } from '@/lib/image';

interface NewsImageProps {
  src: string | null | undefined;
  alt: string;
  fallbackSrc?: string;
  className?: string;
  priority?: boolean;
  loading?: 'lazy' | 'eager';
  aspectRatio?: string; // e.g., '16/9', '2/1', '4/3', '1/1'
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  onLoad?: () => void;
  onError?: () => void;
  enableParallax?: boolean;
  enableHoverZoom?: boolean;
  showPlaceholder?: boolean;
  placeholderColor?: string;
  borderRadius?: string;
  imageRecoveryEndpoint?: string; // API endpoint for image recovery
  articleId?: string;
  externalLink?: string;
  /** Resize tier for the image proxy (card default) */
  size?: ImageSize;
}

const DEFAULT_FALLBACK = '/logo.png';
const LOGO_PATTERNS = /(?:^|[\/._-])(logo|favicon|avatar|placeholder|brand-logo|site-icon|punchng.*logo|cropped-punch|PUNCH-Logo)(?:[\/._-]|$)/i;

/**
 * Check if an image URL is a logo/placeholder
 */
const isLogoOrPlaceholder = (url: string | null | undefined): boolean => {
  if (!url) return true;
  return LOGO_PATTERNS.test(url);
};

/**
 * NewsImage - Smart image component with:
 * - Automatic logo/placeholder detection
 * - Image recovery via API
 * - Parallax scroll effect
 * - Hover zoom animation
 * - Loading states with skeleton
 * - Error handling with retry
 */
export const NewsImage = ({
  src,
  alt,
  fallbackSrc = DEFAULT_FALLBACK,
  className = '',
  priority = false,
  loading = 'lazy',
  aspectRatio = '16/9',
  objectFit = 'cover',
  onLoad,
  onError,
  enableParallax = false,
  enableHoverZoom = true,
  showPlaceholder = true,
  placeholderColor = 'var(--nr-surface)',
  borderRadius = 'var(--nr-radius-card)',
  imageRecoveryEndpoint = '/api/extract',
  articleId,
  externalLink,
  size = 'card',
}: NewsImageProps) => {
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Motion values for parallax and hover effects
  const parallaxY = useMotionValue(0);
  const hoverScale = useMotionValue(1);
  const hoverRotateX = useMotionValue(0);
  const hoverRotateY = useMotionValue(0);

  // Spring animations for smooth transitions
  const springY = useSpring(parallaxY, { stiffness: 300, damping: 30 });
  const springScale = useSpring(hoverScale, { stiffness: 400, damping: 25 });
  const springRotateX = useSpring(hoverRotateX, { stiffness: 400, damping: 25 });
  const springRotateY = useSpring(hoverRotateY, { stiffness: 400, damping: 25 });

  // Transform for parallax + hover
  const transform = useTransform(
    [springY, springScale, springRotateX, springRotateY],
    ([y, scale, rx, ry]) => `translate3d(0, ${y}px, 0) scale(${scale}) rotateX(${rx}deg) rotateY(${ry}deg)`
  );

  // Candidate cascade: CDN proxy → engine → original (resilient on slow networks)
  const candidatesRef = useRef<string[]>([]);
  const candidateIdx = useRef(0);

  useEffect(() => {
    candidateIdx.current = 0;
    if (src && !isLogoOrPlaceholder(src)) {
      const list = imageCandidates(src, size);
      candidatesRef.current = list;
      setCurrentSrc(list[0] || null);
      setHasError(false);
    } else {
      candidatesRef.current = [];
      setCurrentSrc(null);
    }
    setIsLoading(true);
  }, [src, size]);

  // Attempt image recovery from article URL
  const attemptImageRecovery = useCallback(async () => {
    if (recoveryAttempted || !externalLink || !articleId) return;

    setRecoveryAttempted(true);
    try {
      const response = await fetch(imageRecoveryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: externalLink,
          fallbackTitle: alt,
          fallbackImage: src
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        const found = data?.image;
        if (found && !isLogoOrPlaceholder(found)) {
          const list = imageCandidates(found, size);
          candidatesRef.current = list;
          candidateIdx.current = 0;
          setCurrentSrc(list[0] || found);
          setHasError(false);
          setIsLoading(true);
          return;
        }
      }
    } catch (err) {
      console.debug('Image recovery failed:', err);
    }
  }, [recoveryAttempted, externalLink, articleId, alt, src, imageRecoveryEndpoint]);

  // Trigger recovery when we have a logo/placeholder
  useEffect(() => {
    if (currentSrc === null && externalLink && !recoveryAttempted) {
      attemptImageRecovery();
    }
  }, [currentSrc, externalLink, recoveryAttempted, attemptImageRecovery]);

  // Handle image load
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  }, [onLoad]);

  // Handle image error
  const handleError = useCallback(() => {
    const next = candidateIdx.current + 1;
    const list = candidatesRef.current;
    if (next < list.length) {
      candidateIdx.current = next;
      setIsLoading(true);
      setCurrentSrc(list[next]);
      return;
    }
    if (currentSrc !== fallbackSrc && fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      return;
    }
    setHasError(true);
    setIsLoading(false);
    onError?.();
  }, [currentSrc, fallbackSrc, onError]);

  // Parallax effect on scroll
  useEffect(() => {
    if (!enableParallax || !containerRef.current) return;

    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Element is in viewport
      if (rect.bottom >= 0 && rect.top <= viewportHeight) {
        const progress = (viewportHeight - rect.top) / (viewportHeight + rect.height);
        // Parallax range: -20px to +20px
        parallaxY.set((progress - 0.5) * 40);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => window.removeEventListener('scroll', handleScroll);
  }, [enableParallax, parallaxY]);

  // Hover 3D tilt effect
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!enableHoverZoom) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Rotate based on mouse position (-5deg to +5deg)
    hoverRotateY.set(((x - centerX) / centerX) * 5);
    hoverRotateX.set(((centerY - y) / centerY) * 5);
  }, [enableHoverZoom, hoverRotateX, hoverRotateY]);

  const handleMouseLeave = useCallback(() => {
    hoverRotateX.set(0);
    hoverRotateY.set(0);
    hoverScale.set(1);
  }, [hoverRotateX, hoverRotateY, hoverScale]);

  const handleMouseEnter = useCallback(() => {
    hoverScale.set(1.03);
  }, [hoverScale]);

  // Final image source to use
  const finalSrc = currentSrc || (hasError ? fallbackSrc : null);
  const showFallback = hasError && !currentSrc;
  const showSkeleton = isLoading && !hasError && !currentSrc;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden bg-muted/30',
        className
      )}
      style={{
        aspectRatio,
        borderRadius,
        backgroundColor: placeholderColor,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
    >
      {/* Skeleton Loader */}
      {showSkeleton && showPlaceholder && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{
            background: `linear-gradient(90deg, ${placeholderColor} 25%, hsl(var(--muted)) 50%, ${placeholderColor} 75%)`,
            backgroundSize: '200% 100%',
          }}
          animate={{ backgroundPosition: ['-200% 0', '200% 0'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* Error/Placeholder State */}
      {(hasError || showFallback) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground/50 p-4">
            <LucideImage className="w-8 h-8" />
            <span className="text-xs font-medium">Image unavailable</span>
            <motion.button
              onClick={() => { setHasError(false); setCurrentSrc(null); setIsLoading(true); }}
              whileTap={{ scale: 0.95 }}
              className="text-xs text-primary hover:underline"
            >
              Retry
            </motion.button>
          </div>
        </div>
      )}

      {/* Actual Image */}
      {finalSrc && (
        <motion.img
          ref={imgRef}
          src={finalSrc}
          alt={alt}
          loading={loading}
          decoding="async"
          // @ts-expect-error fetchPriority is valid in modern browsers
          fetchPriority={priority ? "high" : "auto"}
          className={cn(
            'absolute inset-0 w-full h-full transition-opacity duration-300',
            isLoading ? 'opacity-40' : 'opacity-100',
            objectFit === 'cover' && 'object-cover',
            objectFit === 'contain' && 'object-contain',
            objectFit === 'fill' && 'object-fill',
          )}
          style={{
            objectFit,
            borderRadius,
            transform: enableParallax || enableHoverZoom ? transform : undefined,
            transformOrigin: 'center center',
            willChange: enableParallax || enableHoverZoom ? 'transform' : undefined,
          }}
          onLoad={handleLoad}
          onError={handleError}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      )}

      {/* Loading Spinner */}
      {isLoading && !hasError && currentSrc && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * HeroImage - Larger image for hero sections with enhanced effects
 */
export const HeroImage = ({
  src,
  alt,
  fallbackSrc = DEFAULT_FALLBACK,
  className = '',
  ...props
}: NewsImageProps) => {
  return (
    <NewsImage
      src={src}
      alt={alt}
      fallbackSrc={fallbackSrc}
      className={cn('rounded-2xl', className)}
      aspectRatio="16/9"
      enableParallax={true}
      enableHoverZoom={true}
      priority={true}
      loading="eager"
      size="hero"
      {...props}
    />
  );
};

/**
 * ThumbnailImage - Small image for lists/cards
 */
export const ThumbnailImage = ({
  src,
  alt,
  fallbackSrc = DEFAULT_FALLBACK,
  className = '',
  ...props
}: NewsImageProps) => {
  return (
    <NewsImage
      src={src}
      alt={alt}
      fallbackSrc={fallbackSrc}
      className={cn('rounded-xl', className)}
      aspectRatio="16/9"
      enableHoverZoom={true}
      enableParallax={false}
      loading="lazy"
      size="card"
      {...props}
    />
  );
};

/**
 * SquareImage - 1:1 aspect ratio for profile/avatar-like images
 */
export const SquareImage = ({
  src,
  alt,
  fallbackSrc = DEFAULT_FALLBACK,
  className = '',
  ...props
}: NewsImageProps) => {
  return (
    <NewsImage
      src={src}
      alt={alt}
      fallbackSrc={fallbackSrc}
      className={cn('rounded-full', className)}
      aspectRatio="1/1"
      objectFit="cover"
      enableHoverZoom={false}
      enableParallax={false}
      {...props}
    />
  );
};

export default NewsImage;