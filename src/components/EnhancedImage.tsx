import { useState, useRef, useEffect } from 'react';

interface EnhancedImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  fallback?: string;
  width?: number | string;
  height?: number | string;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
  priority?: boolean;
}

const EnhancedImage: React.FC<EnhancedImageProps> = ({
  src,
  alt,
  className,
  style,
  placeholder,
  fallback,
  width,
  height,
  loading = 'lazy',
  onLoad,
  onError,
  priority = false
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(priority ? src : null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);


  // Default fallback images based on content type
  const getDefaultFallback = () => {
    if (alt.toLowerCase().includes('news') || alt.toLowerCase().includes('article')) {
      return 'https://picsum.photos/seed/news/400/250';
    }
    if (alt.toLowerCase().includes('music') || alt.toLowerCase().includes('artist')) {
      return 'https://picsum.photos/seed/music/400/250';
    }
    if (alt.toLowerCase().includes('movie') || alt.toLowerCase().includes('film')) {
      return 'https://picsum.photos/seed/movie/400/250';
    }
    if (alt.toLowerCase().includes('celebrity') || alt.toLowerCase().includes('person')) {
      return 'https://picsum.photos/seed/person/400/250';
    }
    if (alt.toLowerCase().includes('nigeria') || alt.toLowerCase().includes('ghana')) {
      return 'https://picsum.photos/seed/africa/400/250';
    }
    return 'https://picsum.photos/seed/content/400/250';
  };

  const handleError = () => {
    setHasError(true);
    const fallbackImage = fallback || getDefaultFallback();
    setImageSrc(fallbackImage);
    onError?.();
  };

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || loading === 'eager') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: '50px', // Start loading 50px before visible
        threshold: 0.01
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority, loading]);

  useEffect(() => {
    if (isInView && !imageSrc) {
      setImageSrc(src);
    }
  }, [isInView, src, imageSrc]);

  useEffect(() => {
    // Reset state when src changes
    if (src !== imageSrc && isInView) {
      setImageSrc(src);
      setIsLoaded(false);
      setHasError(false);
    }
  }, [src, imageSrc, isInView]);


  // Generate blur placeholder
  const getBlurPlaceholder = () => {
    if (placeholder) return placeholder;
    // Generate a tiny blurred version or use a gradient
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 250'%3E%3Crect fill='%23f3f4f6' width='400' height='250'/%3E%3C/svg%3E`;
  };

  return (
    <div 
      ref={containerRef}
      className={`enhanced-image-container ${className || ''}`}
      style={{
        position: 'relative',
        width: width || '100%',
        height: height || 'auto',
        overflow: 'hidden',
        borderRadius: style?.borderRadius || '8px',
        backgroundColor: '#f3f4f6',
        ...style
      }}
    >
      {/* Blur Placeholder - shows immediately */}
      {!isLoaded && !hasError && (
        <div 
          className="image-placeholder"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url(${getBlurPlaceholder()})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(20px)',
            transform: 'scale(1.1)', // Prevent blur edges
            transition: 'opacity 0.3s ease-out'
          }}
        />
      )}

      {/* Loading Spinner */}
      {!isLoaded && !hasError && isInView && (
        <div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1
          }}
        >
          <div 
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid #e5e7eb',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }}
          />
        </div>
      )}


      {/* Error State */}
      {hasError && (
        <div 
          className="image-error"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            fontSize: '12px',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div>Image not available</div>
          <div 
            style={{
              fontSize: '10px',
              color: '#ef4444',
              backgroundColor: '#fecaca',
              padding: '2px 6px',
              borderRadius: '999px'
            }}
          >
            {alt}
          </div>
        </div>
      )}

      {/* Main Image - only load when in view */}
      {isInView && (
        <img
          ref={imgRef}
          src={imageSrc || ''}
          alt={alt}
          loading={loading}
          decoding="async"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'opacity 0.4s ease-out, transform 0.3s ease-out',
            opacity: isLoaded ? 1 : 0,
            transform: isLoaded ? 'scale(1)' : 'scale(1.05)',
            display: 'block'
          }}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}


      {/* Image Overlay for Better Text Readability */}
      <div 
        className="image-overlay"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '40%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
          pointerEvents: 'none',
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease-out'
        }}
      />

      {/* Alt Text as Caption (Optional) */}
      {alt && (
        <div 
          className="image-caption"
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            right: '8px',
            color: 'white',
            fontSize: '11px',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-out'
          }}
        >
          {alt}
        </div>
      )}

      {/* Add CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default EnhancedImage;
