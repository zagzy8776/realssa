import { useEffect, useRef, useState } from 'react';
import { imageCandidates } from '@/lib/image';

interface CardImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  preferOriginal?: boolean;
}

/**
 * Fills parent (must be position:relative + aspect-ratio).
 * Uses absolute inset-0 so height never collapses before the image loads
 * (the old w-full/h-full flex child bug left Discover Feed cards blank).
 */
export default function CardImage({
  src,
  alt,
  className = '',
  preferOriginal = true,
}: CardImageProps) {
  const [candidates, setCandidates] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const idxRef = useRef(0);

  useEffect(() => {
    idxRef.current = 0;
    setLoaded(false);
    setFailed(false);

    if (!src || src === '/logo.png') {
      setCandidates([]);
      setIdx(0);
      setFailed(true);
      return;
    }

    const original = src.startsWith('//') ? `https:${src}` : src;
    const proxied = imageCandidates(original, 'card');
    const list = preferOriginal
      ? [original, ...proxied.filter((u) => u !== original)]
      : proxied.length
        ? proxied
        : [original];

    setCandidates([...new Set(list.filter(Boolean))]);
    setIdx(0);
  }, [src, preferOriginal]);

  const current = candidates[idx];

  const onError = () => {
    const next = idxRef.current + 1;
    if (next < candidates.length) {
      idxRef.current = next;
      setIdx(next);
      setLoaded(false);
      return;
    }
    setFailed(true);
  };

  // Always fill the aspect-ratio parent
  if (failed || !current) {
    return (
      <div
        className={`absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 ${className}`}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={current}
      alt={alt}
      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
        loaded ? 'opacity-100' : 'opacity-80'
      } ${className}`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={onError}
    />
  );
}
