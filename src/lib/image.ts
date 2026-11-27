import { RUST_ENGINE_URL } from '@/lib/api-base';

export type ImageSize = 'thumb' | 'card' | 'hero' | 'full';

const WIDTHS: Record<ImageSize, number> = {
  thumb: 320,
  card: 640,
  hero: 1200,
  full: 1600,
};

const QUALITY: Record<ImageSize, number> = {
  thumb: 60,
  card: 70,
  hero: 78,
  full: 82,
};

/** Absolute URLs that are already on our engine or data/blob — leave alone */
function shouldSkipProxy(url: string): boolean {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return true;
  if (url.startsWith('/')) return true; // same-origin assets e.g. /logo.png
  try {
    const host = new URL(url).hostname;
    if (
      host === 'engine.realssanews.com.ng' ||
      host.endsWith('.fly.dev') ||
      host === 'images.weserv.nl' ||
      host === 'wsrv.nl'
    ) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

/**
 * Route remote images through RealSSA engine /img for:
 * - WebP conversion
 * - Resize (much smaller bytes on slow networks)
 * - Hotlink / CORS bypass
 *
 * Falls back to original URL if anything looks unsafe.
 */
export function optimizeImageUrl(
  src: string | null | undefined,
  size: ImageSize = 'card'
): string {
  if (!src) return '';
  const trimmed = src.trim();
  if (!trimmed || shouldSkipProxy(trimmed)) return trimmed;

  // Protocol-relative
  const absolute = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;

  try {
    // Validate URL
    const u = new URL(absolute);
    if (!['http:', 'https:'].includes(u.protocol)) return trimmed;

    const w = WIDTHS[size] ?? 640;
    const q = QUALITY[size] ?? 70;
    const base = (RUST_ENGINE_URL || 'https://engine.realssanews.com.ng').replace(/\/$/, '');
    return `${base}/img?url=${encodeURIComponent(absolute)}&w=${w}&q=${q}`;
  } catch {
    return trimmed;
  }
}

/** Low-res blur-up companion (tiny width) for progressive feel */
export function optimizeImagePlaceholder(src: string | null | undefined): string {
  return optimizeImageUrl(src, 'thumb');
}
