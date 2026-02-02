import { useState, useEffect } from 'react';

interface SimpleImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  fallback?: string;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
}

const SimpleImage: React.FC<SimpleImageProps> = ({
  src,
  alt,
  className,
  style,
  fallback,
  loading = 'lazy',
  priority = false
}) => {
  const [imageSrc, setImageSrc] = useState(src);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImageSrc(src);
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    const fallbackImage = fallback || 'https://picsum.photos/seed/news/400/250';
    setImageSrc(fallbackImage);
    setHasError(true);
  };

  const handleLoad = () => {
    setIsLoaded(true);
  };

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transition: 'opacity 0.3s ease-in-out',
        opacity: isLoaded ? 1 : 0,
        display: 'block',
        filter: hasError ? 'grayscale(100%)' : 'none',
        ...style
      }}
      loading={priority ? 'eager' : loading}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
};

export default SimpleImage;
