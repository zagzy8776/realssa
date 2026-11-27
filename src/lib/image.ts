import { RUST_ENGINE_URL } from '@/lib/api-base';

export type ImageSize = 'thumb' | 'card' | 'hero' | 'full';

const WIDTHS: Record<ImageSize, number> = {
  thumb: 280,
  card: 560,
  hero: 1100,
  full: 1600,
};

const QUALITY: Record<ImageSize, number> = {
  thumb: 55,
  card: 65,
  hero: 75,
  full: 80,
};

function toAbsolute(url: string): string {
  const t = url.trim();
  if (t.startsWith('//')) return `https:${t}`;
  return t;
}

/** Absolute URLs that are already optimized or local */
export function shouldSkipProxy(url: string): boolean {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return true;
  if (url.startsWith('/')) return true;
  try {
    const host = new URL(toAbsolute(url)).hostname;
    if (
      host === 'engine.realssanews.com.ng' ||
      host.endsWith('.fly.dev') ||
      host === 'images.weserv.nl' ||
      host === 'wsrv.nl' ||
      host === 'cdn.realssanews.com.ng'
    ) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

/** Pull original remote URL out of a proxy URL if present */
export function unwrapImageUrl(src: string | null | undefined): string {
  if (!src) return '';
  try {
    const u = new URL(toAbsolute(src));
    if (
      u.hostname === 'engine.realssanews.com.ng' ||
      u.hostname.endsWith('.fly.dev')
    ) {
      const inner = u.searchParams.get('url');
      if (inner) return inner;
    }
    if (u.hostname === 'images.weserv.nl' || u.hostname === 'wsrv.nl') {
      const inner = u.searchParams.get('url');
      if (inner) return inner.startsWith('http') ? inner : `https://${inner}`;
    }
  } catch { /* ignore */ }
  return src;
}

/**
 * RealSSA engine proxy — WebP + resize (best when warm).
 */
export function engineProxyUrl(src: string, size: ImageSize = 'card'): string {
  const absolute = toAbsolute(src);
  const w = WIDTHS[size] ?? 560;
  const q = QUALITY[size] ?? 65;
  const base = (RUST_ENGINE_URL || 'https://engine.realssanews.com.ng').replace(/\/$/, '');
  return `${base}/img?url=${encodeURIComponent(absolute)}&w=${w}&q=${q}`;
}

/**
 * Cloudflare-backed weserv — global edge, great for Africa/EU/US cold starts.
 */
export function weservProxyUrl(src: string, size: ImageSize = 'card'): string {
  const absolute = toAbsolute(src).replace(/^https?:\/\//, '');
  const w = WIDTHS[size] ?? 560;
  const q = QUALITY[size] ?? 65;
  return `https://images.weserv.nl/?url=${encodeURIComponent(absolute)}&w=${w}&q=${q}&output=webp&we`;
}

/**
 * Primary optimized URL for <img src>.
 * Prefer weserv for speed/reliability under concurrent feed load;
 * engine remains available via engineProxyUrl for retry cascade.
 */
export function optimizeImageUrl(
  src: string | null | undefined,
  size: ImageSize = 'card'
): string {
  if (!src) return '';
  const trimmed = src.trim();
  if (!trimmed || shouldSkipProxy(trimmed)) return trimmed;

  try {
    const absolute = toAbsolute(trimmed);
    const u = new URL(absolute);
    if (!['http:', 'https:'].includes(u.protocol)) return trimmed;
    // weserv first — handles concurrent home-feed load better than a single Fly machine
    return weservProxyUrl(absolute, size);
  } catch {
    return trimmed;
  }
}

/** Ordered candidates for resilient loading */
export function imageCandidates(
  src: string | null | undefined,
  size: ImageSize = 'card'
): string[] {
  if (!src) return [];
  const original = unwrapImageUrl(src.trim());
  if (!original) return [];
  if (shouldSkipProxy(original) || original.startsWith('/')) return [original];

  const list: string[] = [];
  try {
    list.push(weservProxyUrl(original, size));
    list.push(engineProxyUrl(original, size));
    list.push(original);
  } catch {
    list.push(original);
  }
  // unique preserve order
  return [...new Set(list.filter(Boolean))];
}

export function optimizeImagePlaceholder(src: string | null | undefined): string {
  return optimizeImageUrl(src, 'thumb');
}
