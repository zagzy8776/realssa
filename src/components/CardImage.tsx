import { useEffect, useRef, useState } from 'react';
import { imageCandidates } from '@/lib/image';

interface CardImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  /** Prefer original URL first (like Hero) for speed; cascade on error */
  preferOriginal?: boolean;
}

/**
 * Lightweight card image — same reliability model as HeroSection.
 * 1) Try original (referrerPolicy=no-referrer)
 * 2) Then CDN / engine proxies from imageCandidates
 * 3) Never leave a pure-black hole: soft gradient fallback
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

    const proxied = imageCandidates(src, 'card');
    // Original first (hero-style) — often works and is fastest when CDN is cold
    const original = src.startsWith('//') ? `https:${src}` : src;
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

  if (failed || !current) {
    return (
      <div
        className={`w-full h-full min-h-[120px] bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 ${className}`}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={current}
      alt={alt}
      className={`w-full h-full object-cover transition-opacity duration-300 ${
        loaded ? 'opacity-100' : 'opacity-70'
      } ${className}`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={onError}
    />
  );
}
