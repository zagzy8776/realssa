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
  const [imageSrc, setImageSrc] = useState(src);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Default fallback images based on content type
  const getDefaultFallback = () => {
    if (alt.toLowerCase().includes('news') || alt.toLowerCase().includes('article')) {
      return 'https://via.placeholder.com/400x250?text=News+Image';
    }
    if (alt.toLowerCase().includes('music') || alt.toLowerCase().includes('artist')) {
      return 'https://via.placeholder.com/400x250?text=Music+Artist';
    }
    if (alt.toLowerCase().includes('movie') || alt.toLowerCase().includes('film')) {
      return 'https://via.placeholder.com/400x250?text=Movie+Poster';
    }
    if (alt.toLowerCase().includes('celebrity') || alt.toLowerCase().includes('person')) {
      return 'https://via.placeholder.com/400x250?text=Person+Image';
    }
    if (alt.toLowerCase().includes('nigeria') || alt.toLowerCase().includes('ghana')) {
      return 'https://via.placeholder.com/400x250?text=African+Content';
    }
    return 'https://via.placeholder.com/400x250?text=Content+Image';
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

  useEffect(() => {
    // Reset state when src changes
    setImageSrc(src);
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  return (
    <div 
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
      {/* Loading/Placeholder State */}
      {!isLoaded && !hasError && (
        <div 
          className="image-placeholder"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f9fafb',
            color: '#9ca3af',
            fontSize: '12px'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '8px' }}>Loading image...</div>
            <div 
              style={{
                width: '40px',
                height: '4px',
                backgroundColor: '#e5e7eb',
                borderRadius: '2px',
                margin: '0 auto'
              }}
            >
              <div 
                style={{
                  height: '100%',
                  width: '0%',
                  backgroundColor: '#2563eb',
                  transition: 'width 0.3s ease-in-out',
                  animation: 'loading 1.5s ease-in-out infinite'
                }}
              ></div>
            </div>
          </div>
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

      {/* Main Image */}
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transition: 'opacity 0.3s ease-in-out',
          opacity: isLoaded ? 1 : 0,
          display: 'block'
        }}
        onLoad={handleLoad}
        onError={handleError}
      />

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
          pointerEvents: 'none'
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
            transition: 'opacity 0.3s ease-in-out'
          }}
        >
          {alt}
        </div>
      )}
    </div>
  );
};

export default EnhancedImage;