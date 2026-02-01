import { useState } from 'react';

interface SimpleImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  fallback?: string;
  loading?: 'lazy' | 'eager';
}

const SimpleImage: React.FC<SimpleImageProps> = ({
  src,
  alt,
  className,
  style,
  fallback,
  loading = 'lazy'
}) => {
  const [imageSrc, setImageSrc] = useState(src);
  const [isLoaded, setIsLoaded] = useState(false);

  const handleError = () => {
    const fallbackImage = fallback || 'https://picsum.photos/seed/news/400/250';
    setImageSrc(fallbackImage);
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
        ...style
      }}
      loading={loading}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
};

export default SimpleImage;